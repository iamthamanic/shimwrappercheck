#!/usr/bin/env node
/**
 * CLI-Befehl für MCP-Setup: Konfiguriert einen MCP-Client (Cursor, Claude Desktop, Codex CLI)
 * so dass shimwrappercheck als MCP-Server verfügbar ist.
 * Zweck: Agenten können diesen Befehl im Terminal ausführen, um sich selbst zu konfigurieren.
 * Problem: Ohne diesen Befehl müssten Nutzer manuell JSON/TOML-Dateien bearbeiten.
 * Usage: npx shimwrappercheck mcp-setup [--client cursor|claude-desktop|codex-cli] [--print]
 *   --client: Welcher MCP-Client konfiguriert werden soll (default: alle erkannten).
 *   --print: Config nur anzeigen, nicht schreiben (dry-run).
 * Location: scripts/mcp-setup.js
 */
const path = require("path");
const fs = require("fs");

const projectRoot = process.env.SHIM_PROJECT_ROOT || process.cwd();
const pkgRoot = path.join(__dirname, "..");

/**
 * Bekannte MCP-Client-Config-Pfade.
 * Zweck: Gleiche Daten wie im MCP-Server; ohne müssten wir sie duplizieren.
 */
const MCP_CLIENTS = {
  cursor: {
    path: path.join(process.env.HOME || "~", ".cursor", "mcp.json"),
    format: "json",
    label: "Cursor IDE",
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
    label: "Claude Desktop",
  },
  "codex-cli": {
    path: path.join(process.env.HOME || "~", ".codex", "config.toml"),
    format: "toml",
    label: "Codex CLI",
  },
};

/**
 * Erzeugt die Server-Pfad-Konfiguration.
 * Zweck: Findet mcp/server.js im Projekt oder Paket; ohne wüssten wir nicht, wo der Server liegt.
 */
function resolveServerPath() {
  // 1. Im Projekt selbst
  const localPath = path.join(projectRoot, "mcp", "server.js");
  if (fs.existsSync(localPath)) return localPath;

  // 2. Im node_modules des Pakets
  const pkgPath = path.join(projectRoot, "node_modules", "shimwrappercheck", "mcp", "server.js");
  if (fs.existsSync(pkgPath)) return pkgPath;

  // 3. Im Paket-Quellverzeichnis (Entwicklung)
  const devPath = path.join(pkgRoot, "mcp", "server.js");
  if (fs.existsSync(devPath)) return devPath;

  // Fallback: npx-basiert (kein Pfad nötig, npx löst auf)
  return null;
}

/**
 * Liest eine bestehende JSON-Config.
 * Zweck: Bestehende Server-Einträge dürfen nicht verloren gehen.
 */
function readJsonConfig(configPath) {
  if (!fs.existsSync(configPath)) return { mcpServers: {} };
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return { mcpServers: {} };
  }
}

/**
 * Schreibt JSON-Config.
 * Zweck: Atomarer Write mit mkdir-p; ohne gäbe es ENOENT.
 */
function writeJsonConfig(configPath, config) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

/**
 * Einfacher TOML-Parser für [mcp_servers.*]-Sektionen.
 * Zweck: Gleich wie im MCP-Server; ohne könnten wir Codex CLI nicht lesen.
 */
function parseTomlMcpServers(raw) {
  const result = { mcpServers: {} };
  const lines = raw.split(/\r?\n/);
  let currentServer = null;
  let inEnv = false;
  let currentEnv = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const sectionMatch = trimmed.match(/^\[mcp_servers\.([^\]]+)\]$/);
    if (sectionMatch) {
      const name = sectionMatch[1];
      if (name.endsWith(".env")) {
        currentServer = name.replace(/\.env$/, "");
        inEnv = true;
        currentEnv = {};
        if (!result.mcpServers[currentServer]) result.mcpServers[currentServer] = {};
      } else {
        currentServer = name;
        inEnv = false;
        currentEnv = {};
        if (!result.mcpServers[currentServer]) result.mcpServers[currentServer] = {};
      }
      continue;
    }
    const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (kvMatch && currentServer) {
      const key = kvMatch[1];
      let value = kvMatch[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (inEnv) {
        currentEnv[key] = value;
        result.mcpServers[currentServer].env = currentEnv;
      } else if (key === "args") {
        try {
          const arrMatch = value.match(/^\[(.*)\]$/);
          if (arrMatch) {
            result.mcpServers[currentServer].args = arrMatch[1]
              .split(",")
              .map((s) => s.trim().replace(/^["']|["']$/g, ""))
              .filter(Boolean);
          }
        } catch {
          result.mcpServers[currentServer].args = [value];
        }
      } else if (key === "url") {
        result.mcpServers[currentServer].url = value;
      } else {
        result.mcpServers[currentServer][key] = value;
      }
    }
  }
  return result;
}

/**
 * Erzeugt TOML-Text für einen mcp_servers-Eintrag.
 * Zweck: Codex CLI erwartet TOML; ohne könnten wir Codex nicht konfigurieren.
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
 * Schreibt TOML-Config, indem shimwrappercheck-Sektion ersetzt wird.
 * Zweck: Andere Einstellungen in config.toml bleiben erhalten; ohne würden wir sie löschen.
 */
function writeTomlConfig(configPath, serverConfig) {
  let existingRaw = "";
  if (fs.existsSync(configPath)) existingRaw = fs.readFileSync(configPath, "utf8");

  // Alte shimwrappercheck-Sektion entfernen
  const lines = existingRaw.split(/\r?\n/);
  const filtered = [];
  let skip = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && !trimmed.startsWith("[[")) {
      skip = trimmed.startsWith("[mcp_servers.shimwrappercheck]");
    }
    if (!skip) filtered.push(line);
  }

  // Neue Sektion anhängen
  const newEntry = generateTomlMcpEntry("shimwrappercheck", serverConfig);
  let result = filtered.join("\n").replace(/\n+$/, "");
  if (result && !result.endsWith("\n")) result += "\n";
  result += newEntry + "\n";

  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, result, "utf8");
}

