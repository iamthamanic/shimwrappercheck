const fs = require("fs");
const path = require("path");

const {
  generateTomlMcpEntry,
  parseTomlMcpServers,
  writeTomlMcpConfig,
} = require("./mcp-client-toml");

/**
 * Known MCP client config files that shimwrappercheck can manage directly.
 * Purpose: Keep the supported client matrix in one shared module so setup flows stay aligned.
 * Problem solved: Without a shared map, Codex/Cursor/Claude paths drift and self-configuration becomes inconsistent.
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
 * Resolve the MCP server path from the current project or package installation.
 * Purpose: Let CLI commands and setup flows reuse the same discovery logic regardless of local/dev/global installs.
 * Inputs: projectRoot (string), packageRoot (string). Output: absolute path to mcp/server.js or null.
 */
function resolveServerPath(projectRoot, packageRoot) {
  const candidates = [
    path.join(projectRoot, "mcp", "server.js"),
    path.join(projectRoot, "node_modules", "shimwrappercheck", "mcp", "server.js"),
    path.join(packageRoot, "mcp", "server.js"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Build the shimwrappercheck MCP server entry for a specific project.
 * Purpose: Keep generated config identical across CLI setup and machine-oriented commands.
 * Inputs: serverPath (string), projectRoot (string). Output: config object for one MCP server.
 */
function buildShimServerConfig(serverPath, projectRoot) {
  return {
    command: "node",
    args: [serverPath],
    env: {
      SHIM_PROJECT_ROOT: projectRoot,
    },
  };
}

/**
 * Read an existing MCP client config file in JSON or TOML form.
 * Purpose: Preserve unrelated server entries instead of overwriting the whole file.
 * Inputs: configPath (string), format ("json"|"toml"). Output: normalized config object.
 */
function readMcpClientConfig(configPath, format) {
  if (!fs.existsSync(configPath)) {
    return { mcpServers: {} };
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    if (format === "toml") {
      return parseTomlMcpServers(raw);
    }
    return JSON.parse(raw);
  } catch {
    return { mcpServers: {} };
  }
}

/**
 * Write an MCP client config in the correct file format.
 * Purpose: Hide JSON/TOML branching from callers so setup code stays simple.
 * Inputs: configPath (string), config (object), format ("json"|"toml"). Output: void.
 */
function writeMcpClientConfig(configPath, config, format) {
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (format === "toml") {
    writeTomlMcpConfig(configPath, config.mcpServers?.shimwrappercheck || {});
    return;
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
}

/**
 * List all supported MCP clients and whether shimwrappercheck is already present.
 * Purpose: Query commands need a structured inventory before they decide what to configure.
 * Input: none. Output: array of client descriptor objects.
 */
function listMcpClients() {
  return Object.entries(MCP_CLIENT_CONFIGS).map(([name, info]) => {
    const existing = readMcpClientConfig(info.path, info.format);
    return {
      name,
      description: info.description,
      format: info.format,
      configPath: info.path,
      shimwrappercheckConfigured: !!existing.mcpServers?.shimwrappercheck,
    };
  });
}

/**
 * Add or update the shimwrappercheck MCP entry for one client.
 * Purpose: Power both "mcp-setup" and new non-interactive CLI commands with the same write logic.
 * Inputs: options object with client, projectRoot, serverPath, and write flag. Output: structured result object.
 */
function configureMcpClient(options) {
  const clientInfo = MCP_CLIENT_CONFIGS[options.client];
  if (!clientInfo) {
    return {
      success: false,
      error: `Unknown MCP client: ${options.client}. Supported: ${Object.keys(MCP_CLIENT_CONFIGS).join(", ")}`,
    };
  }

  if (!options.serverPath) {
    return {
      success: false,
      error: "Could not resolve mcp/server.js. Install shimwrappercheck first or pass --server-path.",
    };
  }

  const existingConfig = readMcpClientConfig(clientInfo.path, clientInfo.format);
  const alreadyConfigured = !!existingConfig.mcpServers?.shimwrappercheck;
  const action = alreadyConfigured ? "updated" : "added";
  const serverConfig = buildShimServerConfig(options.serverPath, options.projectRoot);
  const nextConfig = {
    ...existingConfig,
    mcpServers: {
      ...(existingConfig.mcpServers || {}),
      shimwrappercheck: serverConfig,
    },
  };
  const preview =
    clientInfo.format === "toml"
      ? generateTomlMcpEntry("shimwrappercheck", serverConfig)
      : JSON.stringify({ mcpServers: { shimwrappercheck: serverConfig } }, null, 2);

  if (options.write !== false) {
    writeMcpClientConfig(clientInfo.path, nextConfig, clientInfo.format);
  }

  return {
    success: true,
    client: options.client,
    configPath: clientInfo.path,
    format: clientInfo.format,
    action,
    dryRun: options.write === false,
    serverPath: options.serverPath,
    projectRoot: options.projectRoot,
    existingServers: Object.keys(nextConfig.mcpServers),
    preview,
  };
}

module.exports = {
  MCP_CLIENT_CONFIGS,
  buildShimServerConfig,
  configureMcpClient,
  generateTomlMcpEntry,
  listMcpClients,
  parseTomlMcpServers,
  readMcpClientConfig,
  resolveServerPath,
  writeMcpClientConfig,
};
