/**
 * run_checks tool — core engine only.
 */
const { loadCoreModule, PACKAGE_ROOT } = require("../core-bridge.js");
const { getCheckStatus } = require("./reports.js");

async function runChecks(projectRoot, opts = {}) {
  const core = await loadCoreModule();
  if (!core?.runChecksFromMcpOptions) {
    throw new Error(
      "shimwrappercheck core not built. Run: npm run build (packages/core/dist missing)",
    );
  }

  const env = {
    ...process.env,
    SHIM_PROJECT_ROOT: projectRoot,
  };
  if (opts.checkMode) env.CHECK_MODE = opts.checkMode;

  const aggregate = await core.runChecksFromMcpOptions({
    projectRoot,
    packageRoot: PACKAGE_ROOT,
    env,
    checkMode: opts.checkMode,
    frontend: opts.frontend,
    backend: opts.backend,
    noAiReview: opts.noAiReview,
    noExplanationCheck: opts.noExplanationCheck,
    noI18nCheck: opts.noI18nCheck,
    noSast: opts.noSast,
    noGitleaks: opts.noGitleaks,
    noFallow: opts.noFallow,
    noRuff: opts.noRuff,
    noShellcheck: opts.noShellcheck,
    refactor: opts.refactor,
    until95: opts.until95,
    timeoutSec: opts.timeoutSec,
  });

  const lastError = (await getCheckStatus(projectRoot)).error ?? null;

  return {
    ...aggregate,
    lastError,
  };
}

module.exports = { runChecks };