/**
 * Hauptfunktion: Konfiguriert den angegebenen MCP-Client.
 * Zweck: Orchestriert den gesamten Setup-Flow; ohne gäbe es keinen CLI-Einstieg.
 */
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--print") || args.includes("--dry-run"); // Nur anzeigen, nicht schreiben; ohne würde --print nichts tun.
  const helpFlag = args.includes("--help") || args.includes("-h");

  // Client-Flag parsen
  let targetClient = null;
  const clientIdx = args.indexOf("--client");
  if (clientIdx !== -1 && args[clientIdx + 1]) {
    targetClient = args[clientIdx + 1]; // Explizit angegebener Client; ohne würden wir alle konfigurieren.
  }

  if (helpFlag) {
    console.log("shimwrappercheck mcp-setup");
    console.log("");
    console.log("Configure an MCP client so AI agents can use shimwrappercheck tools.");
    console.log("");
    console.log("Usage:");
    console.log("  npx shimwrappercheck mcp-setup              # Configure all detected clients");
    console.log("  npx shimwrappercheck mcp-setup --client cursor   # Configure Cursor only");
    console.log("  npx shimwrappercheck mcp-setup --client codex-cli # Configure Codex CLI only");
    console.log("  npx shimwrappercheck mcp-setup --client claude-desktop  # Configure Claude only");
    console.log("  npx shimwrappercheck mcp-setup --print      # Dry-run: show config without writing");
    console.log("");
    console.log("Supported clients: cursor, claude-desktop, codex-cli");
    console.log("Project root:", projectRoot);
    return;
  }

  const serverPath = resolveServerPath(); // Server-Pfad ermitteln; ohne wüssten wir nicht, was in die Config soll.
  if (!serverPath) {
    console.error("Error: Could not find mcp/server.js. Install shimwrappercheck first.");
    process.exit(1);
  }

  console.log("shimwrappercheck MCP Setup");
  console.log("Project:", projectRoot);
  console.log("Server:", serverPath);
  console.log("");

  // Server-Config-Block (gleich für alle Clients)
  const serverConfig = {
    command: "node",
    args: [serverPath],
    env: { SHIM_PROJECT_ROOT: projectRoot },
  };

  // JSON-Config-Block (für Cursor, Claude Desktop)
  const jsonServerConfig = {
    shimwrappercheck: serverConfig,
  };

  // Zu konfigurierende Clients bestimmen
  const clientsToConfigure = targetClient
    ? { [targetClient]: MCP_CLIENTS[targetClient] } // Nur den angegebenen Client; ohne würden wir alle konfigurieren.
    : MCP_CLIENTS; // Alle Clients; ohne müsste der Nutzer --client angeben.

  let configured = 0;
  for (const [name, info] of Object.entries(clientsToConfigure)) {
    if (!info) {
      console.error(`Unknown client: ${name}. Supported: ${Object.keys(MCP_CLIENTS).join(", ")}`);
      continue;
    }

    // Prüfen ob bereits konfiguriert
    let alreadyConfigured = false;
    if (info.format === "toml") {
      if (fs.existsSync(info.path)) {
        const existing = parseTomlMcpServers(fs.readFileSync(info.path, "utf8"));
        alreadyConfigured = !!existing.mcpServers?.shimwrappercheck;
      }
    } else {
      const existing = readJsonConfig(info.path);
      alreadyConfigured = !!existing.mcpServers?.shimwrappercheck;
    }

    console.log(`${info.label} (${name}):`);
    console.log(`  Config: ${info.path}`);
    console.log(`  Format: ${info.format}`);
    console.log(`  Already configured: ${alreadyConfigured ? "yes" : "no"}`);

    if (dryRun) {
      // Nur anzeigen, nicht schreiben; ohne würde --print nichts tun.
      console.log(`  Action: would ${alreadyConfigured ? "update" : "add"} shimwrappercheck server`);
      if (info.format === "toml") {
        console.log("  Entry:");
        console.log(generateTomlMcpEntry("shimwrappercheck", serverConfig)
          .split("\n")
          .map((l) => "    " + l)
          .join("\n"));
      } else {
        console.log("  Entry:");
        console.log(JSON.stringify(jsonServerConfig, null, 2)
          .split("\n")
          .map((l) => "    " + l)
          .join("\n"));
      }
    } else {
      // Konfiguration schreiben; ohne würde der Agent den Server nicht nutzen können.
      try {
        if (info.format === "toml") {
          writeTomlConfig(info.path, serverConfig);
        } else {
          const existing = readJsonConfig(info.path);
          existing.mcpServers = existing.mcpServers || {};
          existing.mcpServers.shimwrappercheck = serverConfig;
          writeJsonConfig(info.path, existing);
        }
        console.log(`  ✓ ${alreadyConfigured ? "Updated" : "Added"} shimwrappercheck server`);
        configured++;
      } catch (err) {
        console.error(`  ✗ Error: ${err.message}`);
        console.error(`  Try: manually add the entry to ${info.path}`);
      }
    }
    console.log("");
  }

  if (!dryRun) {
    console.log(`Configured ${configured} client(s).`);
    console.log("");
    console.log("Available MCP tools:");
    console.log("  run_checks, get_check_status, get_config, set_config,");
    console.log("  list_checks, toggle_check, get_latest_report,");
    console.log("  configure_mcp, list_mcp_clients, get_agents_md");
    console.log("");
    console.log("Restart your MCP client to apply changes.");
  }
}

main();
