#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const readline = require("readline");

const projectRoot = process.cwd();
const pkgRoot = path.join(__dirname, "..");
const templatesDir = path.join(pkgRoot, "templates");
const pkgJson = require("../package.json");

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasCommand(cmd) {
  try {
    cp.execSync(`command -v ${cmd}`, { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
}

function isGitRepo() {
  try {
    cp.execSync("git rev-parse --is-inside-work-tree", {
      stdio: "ignore",
      shell: true,
    });
    return true;
  } catch {
    return exists(path.join(projectRoot, ".git"));
  }
}

function ensureDir(dirPath) {
  if (!exists(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyTemplate(templateName, destPath, makeExecutable) {
  const src = path.join(templatesDir, templateName);
  ensureDir(path.dirname(destPath));
  fs.copyFileSync(src, destPath);
  if (makeExecutable) {
    try {
      fs.chmodSync(destPath, 0o755);
    } catch {
      // ignore chmod errors
    }
  }
}

function formatBool(val) {
  return val ? "ja" : "nein";
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question) =>
    new Promise((resolve) => rl.question(question, resolve));

  const askYesNo = async (question, defaultYes) => {
    const hint = defaultYes ? "J/n" : "j/N";
    const answer = (await ask(`${question} [${hint}] `)).trim().toLowerCase();
    if (!answer) return defaultYes;
    return ["j", "ja", "y", "yes"].includes(answer);
  };

  const askInput = async (question, def) => {
    const answer = (await ask(`${question} [${def}] `)).trim();
    return answer || def;
  };

  const packagePath = path.join(projectRoot, "package.json");
  const projectPackage = readJson(packagePath);

  const hasSupabase =
    exists(path.join(projectRoot, "supabase")) ||
    exists(path.join(projectRoot, "supabase", "config.toml")) ||
    exists(path.join(projectRoot, "supabase", "functions"));
  const hasSupabaseFunctions = exists(
    path.join(projectRoot, "supabase", "functions"),
  );
  const hasSrc = exists(path.join(projectRoot, "src"));
  const hasGit = isGitRepo();
  const hasPackageJson = !!projectPackage;
  const hasHusky =
    exists(path.join(projectRoot, ".husky")) ||
    (projectPackage &&
      projectPackage.devDependencies &&
      projectPackage.devDependencies.husky);

  console.log("shimwrappercheck init");
  console.log("Projekt:", projectRoot);
  console.log("Gefundene Signale:");
  let repoType = "unbekannt";
  if (hasSupabase && hasSrc) {
    repoType = "mixed (frontend + backend)";
  } else if (hasSupabase) {
    repoType = hasSupabaseFunctions
      ? "backend (supabase functions)"
      : "backend (supabase)";
  } else if (hasSrc) {
    repoType = "frontend";
  }

  console.log(
    `- Supabase: ${formatBool(hasSupabase)}${hasSupabaseFunctions ? " (functions)" : ""}`,
  );
  console.log(`- Frontend (src/): ${formatBool(hasSrc)}`);
  console.log(`- Git Repo: ${formatBool(hasGit)}`);
  console.log(`- package.json: ${formatBool(hasPackageJson)}`);
  console.log(`- Husky: ${formatBool(hasHusky)}`);
  console.log(`- Repo-Typ: ${repoType}`);
  console.log("");

  const enableSupabase = await askYesNo(
    "Supabase-Shim aktivieren (Checks vor supabase CLI)?",
    hasSupabase,
  );

  const enableGitWrapper = await askYesNo(
    "Git-Wrapper aktivieren (Checks vor git push)?",
    hasGit,
  );

  let enforceCommands = "all";
  let hookCommands = "functions,db,migration";
  let defaultFunction = hasSupabaseFunctions ? "server" : "";
  let autoPush = hasGit;
  let gitEnforceCommands = "push";
  let disableAiByDefault = false;

  if (enableSupabase) {
    let defaultEnforce = "all";
    if (hasSupabaseFunctions) {
      defaultEnforce = "functions,db,migration";
    } else if (hasSupabase) {
      defaultEnforce = "db,migration";
    }
    enforceCommands = (
      await askInput(
        "Welche Supabase-Befehle sollen Checks erzwingen? (all | none | functions,db,migration)",
        defaultEnforce,
      )
    )
      .toLowerCase()
      .replace(/\s+/g, "");

    const defaultHooks = hasSupabaseFunctions
      ? "functions,db,migration"
      : "none";
    hookCommands = (
      await askInput(
        "Welche Befehle sollen Post-Deploy Hooks triggern? (functions,db,migration | all | none)",
        defaultHooks,
      )
    )
      .toLowerCase()
      .replace(/\s+/g, "");

    if (hasSupabaseFunctions) {
      defaultFunction = await askInput(
        "Default Function fuer Health/Logs",
        defaultFunction || "server",
      );
    } else {
      defaultFunction = "";
    }
    autoPush = await askYesNo(
      "Nach erfolgreichem CLI-Lauf automatisch git push?",
      hasGit,
    );
  }

  if (enableGitWrapper) {
    gitEnforceCommands = (
      await askInput(
        "Welche Git-Befehle sollen Checks erzwingen? (push,commit,merge,rebase,all,none)",
        "push",
      )
    )
      .toLowerCase()
      .replace(/\\s+/g, "");
  }

  const enableAiReview = await askYesNo(
    "AI Review aktivieren (Codex default, Cursor fallback)?",
    true,
  );
  if (!enableAiReview) {
    disableAiByDefault = await askYesNo(
      "Standardmaessig --no-ai-review setzen?",
      true,
    );
  }

  if (enableAiReview) {
    const hasCodex = hasCommand("codex");
    const hasAgent = hasCommand("agent");

    if (hasCodex) {
      const doLogin = await askYesNo(
        "Jetzt in ChatGPT via codex login einloggen?",
        false,
      );
      if (doLogin) {
        try {
          cp.spawnSync("codex", ["login"], { stdio: "inherit" });
        } catch {
          console.log("codex login fehlgeschlagen. Bitte manuell ausfuehren.");
        }
      }
    } else if (hasAgent) {
      const doLogin = await askYesNo(
        "Codex nicht gefunden. Cursor agent login starten?",
        false,
      );
      if (doLogin) {
        try {
          cp.spawnSync("agent", ["login"], { stdio: "inherit" });
        } catch {
          console.log("agent login fehlgeschlagen. Bitte manuell ausfuehren.");
        }
      }
    } else {
      console.log(
        "Hinweis: Weder codex noch agent gefunden. Installiere/konfiguriere die CLI fuer AI Review.",
      );
    }
  }

  const runChecksPath = path.join(projectRoot, "scripts", "run-checks.sh");
  if (!exists(runChecksPath)) {
    const createChecks = await askYesNo(
      "scripts/run-checks.sh aus Template anlegen?",
      true,
    );
    if (createChecks) {
      copyTemplate("run-checks.sh", runChecksPath, true);
    }
  }

  const agentsPath = path.join(projectRoot, "AGENTS.md");
  if (!exists(agentsPath)) {
    const createAgents = await askYesNo(
      "AGENTS.md aus Standard-Template anlegen?",
      true,
    );
    if (createAgents) {
      const agentsTpl = path.join(templatesDir, "AGENTS.md");
      if (exists(agentsTpl)) {
        fs.copyFileSync(agentsTpl, agentsPath);
        console.log("  angelegt: AGENTS.md");
      }
    }
  }

  const aiReviewPath = path.join(projectRoot, "scripts", "ai-code-review.sh");
  if (enableAiReview && !exists(aiReviewPath)) {
    const createAiReview = await askYesNo(
      "scripts/ai-code-review.sh aus Template anlegen?",
      true,
    );
    if (createAiReview) {
      copyTemplate("ai-code-review.sh", aiReviewPath, true);
    }
  }

  const aiExplanationPath = path.join(
    projectRoot,
    "scripts",
    "ai-explanation-check.sh",
  );
  if (!exists(aiExplanationPath)) {
    const createExplanation = await askYesNo(
      "scripts/ai-explanation-check.sh (Full Explanation Check) aus Template anlegen?",
      true,
    );
    if (createExplanation) {
      copyTemplate("ai-explanation-check.sh", aiExplanationPath, true);
    }
  }

  const copyHardRulesTemplates = await askYesNo(
    "Hard-Rules Config-Templates kopieren (dependency-cruiser, semgrep, stryker, eslint complexity)?",
    false,
  );
  if (copyHardRulesTemplates) {
    const hardRules = [
      [".dependency-cruiser.json", ".dependency-cruiser.json"],
      [".semgrep.example.yml", ".semgrep.example.yml"],
      ["stryker.config.json", "stryker.config.json"],
      ["eslint.complexity.json", "eslint.complexity.json"],
    ];
    for (const [tpl, destName] of hardRules) {
      const src = path.join(templatesDir, tpl);
      if (exists(src)) {
        const dest = path.join(projectRoot, destName);
        if (!exists(dest)) {
          fs.copyFileSync(src, dest);
          console.log("  angelegt: " + destName);
        }
      }
    }
  }

  const createChecktools = await askYesNo(
    "Check-Tools Ordner anlegen (.shimwrapper/checktools/) – Tools pro Projekt, getrennt vom Repo?",
    false,
  );
  if (createChecktools) {
    const checktoolsDir = path.join(projectRoot, ".shimwrapper", "checktools");
    const checktoolsPkg = path.join(checktoolsDir, "package.json");
    if (!exists(checktoolsPkg)) {
      ensureDir(checktoolsDir);
      const tpl = path.join(templatesDir, "checktools-package.json");
      if (exists(tpl)) {
        fs.copyFileSync(tpl, checktoolsPkg);
        console.log("  angelegt: .shimwrapper/checktools/package.json");
      } else {
        const defaultPkg = {
          name: "shimwrapper-checktools",
          private: true,
          devDependencies: {
            eslint: "^9",
            prettier: "^3",
            typescript: "^5",
            vitest: "^2",
            vite: "^6",
          },
        };
        fs.writeFileSync(
          checktoolsPkg,
          JSON.stringify(defaultPkg, null, 2) + "\n",
        );
        console.log("  angelegt: .shimwrapper/checktools/package.json");
      }
      console.log(
        "  Danach: npx shimwrappercheck install-tools (oder npm install in .shimwrapper/checktools)",
      );
    } else {
      console.log("  .shimwrapper/checktools/package.json existiert bereits.");
    }
  }

  if (hasGit) {
    let hookInstalled = false;
    if (hasHusky) {
      const useHusky = await askYesNo(
        "Husky pre-push Hook installieren?",
        true,
      );
      if (useHusky) {
        const huskyPath = path.join(projectRoot, ".husky", "pre-push");
        if (exists(huskyPath)) {
          const overwrite = await askYesNo(
            "Husky pre-push existiert. Ueberschreiben?",
            false,
          );
          if (!overwrite) {
            hookInstalled = true;
          } else {
            copyTemplate("husky-pre-push", huskyPath, true);
            hookInstalled = true;
          }
        } else {
          copyTemplate("husky-pre-push", huskyPath, true);
          hookInstalled = true;
        }
      }
    }

    if (!hookInstalled) {
      const useGitHook = await askYesNo(
        "Plain git pre-push Hook installieren?",
        true,
      );
      if (useGitHook) {
        const hookPath = path.join(projectRoot, ".git", "hooks", "pre-push");
        if (exists(hookPath)) {
          const overwrite = await askYesNo(
            "git pre-push Hook existiert. Ueberschreiben?",
            false,
          );
          if (!overwrite) {
            // skip
          } else {
            copyTemplate("git-pre-push", hookPath, true);
          }
        } else {
          copyTemplate("git-pre-push", hookPath, true);
        }
      }
    }
  }

  if (hasPackageJson) {
    const addScript = await askYesNo(
      'package.json: Script "supabase:checked" eintragen?',
      true,
    );
    if (addScript) {
      projectPackage.scripts = projectPackage.scripts || {};
      if (!projectPackage.scripts["supabase:checked"]) {
        projectPackage.scripts["supabase:checked"] = "supabase";
      }
      fs.writeFileSync(
        packagePath,
        JSON.stringify(projectPackage, null, 2) + "\n",
      );
    }

    if (enableGitWrapper) {
      const addGitScript = await askYesNo(
        'package.json: Script "git:checked" eintragen?',
        true,
      );
      if (addGitScript) {
        projectPackage.scripts = projectPackage.scripts || {};
        if (!projectPackage.scripts["git:checked"]) {
          projectPackage.scripts["git:checked"] = "git";
        }
        fs.writeFileSync(
          packagePath,
          JSON.stringify(projectPackage, null, 2) + "\n",
        );
      }
    }
  } else {
    console.log("package.json nicht gefunden; Scripts wurden nicht angepasst.");
  }

  if (enableSupabase || enableGitWrapper || disableAiByDefault) {
    const configPath = path.join(projectRoot, ".shimwrappercheckrc");
    let writeConfig = true;
    if (exists(configPath)) {
      writeConfig = await askYesNo(
        "Config .shimwrappercheckrc existiert. Ueberschreiben?",
        false,
      );
      if (!writeConfig) {
        console.log("Config beibehalten.");
      }
    }
    if (writeConfig) {
      const lines = [];
      lines.push("# shimwrappercheck config");
      if (enableSupabase) {
        lines.push(`SHIM_ENFORCE_COMMANDS="${enforceCommands}"`);
        lines.push(`SHIM_HOOK_COMMANDS="${hookCommands}"`);
        if (defaultFunction) {
          lines.push(`SHIM_DEFAULT_FUNCTION="${defaultFunction}"`);
        }
        lines.push(`SHIM_AUTO_PUSH=${autoPush ? 1 : 0}`);
      }
      if (enableGitWrapper) {
        lines.push(`SHIM_GIT_ENFORCE_COMMANDS="${gitEnforceCommands}"`);
      }
      if (disableAiByDefault) {
        lines.push('SHIM_CHECKS_ARGS="--no-ai-review"');
      }
      fs.writeFileSync(configPath, lines.join("\n") + "\n");
    }
  }

  console.log("");
  console.log("Setup abgeschlossen. Naechste Schritte:");
  if (enableSupabase) {
    console.log(
      "- nutze: npx supabase <args> oder npm run supabase:checked -- <args>",
    );
  }
  if (enableGitWrapper) {
    console.log("- nutze: npx git <args> oder npm run git:checked -- <args>");
  }
  console.log("- optional: npx shimwrappercheck install (globale PATH-Shims)");
  if (enableAiReview) {
    console.log(
      "- optional: RUN_CURSOR_REVIEW=1 fuer zweiten Review-Durchlauf",
    );
  }
  console.log("- pruefe ggf. scripts/run-checks.sh und passe die Checks an");

  if (process.env.SHIM_LAUNCH_DASHBOARD === "1") {
    launchDashboard();
  } else {
    console.log("");
    console.log("Einstellungen spaeter aendern: Dashboard starten mit");
    console.log(
      "  cd node_modules/shimwrappercheck/dashboard && npm install && npm run dev",
    );
    console.log(
      "  dann http://localhost:3000 oeffnen (Presets, Checks, AGENTS.md).",
    );
  }

  rl.close();
}

function launchDashboard() {
  const dashboardPath = path.join(pkgRoot, "dashboard");
  if (!exists(dashboardPath)) {
    console.log("");
    console.log(
      "Dashboard nicht gefunden. Spaeter: cd node_modules/shimwrappercheck/dashboard && npm run dev",
    );
    return;
  }
  let port = 3000;
  try {
    const findPortScript = path.join(__dirname, "find-free-port.js");
    port = parseInt(
      cp.execSync(`node "${findPortScript}" 3000`, { encoding: "utf8" }).trim(),
      10,
    );
  } catch (e) {
    // fallback 3000
  }
  const url = `http://localhost:${port}`;
  console.log("");
  console.log(
    "Starte Dashboard (grafische Oberflaeche) auf Port " + port + "...",
  );
  try {
    cp.execSync("npm install", { cwd: dashboardPath, stdio: "pipe" });
  } catch (e) {
    console.log(
      "npm install im Dashboard-Ordner fehlgeschlagen, starte trotzdem.",
    );
  }
  const dev = cp.spawn("npm", ["run", "dev"], {
    cwd: dashboardPath,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, PORT: String(port) },
  });
  dev.unref();
  const delay = 5000;
  setTimeout(() => {
    try {
      if (process.platform === "darwin") {
        cp.execSync(`open "${url}"`);
      } else if (process.platform === "win32") {
        cp.execSync(`start "${url}"`);
      } else {
        cp.execSync(`xdg-open "${url}"`);
      }
    } catch (e) {
      // ignore
    }
  }, delay);
  console.log("");
  console.log(
    "Dashboard wird gestartet. Browser oeffnet sich in wenigen Sekunden unter " +
      url,
  );
  console.log("Falls nicht: " + url + " im Browser oeffnen.");
  console.log(
    'Zum Beenden des Servers: Prozess "next dev" beenden (Aktivitaetsmonitor / Task-Manager).',
  );
}

main().catch((err) => {
  console.error("Init fehlgeschlagen:", err);
  process.exit(1);
});
