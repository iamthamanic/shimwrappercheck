/**
 * Config and check-list tools backed by @shimwrappercheck/core.
 */
const { loadCoreModule } = require("../core-bridge.js");

async function requireCore() {
  const core = await loadCoreModule();
  if (!core) {
    throw new Error(
      "shimwrappercheck core not built. Run: npm run build (packages/core/dist missing)",
    );
  }
  return core;
}

async function getConfig(projectRoot) {
  const core = await requireCore();
  const loaded = core.loadConfig({ projectRoot, env: process.env });
  return {
    path: loaded.path,
    config: loaded.legacy,
    canonical: loaded.config,
    source: "core",
  };
}

async function setConfig(projectRoot, values) {
  const core = await requireCore();
  const patched = core.patchLegacyRc(values, { projectRoot });
  return {
    success: true,
    source: "core",
    message: `Updated ${Object.keys(values).length} key(s) in .shimwrappercheckrc`,
    updatedKeys: Object.keys(values),
    path: patched.path,
  };
}

async function listChecks(projectRoot) {
  const core = await requireCore();
  const { config } = core.loadConfig({ projectRoot, env: process.env });
  const catalog = core.listCheckCatalog();
  return {
    source: "core-registry",
    checks: catalog.map((check) => ({
      id: check.id,
      label: check.label,
      envKey: check.envKey,
      enabled: config.checks[check.id] !== false,
      defaultEnabled: check.defaultEnabled,
      category: check.category,
    })),
  };
}

async function toggleCheck(projectRoot, envKey, enabled) {
  const core = await requireCore();
  return core.toggleLegacyCheck(envKey, enabled, projectRoot);
}

module.exports = {
  getConfig,
  setConfig,
  listChecks,
  toggleCheck,
};
