#!/usr/bin/env node
/**
 * Interactive terminal configuration mode for shimwrappercheck.
 * Updates .shimwrappercheckrc without requiring the dashboard.
 */
const path = require("path");
const cp = require("child_process");
const readline = require("readline");
const {
  exists,
  readRcFile,
  parseCsv,
  isEnabled,
  writeRcFile,
} = require("./lib/rc-utils");
const { CHECK_CATALOG, DEFAULT_CHECK_ORDER } = require("./lib/check-catalog");

const projectRoot = process.env.SHIM_PROJECT_ROOT || process.cwd();
const rcPath = path.join(projectRoot, ".shimwrappercheckrc");
const checktoolsPkgPath = path.join(
  projectRoot,
  ".shimwrapper",
  "checktools",
  "package.json",
);
const installCheckDepsScript = path.join(__dirname, "install-check-deps.js");

const ORDERED_KEYS = [
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

function printHelp() {
  console.log("shimwrappercheck config");
  console.log("");
  console.log("Interactive terminal configuration for .shimwrappercheckrc.");
  console.log("Usage:");
  console.log("  npx shimwrappercheck config");
  console.log("  npx shimwrappercheck configure");
}

function normalizeCsv(value) {
  return parseCsv(value).join(",");
}

function createPrompter() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question) =>
    new Promise((resolve) => rl.question(question, resolve));

  const askInput = async (question, defaultValue) => {
    const answer = (await ask(`${question} [${defaultValue}] `)).trim();
    return answer || defaultValue;
  };

  const askYesNo = async (question, defaultYes) => {
    const hint = defaultYes ? "J/n" : "j/N";
    const answer = (await ask(`${question} [${hint}] `)).trim().toLowerCase();
    if (!answer) return defaultYes;
    return ["j", "ja", "y", "yes"].includes(answer);
  };

  return {
    askInput,
    askYesNo,
    close() {
      rl.close();
    },
  };
}

function clampOption(value, allowed, fallback) {
  if (allowed.includes(value)) return value;
  return fallback;
}

