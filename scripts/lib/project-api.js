const {
  CONFIG_KEY_ORDER,
  getConfig,
  getProjectPaths,
  listChecks,
  setConfig,
  toggleCheck,
} = require("./project-config-api");
const {
  findLatestReport,
  getAgentsMd,
  readLastError,
  runChecks,
} = require("./project-runtime-api");

/**
 * Aggregated project API exports.
 * Purpose: Keep existing import sites stable while the implementation is split into smaller focused modules.
 * Problem solved: We keep file sizes under the project rule without forcing every caller to know the new module layout.
 */
module.exports = {
  CONFIG_KEY_ORDER,
  findLatestReport,
  getAgentsMd,
  getConfig,
  getProjectPaths,
  listChecks,
  readLastError,
  runChecks,
  setConfig,
  toggleCheck,
};
