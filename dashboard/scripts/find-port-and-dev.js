#!/usr/bin/env node
/**
 * Starts Next dev: uses .shimwrappercheck-ui.json (portAuto/port) if present,
 * otherwise finds first free port from 3000 upward.
 */
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");
const net = require("net");

function getProjectRoot() {
  const cwd = process.cwd();
  const name = path.basename(cwd);
  if (name === "dashboard") return path.resolve(cwd, "..");
  return cwd;
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

const uiConfig = readUiConfig();
const startPort = parseInt(process.env.PORT || String(uiConfig.port || 3000), 10);

function tryPort(port, cb) {
  const server = net.createServer();
  server.once("error", () => tryPort(port + 1, cb));
  server.once("listening", () => {
    server.close(() => cb(port));
  });
  server.listen(port);
}

function runDev(port) {
  const url = `http://localhost:${port}`;
  // Dev script: show URL for user (no shell to avoid DEP0190 and proper arg escaping)
  process.stdout.write(`Dashboard: ${url}\n`);
  const cwd = path.join(__dirname, "..");
  const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next");
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    cwd,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });
  child.on("exit", (code) => process.exit(code || 0));
}

if (uiConfig.portAuto) {
  tryPort(startPort, runDev);
} else {
  runDev(startPort);
}
