/**
 * Review report and last-error tools via core.
 */
const { loadCoreModule } = require("../core-bridge.js");

async function getLatestReport(projectRoot) {
  const core = await loadCoreModule();
  if (!core?.findLatestReviewReport) {
    return { found: false, message: "Core engine not built." };
  }
  return core.findLatestReviewReport(projectRoot);
}

async function getCheckStatus(projectRoot) {
  const core = await loadCoreModule();
  if (!core?.readLastErrorEntry) {
    return {
      hasError: false,
      message: "Core engine not built.",
    };
  }
  const lastError = core.readLastErrorEntry(projectRoot);
  return lastError
    ? { hasError: true, error: lastError }
    : {
        hasError: false,
        message: "No last error found. Last run passed or no run yet.",
      };
}

module.exports = {
  getLatestReport,
  getCheckStatus,
};
