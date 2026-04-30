#!/usr/bin/env node
/**
 * MCP server for shimwrappercheck – zero-dependency, raw JSON-RPC over stdio.
 * Zweck: Ermöglicht AI-Agenten (Codex, Cursor, Claude, etc.), shimwrappercheck strukturiert zu steuern –
 *   Checks ausführen, Config lesen/schreiben, Check-Status abfragen, Fehler für Self-Healing einsehen.
 * Problem: Ohne MCP müssten Agenten CLI-Befehle als Shell-Aufrufe absetzen und stdout parsen;
 *   strukturierte JSON-Responses und direkter Zugriff auf Config/Status sind für Agenten wesentlich wertvoller.
 * Eingabe: JSON-RPC 2.0 über stdin (MCP-Protokoll). Ausgabe: JSON-RPC 2.0 über stdout.
 * Location: mcp/server.js
 * Keine externen Abhängigkeiten: Nutzt nur Node.js-Builtins (child_process, fs, path, readline).
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");

// ---------------------------------------------------------------------------
// Projekt-Root ermitteln
// ---------------------------------------------------------------------------

/** Projekt-Root: Wo .shimwrappercheckrc und .shim/ liegen. Ohne wissen wir nicht, welches Projekt geprüft werden soll. */
const projectRoot = process.env.SHIM_PROJECT_ROOT || process.cwd();

/** Pfad zur .shimwrappercheckrc-Datei; ohne können Config-Tools nicht lesen/schreiben. */
const rcPath = path.join(projectRoot, ".shimwrappercheckrc");

/** Pfad zum .shim-Verzeichnis für Laufzeitdaten (last_error.json etc.). */
const shimDir = path.join(projectRoot, ".shim");

// ---------------------------------------------------------------------------
// Hilfsfunktionen: .shimwrappercheckrc lesen/schreiben
// ---------------------------------------------------------------------------

/**
 * Liest .shimwrappercheckrc als key/value-Objekt.
 * Zweck: Strukturierte Config-Daten für Agenten, ohne Shell-Parsing.
 * Problem: Ohne diese Funktion müssten Agenten die Datei roh lesen und selbst parsen.
 * Eingabe: filePath (string). Ausgabe: Record<string, string>.
 */
function readRcFile(filePath) {
  if (!fs.existsSync(filePath)) return {}; // Datei nicht vorhanden → leeres Objekt; ohne würden wir einen ENOENT werfen.
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue; // Kommentare und Leerzeilen überspringen; ohne würden sie als Keys geparsed.
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/); // Key=Value-Format extrahieren.
    if (!match) continue;
    let value = match[2].trim();
    // Anführungszeichen entfernen, falls vorhanden; ohne würden sie im Value landen.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

/**
 * Schreibt ein key/value-Objekt als .shimwrappercheckrc.
 * Zweck: Aktualisiert die Config, damit Agenten Checks konfigurieren können.
 * Problem: Ohne diese Funktion gäbe es keinen Weg, Config programmatisch zu ändern.
 * Eingabe: filePath (string), values (Record<string, string>).
 * Ausgabe: void (schreibt Datei).
 */
function writeRcFile(filePath, values) {
  // Bestehende Kommentar-Zeilen bewahren; ohne gingen manuelle Kommentare verloren.
  const existingLines = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8").split(/\r?\n/)
    : [];
  const headerLine =
    existingLines.find((l) => l.trim().startsWith("#")) ||
    "# shimwrappercheck config (managed by MCP)";

  const keys = Object.keys(values);
  const contentLines = [headerLine];

  // Alle Keys sortiert schreiben; ohne wäre die Reihenfolge zufällig und schwer lesbar.
  for (const key of keys.sort((a, b) => a.localeCompare(b))) {
    const val = String(values[key]);
    // Numerische Werte ohne Quotes, Strings mit Quotes; ohne würde die Shell-Interpretation scheitern.
    if (/^[0-9]+$/.test(val)) {
      contentLines.push(`${key}=${val}`);
    } else {
      const escaped = val.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
      contentLines.push(`${key}="${escaped}"`);
    }
  }

  fs.writeFileSync(filePath, contentLines.join("\n") + "\n", "utf8");
}

/**
 * Liest .shim/last_error.json für Agent-Self-Healing.
 * Zweck: Gibt dem Agenten den letzten Check-Fehler strukturiert zurück.
 * Problem: Ohne wüsste der Agent nicht, welcher Check gefailt ist und warum.
 * Eingabe: keine. Ausgabe: object|null.
 */
function readLastError() {
  const filePath = path.join(shimDir, "last_error.json");
  if (!fs.existsSync(filePath)) return null; // Kein Fehler vorhanden.
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null; // Beschädigte JSON-Datei → null statt Crash.
  }
}

/**
 * Liest den Check-Katalog aus scripts/lib/check-catalog.js (falls vorhanden).
 * Zweck: Stellt Agenten die vollständige Liste der verfügbaren Checks zur Verfügung.
 * Problem: Ohne den Katalog müssten Agenten die Check-IDs raten.
 * Eingabe: keine. Ausgabe: array von check-Objekten oder leeres Array.
 */
