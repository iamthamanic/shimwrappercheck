/**
 * MCP self-configuration tools (configure_mcp, list_mcp_clients).
 */
const path = require("path");
const {
  configureMcpClient,
  listMcpClients,
  resolveServerPath,
} = require("../../scripts/lib/mcp-client-config.js");

/**
 * Configure a supported MCP client to use shimwrappercheck.
 * @param {string} client
 * @param {string} [serverPath]
 * @param {string} projectRoot
 * @param {string} packageRoot
 */
function handleConfigureMcp(client, serverPath, projectRoot, packageRoot) {
  const resolvedServerPath =
    serverPath ||
    resolveServerPath(projectRoot, packageRoot) ||
    path.resolve(__dirname, "..", "server.js");

  return configureMcpClient({
    client,
    projectRoot,
    serverPath: resolvedServerPath,
    write: true,
  });
}

/** List MCP clients and whether shimwrappercheck is configured. */
function handleListMcpClients() {
  return { clients: listMcpClients() };
}

module.exports = {
  handleConfigureMcp,
  handleListMcpClients,
};
