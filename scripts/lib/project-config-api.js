const fs = require("fs");
const path = require("path");

const { CHECK_CATALOG } = require("./check-catalog");
const { readRcFile, writeRcFile } = require("./rc-utils");
const { getCoreIfReady } = require("./core-bridge");

/**
 * Preferred key ordering for .shimwrappercheckrc writes.
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

function getProjectPaths(projectRootInput) {
  const core = getCoreIfReady();
  if (core?.getProjectPaths) {
    return core.getProjectPaths(projectRootInput);
  }

  const projectRoot =
    projectRootInput || process.env.SHIM_PROJECT_ROOT || process.cwd();
  return {
    projectRoot,
    rcPath: path.join(projectRoot, ".shimwrappercheckrc"),
    presetsPath: path.join(projectRoot, ".shimwrappercheck-presets.json"),
  };
}

function readRcHeaderLine(rcPath) {
  if (!fs.existsSync(rcPath)) {
    return "# shimwrappercheck config (managed by shimwrappercheck CLI)";
  }

  const lines = fs.readFileSync(rcPath, "utf8").split(/\r?\n/);
  const headerLine = lines.find((line) => line.trim().startsWith("#"));
  return (
    headerLine || "# shimwrappercheck config (managed by shimwrappercheck CLI)"
  );
}

function loadCheckCatalog(projectRoot) {
  const candidatePaths = [
    ...new Set([
      path.join(projectRoot, "scripts", "lib", "check-catalog.js"),
      path.join(__dirname, "check-catalog.js"),
    ]),
  ];

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

function getConfig(projectRootInput) {
  const core = getCoreIfReady();
  if (core?.getLegacyConfig) {
    return core.getLegacyConfig(projectRootInput);
  }

  const { rcPath } = getProjectPaths(projectRootInput);
  return {
    path: rcPath,
    config: readRcFile(rcPath),
  };
}

function setConfig(projectRootInput, values) {
  const core = getCoreIfReady();
  if (core?.setLegacyConfig) {
    return core.setLegacyConfig(values, projectRootInput);
  }

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

function toggleCheck(projectRootInput, envKey, enabled) {
  const core = getCoreIfReady();
  if (core?.toggleLegacyCheck) {
    return core.toggleLegacyCheck(envKey, enabled, projectRootInput);
  }

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

function listChecks(projectRootInput) {
  const core = getCoreIfReady();
  if (core?.listChecksWithState) {
    return core.listChecksWithState(projectRootInput);
  }

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
