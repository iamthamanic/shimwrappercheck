#!/usr/bin/env node
/**
 * Shim runner: orchestrates all checks (deterministic, mutation, E2E, AI deductive review).
 * Writes .shim/last_error.json on first failure for agent self-healing.
 * Usage: node scripts/shim-runner.js [--full] [--no-sast] [--no-architecture] [--no-complexity] [--no-mutation] [--no-e2e] [--no-ai-review] [--no-explanation-check] [--frontend] [--backend]
 * Or: npx shimwrappercheck run --full
 */
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');

const projectRoot = process.env.SHIM_PROJECT_ROOT || process.cwd();

function loadEnv() {
  try {
    const dotenvPath = path.join(projectRoot, '.env');
    if (fs.existsSync(dotenvPath)) {
      require('dotenv').config({ path: dotenvPath });
    }
  } catch (e) {
    // dotenv optional
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const full = args.includes('--full');
  const opts = {
    full,
    sast: !args.includes('--no-sast'),
    architecture: !args.includes('--no-architecture'),
    complexity: !args.includes('--no-complexity'),
    mutation: full && !args.includes('--no-mutation'),
    e2e: full && !args.includes('--no-e2e'),
    aiReview: !args.includes('--no-ai-review'),
    explanationCheck: !args.includes('--no-explanation-check'),
    frontend: args.includes('--frontend') || (args.length > 0 && !args.some(a => a.startsWith('--no-')) && !args.includes('--backend-only')),
    backend: args.includes('--backend'),
  };
  if (args.length === 0 || full) {
    opts.frontend = true;
    opts.backend = true;
  }
  return opts;
}

function writeLastError(entry) {
  const shimDir = path.join(projectRoot, '.shim');
  if (!fs.existsSync(shimDir)) fs.mkdirSync(shimDir, { recursive: true });
  const out = {
    check: entry.check,
    message: entry.message,
    line: entry.line,
    suggestion: entry.suggestion,
    timestamp: new Date().toISOString(),
    rawOutput: entry.rawOutput ? String(entry.rawOutput).slice(0, 2000) : undefined,
  };
  fs.writeFileSync(path.join(shimDir, 'last_error.json'), JSON.stringify(out, null, 2), 'utf8');
}

function clearLastError() {
  const p = path.join(projectRoot, '.shim', 'last_error.json');
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    shell: true,
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
    ...options,
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error,
  };
}

function runNpx(args, options = {}) {
  return run('npx', args, options);
}

function fail(check, message, suggestion, line, rawOutput) {
  writeLastError({ check, message, suggestion, line, rawOutput });
  console.error(`[${check}] ${message}`);
  if (suggestion) console.error('Suggestion:', suggestion);
  process.exit(1);
}

function checkSemgrep(opts) {
  if (!opts.sast) return;
  const semgrep = run('semgrep', ['scan', '--config', 'auto', '.', '--error', '--no-git-ignore']);
  if (semgrep.error && semgrep.error.code === 'ENOENT') return;
  if (semgrep.status === 127 || semgrep.status === 126) return;
  if (semgrep.status !== 0 && semgrep.status !== null) {
    const firstLine = (semgrep.stdout + semgrep.stderr).split('\n').find(l => /:\d+:\d+:/.test(l)) || semgrep.stderr.slice(0, 500);
    fail('semgrep', 'SAST findings', 'Fix or suppress findings; see semgrep output.', firstLine, semgrep.stdout + semgrep.stderr);
  }
}

function checkDependencyCruiser(opts) {
  if (!opts.architecture) return;
  const configPath = path.join(projectRoot, '.dependency-cruiser.json');
  if (!fs.existsSync(configPath)) return;
  const srcDir = path.join(projectRoot, 'src');
  if (!fs.existsSync(srcDir)) return;
  const dep = runNpx(['depcruise', 'src', '--output-type', 'err']);
  if (dep.status !== 0 && dep.status !== null) {
    fail('dependency-cruiser', 'Architecture violation (circular or layer)', 'Remove circular deps and respect layer separation.', null, dep.stdout + dep.stderr);
  }
}

function checkStryker(opts) {
  if (!opts.mutation) return;
  const strykerConfig = path.join(projectRoot, 'stryker.config.json');
  if (!fs.existsSync(strykerConfig)) return;
  const res = runNpx(['stryker', 'run']);
  const out = res.stdout + res.stderr;
  const scoreMatch = out.match(/Mutation\s*testing\s*score[:\s]*(\d+(?:\.\d+)?)\s*%/i) || out.match(/(\d+(?:\.\d+)?)\s*%\s*mutation/i);
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
  if (res.status !== 0 || score < 80) {
    fail('stryker', `Mutation score ${score}% (min 80%)`, 'Improve tests to kill more mutants.', null, out.slice(-3000));
  }
}

function checkE2E(opts) {
  if (!opts.e2e) return;
  const playwrightConfig = path.join(projectRoot, 'playwright.config.ts');
  const playwrightConfigJs = path.join(projectRoot, 'playwright.config.js');
  if (!fs.existsSync(playwrightConfig) && !fs.existsSync(playwrightConfigJs)) return;
  const res = runNpx(['playwright', 'test']);
  if (res.status !== 0 && res.status !== null) {
    fail('e2e', 'Playwright E2E tests failed', 'Fix failing E2E tests or run locally.', null, res.stdout + res.stderr);
  }
}

async function checkAiDeductive(opts) {
  if (!opts.aiReview) return;
  try {
    const aiReview = require(path.join(__dirname, 'ai-deductive-review.js'));
    const result = await aiReview.runAsync(projectRoot);
    if (!result.ok) {
      fail('ai-deductive-review', result.message || 'AI review score < 95%', result.suggestion || 'Address deductions to reach 95%.', null, JSON.stringify(result.deductions));
    }
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND' || (e.message && e.message.includes('ai-deductive-review'))) {
      return;
    }
    fail('ai-deductive-review', e.message || String(e), 'Check API key and network.', null, e.stack);
  }
}

function runFrontendBackendBase(opts) {
  const runChecksPath = path.join(projectRoot, 'scripts', 'run-checks.sh');
  if (fs.existsSync(runChecksPath)) {
    const args = [];
    if (opts.frontend) args.push('--frontend');
    if (opts.backend) args.push('--backend');
    if (!opts.aiReview) args.push('--no-ai-review');
    if (!opts.explanationCheck) args.push('--no-explanation-check');
    const res = run('bash', [runChecksPath, ...args]);
    if (res.status !== 0 && res.status !== null) {
      fail('run-checks', 'Frontend/backend checks failed', 'Fix lint, build, or tests.', null, res.stdout + res.stderr);
    }
  } else {
    if (opts.frontend) {
      run('npm', ['run', 'lint'], { stdio: 'inherit' });
      run('npm', ['run', 'build'], { stdio: 'inherit' });
      run('npm', ['run', 'test:run'], { stdio: 'inherit' });
    }
  }
}

async function main() {
  loadEnv();
  const opts = parseArgs();

  runFrontendBackendBase(opts);
  checkSemgrep(opts);
  checkDependencyCruiser(opts);
  checkStryker(opts);
  checkE2E(opts);
  await checkAiDeductive(opts);

  clearLastError();
  console.log('All checks passed.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
