#!/usr/bin/env node
/**
 * Install npm dependencies needed by enabled shimwrapper checks.
 * Usage:
 *   npx shimwrappercheck install-check-deps
 *   npx shimwrappercheck install-check-deps --all
 *   npx shimwrappercheck install-check-deps --checks lint,typecheck,complexity
 *   npx shimwrappercheck install-check-deps --target checktools|project
 */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const readline = require("readline");
const {
  exists,
  readRcFile,
  parseCsv,
  isEnabled,
} = require("./lib/rc-utils");
const {
  CHECK_CATALOG,
  CHECK_NPM_DEPENDENCIES,
  CHECK_SYSTEM_HINTS,
} = require("./lib/check-catalog");

const projectRoot = process.env.SHIM_PROJECT_ROOT || process.cwd();
const pkgRoot = path.resolve(__dirname, "..");
const templatesDir = path.join(pkgRoot, "templates");
const rcPath = path.join(projectRoot, ".shimwrappercheckrc");
const checktoolsDir = path.join(projectRoot, ".shimwrapper", "checktools");
const checktoolsPkgPath = path.join(checktoolsDir, "package.json");
const projectPkgPath = path.join(projectRoot, "package.json");

function ensureDir(dirPath) {
  if (!exists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function unique(list) {
  return [...new Set(list)];
}

function readJson(filePath) {
  if (!exists(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function ensureChecktoolsPackage() {
  ensureDir(checktoolsDir);
  if (exists(checktoolsPkgPath)) return;
  const templatePath = path.join(templatesDir, "checktools-package.json");
  if (exists(templatePath)) {
    fs.copyFileSync(templatePath, checktoolsPkgPath);
    console.log("Created .shimwrapper/checktools/package.json from template.");
    return;
  }

  const defaultPkg = {
    name: "shimwrapper-checktools",
    private: true,
    devDependencies: {},
  };
  fs.writeFileSync(
    checktoolsPkgPath,
    JSON.stringify(defaultPkg, null, 2) + "\n",
    "utf8",
  );
  console.log("Created .shimwrapper/checktools/package.json.");
}

function printHelp() {
  console.log("shimwrappercheck install-check-deps");
  console.log("");
  console.log("Options:");
  console.log(
    "  --all                     Install deps for all known checks (not only active checks).",
  );
  console.log(
    "  --checks <csv>            Install deps for explicit checks (e.g. lint,typecheck,complexity).",
  );
  console.log(
    "  --target <checktools|project>  Install destination (default: checktools when available).",
  );
  console.log("  --yes                     Do not ask for confirmation.");
  console.log("  --help                    Show this help.");
}

async function askYesNo(question, defaultYes) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const hint = defaultYes ? "J/n" : "j/N";
  const answer = await new Promise((resolve) =>
    rl.question(`${question} [${hint}] `, resolve),
  );
  rl.close();
  const normalized = String(answer || "").trim().toLowerCase();
  if (!normalized) return defaultYes;
  return ["j", "ja", "y", "yes"].includes(normalized);
}

function parseArgs(argv) {
  const options = {
    allChecks: false,
    explicitChecks: [],
    target: "",
    yes: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--all") {
      options.allChecks = true;
      continue;
    }
    if (arg === "--checks") {
      const value = argv[i + 1];
      if (!value) {
        console.error("Missing value for --checks");
        process.exit(1);
      }
      options.explicitChecks = parseCsv(value);
      i += 1;
      continue;
    }
    if (arg === "--target") {
      const value = (argv[i + 1] || "").trim().toLowerCase();
      if (!value) {
        console.error("Missing value for --target");
        process.exit(1);
      }
      if (!["checktools", "project"].includes(value)) {
        console.error("Invalid --target value. Use checktools or project.");
        process.exit(1);
      }
      options.target = value;
      i += 1;
      continue;
    }
    if (arg === "--yes") {
      options.yes = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    console.error("Unknown option:", arg);
    printHelp();
    process.exit(1);
  }

  return options;
}

function resolveTarget(options) {
  if (options.target) return options.target;
  return exists(checktoolsPkgPath) ? "checktools" : "project";
}

function resolveChecks(options, rcValues) {
  if (options.explicitChecks.length > 0) {
    return unique(options.explicitChecks);
  }
  if (options.allChecks) {
    return CHECK_CATALOG.map((entry) => entry.id);
  }

  const configuredOrder = parseCsv(rcValues.SHIM_CHECK_ORDER);
  if (configuredOrder.length > 0) {
    return unique(configuredOrder);
  }

  return CHECK_CATALOG.filter((entry) =>
    isEnabled(rcValues[entry.envKey], entry.defaultEnabled),
  ).map((entry) => entry.id);
}

function resolveNpmDeps(checkIds) {
  const deps = new Set();
  for (const checkId of checkIds) {
    for (const dep of CHECK_NPM_DEPENDENCIES[checkId] || []) {
      deps.add(dep);
    }
  }
  return [...deps];
}

function resolveSystemHints(checkIds) {
  const hints = [];
  for (const checkId of checkIds) {
    if (CHECK_SYSTEM_HINTS[checkId]) {
      hints.push({ checkId, hint: CHECK_SYSTEM_HINTS[checkId] });
    }
  }
  return hints;
}

function collectInstalledDeps(packageJsonPath) {
  const pkg = readJson(packageJsonPath) || {};
  return new Set([
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ]);
}

function installPackages(targetDir, packages) {
  if (packages.length === 0) return 0;
  const result = cp.spawnSync("npm", ["install", "--save-dev", ...packages], {
    cwd: targetDir,
    stdio: "inherit",
    shell: true,
  });
  return result.status == null ? 1 : result.status;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const rcValues = readRcFile(rcPath);
  const checkIds = resolveChecks(options, rcValues);
  const target = resolveTarget(options);
  const npmDeps = resolveNpmDeps(checkIds);
  const systemHints = resolveSystemHints(checkIds);

  if (checkIds.length === 0) {
    console.log(
      "No checks selected. Use --all or --checks <csv> to force dependency installation.",
    );
    return;
  }

  if (target === "checktools") {
    ensureChecktoolsPackage();
  } else if (!exists(projectPkgPath)) {
    console.error(
      "No package.json found in project root. Use --target checktools or create package.json first.",
    );
    process.exit(1);
  }

  const targetDir = target === "checktools" ? checktoolsDir : projectRoot;
  const packageJsonPath =
    target === "checktools" ? checktoolsPkgPath : projectPkgPath;
  const alreadyInstalled = collectInstalledDeps(packageJsonPath);
  const missingDeps = npmDeps.filter((dep) => !alreadyInstalled.has(dep));

  console.log("Selected checks:", checkIds.join(", "));
  console.log(
    "Install target:",
    target === "checktools"
      ? ".shimwrapper/checktools (project-local check tools)"
      : "project package.json",
  );
  if (missingDeps.length > 0) {
    console.log("NPM deps to install:", missingDeps.join(", "));
  } else {
    console.log("All required npm deps are already installed.");
  }

  if (systemHints.length > 0) {
    console.log("");
    console.log("Additional non-npm tooling:");
    for (const entry of systemHints) {
      console.log(`- ${entry.checkId}: ${entry.hint}`);
    }
  }

  if (missingDeps.length === 0) return;

  let shouldInstall = options.yes;
  if (!shouldInstall) {
    shouldInstall = await askYesNo("Install missing dependencies now?", true);
  }
  if (!shouldInstall) {
    console.log("Skipped dependency installation.");
    return;
  }

  console.log("");
  console.log("Installing npm dependencies...");
  const rc = installPackages(targetDir, missingDeps);
  if (rc !== 0) {
    process.exit(rc);
  }
  console.log("Done.");
}

main().catch((error) => {
  console.error(
    "install-check-deps failed:",
    error && error.message ? error.message : error,
  );
  process.exit(1);
});