function loadCheckCatalog() {
  // Verschiedene Pfade prüfen: im Projekt oder im node_modules des Pakets.
  const candidates = [
    path.join(projectRoot, "scripts", "lib", "check-catalog.js"),
    path.join(__dirname, "..", "scripts", "lib", "check-catalog.js"),
  ];
  for (const catalogPath of candidates) {
    if (fs.existsSync(catalogPath)) {
      try {
        // require() für CommonJS-Modul; ohne könnten wir den Katalog nicht laden.
        const catalog = require(catalogPath);
        return catalog.CHECK_CATALOG || [];
      } catch {}
    }
  }
  return []; // Kein Katalog gefunden; Agent bekommt leere Liste.
}

/**
 * Führt run-checks.sh oder shim-runner.js aus und fängt stdout/stderr + Exit-Code ein.
 * Zweck: Agenten können Checks on-demand auslösen und strukturierte Ergebnisse bekommen.
 * Problem: Ohne diese Funktion müssten Agenten Shell-Befehle selbst konstruieren und Output parsen.
 * Eingabe: opts (object mit flags). Ausgabe: { exitCode, stdout, stderr, passed, lastError }.
 */
function runChecks(opts = {}) {
  const args = [];

  // Frontend/Backend-Scope; ohne würden immer beide laufen.
  if (opts.frontend === false && opts.backend === false) {
    // Beide false → default: beide laufen.
  } else if (opts.frontend === false) {
    args.push("--no-frontend");
  } else if (opts.backend === false) {
    args.push("--no-backend");
  }

  // Einzelne Checks deaktivieren; ohne laufen alle aktivierten Checks.
  if (opts.noAiReview) args.push("--no-ai-review");
  if (opts.noExplanationCheck) args.push("--no-explanation-check");
  if (opts.noI18nCheck) args.push("--no-i18n-check");
  if (opts.noSast) args.push("--no-sast");
  if (opts.noGitleaks) args.push("--no-gitleaks");
  if (opts.noRuff) args.push("--no-ruff");
  if (opts.noShellcheck) args.push("--no-shellcheck");

  // Refactor/Until-95-Modi; ohne läuft der Default aus .shimwrappercheckrc.
  if (opts.refactor) args.push("--refactor");
  if (opts.until95) args.push("--until-95");

  // CHECK_MODE steuern; ohne läuft der Default aus .shimwrappercheckrc.
  const env = { ...process.env, SHIM_PROJECT_ROOT: projectRoot };
  if (opts.checkMode) {
    env.CHECK_MODE = opts.checkMode;
  }

  // run-checks.sh bevorzugen; fallback auf shim-runner.js.
  const runChecksPath = path.join(projectRoot, "scripts", "run-checks.sh");
  const shimRunnerPath = path.join(projectRoot, "scripts", "shim-runner.js");
  let cmd, cmdArgs;

  if (fs.existsSync(runChecksPath)) {
    cmd = "bash";
    cmdArgs = [runChecksPath, ...args];
  } else if (fs.existsSync(shimRunnerPath)) {
    cmd = process.execPath;
    cmdArgs = [shimRunnerPath, ...args];
  } else {
    return {
      exitCode: 1,
      stdout: "",
      stderr: "No run-checks.sh or shim-runner.js found in project.",
      passed: false,
      lastError: null,
    };
  }

  // Prozess ausführen; ohne spawnSync keinen Exit-Code und kein stdout.
  const result = spawnSync(cmd, cmdArgs, {
    cwd: projectRoot,
    env,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024, // 8 MB Buffer für große Check-Outputs; ohne würde der Prozess crashen.
    timeout: (opts.timeoutSec || 600) * 1000, // Timeout in ms; ohne könnte der Agent ewig warten.
  });

  const exitCode = result.status ?? 1; // Null-Status als Fehler werten; ohne würde ein Crash als Erfolg gelten.
  const lastError = readLastError(); // Nach dem Lauf den letzten Fehler lesen; ohne wüsste der Agent nicht, was schiefging.

  return {
    exitCode,
    stdout: (result.stdout || "").slice(0, 50000), // Auf 50 KB begrenzen; ohne könnte die Response zu groß werden.
    stderr: (result.stderr || "").slice(0, 20000), // Auf 20 KB begrenzen.
    passed: exitCode === 0,
    lastError,
  };
}

/**
 * Findet den neuesten Review-Report im Report-Verzeichnis.
 * Zweck: Agenten können den letzten AI-Review-Report lesen.
 * Problem: Ohne diese Funktion müsste der Agent den Report-Pfad raten.
 * Eingabe: keine. Ausgabe: { found, path, content } oder { found: false }.
 */
