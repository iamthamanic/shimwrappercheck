const fs = require("fs");
const path = require("path");

const { CHECK_CATALOG } = require("./check-catalog");
const { readRcFile, writeRcFile } = require("./rc-utils");

/**
 * Preferred key ordering for .shimwrappercheckrc writes.
 * Purpose: Keep machine-written config files stable and easy to diff.
 * Problem solved: Without a shared order, different commands rewrite the same file with noisy key shuffling.
 */
const CONFIG_KEY_ORDER = [
  "SHIM_ENFORCE_COMMANDS",
  "SHIM_HOOK_COMMANDS",
  "SHIM_AUTO_PUSH",
  "SHIM_GIT_ENFORCE_COMMANDS",
  "SHIM_GIT_CHECK_MODE_ON_PUSH",
  "SHIM_AI_REVIEW_PROVIDER",
  "CHECK_MODE",
  "SHIM_AUDIT_LEVEL",
  "SHIM_CONTINUE_ON_ERROR",
  "SHIM_STRICT_NETWORK_CHECKS",
  "SHIM_I18N_REQUIRE_MESSAGES_DIR",
  "SHIM_CHECK_ORDER",
  ...CHECK_CATALOG.map((entry) => entry.envKey),
];

/**
 * Resolve the core project file paths from an optional root override.
 * Purpose: Give all config-oriented helpers one canonical path lookup.
 * Input: projectRootInput (string|undefined). Output: object with absolute paths.
 */
function getProjectPaths(projectRootInput) {
  const projectRoot = projectRootInput || process.env.SHIM_PROJECT_ROOT || process.cwd();
  return {
    projectRoot,
    rcPath: path.join(projectRoot, ".shimwrappercheckrc"),
    presetsPath: path.join(projectRoot, ".shimwrappercheck-presets.json"),
  };
}

/**
 * Preserve the existing rc header comment when rewriting the file.
 * Purpose: Programmatic config writes should not drop the first human-facing explanation line.
 * Input: rcPath (string). Output: header line string.
 */
function readRcHeaderLine(rcPath) {
  if (!fs.existsSync(rcPath)) {
    return "# shimwrappercheck config (managed by shimwrappercheck CLI)";
  }

  const lines = fs.readFileSync(rcPath, "utf8").split(/\r?\n/);
  const headerLine = lines.find((line) => line.trim().startsWith("#"));
  return headerLine || "# shimwrappercheck config (managed by shimwrappercheck CLI)";
}

/**
 * Load the local check catalog when available, otherwise use the packaged one.
 * Purpose: Repo development and installed package usage should both see the correct check definitions.
 * Input: projectRoot (string). Output: array of catalog entries.
 */
function loadCheckCatalog(projectRoot) {
  const candidatePaths = [...new Set([
    path.join(projectRoot, "scripts", "lib", "check-catalog.js"),
    path.join(__dirname, "check-catalog.js"),
  ])];

  for (const candidatePath of candidatePaths) {
    if (!fs.existsSync(candidatePath)) continue;

    try {
      const catalogModule = require(candidatePath);
      return catalogModule.CHECK_CATALOG || [];
    } catch {
      continue;
    }
  }

  return [];
}

/**
 * Read .shimwrappercheckrc as a structured object with its absolute path.
 * Purpose: Mirror the MCP get_config behavior for non-interactive CLI callers.
 * Input: projectRootInput (string|undefined). Output: { path, config }.
 */
function getConfig(projectRootInput) {
  const { rcPath } = getProjectPaths(projectRootInput);
  return {
    path: rcPath,
    config: readRcFile(rcPath),
  };
}

/**
 * Update one or more rc keys without dropping other settings.
 * Purpose: Provide the CLI equivalent of the MCP set_config tool.
 * Inputs: projectRootInput (string|undefined), values (object). Output: structured success result.
 */
function setConfig(projectRootInput, values) {
  const { rcPath } = getProjectPaths(projectRootInput);
  const currentConfig = readRcFile(rcPath);
  const nextConfig = { ...currentConfig };

  for (const [key, value] of Object.entries(values || {})) {
    nextConfig[key] = String(value);
  }

  writeRcFile(rcPath, nextConfig, CONFIG_KEY_ORDER, readRcHeaderLine(rcPath));

  return {
    success: true,
    path: rcPath,
    updatedKeys: Object.keys(values || {}),
    config: nextConfig,
  };
}

/**
 * Enable or disable one rc-backed check flag by env key.
 * Purpose: Keep toggle behavior shared between human CLI and machine automation.
 * Inputs: projectRootInput (string|undefined), envKey (string), enabled (boolean). Output: structured success result.
 */
function toggleCheck(projectRootInput, envKey, enabled) {
  const result = setConfig(projectRootInput, {
    [envKey]: enabled ? "1" : "0",
  });

  return {
    ...result,
    envKey,
    enabled,
    message: `${envKey} is now ${enabled ? "enabled" : "disabled"}`,
  };
}

/**
 * List known checks with their current enabled state.
 * Purpose: Provide a stable check inventory for CLI wrappers and agents.
 * Input: projectRootInput (string|undefined). Output: { source, checks }.
 */
function listChecks(projectRootInput) {
  const { projectRoot, rcPath } = getProjectPaths(projectRootInput);
  const config = readRcFile(rcPath);
  const catalog = loadCheckCatalog(projectRoot);

  if (catalog.length === 0) {
    return {
      source: "config-inferred",
      checks: Object.keys(config)
        .filter((key) => key.startsWith("SHIM_RUN_"))
        .map((key) => ({
          id: key.replace("SHIM_RUN_", "").replace(/_/g, ""),
          label: key,
          envKey: key,
          enabled: config[key] !== "0",
          defaultEnabled: true,
        })),
    };
  }

  return {
    source: "check-catalog",
    checks: catalog.map((check) => ({
      id: check.id,
      label: check.label,
      envKey: check.envKey,
      enabled: config[check.envKey] !== "0",
      defaultEnabled: check.defaultEnabled === 1,
    })),
  };
}

module.exports = {
  CONFIG_KEY_ORDER,
  getConfig,
  getProjectPaths,
  listChecks,
  setConfig,
  toggleCheck,
};
