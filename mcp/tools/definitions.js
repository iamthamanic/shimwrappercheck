/** MCP tool schemas exposed by shimwrappercheck. */
const TOOLS = [
  {
    name: "run_checks",
    description:
      "Run shimwrappercheck checks (lint, build, AI review, etc.) and return structured results with pass/fail, per-check status, infra_error ids, stdout, stderr, and last error for agent self-healing.",
    inputSchema: {
      type: "object",
      properties: {
        checkMode: {
          type: "string",
          enum: ["full", "snippet", "commit"],
          description:
            "AI review scope: full (whole codebase, chunked), snippet (changed files only), commit (last commit only). Default: from .shimwrappercheckrc",
        },
        frontend: { type: "boolean", description: "Run frontend checks (default: true)" },
        backend: { type: "boolean", description: "Run backend checks (default: true)" },
        noAiReview: { type: "boolean", description: "Skip AI review check" },
        noExplanationCheck: { type: "boolean", description: "Skip Full Explanation check" },
        noI18nCheck: { type: "boolean", description: "Skip i18n check" },
        noSast: { type: "boolean", description: "Skip Semgrep SAST scan" },
        noGitleaks: { type: "boolean", description: "Skip Gitleaks secret scan" },
        noFallow: { type: "boolean", description: "Skip Fallow codebase intelligence check" },
        noRuff: { type: "boolean", description: "Skip Ruff Python linter" },
        noShellcheck: { type: "boolean", description: "Skip Shellcheck" },
        refactor: { type: "boolean", description: "Force CHECK_MODE=full for refactor loop" },
        until95: {
          type: "boolean",
          description: "Force CHECK_MODE=full and loop until all chunks >= 95%",
        },
        timeoutSec: { type: "number", description: "Timeout in seconds (default: 600)" },
      },
    },
  },
  {
    name: "get_check_status",
    description:
      "Get the last check error from .shim/last_error.json for agent self-healing. Returns null if last run passed.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_config",
    description: "Read .shimwrappercheckrc as structured key-value pairs.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_config",
    description: "Update keys in .shimwrappercheckrc (partial update).",
    inputSchema: {
      type: "object",
      properties: {
        values: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      },
      required: ["values"],
    },
  },
  {
    name: "list_checks",
    description: "List available checks with enabled state from config.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "toggle_check",
    description: "Enable or disable a check by env key (e.g. SHIM_RUN_LINT).",
    inputSchema: {
      type: "object",
      properties: {
        envKey: { type: "string" },
        enabled: { type: "boolean" },
      },
      required: ["envKey", "enabled"],
    },
  },
  {
    name: "check_update",
    description: "Check npm for a newer shimwrappercheck version.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_latest_report",
    description: "Read the latest AI review markdown report.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "configure_mcp",
    description: "Configure Cursor, Claude Desktop, or Codex CLI to use this MCP server.",
    inputSchema: {
      type: "object",
      properties: {
        client: { type: "string", enum: ["cursor", "claude-desktop", "codex-cli"] },
        serverPath: { type: "string" },
      },
      required: ["client"],
    },
  },
  {
    name: "list_mcp_clients",
    description: "List supported MCP clients and shimwrappercheck config status.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_agents_md",
    description: "Read project AGENTS.md instructions.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_models",
    description: "List models from SHIM_AI_CUSTOM_BASE_URL (Ollama/OpenAI-compatible).",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "set_model",
    description: "Set SHIM_AI_CUSTOM_MODEL in .shimwrappercheckrc.",
    inputSchema: {
      type: "object",
      properties: { model: { type: "string" } },
      required: ["model"],
    },
  },
];

module.exports = { TOOLS };