function findLatestReport() {
  const rc = readRcFile(rcPath);
  // Report-Verzeichnis aus Config oder Default; ohne wissen wir nicht, wo Reports liegen.
  const reportDirName = rc.reviewOutputPath || "reports";
  const reportDir = path.join(projectRoot, reportDirName);

  if (!fs.existsSync(reportDir)) return { found: false }; // Kein Report-Verzeichnis.

  // Alle .md-Dateien sammeln und nach mtime sortieren; ohne könnten wir einen alten Report erwischen.
  const files = fs
    .readdirSync(reportDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({
      name: f,
      fullPath: path.join(reportDir, f),
      mtime: fs.statSync(path.join(reportDir, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) return { found: false }; // Keine Reports vorhanden.

  const latest = files[0];
  return {
    found: true,
    path: latest.fullPath,
    name: latest.name,
    content: fs.readFileSync(latest.fullPath, "utf8").slice(0, 50000), // Auf 50 KB begrenzen.
  };
}

// ---------------------------------------------------------------------------
// MCP Tool-Definitionen
// ---------------------------------------------------------------------------

/**
 * Kanonische Liste aller vom MCP-Server angebotenen Tools.
 * Zweck: Wird für initialize-Response und dispatch genutzt; ohne wüsste der Agent nicht, welche Tools es gibt.
 * Jedes Tool hat: name, description, inputSchema (JSON Schema).
 */

// ---------------------------------------------------------------------------
// MCP-Self-Configuration: Agent kann seine eigene MCP-Client-Config schreiben
// ---------------------------------------------------------------------------

/**
 * Bekannte MCP-Client-Config-Pfade pro Client-Typ.
 * Zweck: Der Agent muss nicht wissen, wo sein Client die Config ablegt; ohne müsste er raten.
 * Eingabe: keine. Ausgabe: object mit clientName -> { path, format }.
 */
const MCP_CLIENT_CONFIGS = {
  cursor: {
    path: path.join(process.env.HOME || "~", ".cursor", "mcp.json"),
    format: "json",
    description: "Cursor IDE MCP config",
  },
  "claude-desktop": {
    path: path.join(
      process.env.HOME || "~",
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    ),
    format: "json",
    description: "Claude Desktop MCP config",
  },
  "codex-cli": {
    path: path.join(process.env.HOME || "~", ".codex", "config.toml"),
    format: "toml",
    description: "Codex CLI MCP config (TOML format)",
  },
};

/**
 * Erzeugt die MCP-Server-Config für shimwrappercheck.
 * Zweck: Strukturierte Config, die direkt in die Client-Datei geschrieben werden kann.
 * Problem: Ohne diese Funktion müsste der Agent den JSON-Block selbst zusammenbauen.
 * Eingabe: serverPath (string). Ausgabe: object (mcpServers-Block).
 */
function generateMcpServerConfig(serverPath) {
  return {
    shimwrappercheck: {
      command: "node",
      args: [serverPath],
      env: {
        SHIM_PROJECT_ROOT: projectRoot, // Projektroot fest eintragen; ohne wüsste der Server nicht, welches Projekt geprüft werden soll.
      },
    },
  };
}

/**
 * Liest eine bestehende MCP-Client-Config oder gibt leeres Basis-Objekt zurück.
 * Zweck: Existierende Server-Configs dürfen nicht verloren gehen; ohne würde der Agent andere Server überschreiben.
 * Eingabe: configPath (string). Ausgabe: object (geparste Config oder leer).
 */
function readMcpClientConfig(configPath, format) {
  if (!fs.existsSync(configPath)) {
    return { mcpServers: {} }; // Keine Config vorhanden → leeres Basis-Objekt.
  }
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    if (format === "toml") {
      // Einfacher TOML-Parser für [mcp_servers.XXX]-Sektionen; ohne könnten wir Codex CLI nicht konfigurieren.
      return parseTomlMcpServers(raw);
    }
    return JSON.parse(raw);
  } catch {
    return { mcpServers: {} }; // Beschädigte Datei → sicherer Fallback.
  }
}

/**
 * Sehr einfacher TOML-Parser für [mcp_servers.*]-Sektionen.
 * Zweck: Codex CLI nutzt TOML; ohne diesen Parser könnten wir die bestehende Config nicht lesen.
 * Problem: Ein vollständiger TOML-Parser wäre Overkill; wir parsen nur mcp_servers-Sektionen.
 * Eingabe: raw (string). Ausgabe: { mcpServers: { name: { command, args, env } } }.
 */
function parseTomlMcpServers(raw) {
  const result = { mcpServers: {} };
  const lines = raw.split(/\r?\n/);
  let currentServer = null; // Aktuelle [mcp_servers.XXX]-Sektion; ohne wüssten wir nicht, wo Werte hingehören.
  let currentEnv = {}; // Aktuelle [mcp_servers.XXX.env]-Sektion; ohne wüssten wir nicht, ob ein Wert zur env-Sub-Sektion gehört.
  let inEnv = false; // Flag ob wir in einer .env-Sub-Sektion sind; ohne würden env-Werte als Server-Eigenschaft gespeichert.

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue; // Kommentare und Leerzeilen überspringen.

    // Sektion-Header erkennen: [mcp_servers.name] oder [mcp_servers.name.env]
    const sectionMatch = trimmed.match(/^\[mcp_servers\.([^\]]+)\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1]; // z.B. "shimwrappercheck" oder "shimwrappercheck.env"
      if (sectionName.endsWith(".env")) {
        // Env-Sub-Sektion; ohne würden env-Werte als Server-Properties gespeichert.
        currentServer = sectionName.replace(/\.env$/, "");
        inEnv = true;
        currentEnv = {};
        if (!result.mcpServers[currentServer])
          result.mcpServers[currentServer] = {};
      } else {
        currentServer = sectionName;
        inEnv = false;
        currentEnv = {};
        if (!result.mcpServers[currentServer])
          result.mcpServers[currentServer] = {};
      }
      continue;
    }

    // Key = Value innerhalb einer Sektion
    const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (kvMatch && currentServer) {
      const key = kvMatch[1];
      let value = kvMatch[2].trim();
      // TOML-Strings in Anführungszeichen; ohne würden Quotes im Value landen.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (inEnv) {
        // Env-Werte in der .env-Sub-Sektion; ohne wüssten wir nicht, dass es env-Einträge sind.
        currentEnv[key] = value;
        result.mcpServers[currentServer].env = currentEnv;
      } else if (key === "args") {
        // Args als TOML-Array; ohne könnten wir Codex nicht korrekt konfigurieren.
        try {
          // Einfaches Array-Parsing für ["a", "b"] Format; ohne gäbe es nur den Rohtext.
          const arrMatch = value.match(/^\[(.*)\]$/);
          if (arrMatch) {
            result.mcpServers[currentServer].args = arrMatch[1]
              .split(",")
              .map((s) => s.trim().replace(/^["']|["']$/g, ""))
              .filter(Boolean);
          }
        } catch {
          result.mcpServers[currentServer].args = [value]; // Fallback: einzelner Wert als Array.
        }
      } else if (key === "url") {
        result.mcpServers[currentServer].url = value; // URL-basierte Server; ohne würden wir URL-Server ignorieren.
      } else {
        result.mcpServers[currentServer][key] = value; // Andere Werte direkt übernehmen; ohne gingen sie verloren.
      }
    }
  }
  return result;
}

/**
 * Erzeugt TOML-Text für einen mcp_servers-Eintrag.
 * Zweck: Codex CLI erwartet TOML; ohne könnten wir Codex nicht konfigurieren.
 * Eingabe: name (string), config (object mit command, args, env). Ausgabe: string (TOML-Zeilen).
 */
function generateTomlMcpEntry(name, config) {
  const lines = [];
  lines.push(`[mcp_servers.${name}]`);
  if (config.command) lines.push(`command = "${config.command}"`);
  if (config.args && Array.isArray(config.args)) {
    const argsStr = config.args.map((a) => `"${a}"`).join(", ");
    lines.push(`args = [${argsStr}]`);
  }
  if (config.env && Object.keys(config.env).length > 0) {
    lines.push(`[mcp_servers.${name}.env]`);
    for (const [k, v] of Object.entries(config.env)) {
      lines.push(`${k} = "${v}"`);
    }
  }
  return lines.join("\n");
}

/**
 * Schreibt die MCP-Client-Config (JSON oder TOML) und erstellt ggf. das Verzeichnis.
 * Zweck: Atomarer Write mit mkdir-p; ohne gäbe es ENOENT beim Schreiben.
 * Eingabe: configPath (string), config (object), format ("json"|"toml"). Ausgabe: void.
 */
function writeMcpClientConfig(configPath, config, format) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true }); // Verzeichnis rekursiv anlegen; ohne schlägt writeFileSync mit ENOENT fehl.
  }
  if (format === "toml") {
    // Für TOML-Configs (Codex CLI): bestehende Datei lesen, shimwrappercheck-Sektion ersetzen, Rest behalten.
    writeTomlMcpConfig(configPath, config);
  } else {
    fs.writeFileSync(
      configPath,
      JSON.stringify(config, null, 2) + "\n",
      "utf8",
    );
  }
}

