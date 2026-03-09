#!/usr/bin/env node
/**
 * CLI-Einstiegspunkt für shimwrappercheck. Leitet Befehle an die passenden Script-Module weiter.
 * Zweck: Einheitlicher Einstieg für npx shimwrappercheck <cmd> und installierte Shims (-- git/supabase/shim).
 * Problem: Ohne dieses Dispatch-Script müssten Nutzer einzelne Skripte direkt aufrufen und die Argumentlogik selbst handhaben.
 * Location: scripts/cli.js
 */
const path = require("path"); // Pfad-Operationen für Script-Pfade nutzen; ohne können wir __dirname nicht zu relativen Modulpfaden zusammensetzen.

// Wenn installierte Shims "npx shimwrappercheck@latest -- git ..." aufrufen, steht in argv[2] "--" und in argv[3] der echte Befehl.
let cmd = process.argv[2]; // Rohen ersten Argumentwert als Befehlskandidat lesen; ohne wüssten wir nicht, welcher Subbefehl gemeint ist.
let restArgs = process.argv.slice(3); // Alle weiteren Argumente für das delegierte Script vorbereiten; ohne gingen Optionen und Ziele des Aufrufers verloren.
// Prüfen, ob Aufruf über Shim mit "--" erfolgte (npx shimwrappercheck@latest -- git push).
if (
  cmd === "--" && // Erstes Token ist "--"; ohne würden wir "git" nie als Befehl hinter dem Delimiter erkennen.
  process.argv[3] && // Es gibt ein drittes Argument; ohne wäre process.argv[3] undefined und includes würde falsch matchen.
  ["git", "supabase", "shim"].includes(process.argv[3]) // Nur diese drei Befehle kommen mit "--" vom Shim; ohne könnten andere Tokens fälschlich übernommen werden.
) {
  // Shim-Aufruf erkannt: Befehl und Rest-Argumente aus argv extrahieren.
  cmd = process.argv[3]; // Echten Befehl hinter dem "--" übernehmen; ohne bleibt cmd auf "--" und der Dispatch schlägt fehl.
  restArgs = process.argv.slice(4); // Argumente hinter dem Befehl (z. B. "push") für das Check-Script weiterreichen; ohne fehlen sie dem git-checked/supabase-Check.
}

if (cmd === "setup") {
  // Setup-Befehl explizit abfangen; ohne würde kein Pfad zu setup.js gesetzt und das Modul nicht gefunden.
  process.argv = [
    process.argv[0], // Node-Binary beibehalten; ohne könnte das Kindmodul mit falschem Interpreter starten.
    path.join(__dirname, "setup.js"), // Absoluten Pfad zum Setup-Script bauen; ohne findet require das Modul bei wechselndem CWD nicht.
    ...restArgs, // Vom Nutzer übergebene Zusatzargumente durchreichen; ohne ignoriert Setup z. B. Flags.
  ];
  require(path.join(__dirname, "setup")); // Setup-Modul ausführen; ohne wird der Setup-Befehl nicht bedient.
  return; // Nach Delegation sofort beenden; ohne würde der Rest des Scripts weiterlaufen und evtl. "Unknown command" ausgeben.
}

if (!cmd || cmd === "init") {
  // Fehlenden Befehl oder explizites "init" als Init-Aufruf behandeln; ohne hätten Nutzer keinen Default-Einstieg.
  process.argv = [
    process.argv[0], // Node-Binary beibehalten; ohne könnte das Kindmodul mit falschem Interpreter starten.
    path.join(__dirname, "init.js"), // Init-Script-Pfad setzen; ohne kann init.js nicht als Hauptmodul laufen.
    ...restArgs, // Vom Nutzer übergebene Zusatzargumente durchreichen; ohne ignoriert init z. B. Flags.
  ];
  require(path.join(__dirname, "init")); // Init-Modul laden und ausführen; ohne bleibt "init" wirkungslos.
  return; // Nach Delegation beenden; ohne würde weiterer Code laufen und evtl. "Unknown command" ausgeben.
}