function runInstallCheckDeps(target) {
  const result = cp.spawnSync(
    process.execPath,
    [installCheckDepsScript, "--yes", "--target", target],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, SHIM_PROJECT_ROOT: projectRoot },
    },
  );
  if (result.status !== 0) {
    console.error("Dependency installation failed.");
    process.exit(result.status == null ? 1 : result.status);
  }
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printHelp();
    return;
  }

  const prompter = createPrompter();
  const current = readRcFile(rcPath);
  const next = { ...current };
  const defaultOrderValue =
    current.SHIM_CHECK_ORDER || DEFAULT_CHECK_ORDER.join(",");

  console.log("shimwrappercheck terminal config");
  console.log("Projekt:", projectRoot);
  console.log("Config:", rcPath);
  console.log("");

  next.SHIM_ENFORCE_COMMANDS = normalizeCsv(
    await prompter.askInput(
      "Supabase Enforce-Commands (all|none|csv)",
      current.SHIM_ENFORCE_COMMANDS || "all",
    ),
  );
  next.SHIM_HOOK_COMMANDS = normalizeCsv(
    await prompter.askInput(
      "Supabase Hook-Commands (all|none|csv)",
      current.SHIM_HOOK_COMMANDS || "functions,db,migration",
    ),
  );
  next.SHIM_GIT_ENFORCE_COMMANDS = normalizeCsv(
    await prompter.askInput(
      "Git Enforce-Commands (all|none|csv)",
      current.SHIM_GIT_ENFORCE_COMMANDS || "push",
    ),
  );

  next.SHIM_GIT_CHECK_MODE_ON_PUSH = clampOption(
    (
      await prompter.askInput(
        "CHECK_MODE fuer git push (snippet|full)",
        current.SHIM_GIT_CHECK_MODE_ON_PUSH || "snippet",
      )
    )
      .trim()
      .toLowerCase(),
    ["snippet", "full"],
    "snippet",
  );
  next.SHIM_AI_REVIEW_PROVIDER = clampOption(
    (
      await prompter.askInput(
        "AI Review Provider (auto|codex|api)",
        current.SHIM_AI_REVIEW_PROVIDER || "auto",
      )
    )
      .trim()
      .toLowerCase(),
    ["auto", "codex", "api"],
    "auto",
  );
  next.CHECK_MODE = clampOption(
    (
      await prompter.askInput(
        "CHECK_MODE fuer manuelle Runs (full|snippet|mix)",
        current.CHECK_MODE || "full",
      )
    )
      .trim()
      .toLowerCase(),
    ["full", "snippet", "mix"],
    "full",
  );
  next.SHIM_AUDIT_LEVEL = clampOption(
    (
      await prompter.askInput(
        "npm audit Level (critical|high|moderate|low)",
        current.SHIM_AUDIT_LEVEL || "high",
      )
    )
      .trim()
      .toLowerCase(),
    ["critical", "high", "moderate", "low"],
    "high",
  );

  next.SHIM_CONTINUE_ON_ERROR = (await prompter.askYesNo(
    "Checks weiterlaufen lassen und Fehler am Ende sammeln?",
    isEnabled(current.SHIM_CONTINUE_ON_ERROR, 0),
  ))
    ? "1"
    : "0";
  next.SHIM_STRICT_NETWORK_CHECKS = (await prompter.askYesNo(
    "Netzwerk/TLS-Infrafehler bei npm audit/Semgrep als harten Fehler behandeln?",
    isEnabled(current.SHIM_STRICT_NETWORK_CHECKS, 0),
  ))
    ? "1"
    : "0";
  next.SHIM_I18N_REQUIRE_MESSAGES_DIR = (await prompter.askYesNo(
    "Fehlen von messages-Verzeichnissen im i18n-Check als Fehler werten?",
    isEnabled(current.SHIM_I18N_REQUIRE_MESSAGES_DIR, 0),
  ))
    ? "1"
    : "0";

  const configuredOrder = await prompter.askInput(
    "Check-Reihenfolge (CSV, 'none' zum Leeren)",
    defaultOrderValue,
  );
  if (configuredOrder.trim().toLowerCase() === "none") {
    delete next.SHIM_CHECK_ORDER;
  } else {
    next.SHIM_CHECK_ORDER = normalizeCsv(configuredOrder);
  }

  console.log("");
  if (await prompter.askYesNo("Einzelne Check-Toggles im Terminal setzen?", true)) {
    for (const check of CHECK_CATALOG) {
      const enabled = await prompter.askYesNo(
        `${check.label} aktivieren?`,
        isEnabled(current[check.envKey], check.defaultEnabled),
      );
      next[check.envKey] = enabled ? "1" : "0";
    }
  }

  writeRcFile(
    rcPath,
    next,
    ORDERED_KEYS,
    "# shimwrappercheck config (generated by shimwrappercheck config)",
  );
  console.log("");
  console.log(".shimwrappercheckrc wurde aktualisiert.");

  const installDepsNow = await prompter.askYesNo(
    "Check-Dependencies jetzt automatisch installieren?",
    true,
  );
  let selectedTarget = "";
  if (installDepsNow) {
    const defaultTarget = exists(checktoolsPkgPath) ? "checktools" : "project";
    selectedTarget = clampOption(
      (
        await prompter.askInput(
          "Installationsziel (checktools|project)",
          defaultTarget,
        )
      )
        .trim()
        .toLowerCase(),
      ["checktools", "project"],
      defaultTarget,
    );
  }
  prompter.close();

  if (!installDepsNow) {
    console.log("Dependency-Installation uebersprungen.");
    console.log("Spaeter: npx shimwrappercheck install-check-deps");
    return;
  }

  runInstallCheckDeps(selectedTarget);
}

main().catch((error) => {
  console.error("config failed:", error && error.message ? error.message : error);
  process.exit(1);
});