/**
 * Schreibt eine TOML-MCP-Config, indem bestehende Sektionen erhalten und shimwrappercheck eingefügt wird.
 * Zweck: Codex CLI config.toml darf nicht überschrieben werden; andere Einstellungen (model, trust, etc.) müssen bleiben.
 * Problem: Ohne diese Funktion würden wir die gesamte config.toml überschreiben und alle anderen Einstellungen löschen.
 * Eingabe: configPath (string), config (object mit mcpServers). Ausgabe: void.
 */
function writeTomlMcpConfig(configPath, config) {
  let existingRaw = "";
  if (fs.existsSync(configPath)) {
    existingRaw = fs.readFileSync(configPath, "utf8");
  }

  // Bestehende [mcp_servers.shimwrappercheck]-Sektion entfernen (inkl. .env-Sub-Sektion).
  // Zweck: Alte shimwrappercheck-Konfiguration ersetzen; ohne gäbe es doppelte Sektionen.
  const lines = existingRaw.split(/\r?\n/);
  const filteredLines = [];
  let skipSection = false; // Flag ob wir in einer zu entfernenden Sektion sind.
  const shimSectionPattern = /^\[mcp_servers\.shimwrappercheck(?:\.env)?\]$/; // Haupt- und .env-Sektion gemeinsam erkennen; ohne bleibt die alte Env-Sektion stehen.
  for (const line of lines) {
    const trimmed = line.trim();
    // Prüfen ob eine neue Sektion beginnt; ohne würden wir immer noch skippen.
    if (trimmed.startsWith("[") && !trimmed.startsWith("[[")) {
      const isShimSection = shimSectionPattern.test(trimmed); // Exakte Prüfung auf shimwrappercheck oder shimwrappercheck.env; ohne würden ähnlich benannte Sektionen falsch matchen.
      skipSection = isShimSection; // Nur die Zielsektionen skippen; andere Sektionen behalten.
      if (!skipSection) {
        filteredLines.push(line); // Neue fremde Sektion sofort behalten; ohne ginge ihr Header beim Wechsel aus der Skip-Phase verloren.
      }
      continue; // Header-Zeile ist bereits verarbeitet; ohne würden wir sie ggf. doppelt pushen.
    }
    if (!skipSection) {
      filteredLines.push(line); // Zeile behalten; ohne würden wir auch andere Sektionen löschen.
    }
  }

  // Neue shimwrappercheck-Sektion anhängen.
  const newEntry = generateTomlMcpEntry(
    "shimwrappercheck",
    config.mcpServers?.shimwrappercheck || {},
  );
  let result = filteredLines.join("\n").replace(/\n+$/, ""); // Trailing newlines entfernen.
  if (result && !result.endsWith("\n")) result += "\n";
  result += newEntry + "\n"; // Neue Sektion anhängen; ohne wäre shimwrappercheck nicht konfiguriert.

  fs.writeFileSync(configPath, result, "utf8");
}