if (cmd === "install") {
  // Install-Befehl (PATH-Shims etc.) abfangen; ohne würde "install" als unbekannt gelten.
  process.argv = [
    process.argv[0], // Node-Binary beibehalten; ohne könnte install.js mit falschem Interpreter starten.
    path.join(__dirname, "install.js"), // Absoluten Pfad zum Install-Script; ohne findet require das Modul bei wechselndem CWD nicht.
    ...restArgs, // Nutzer-Argumente durchreichen; ohne ignoriert install z. B. Zielverzeichnis-Flags.
  ];
  require(path.join(__dirname, "install")); // Install-Logik ausführen; ohne werden Shims nicht in den PATH eingetragen.
  return; // Nach Delegation beenden; ohne würde "Unknown command" folgen.
}

if (cmd === "install-tools") {
  // Check-Tools-Installation (z. B. .shimwrapper/checktools) abfangen; ohne fehlt der Einstieg für Variante B.
  process.argv = [
    process.argv[0], // Node-Binary beibehalten; ohne könnte das Kindmodul falsch starten.
    path.join(__dirname, "install-tools.js"), // Pfad zum Install-Tools-Script; ohne findet require das Modul nicht.
    ...restArgs, // Nutzer-Argumente durchreichen; ohne fehlen dem Modul ggf. Optionen.
  ];
  require(path.join(__dirname, "install-tools")); // Install-Tools-Modul starten; ohne bleibt der Befehl ohne Wirkung.
  return; // Nach Delegation beenden; ohne würde der Script-Fluss weiterlaufen.
}

if (cmd === "install-check-deps" || cmd === "deps") {
  // Abkürzung "deps" und voller Name gleichermaßen bedienen; ohne müssten Nutzer immer den langen Namen tippen.
  process.argv = [
    process.argv[0], // Node-Binary beibehalten; ohne könnte das Kindmodul falsch starten.
    path.join(__dirname, "install-check-deps.js"), // Pfad zum Deps-Script; ohne findet require das Modul nicht.
    ...restArgs, // Nutzer-Argumente durchreichen; ohne ignoriert das Modul z. B. Projekt-Pfade.
  ];
  require(path.join(__dirname, "install-check-deps")); // Abhängigkeiten für Checks installieren; ohne fehlt der zentrale Einstieg dafür.
  return; // Nach Delegation beenden; ohne würde ein weiterer Branch ausgeführt.
}

if (cmd === "config" || cmd === "configure") {
  // Beide Schreibweisen für Konfiguration akzeptieren; ohne wäre nur eine Variante nutzbar.
  process.argv = [
    process.argv[0], // Node-Binary beibehalten; ohne könnte configure.js mit falschem Interpreter starten.
    path.join(__dirname, "configure.js"), // Pfad zum Konfig-Script; ohne findet require das Modul nicht.
    ...restArgs, // Nutzer-Argumente durchreichen; ohne fehlen dem Konfig-Modul ggf. Keys/Values.
  ];
  require(path.join(__dirname, "configure")); // Konfigurationsmodul ausführen; ohne bleibt config/configure ohne Funktion.
  return; // Nach Delegation beenden; ohne würde "Unknown command" ausgegeben.
}

if (cmd === "run") {
  // "run" leitet an den Shim-Runner weiter (run-checks etc.); ohne gäbe es keinen Einstieg für Check-Läufe aus der CLI.
  const runArgs = restArgs; // Argumente für den Runner getrennt halten; ohne würden sie beim Umbau von process.argv verloren gehen.
  process.argv = [
    process.argv[0], // Node-Binary beibehalten; ohne könnte shim-runner.js mit falschem Interpreter starten.
    path.join(__dirname, "shim-runner.js"), // Runner-Script als neues "Hauptprogramm" setzen; ohne führt Node nicht das richtige Modul aus.
    ...runArgs, // Runner-Argumente (z. B. Check-Namen) durchreichen; ohne bekäme der Runner keine Parameter.
  ];
  require(path.join(__dirname, "shim-runner.js")); // Runner starten; ohne wird "run" nicht ausgeführt.
  return; // Nach Delegation beenden; ohne würde der CLI-Fluss weiterlaufen.
}

