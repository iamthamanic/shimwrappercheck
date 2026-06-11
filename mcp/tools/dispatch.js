/**
 * Thin MCP tool router — delegates to core-backed modules.
 */
const path = require("path");
const { PACKAGE_ROOT } = require("../core-bridge.js");
const { runChecks } = require("./run-checks-tool.js");
const { getConfig, setConfig, listChecks, toggleCheck } = require("./config.js");
const { getLatestReport, getCheckStatus } = require("./reports.js");
const { getAgentsMd } = require("./agents.js");
const { listModels, setModel } = require("./models.js");
const {
  handleConfigureMcp,
  handleListMcpClients,
} = require("./mcp-config.js");

/**
 * Dispatch one MCP tool call.
 * @param {string} toolName
 * @param {Record<string, unknown>} args
 * @param {{ projectRoot: string }} ctx
 */
async function handleToolCall(toolName, args, ctx) {
  const { projectRoot } = ctx;

  switch (toolName) {
    case "run_checks":
      return runChecks(projectRoot, {
        checkMode: args.checkMode,
        frontend: args.frontend,
        backend: args.backend,
        noAiReview: args.noAiReview,
        noExplanationCheck: args.noExplanationCheck,
        noI18nCheck: args.noI18nCheck,
        noSast: args.noSast,
        noGitleaks: args.noGitleaks,
        noFallow: args.noFallow,
        noRuff: args.noRuff,
        noShellcheck: args.noShellcheck,
        refactor: args.refactor,
        until95: args.until95,
        timeoutSec: args.timeoutSec,
      });

    case "get_check_status":
      return getCheckStatus(projectRoot);

    case "get_config":
      return getConfig(projectRoot);

    case "set_config":
      return setConfig(projectRoot, args.values || {});

    case "list_checks":
      return listChecks(projectRoot);

    case "toggle_check":
      return toggleCheck(projectRoot, args.envKey, args.enabled);

    case "get_latest_report":
      return getLatestReport(projectRoot);

    case "check_update": {
      const { checkUpdate } = require(
        path.join(PACKAGE_ROOT, "scripts", "check-update"),
      );
      return checkUpdate();
    }

    case "configure_mcp":
      return handleConfigureMcp(
        args.client,
        args.serverPath,
        projectRoot,
        PACKAGE_ROOT,
      );

    case "list_mcp_clients":
      return handleListMcpClients();

    case "get_agents_md":
      return getAgentsMd(projectRoot);

    case "list_models":
      return listModels(projectRoot);

    case "set_model":
      return setModel(projectRoot, args.model);

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

module.exports = { handleToolCall };