/**
 * Konfiguriert einen MCP-Client, damit der Agent shimwrappercheck nutzen kann.
 * Zweck: Der Agent kann sich SELBST konfigurieren – kein manueller Eingriff nötig.
 * Problem: Ohne diese Funktion müsste der Nutzer manuell eine JSON-Datei bearbeiten.
 * Eingabe: client (string, z.B. "cursor"), serverPath (string, optional).
 * Ausgabe: { success, configPath, action, existingServers }.
 */
function configureMcpClient(client, serverPath) {
  const clientInfo = MCP_CLIENT_CONFIGS[client];
  if (!clientInfo) {
    return {
      success: false,
      error: `Unknown MCP client: ${client}. Supported: ${Object.keys(MCP_CLIENT_CONFIGS).join(", ")}`,
    };
  }

  // Server-Pfad ermitteln: explizit, aus __dirname, oder fallback über npx.
  const resolvedServerPath = serverPath || path.resolve(__dirname, "server.js"); // Eigene server.js-Position; ohne wüsste der Agent nicht, wo der Server liegt.

  const configPath = clientInfo.path;
  const existingConfig = readMcpClientConfig(configPath, clientInfo.format); // Bestehende Config lesen; Format übergeben für TOML/JSON; ohne würden wir TOML nicht korrekt parsen.
  const newServerConfig = generateMcpServerConfig(resolvedServerPath);

  // Prüfen ob shimwrappercheck schon konfiguriert ist; ohne würden wir bei jedem Aufruf überschreiben.
  const alreadyConfigured = !!existingConfig.mcpServers?.shimwrappercheck;
  const action = alreadyConfigured ? "updated" : "added";

  // Merge: shimwrappercheck-Eintrag aktualisieren, andere Server-Einträge behalten.
  existingConfig.mcpServers = existingConfig.mcpServers || {};
  existingConfig.mcpServers.shimwrappercheck = newServerConfig.shimwrappercheck;

  writeMcpClientConfig(configPath, existingConfig, clientInfo.format); // Atomar schreiben; Format (json/toml) übergeben; ohne würde Codex TOML als JSON geschrieben.

  return {
    success: true,
    client,
    configPath,
    action,
    serverPath: resolvedServerPath,
    projectRoot,
    existingServers: Object.keys(existingConfig.mcpServers), // Alle konfigurierten Server auflisten; ohne wüsste der Agent nicht, was noch läuft.
  };
}

/**
 * Listet alle unterstützten MCP-Clients mit ihren Config-Pfaden und ob shimwrappercheck bereits konfiguriert ist.
 * Zweck: Der Agent kann entscheiden, welchen Client er konfigurieren soll.
 * Eingabe: keine. Ausgabe: array von client-Info-Objekten.
 */
function listMcpClients() {
  return Object.entries(MCP_CLIENT_CONFIGS).map(([name, info]) => {
    const existing = readMcpClientConfig(info.path, info.format); // Bestehende Config prüfen; Format übergeben; ohne würde TOML-Parsing fehlschlagen.
    const hasShim = !!existing.mcpServers?.shimwrappercheck;
    return {
      name,
      configPath: info.path,
      description: info.description,
      format: info.format, // "json" oder "toml"; ohne wüsste der Agent nicht, wie die Config geschrieben wird.
      shimwrappercheckConfigured: hasShim, // true = bereits konfiguriert; ohne müsste der Agent die Datei selbst prüfen.
    };
  });
}