if (cmd === "dashboard") {
  // Dashboard aus dem Paket-Verzeichnis starten; ohne würde "next dev" ggf. im Host-Projekt laufen und Build-Fehler (z. B. import type) im falschen Projekt verursachen.
  const { spawn, spawnSync } = require("child_process"); // spawnSync fuer npm install, spawn fuer dev-Server; ohne fehlen Dashboard-Abhängigkeiten oder der Server startet nicht.
  const dashboardDir = path.resolve(__dirname, "..", "dashboard"); // Immer das Dashboard im eigenen Paket (node_modules/shimwrappercheck/dashboard); unabhaengig von process.cwd().
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm"; // Windows braucht npm.cmd; ohne schlaegt spawn("npm", ...) unter Windows fehl.
  const installResult = spawnSync(npmCmd, ["install"], {
    cwd: dashboardDir, // Dashboard hat eigene package.json; Abhängigkeiten müssen dort installiert sein, sonst schlaegt "npm run dev" fehl.
    stdio: "inherit",
  });
  if (installResult.status !== 0) {
    process.exit(installResult.status != null ? installResult.status : 1);
  }
  const child = spawn(npmCmd, ["run", "dev", ...restArgs], {
    cwd: dashboardDir, // Next.js muss im Dashboard-Ordner laufen; sonst wird das Host-Projekt gebaut (falsches app/layout.tsx, Parser-Fehler).
    stdio: "inherit",
    env: { ...process.env, SHIM_PROJECT_ROOT: process.cwd() }, // Aktuelles CWD als Projekt-Root an das Dashboard uebergeben; ohne kennt die UI das richtige Projekt nicht.
  });
  child.on("exit", (code) => process.exit(code != null ? code : 1));
  return;
}

if (cmd === "git") {
  // Git-Check-Pfad: git-checked.sh mit restlichen Argumenten aufrufen; ohne würde "git" nicht durch die Check-Hülle laufen.
  const { spawnSync } = require("child_process"); // Synchrone Prozessausführung für einfachen Exit-Code-Forward; ohne müssten wir asynchron exit(…) aufrufen.
  const gitChecked = path.join(__dirname, "git-checked.sh"); // Pfad zum Check-Script ermitteln; ohne kann spawnSync das Script nicht finden.
  const result = spawnSync("bash", [gitChecked, ...restArgs], {
    // Bash mit Script und Nutzer-Argumenten starten; ohne würde der echte git-Befehl nicht durch die Pre-Push-Checks laufen.
    stdio: "inherit", // Stdout/Stderr des Kindprozesses direkt an die Konsole weitergeben; ohne sieht der Nutzer keine Check-Ausgabe.
    cwd: process.cwd(), // Im aktuellen Arbeitsverzeichnis laufen lassen; ohne würden Checks im falschen Projekt ausgeführt.
    env: { ...process.env, SHIM_PROJECT_ROOT: process.cwd() }, // Projektroot an die Kindumgebung übergeben; ohne kennt git-checked.sh das Projekt nicht.
  });
  process.exit(result.status != null ? result.status : 1); // Exit-Code des Check-Scripts an die Shell zurückgeben; ohne erscheint der Aufruf immer als Erfolg.
  return;
}

// Kein bekannter Befehl: Nutzer informieren und mit Fehlercode beenden.
console.error("Unknown command:", cmd); // Unbekannten Befehl ausgeben; ohne weiß der Nutzer nicht, warum der Aufruf fehlschlug.
console.error(
  "Usage: shimwrappercheck [setup|init|config|install|install-tools|install-check-deps|run|dashboard|git]",
); // Unterstützte Befehle anzeigen; ohne fehlt die direkte Hilfestellung.
process.exit(1); // Mit Fehlercode beenden; ohne interpretieren Aufrufer (Shims, CI) den unbekannten Befehl als Erfolg.
