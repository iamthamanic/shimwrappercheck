#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const readline = require('readline');

const projectRoot = process.cwd();
const pkgRoot = path.join(__dirname, '..');
const templatesDir = path.join(pkgRoot, 'templates');
const pkgJson = require('../package.json');

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasCommand(cmd) {
  try {
    cp.execSync(`command -v ${cmd}`, { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

function isGitRepo() {
  try {
    cp.execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return exists(path.join(projectRoot, '.git'));
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
  return val ? 'ja' : 'nein';
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question) => new Promise((resolve) => rl.question(question, resolve));

  const askYesNo = async (question, defaultYes) => {
    const hint = defaultYes ? 'J/n' : 'j/N';
    const answer = (await ask(`${question} [${hint}] `)).trim().toLowerCase();
    if (!answer) return defaultYes;
    return ['j', 'ja', 'y', 'yes'].includes(answer);
  };

  const askInput = async (question, def) => {
    const answer = (await ask(`${question} [${def}] `)).trim();
    return answer || def;
  };

  const packagePath = path.join(projectRoot, 'package.json');
  const projectPackage = readJson(packagePath);

  const hasSupabase = exists(path.join(projectRoot, 'supabase')) ||
    exists(path.join(projectRoot, 'supabase', 'config.toml')) ||
    exists(path.join(projectRoot, 'supabase', 'functions'));
  const hasSupabaseFunctions = exists(path.join(projectRoot, 'supabase', 'functions'));
  const hasSrc = exists(path.join(projectRoot, 'src'));
  const hasGit = isGitRepo();
  const hasPackageJson = !!projectPackage;
  const hasHusky = exists(path.join(projectRoot, '.husky')) ||
    (projectPackage && projectPackage.devDependencies && projectPackage.devDependencies.husky);

  console.log('shimwrappercheck init');
  console.log('Projekt:', projectRoot);
  console.log('Gefundene Signale:');
  let repoType = 'unbekannt';
  if (hasSupabase && hasSrc) {
    repoType = 'mixed (frontend + backend)';
  } else if (hasSupabase) {
    repoType = hasSupabaseFunctions ? 'backend (supabase functions)' : 'backend (supabase)';
  } else if (hasSrc) {
    repoType = 'frontend';
  }

  console.log(`- Supabase: ${formatBool(hasSupabase)}${hasSupabaseFunctions ? ' (functions)' : ''}`);
  console.log(`- Frontend (src/): ${formatBool(hasSrc)}`);
  console.log(`- Git Repo: ${formatBool(hasGit)}`);
  console.log(`- package.json: ${formatBool(hasPackageJson)}`);
  console.log(`- Husky: ${formatBool(hasHusky)}`);
  console.log(`- Repo-Typ: ${repoType}`);
  console.log('');

  const enableSupabase = await askYesNo(
    'Supabase-Shim aktivieren (Checks vor supabase CLI)?',
    hasSupabase
  );

  const enableGitWrapper = await askYesNo(
    'Git-Wrapper aktivieren (Checks vor git push)?',
    hasGit
  );

  let enforceCommands = 'all';
  let hookCommands = 'functions,db,migration';
  let defaultFunction = hasSupabaseFunctions ? 'server' : '';
  let autoPush = hasGit;
  let gitEnforceCommands = 'push';
  let disableAiByDefault = false;

  if (enableSupabase) {
    let defaultEnforce = 'all';
    if (hasSupabaseFunctions) {
      defaultEnforce = 'functions,db,migration';
    } else if (hasSupabase) {
      defaultEnforce = 'db,migration';
    }
    enforceCommands = (await askInput(
      'Welche Supabase-Befehle sollen Checks erzwingen? (all | none | functions,db,migration)',
      defaultEnforce
    )).toLowerCase().replace(/\s+/g, '');

    const defaultHooks = hasSupabaseFunctions ? 'functions,db,migration' : 'none';
    hookCommands = (await askInput(
      'Welche Befehle sollen Post-Deploy Hooks triggern? (functions,db,migration | all | none)',
      defaultHooks
    )).toLowerCase().replace(/\s+/g, '');

    if (hasSupabaseFunctions) {
      defaultFunction = await askInput('Default Function fuer Health/Logs', defaultFunction || 'server');
    } else {
      defaultFunction = '';
    }
    autoPush = await askYesNo('Nach erfolgreichem CLI-Lauf automatisch git push?', hasGit);
  }

  if (enableGitWrapper) {
    gitEnforceCommands = (await askInput(
      'Welche Git-Befehle sollen Checks erzwingen? (push,commit,merge,rebase,all,none)',
      'push'
    )).toLowerCase().replace(/\\s+/g, '');
  }

  const enableAiReview = await askYesNo(
    'AI Review aktivieren (Codex default, Cursor fallback)?',
    true
  );
  if (!enableAiReview) {
    disableAiByDefault = await askYesNo('Standardmaessig --no-ai-review setzen?', true);
  }

  if (enableAiReview) {
    const hasCodex = hasCommand('codex');
    const hasAgent = hasCommand('agent');

    if (hasCodex) {
      const doLogin = await askYesNo('Jetzt in ChatGPT via codex login einloggen?', false);
      if (doLogin) {
        try {
          cp.spawnSync('codex', ['login'], { stdio: 'inherit' });
        } catch {
          console.log('codex login fehlgeschlagen. Bitte manuell ausfuehren.');
        }
      }
    } else if (hasAgent) {
      const doLogin = await askYesNo('Codex nicht gefunden. Cursor agent login starten?', false);
      if (doLogin) {
        try {
          cp.spawnSync('agent', ['login'], { stdio: 'inherit' });
        } catch {
          console.log('agent login fehlgeschlagen. Bitte manuell ausfuehren.');
        }
      }
    } else {
      console.log('Hinweis: Weder codex noch agent gefunden. Installiere/konfiguriere die CLI fuer AI Review.');
    }
  }

  const runChecksPath = path.join(projectRoot, 'scripts', 'run-checks.sh');
  if (!exists(runChecksPath)) {
    const createChecks = await askYesNo('scripts/run-checks.sh aus Template anlegen?', true);
    if (createChecks) {
      copyTemplate('run-checks.sh', runChecksPath, true);
    }
  }

  const aiReviewPath = path.join(projectRoot, 'scripts', 'ai-code-review.sh');
  if (enableAiReview && !exists(aiReviewPath)) {
    const createAiReview = await askYesNo('scripts/ai-code-review.sh aus Template anlegen?', true);
    if (createAiReview) {
      copyTemplate('ai-code-review.sh', aiReviewPath, true);
    }
  }

  if (hasGit) {
    let hookInstalled = false;
    if (hasHusky) {
      const useHusky = await askYesNo('Husky pre-push Hook installieren?', true);
      if (useHusky) {
        const huskyPath = path.join(projectRoot, '.husky', 'pre-push');
        if (exists(huskyPath)) {
          const overwrite = await askYesNo('Husky pre-push existiert. Ueberschreiben?', false);
          if (!overwrite) {
            hookInstalled = true;
          } else {
            copyTemplate('husky-pre-push', huskyPath, true);
            hookInstalled = true;
          }
        } else {
          copyTemplate('husky-pre-push', huskyPath, true);
          hookInstalled = true;
        }
      }
    }

    if (!hookInstalled) {
      const useGitHook = await askYesNo('Plain git pre-push Hook installieren?', true);
      if (useGitHook) {
        const hookPath = path.join(projectRoot, '.git', 'hooks', 'pre-push');
        if (exists(hookPath)) {
          const overwrite = await askYesNo('git pre-push Hook existiert. Ueberschreiben?', false);
          if (!overwrite) {
            // skip
          } else {
            copyTemplate('git-pre-push', hookPath, true);
          }
        } else {
          copyTemplate('git-pre-push', hookPath, true);
        }
      }
    }
  }

  if (hasPackageJson) {
    const addScript = await askYesNo('package.json: Script "supabase:checked" eintragen?', true);
    if (addScript) {
      projectPackage.scripts = projectPackage.scripts || {};
      if (!projectPackage.scripts['supabase:checked']) {
        projectPackage.scripts['supabase:checked'] = 'supabase';
      }
      fs.writeFileSync(packagePath, JSON.stringify(projectPackage, null, 2) + '\n');
    }

    if (enableGitWrapper) {
      const addGitScript = await askYesNo('package.json: Script "git:checked" eintragen?', true);
      if (addGitScript) {
        projectPackage.scripts = projectPackage.scripts || {};
        if (!projectPackage.scripts['git:checked']) {
          projectPackage.scripts['git:checked'] = 'git';
        }
        fs.writeFileSync(packagePath, JSON.stringify(projectPackage, null, 2) + '\n');
      }
    }
  } else {
    console.log('package.json nicht gefunden; Scripts wurden nicht angepasst.');
  }

  if (enableSupabase || enableGitWrapper || disableAiByDefault) {
    const configPath = path.join(projectRoot, '.shimwrappercheckrc');
    let writeConfig = true;
    if (exists(configPath)) {
      writeConfig = await askYesNo('Config .shimwrappercheckrc existiert. Ueberschreiben?', false);
      if (!writeConfig) {
        console.log('Config beibehalten.');
      }
    }
    if (writeConfig) {
      const lines = [];
      lines.push('# shimwrappercheck config');
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
      fs.writeFileSync(configPath, lines.join('\n') + '\n');
    }
  }

  console.log('');
  console.log('Setup abgeschlossen. Naechste Schritte:');
  if (enableSupabase) {
    console.log('- nutze: npx supabase <args> oder npm run supabase:checked -- <args>');
  }
  if (enableGitWrapper) {
    console.log('- nutze: npx git <args> oder npm run git:checked -- <args>');
  }
  if (enableAiReview) {
    console.log('- optional: RUN_CURSOR_REVIEW=1 fuer zweiten Review-Durchlauf');
  }
  console.log('- pruefe ggf. scripts/run-checks.sh und passe die Checks an');

  rl.close();
}

main().catch((err) => {
  console.error('Init fehlgeschlagen:', err);
  process.exit(1);
});