const TOOLS = [
  {
    name: "run_checks",
    description:
      "Run shimwrappercheck checks (lint, build, AI review, etc.) and return structured results with pass/fail, stdout, stderr, and last error for agent self-healing. Use this before deploying or pushing code.",
    inputSchema: {
      type: "object",
      properties: {
        checkMode: {
          type: "string",
          enum: ["full", "snippet", "commit"],
          description:
            "AI review scope: full (whole codebase, chunked), snippet (changed files only), commit (last commit only, used by pre-push). Default: from .shimwrappercheckrc",
        },
        frontend: {
          type: "boolean",
          description: "Run frontend checks (default: true)",
        },
        backend: {
          type: "boolean",
          description: "Run backend checks (default: true)",
        },
        noAiReview: {
          type: "boolean",
          description: "Skip AI review check",
        },
        noExplanationCheck: {
          type: "boolean",
          description: "Skip Full Explanation check",
        },
        noI18nCheck: {
          type: "boolean",
          description: "Skip i18n check",
        },
        noSast: {
          type: "boolean",
          description: "Skip Semgrep SAST scan",
        },
        noGitleaks: {
          type: "boolean",
          description: "Skip Gitleaks secret scan",
        },
        noRuff: {
          type: "boolean",
          description: "Skip Ruff Python linter",
        },
        noShellcheck: {
          type: "boolean",
          description: "Skip Shellcheck",
        },
        refactor: {
          type: "boolean",
          description: "Force CHECK_MODE=full for refactor loop",
        },
        until95: {
          type: "boolean",
          description: "Force CHECK_MODE=full and loop until all chunks >= 95%",
        },
        timeoutSec: {
          type: "number",
          description: "Timeout in seconds (default: 600)",
        },
      },
    },
  },
  {
    name: "get_check_status",
    description:
      "Get the last check error from .shim/last_error.json for agent self-healing. Returns null if last run passed. Use this after run_checks fails to understand what went wrong.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_config",
    description:
      "Read the current .shimwrappercheckrc configuration as structured key-value pairs. Includes check toggles, check mode, AI review settings, etc.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_config",
    description:
      "Update one or more configuration values in .shimwrappercheckrc. Only the specified keys are changed; others are preserved. Example keys: SHIM_RUN_LINT, CHECK_MODE, SHIM_AI_REVIEW_PROVIDER.",
    inputSchema: {
      type: "object",
      properties: {
        values: {
          type: "object",
          description:
            "Key-value pairs to set in .shimwrappercheckrc (e.g. { SHIM_RUN_LINT: '1', CHECK_MODE: 'full' })",
          additionalProperties: { type: "string" },
        },
      },
      required: ["values"],
    },
  },
  {
    name: "list_checks",
    description:
      "List all available shimwrappercheck checks with their IDs, labels, env-keys, and current enabled/disabled status from .shimwrappercheckrc.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "toggle_check",
    description:
      "Enable or disable a specific check by its env-key in .shimwrappercheckrc. Example env-keys: SHIM_RUN_LINT, SHIM_RUN_AI_REVIEW, SHIM_RUN_PRETTIER, SHIM_RUN_EXPLANATION_CHECK.",
    inputSchema: {
      type: "object",
      properties: {
        envKey: {
          type: "string",
          description: "The env key for the check (e.g. SHIM_RUN_LINT)",
        },
        enabled: {
          type: "boolean",
          description: "true to enable, false to disable",
        },
      },
      required: ["envKey", "enabled"],
    },
  },
  {
    name: "get_latest_report",
    description:
      "Read the latest AI review report (markdown) from the reports directory. Useful after running checks with AI review enabled to see detailed deductions and scores.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "configure_mcp",
    description:
      "Configure an MCP client (Cursor, Claude Desktop, Codex CLI) so the agent can use shimwrappercheck tools. The agent calls this ONCE to self-configure — no manual JSON editing needed. Returns the config path and status.",
    inputSchema: {
      type: "object",
      properties: {
        client: {
          type: "string",
          enum: ["cursor", "claude-desktop", "codex-cli"],
          description: "Which MCP client to configure",
        },
        serverPath: {
          type: "string",
          description:
            "Absolute path to mcp/server.js (auto-detected if omitted). Set this if shimwrappercheck is installed globally or in node_modules.",
        },
      },
      required: ["client"],
    },
  },
  {
    name: "list_mcp_clients",
    description:
      "List all supported MCP clients with their config paths and whether shimwrappercheck is already configured. Call this before configure_mcp to see the current state.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_agents_md",
    description:
      "Read the project's AGENTS.md file (agent instructions). Useful for agents to check current project rules, check descriptions, and coding standards.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_models",
    description:
      "List available AI models from the configured custom provider endpoint (Ollama Cloud, OpenRouter, etc.). Requires SHIM_AI_CUSTOM_BASE_URL to be set. Returns model IDs and names.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_model",
    description:
      "Set the AI review model in .shimwrappercheckrc (e.g. kimi-k2-6). Use list_models first to see available options, then call this to select one. The model change takes effect on the next AI review run.",
    inputSchema: {
      type: "object",
      properties: {
        model: {
          type: "string",
          description:
            "Model ID to use (e.g. kimi-k2-6, gpt-4o-mini, claude-3-5-haiku-20241022)",
        },
      },
      required: ["model"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool-Dispatch: ruft die passende Funktion auf und gibt das Resultat zurück
// ---------------------------------------------------------------------------

/**
 * Dispatcht einen Tool-Aufruf an die passende Handler-Funktion.
 * Zweck: Zentraler Router für alle MCP-Tools; ohne müsste jeder Aufruf einzeln behandelt werden.
 * Eingabe: toolName (string), args (object). Ausgabe: any (wird als JSON-Content zurückgegeben).
 */
function handleToolCall(toolName, args) {
  switch (toolName) {
    case "run_checks": {
      // Check-Optionen aus den MCP-Argumenten extrahieren; ohne würden Flags fehlen.
      const opts = {
        checkMode: args.checkMode,
        frontend: args.frontend,
        backend: args.backend,
        noAiReview: args.noAiReview,
        noExplanationCheck: args.noExplanationCheck,
        noI18nCheck: args.noI18nCheck,
        noSast: args.noSast,
        noGitleaks: args.noGitleaks,
        noRuff: args.noRuff,
        noShellcheck: args.noShellcheck,
        refactor: args.refactor,
        until95: args.until95,
        timeoutSec: args.timeoutSec,
      };
      const result = runChecks(opts);
      return result;
    }

    case "get_check_status": {
      const lastError = readLastError();
      return lastError
        ? { hasError: true, error: lastError }
        : {
            hasError: false,
            message: "No last error found. Last run passed or no run yet.",
          };
    }

    case "get_config": {
      const config = readRcFile(rcPath);
      return { path: rcPath, config };
    }

    case "set_config": {
      const current = readRcFile(rcPath); // Aktuelle Config lesen; ohne würden wir bestehende Werte verlieren.
      const updated = { ...current, ...args.values }; // Merge: neue Werte überschreiben alte.
      writeRcFile(rcPath, updated); // Atomar schreiben.
      return {
        success: true,
        message: `Updated ${Object.keys(args.values).length} key(s) in .shimwrappercheckrc`,
        updatedKeys: Object.keys(args.values),
      };
    }

    case "list_checks": {
      const catalog = loadCheckCatalog();
      const config = readRcFile(rcPath);

      if (catalog.length === 0) {
        // Fallback: Check-Toggles aus Config ableiten; ohne wüsste der Agent gar nicht, was es gibt.
        const fallbackChecks = Object.keys(config)
          .filter((k) => k.startsWith("SHIM_RUN_"))
          .map((k) => {
            const id = k.replace("SHIM_RUN_", "").replace(/_/g, "");
            return {
              id,
              envKey: k,
              enabled: config[k] !== "0",
              defaultEnabled: true,
              label: id,
            };
          });
        return { source: "config-inferred", checks: fallbackChecks };
      }

      const checks = catalog.map((check) => ({
        id: check.id,
        label: check.label,
        envKey: check.envKey,
        enabled: config[check.envKey] !== "0", // "0" = deaktiviert; alles andere = aktiv.
        defaultEnabled: check.defaultEnabled === 1,
      }));

      return { source: "check-catalog", checks };
    }

    case "toggle_check": {
      const current = readRcFile(rcPath);
      current[args.envKey] = args.enabled ? "1" : "0";
      writeRcFile(rcPath, current);
      return {
        success: true,
        envKey: args.envKey,
        enabled: args.enabled,
        message: `${args.envKey} is now ${args.enabled ? "enabled" : "disabled"}`,
      };
    }

    case "get_latest_report": {
      return findLatestReport();
    }

    case "configure_mcp": {
      const result = configureMcpClient(args.client, args.serverPath); // MCP-Client konfigurieren; ohne müsste der Nutzer manuell JSON bearbeiten.
      return result;
    }

    case "list_mcp_clients": {
      return { clients: listMcpClients() }; // Alle unterstützten Clients auflisten; ohne wüsste der Agent nicht, welche Clients es gibt.
    }

    case "get_agents_md": {
      // AGENTS.md lesen; ohne wüsste der Agent nicht, welche Regeln für das Projekt gelten.
      const agentsPath = path.join(projectRoot, "AGENTS.md");
      if (!fs.existsSync(agentsPath)) {
        return { found: false, message: "No AGENTS.md found in project root." };
      }
      try {
        const content = fs.readFileSync(agentsPath, "utf8");
        return {
          found: true,
          path: agentsPath,
          content: content.slice(0, 50000),
        }; // Auf 50 KB begrenzen; ohne droht Overflow bei großen Dateien.
      } catch {
        return { found: false, message: "Could not read AGENTS.md." };
      }
    }

    case "list_models": {
      // Verfügbare Modell-IDs vom konfigurierten Endpoint abrufen.
      const globalEnvPath = path.join(
        require("os").homedir(),
        ".shimwrappercheck",
        ".env",
      );
      if (fs.existsSync(globalEnvPath)) {
        const envContent = fs.readFileSync(globalEnvPath, "utf8");
        for (const line of envContent.split("\n")) {
          const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
          if (m && !process.env[m[1]])
            process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
      const baseUrl = process.env.SHIM_AI_CUSTOM_BASE_URL;
      const apiKey = process.env.SHIM_AI_CUSTOM_API_KEY || "";
      const format = (
        readRcFile(rcPath).SHIM_AI_CUSTOM_FORMAT || "openai"
      ).toLowerCase();
      const isLocal =
        (process.env.SHIM_AI_OLLAMA_MODE || "").toLowerCase() === "local" ||
        (baseUrl || "").includes("localhost") ||
        (baseUrl || "").includes("127.0.0.1");
      if (!baseUrl) {
        return {
          error: "SHIM_AI_CUSTOM_BASE_URL not configured. Run ai-setup first.",
        };
      }
      if (!isLocal && !apiKey) {
        return {
          error: "SHIM_AI_CUSTOM_API_KEY not configured. Run ai-setup first.",
        };
      }
      try {
        const cleanBase = baseUrl.replace(/\/$/, "");
        const url =
          format === "ollama" ? `${cleanBase}/api/tags` : `${cleanBase}/models`;
        const authHeader = apiKey ? `-H "Authorization: Bearer ${apiKey}"` : "";
        const res = require("child_process").execSync(
          `curl -s ${authHeader} "${url}"`.trim(),
          {
            timeout: 15000,
            encoding: "utf8",
          },
        );
        const json = JSON.parse(res);
        const models =
          format === "ollama"
            ? (Array.isArray(json.models) ? json.models : [])
                .map((m) => ({
                  id: String(m.name || ""),
                  name: String(m.name || ""),
                }))
                .filter((m) => m.id)
            : (Array.isArray(json.data) ? json.data : [])
                .map((m) => ({
                  id: String(m.id || ""),
                  name: String(m.id || ""),
                }))
                .filter((m) => m.id);
        return {
          models,
          currentModel: readRcFile(rcPath).SHIM_AI_CUSTOM_MODEL || "",
        };
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    case "set_model": {
      // Modell in .shimwrappercheckrc setzen.
      const model = args.model?.trim();
      if (!model) return { error: "model is required" };
      const current = readRcFile(rcPath);
      writeRcFile(rcPath, { ...current, SHIM_AI_CUSTOM_MODEL: model });
      return { ok: true, model };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 über stdio (MCP-Protokoll)
// ---------------------------------------------------------------------------

/**
 * Sendet eine JSON-RPC-Response über stdout.
 * Zweck: MCP-Client erwartet Antworten auf stdout; ohne käme die Antwort nicht beim Agenten an.
 * Eingabe: id (number|string), result (any). Ausgabe: void (schreibt auf stdout).
 */
function sendResponse(id, result) {
  const response = {
    jsonrpc: "2.0",
    id,
    result,
  };
  // WICHTIG: Nur auf stdout schreiben; stderr ist für Debug-Logs.
  process.stdout.write(JSON.stringify(response) + "\n");
}

/**
 * Sendet einen JSON-RPC-Error über stdout.
 * Zweck: Strukturierte Fehlermeldung für den MCP-Client; ohne wüsste der Client nicht, was schiefging.
 * Eingabe: id (number|string), code (number), message (string). Ausgabe: void.
 */
function sendError(id, code, message) {
  const response = {
    jsonrpc: "2.0",
    id,
    error: { code, message },
  };
  process.stdout.write(JSON.stringify(response) + "\n");
}

/**
 * Verarbeitet eine eingehende JSON-RPC-Request.
 * Zweck: Zentrale Dispatch-Funktion für alle MCP-Methoden; ohne käme keine Anfrage beim Server an.
 * Eingabe: request (object mit jsonrpc, id, method, params). Ausgabe: void (sendet Response).
 */
function handleRequest(request) {
  const { id, method, params } = request;

  switch (method) {
    case "initialize": {
      // MCP-Initialize-Handshake; ohne diesen kann der Client keine Tools nutzen.
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: {}, // Wir bieten Tools an; ohne dieses Capability würde der Client keine Tool-Aufrufe senden.
        },
        serverInfo: {
          name: "shimwrappercheck",
          version: "0.1.0",
        },
      });
      break;
    }

    case "notifications/initialized": {
      // Client hat den Handshake bestätigt; keine Response nötig (Notification).
      // Ohne diesen Handler würden wir versuchen, eine Response auf eine Notification zu senden (was MCP verbietet).
      break;
    }

    case "tools/list": {
      // Alle verfügbaren Tools zurückgeben; ohne wüsste der Agent nicht, was er aufrufen kann.
      sendResponse(id, {
        tools: TOOLS,
      });
      break;
    }

    case "tools/call": {
      // Tool-Aufruf dispatchen; ohne käme die Agent-Anfrage nicht beim Handler an.
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      if (!toolName) {
        sendError(id, -32602, "Missing tool name in params");
        break;
      }

      try {
        const result = handleToolCall(toolName, toolArgs);
        // Ergebnis als text-Content zurückgeben; MCP erwartet dieses Format.
        sendResponse(id, {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        });
      } catch (err) {
        // Fehler im Tool-Handler abfangen; ohne würde der Server crashen.
        sendError(id, -32603, `Tool execution error: ${err.message}`);
      }
      break;
    }

    case "ping": {
      // Health-Check; ohne diesen Handler wüsste der Client nicht, ob der Server noch lebt.
      sendResponse(id, {});
      break;
    }

    default: {
      // Unbekannte Methode; ohne diesen Handler gäbe es keine Response und der Client würde timeouten.
      sendError(id, -32601, `Method not found: ${method}`);
    }
  }
}

// ---------------------------------------------------------------------------
// stdin lesen und Requests verarbeiten
// ---------------------------------------------------------------------------

/**
 * Haupt-Loop: Liest zeilenweise JSON-RPC-Requests von stdin und verarbeitet sie.
 * Zweck: MCP-Client spricht über stdio; ohne diesen Loop kämen keine Requests an.
 * Eingabe: stdin-Zeilen. Ausgabe: Responses auf stdout.
 */
function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false, // Kein TTY; MCP läuft über Pipes.
  });

  // Unhandled-Rejections abfangen; ohne würde der Server bei asynchronen Fehlern crashen.
  process.on("uncaughtException", (err) => {
    console.error("[MCP shimwrappercheck] uncaughtException:", err.message);
  });
  process.on("unhandledRejection", (err) => {
    console.error("[MCP shimwrappercheck] unhandledRejection:", err);
  });

  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (!trimmed) return; // Leerzeilen ignorieren; ohne würden wir einen JSON-Parse-Fehler werfen.

    try {
      const request = JSON.parse(trimmed);
      handleRequest(request); // Request verarbeiten; ohne käme die Anfrage nicht an.
    } catch (err) {
      // Ungültiges JSON; ohne wüsste der Client nicht, warum die Anfrage fehlschlug.
      sendError(null, -32700, `Parse error: ${err.message}`);
    }
  });

  rl.on("close", () => {
    // stdin geschlossen → Server beenden; ohne würde der Prozess hängen bleiben.
    process.exit(0);
  });

  console.error(
    "[MCP shimwrappercheck] Server started on stdio. Project root:",
    projectRoot,
  );
}

main();
