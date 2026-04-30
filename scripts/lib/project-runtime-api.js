const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const { getProjectPaths } = require("./project-config-api");

/**
 * Read .shim/last_error.json in a safe way.
 * Purpose: Expose the most recent failing check for status queries and self-healing flows.
 * Input: projectRootInput (string|undefined). Output: parsed object or null.
 */
function readLastError(projectRootInput) {
  const { projectRoot } = getProjectPaths(projectRootInput);
  const lastErrorPath = path.join(projectRoot, ".shim", "last_error.json"); // nosemgrep: path-join-resolve-traversal
  if (!fs.existsSync(lastErrorPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(lastErrorPath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Resolve the review output directory from dashboard presets with a safe fallback.
 * Purpose: "report latest" should follow the same reviewOutputPath users configure in the dashboard.
 * Input: projectRootInput (string|undefined). Output: absolute review directory path.
 */
function resolveReviewDirectory(projectRootInput) {
  const { projectRoot, presetsPath } = getProjectPaths(projectRootInput);
  let configuredDirectory = "reports";

  if (fs.existsSync(presetsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(presetsPath, "utf8"));
      if (
        typeof parsed.reviewOutputPath === "string" &&
        parsed.reviewOutputPath.trim()
      ) {
        configuredDirectory = parsed.reviewOutputPath.trim();
      }
    } catch {
      configuredDirectory = "reports";
    }
  }

  const resolvedDirectory = path.resolve(projectRoot, configuredDirectory); // nosemgrep: path-join-resolve-traversal
  const safePrefix = projectRoot.endsWith(path.sep)
    ? projectRoot
    : `${projectRoot}${path.sep}`;
  if (
    resolvedDirectory !== projectRoot &&
    !resolvedDirectory.startsWith(safePrefix)
  ) {
    return path.join(projectRoot, "reports"); // nosemgrep: path-join-resolve-traversal
  }

  return resolvedDirectory;
}

/**
 * Find the newest markdown review report for the current project.
 * Purpose: Mirror the MCP get_latest_report behavior for shell automation.
 * Input: projectRootInput (string|undefined). Output: { found, path?, name?, content? }.
 */
function findLatestReport(projectRootInput) {
  const reviewDirectory = resolveReviewDirectory(projectRootInput);
  if (!fs.existsSync(reviewDirectory)) {
    return { found: false, directory: reviewDirectory };
  }

  const markdownFiles = fs
    .readdirSync(reviewDirectory)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => ({
      name: fileName,
      fullPath: path.join(reviewDirectory, fileName), // nosemgrep: path-join-resolve-traversal
      mtimeMs: fs.statSync(path.join(reviewDirectory, fileName)).mtimeMs, // nosemgrep: path-join-resolve-traversal
    }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs);

  if (markdownFiles.length === 0) {
    return { found: false, directory: reviewDirectory };
  }

  const latestFile = markdownFiles[0];
  return {
    found: true,
    directory: reviewDirectory,
    path: latestFile.fullPath,
    name: latestFile.name,
    content: fs.readFileSync(latestFile.fullPath, "utf8").slice(0, 50000),
  };
}

/**
 * Read AGENTS.md from the current project root.
 * Purpose: Structured CLI callers should be able to inspect project instructions without opening files manually.
 * Input: projectRootInput (string|undefined). Output: { found, path?, content? }.
 */
function getAgentsMd(projectRootInput) {
  const { projectRoot } = getProjectPaths(projectRootInput);
  const agentsPath = path.join(projectRoot, "AGENTS.md"); // nosemgrep: path-join-resolve-traversal
  if (!fs.existsSync(agentsPath)) {
    return { found: false, message: "No AGENTS.md found in project root." };
  }

  try {
    return {
      found: true,
      path: agentsPath,
      content: fs.readFileSync(agentsPath, "utf8").slice(0, 50000),
    };
  } catch {
    return { found: false, message: "Could not read AGENTS.md." };
  }
}

/**
 * Resolve the check runner entrypoint from the project first, then from the installed package.
 * Purpose: A local project override should win, but the package fallback keeps commands usable before init copies scripts.
 * Inputs: projectRoot (string). Output: { command, args } or null.
 */
function resolveCheckRunner(projectRoot) {
  const runChecksCandidates = [
    path.join(projectRoot, "scripts", "run-checks.sh"), // nosemgrep: path-join-resolve-traversal
    path.join(__dirname, "..", "run-checks.sh"),
  ];
  for (const candidate of runChecksCandidates) {
    if (fs.existsSync(candidate)) {
      return { command: "bash", args: [candidate] };
    }
  }

  const shimRunnerCandidates = [
    path.join(projectRoot, "scripts", "shim-runner.js"), // nosemgrep: path-join-resolve-traversal
    path.join(__dirname, "..", "shim-runner.js"),
  ];
  for (const candidate of shimRunnerCandidates) {
    if (fs.existsSync(candidate)) {
      return { command: process.execPath, args: [candidate] };
    }
  }

  return null;
}

/**
 * Execute the configured check runner and return a structured result.
 * Purpose: Provide a JSON-friendly command runner for CLI parity and future automation.
 * Inputs: projectRootInput (string|undefined), opts (object). Output: structured run result.
 */
function runChecks(projectRootInput, opts = {}) {
  const { projectRoot } = getProjectPaths(projectRootInput);
  const runner = resolveCheckRunner(projectRoot);
  if (!runner) {
    return {
      exitCode: 1,
      passed: false,
      stdout: "",
      stderr: "No run-checks.sh or shim-runner.js found in project or package.",
      lastError: null,
      timedOut: false,
    };
  }

  const args = [...runner.args];
  if (opts.frontend === true) args.push("--frontend");
  if (opts.backend === true) args.push("--backend");
  if (opts.frontend === false) args.push("--no-frontend");
  if (opts.backend === false) args.push("--no-backend");
  if (opts.noAiReview) args.push("--no-ai-review");
  if (opts.noExplanationCheck) args.push("--no-explanation-check");
  if (opts.noI18nCheck) args.push("--no-i18n-check");
  if (opts.noSast) args.push("--no-sast");
  if (opts.noGitleaks) args.push("--no-gitleaks");
  if (opts.noRuff) args.push("--no-ruff");
  if (opts.noShellcheck) args.push("--no-shellcheck");
  if (opts.refactor) args.push("--refactor");
  if (opts.until95) args.push("--until-95");

  const env = { ...process.env, SHIM_PROJECT_ROOT: projectRoot };
  if (opts.checkMode) {
    env.CHECK_MODE = opts.checkMode;
  }

  const result = spawnSync(runner.command, args, { // nosemgrep: detect-child-process
    cwd: projectRoot,
    env,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: Number(opts.timeoutSec || 600) * 1000,
  });

  const exitCode = result.status ?? 1;
  return {
    command: runner.command,
    args,
    exitCode,
    passed: exitCode === 0,
    stdout: String(result.stdout || "").slice(0, 50000),
    stderr: String(result.stderr || "").slice(0, 20000),
    lastError: readLastError(projectRoot),
    timedOut: Boolean(result.error && result.error.code === "ETIMEDOUT"),
    error: result.error ? result.error.message : null,
  };
}

module.exports = {
  findLatestReport,
  getAgentsMd,
  readLastError,
  runChecks,
};
