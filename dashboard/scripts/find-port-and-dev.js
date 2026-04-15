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

const LOCK_FILE = ".shimwrappercheck-dashboard.lock"; // Dateiname der Lock-Datei; ohne wäre der Name an mehreren Stellen hardcoded.
const MAX_PORT = 65535; // Maximaler TCP-Port; ohne wäre die Obergrenze undefiniert.
const PRIVILEGED_PORT_MAX = 1023; // Ports unter 1024 sind privilegiert; ohne könnte die Range-Logik falsch sein.

/**
 * getProjectRoot: Ermittelt das Projekt-Root (Parent von dashboard/ oder cwd).
 * Zweck: Lock-Datei und UI-Config liegen im Projekt-Root. Problem: Ohne wäre nicht klar, wo .lock und .shimwrappercheck-ui.json liegen. Eingabe: keine. Ausgabe: absoluter Pfad (string).
 */
function getProjectRoot() {
  const cwd = process.cwd(); // Aktuelles Arbeitsverzeichnis; ohne wäre die Erkennung "dashboard" nicht möglich.
  const name = path.basename(cwd);
  if (name === "dashboard") return path.resolve(cwd, ".."); // Wenn wir in dashboard/ sind, Root = Parent; ohne würde Lock ins Dashboard geschrieben.
  return cwd;
}

/**
 * getLockPath: Liefert den vollen Pfad zur Lock-Datei.
 * Zweck: Ein zentraler Ort für den Lock-Pfad. Problem: Ohne wäre der Pfad an mehreren Stellen dupliziert. Eingabe: keine. Ausgabe: string (Pfad).
 */
function getLockPath() {
  return path.join(getProjectRoot(), LOCK_FILE);
}

/**
 * readLock: Liest die gespeicherte Port-Nummer aus der Lock-Datei.
 * Zweck: Prüfen ob bereits eine Instanz läuft. Problem: Ohne könnten mehrere Dashboard-Instanzen starten. Eingabe: keine. Ausgabe: number | null.
 */
function readLock() {
  try {
    const p = getLockPath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf8")); // Lock-Inhalt parsen; ohne wäre nur Roh-Text.
      if (typeof data.port === "number" && data.port > 0) return data.port; // Nur gültige Port-Zahl zurückgeben; ohne könnten ungültige Werte genutzt werden.
    }
  } catch {
    // ignore — Lock defekt oder nicht lesbar; dann so tun als gäbe es keine Lock.
  }
  return null;
}

/**
 * writeLock: Schreibt die Port-Nummer in die Lock-Datei.
 * Zweck: Folgestarts erkennen "already running". Problem: Ohne würde jeder Start eine neue Instanz erzeugen. Eingabe: port (number). Ausgabe: keins.
 */
function writeLock(port) {
  try {
    fs.writeFileSync(getLockPath(), JSON.stringify({ port }) + "\n", "utf8");
  } catch {
    // ignore — Schreiben fehlgeschlagen (z. B. keine Schreibrechte); Start trotzdem erlauben.
  }
}

/**
 * removeLock: Entfernt die Lock-Datei.
 * Zweck: Beim Beenden des Servers Lock freigeben. Problem: Ohne bliebe Lock liegen und Neustart meldet fälschlich "already running". Eingabe: keine. Ausgabe: keins.
 */
