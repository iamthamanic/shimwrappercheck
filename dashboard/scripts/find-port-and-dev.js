#!/usr/bin/env node
/**
 * Starts Next dev: uses .shimwrappercheck-ui.json (portAuto/port) if present.
 * Finds first free port from startPort. Writes .shimwrappercheck-dashboard.lock with port.
 * If lock exists and that port responds on /api/info → "Dashboard already running at URL".
 * Use --restart to kill the existing process and start a new one.
 */
const path = require("path");
const fs = require("fs");
const { spawn, execSync } = require("child_process");
const net = require("net");
const http = require("http");

const LOCK_FILE = ".shimwrappercheck-dashboard.lock";
const MAX_PORT = 65535;
const PRIVILEGED_PORT_MAX = 1023;

function getProjectRoot() {
  const cwd = process.cwd();
  const name = path.basename(cwd);
  if (name === "dashboard") return path.resolve(cwd, "..");
  return cwd;
}

function getLockPath() {
  return path.join(getProjectRoot(), LOCK_FILE);
}

function readLock() {
  try {
    const p = getLockPath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      if (typeof data.port === "number" && data.port > 0) return data.port;
    }
  } catch {
    // ignore
  }
  return null;
}

function writeLock(port) {
  try {
    fs.writeFileSync(getLockPath(), JSON.stringify({ port }) + "\n", "utf8");
  } catch {
    // ignore
  }
}

function removeLock() {
  try {
    const p = getLockPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
}

function isDashboardRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/info`, { timeout: 2000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          resolve(typeof data.version === "string");
        } catch {
          resolve(false);
        }
      });
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

function killProcessOnPort(port) {
  try {
    if (process.platform === "win32") return false;
    const pid = execSync(`lsof -ti :${port}`, { encoding: "utf8" }).trim();
    if (pid) {
      execSync(`kill ${pid}`, { stdio: "ignore" });
      return true;
    }
  } catch {
    // no process or lsof/kill failed (e.g. Windows)
  }
  return false;
}

function readUiConfig() {
  try {
    const root = getProjectRoot();
    const p = path.join(root, ".shimwrappercheck-ui.json");
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      return {
        portAuto: data.portAuto !== false,
        port: typeof data.port === "number" && data.port > 0 ? data.port : 3000,
      };
    }
  } catch {
    // ignore
  }
  return { portAuto: true, port: 3000 };
}

const wantRestart = process.argv.includes("--restart");
const uiConfig = readUiConfig();
const envPort = process.env.PORT;
const rawStartPort = envPort ? Number(envPort) : Number(uiConfig.port || 3000);

function normalizeStartPort(port) {
  if (!Number.isFinite(port)) return 3000;
  if (port < 1) return 1;
  if (port > MAX_PORT) return MAX_PORT;
  return Math.trunc(port);
}

function runDev(port) {
  const url = `http://localhost:${port}`;
  process.stdout.write(`Dashboard: ${url}\n`);
  const cwd = path.join(__dirname, "..");
  const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
  writeLock(port);
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    cwd,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });
  child.on("exit", (code) => {
    removeLock();
    process.exit(code || 0);
  });
}

function portRangeFor(startPort) {
  const minPort = startPort > PRIVILEGED_PORT_MAX ? PRIVILEGED_PORT_MAX + 1 : 1;
  return { minPort, maxPort: MAX_PORT };
}

function nextPortInRange(startPort, minPort, maxPort, offset) {
  const range = maxPort - minPort + 1;
  const normalizedStart = startPort - minPort;
  return minPort + ((normalizedStart + offset) % range);
}

function canListenOnPort(port) {
  return new Promise((resolve) => {
    let resolved = false;

    const finish = (result) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    const tryListen = (host, onUnsupported) => {
      const server = net.createServer();
      server.once("error", (err) => {
        const code = err && err.code ? err.code : "UNKNOWN";
        if ((code === "EADDRNOTAVAIL" || code === "EAFNOSUPPORT") && typeof onUnsupported === "function") {
          onUnsupported();
          return;
        }
        finish({ free: false, code });
      });
      server.once("listening", () => {
        server.close(() => finish({ free: true }));
      });
      if (typeof host === "string") {
        server.listen(port, host);
      } else {
        server.listen(port);
      }
    };

    const hosts = ["::", "127.0.0.1", "::1"];
    let index = 0;

    const nextHost = () => {
      if (index >= hosts.length) {
        finish({ free: true });
        return;
      }
      const host = hosts[index];
      index += 1;
      tryListen(host, () => nextHost());
    };

    nextHost();
  });
}

async function findAvailablePort(startPort) {
  const { minPort, maxPort } = portRangeFor(startPort);
  const range = maxPort - minPort + 1;
  for (let offset = 0; offset < range; offset += 1) {
    const candidate = nextPortInRange(startPort, minPort, maxPort, offset);
    const result = await canListenOnPort(candidate);
    if (result.free) return candidate;
    if (result.code === "EPERM" || result.code === "EACCES") {
      throw new Error(
        "Cannot bind to ports (EPERM/EACCES). This environment blocks opening sockets; start the dashboard locally or outside the sandbox."
      );
    }
  }
  throw new Error(`No free ports available between ${minPort} and ${maxPort}.`);
}

async function main() {
  const lockedPort = readLock();
  if (lockedPort != null) {
    const running = await isDashboardRunning(lockedPort);
    if (running) {
      const url = `http://localhost:${lockedPort}`;
      if (wantRestart) {
        killProcessOnPort(lockedPort);
        removeLock();
        process.stdout.write(`Stopped dashboard on port ${lockedPort}. Starting new instance...\n`);
        await new Promise((r) => setTimeout(r, 500));
      } else {
        process.stdout.write(`Dashboard already running: ${url}\n`);
        process.stdout.write(`To restart, run: npm run dashboard -- --restart\n`);
        process.exit(0);
      }
    } else {
      removeLock();
    }
  }

  const startPort = normalizeStartPort(rawStartPort);
  if (uiConfig.portAuto) {
    try {
      const port = await findAvailablePort(startPort);
      runDev(port);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`${message}\n`);
      process.exit(1);
    }
  } else {
    runDev(startPort);
  }
}

main();
