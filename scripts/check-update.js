/**
 * check-update: prüft, ob eine neuere Version von shimwrappercheck auf npm verfügbar ist.
 * Zweck: Agenten und Nutzer sollen wissen, ob sie ein Update verpassen.
 * Problem: Ohne dieses Modul läuft der Agent möglicherweise lange Zeit auf einer veralteten Version, ohne es zu merken.
 * Eingabe: currentVersion (optional, sonst aus package.json). Ausgabe: { current, latest, outdated, message }.
 *
 * Sichere Ausführung: npm view läuft mit execFile im Hintergrund; bei Netzwerkfehlern oder Timeout wird gracefully ein leeres Ergebnis zurückgegeben, damit der Agent nicht hängt.
 */
const { execFile } = require("child_process");
const { promisify } = require("util");
const fs = require("fs");
const path = require("path");

const execFileAsync = promisify(execFile);

/**
 * currentVersion: Liest die lokale Version aus dem package.json von shimwrappercheck.
 * Zweck: Wir brauchen eine Vergleichsbasis. Ohne diese Funktion kennt das Modul seine eigene Versionsnummer nicht.
 * Ausgabe: string (z. B. "0.4.18") oder "0.0.0" als Fallback.
 */
function currentVersion() {
  try {
    const pkgPath = path.join(__dirname, "..", "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      return pkg.version || "0.0.0";
    }
  } catch {
    // Datei nicht lesbar oder kein JSON
  }
  return "0.0.0";
}

/**
 * fetchLatestVersion: Fragt npm nach der aktuellsten Version.
 * Zweck: Soll die remote Version ermitteln. Ohne diesen Call gibt es keinen Vergleich.
 * Problem: npm view kann langsam sein, oder offline nicht erreichbar.
 * Lösung: Timeout 8s, bei Fehler/Timeout wird null zurückgegeben. execFile statt exec (kein Shell-Injektions-Risiko).
 * Ausgabe: string | null.
 */
async function fetchLatestVersion() {
  try {
    const { stdout } = await execFileAsync(
      "npm",
      [
        "view",
        "shimwrappercheck",
        "version",
        "--registry",
        "https://registry.npmjs.org/",
      ],
      { timeout: 8000, encoding: "utf8" },
    );
    const v = stdout.trim();
    return v || null;
  } catch {
    return null;
  }
}

/**
 * isOutdated: Vergleicht zwei Versionsstrings (simples Split auf Punkte).
 * Zweck: Semver-Vergleich ohne riesige Dependency. Ohne diese Funktion wüssten wir nicht, ob latest > current.
 * Eingabe: a, b (strings wie "0.4.18"). Ausgabe: true wenn b > a.
 */
function isOutdated(current, latest) {
  if (!current || !latest) return false;
  const ca = current.split(".").map((n) => parseInt(n, 10) || 0);
  const lb = latest.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(ca.length, lb.length); i++) {
    const av = ca[i] || 0;
    const bv = lb[i] || 0;
    if (bv > av) return true;
    if (av > bv) return false;
  }
  return false;
}

/**
 * checkUpdate: Führt den gesamten Check-Update-Fluss aus.
 * Zweck: Zentrale Funktion für CLI, Dashboard und MCP.
 * Eingabe: options? { current?: string }.
 * Ausgabe: { current: string, latest: string|null, outdated: boolean, message: string }.
 */
async function checkUpdate(options = {}) {
  const cur = options.current || currentVersion();
  const latest = await fetchLatestVersion();
  const outdated = isOutdated(cur, latest);

  let message = "shimwrappercheck is up to date.";
  if (latest === null) {
    message = "Could not check for updates (npm unavailable or offline).";
  } else if (outdated) {
    message = `Update available: ${cur} -> ${latest}. Run "npm i -D shimwrappercheck@latest" to update.`;
  }

  return { current: cur, latest, outdated, message };
}

module.exports = { checkUpdate, currentVersion, fetchLatestVersion };