function removeLock() {
  try {
    const p = getLockPath();
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
}

/**
 * isDashboardRunning: Prüft ob unter dem Port ein Dashboard (/api/info mit version) antwortet.
 * Zweck: Lock könnte von abgestürztem Prozess stammen; dann neu starten. Problem: Ohne könnten wir "already running" melden obwohl nichts läuft. Eingabe: port (number). Ausgabe: Promise<boolean>.
 */
function isDashboardRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/info`, { timeout: 2000 }, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const data = JSON.parse(body);
          resolve(typeof data.version === "string"); // Nur echte Dashboard-API hat version; ohne würden andere Dienste als Dashboard erkannt.
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

/**
 * killProcessOnPort: Beendet den Prozess, der den Port belegt (nur Unix; unter Windows no-op).
 * Zweck: --restart soll alte Instanz beenden. Problem: Ohne würde Restart den Port nicht freigeben. Eingabe: port (number). Ausgabe: boolean (ob etwas beendet wurde).
 */
function killProcessOnPort(port) {
  try {
    if (process.platform === "win32") return false; // lsof/kill unter Windows nicht zuverlässig; ohne würden Windows-Nutzer Fehler sehen.
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

/**
 * readUiConfig: Liest .shimwrappercheck-ui.json (portAuto, port) aus Projekt-Root.
 * Zweck: Nutzer kann Port und portAuto konfigurieren. Problem: Ohne wären nur Env/Default möglich. Eingabe: keine. Ausgabe: { portAuto: boolean, port: number }.
 */
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
  return { portAuto: true, port: 3000 }; // Default: Auto-Port, Start 3000; ohne wäre das Verhalten undefiniert.
}

const wantRestart = process.argv.includes("--restart"); // --restart: bestehende Instanz beenden und neu starten; ohne würde nur "already running" ausgegeben.
const uiConfig = readUiConfig();
const envPort = process.env.PORT; // Env hat Vorrang vor UI-Config; ohne wäre PORT nicht nutzbar.
const rawStartPort = envPort ? Number(envPort) : Number(uiConfig.port || 3000);

/**
 * normalizeStartPort: Bringt Port in gültigen Bereich [1, MAX_PORT].
 * Zweck: Ungültige Werte (NaN, 0, negativ, >65535) vermeiden. Problem: Ohne könnte listen() fehlschlagen. Eingabe: port (number). Ausgabe: number.
 */
function normalizeStartPort(port) {
  if (!Number.isFinite(port)) return 3000;
  if (port < 1) return 1;
  if (port > MAX_PORT) return MAX_PORT;
  return Math.trunc(port);
}

/**
 * runDev: Startet Next.js dev-Server im Dashboard-Verzeichnis.
 * Zweck: Next muss im Paket-Dashboard laufen, sonst baut es das Host-Projekt (fehlendes @/i18n/navigation). Ohne Prüfung würde falscher Build laufen.
 * Eingabe: port (Nummer). Ausgabe: keins (Prozess läuft bis Exit).
 */
function runDev(port) {
  const cwd = path.resolve(path.join(__dirname, "..")); // Absoluter Pfad, damit Next.js garantiert dieses Verzeichnis als Projekt-Root nutzt (nicht das Host-Projekt bei Installation in node_modules).
  // Marker-Datei: i18n/navigation.ts existiert nur im Paket-Dashboard. Hard-Fail bei Fehlen ist gewollt, damit nie im falschen Verzeichnis gebaut wird (Kopplung an diese Datei akzeptiert).
  const i18nNav = path.join(cwd, "i18n", "navigation.ts");
  if (!fs.existsSync(i18nNav)) {
    process.stderr.write(
      "Error: Dashboard must run from the shimwrappercheck package directory.\n" +
        "  Current cwd has no i18n/navigation.ts (expected in dashboard/).\n" +
        "  From your project, run: npx shimwrappercheck dashboard\n" +
        "  Do not run your project's 'npm run dev' to start the shimwrappercheck UI.\n"
    );
    process.exit(1); // Ohne Exit würde Next im falschen Verzeichnis starten und Build-Fehler erzeugen.
  }
  const url = `http://localhost:${port}`;
  process.stdout.write(`\nDashboard: ${url}\n`);
  process.stdout.write(`Open in browser: ${url}/de or ${url}/en\n\n`);
  const nextBin = path.join(cwd, "node_modules", "next", "dist", "bin", "next"); // Next-Binary aus Dashboard-node_modules; ohne würde system-next oder Host-Projekt genutzt.
  writeLock(port); // Lock schreiben, damit zweiter Start "already running" meldet; ohne würden mehrere Instanzen kollidieren.
  const child = spawn(process.execPath, [nextBin, "dev", "-p", String(port)], {
    cwd,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });
  child.on("exit", (code) => {
    removeLock(); // Lock entfernen bei Beendigung; ohne bliebe Lock liegen und Neustart würde blocken.
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
    const result = await canListenOnPort(startPort);
    if (result.free) {
      runDev(startPort);
    } else {
      process.stderr.write(`Port ${startPort} is in use. Finding next available port...\n`);
      try {
        const port = await findAvailablePort(startPort);
        process.stderr.write(
          `Dashboard started at http://localhost:${port} (configured port ${startPort} was busy).\n`
        );
        runDev(port);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(`${message}\n`);
        process.exit(1);
      }
    }
  }
}

main();
