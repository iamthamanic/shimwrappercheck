const fs = require("fs");
const path = require("path");

/**
 * Parse a tiny TOML subset for [mcp_servers.*] sections.
 * Purpose: Read Codex CLI config.toml without adding a full TOML dependency to shimwrappercheck.
 * Input: raw TOML text. Output: normalized object with mcpServers entries.
 */
function parseTomlMcpServers(raw) {
  const result = { mcpServers: {} };
  const lines = String(raw || "").split(/\r?\n/);
  let currentServer = null;
  let currentEnv = {};
  let inEnvSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const sectionMatch = trimmed.match(/^\[mcp_servers\.([^\]]+)\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1];
      if (sectionName.endsWith(".env")) {
        currentServer = sectionName.replace(/\.env$/, "");
        inEnvSection = true;
        currentEnv = {};
      } else {
        currentServer = sectionName;
        inEnvSection = false;
        currentEnv = {};
      }

      if (!result.mcpServers[currentServer]) {
        result.mcpServers[currentServer] = {};
      }
      continue;
    }

    const kvMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*(.+)$/);
    if (!kvMatch || !currentServer) continue;

    const key = kvMatch[1];
    let value = kvMatch[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (inEnvSection) {
      currentEnv[key] = value;
      result.mcpServers[currentServer].env = currentEnv;
      continue;
    }

    if (key === "args") {
      const argsMatch = value.match(/^\[(.*)\]$/);
      if (!argsMatch) {
        result.mcpServers[currentServer].args = [value];
        continue;
      }

      result.mcpServers[currentServer].args = argsMatch[1]
        .split(",")
        .map((entry) => entry.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      continue;
    }

    if (key === "url") {
      result.mcpServers[currentServer].url = value;
      continue;
    }

    result.mcpServers[currentServer][key] = value;
  }

  return result;
}

/**
 * Render one MCP server entry as TOML.
 * Purpose: Codex CLI expects TOML syntax, so dry-runs and config writes need one canonical renderer.
 * Inputs: name (string), config (object). Output: TOML text.
 */
function generateTomlMcpEntry(name, config) {
  const lines = [`[mcp_servers.${name}]`];

  if (config.command) {
    lines.push(`command = "${config.command}"`);
  }

  if (Array.isArray(config.args) && config.args.length > 0) {
    const argsText = config.args.map((entry) => `"${entry}"`).join(", ");
    lines.push(`args = [${argsText}]`);
  }

  if (config.env && Object.keys(config.env).length > 0) {
    lines.push(`[mcp_servers.${name}.env]`);
    for (const [key, value] of Object.entries(config.env)) {
      lines.push(`${key} = "${value}"`);
    }
  }

  return lines.join("\n");
}

/**
 * Write only the shimwrappercheck TOML section while preserving the rest of config.toml.
 * Purpose: Updating Codex CLI MCP config must not delete unrelated model or trust settings.
 * Inputs: configPath (string), serverConfig (object). Output: void.
 */
function writeTomlMcpConfig(configPath, serverConfig) {
  const existingRaw = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
  const lines = existingRaw.split(/\r?\n/);
  const filteredLines = [];
  let skipSection = false;
  const shimSectionPattern = /^\[mcp_servers\.shimwrappercheck(?:\.env)?\]$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("[") && !trimmed.startsWith("[[")) {
      skipSection = shimSectionPattern.test(trimmed);
      if (!skipSection) {
        filteredLines.push(line);
      }
      continue;
    }

    if (!skipSection) {
      filteredLines.push(line);
    }
  }

  let nextRaw = filteredLines.join("\n").replace(/\n+$/, "");
  if (nextRaw && !nextRaw.endsWith("\n")) {
    nextRaw += "\n";
  }
  nextRaw += generateTomlMcpEntry("shimwrappercheck", serverConfig) + "\n";

  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, nextRaw, "utf8");
}

module.exports = {
  generateTomlMcpEntry,
  parseTomlMcpServers,
  writeTomlMcpConfig,
};
