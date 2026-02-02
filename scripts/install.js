#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2).filter((arg, idx) => !(idx === 0 && arg === 'install'));

const options = {
  binDir: process.env.SHIM_BIN_DIR || path.join(os.homedir(), '.local', 'bin'),
  installSupabase: true,
  installGit: true,
  installShim: true,
  overwrite: false,
  dryRun: false,
};

function consumeValue(flag, idx) {
  if (idx + 1 >= args.length) {
    console.error(`Missing value for ${flag}`);
    process.exit(1);
  }
  return args[idx + 1];
}

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--bin-dir') {
    options.binDir = consumeValue(arg, i);
    i += 1;
    continue;
  }
  if (arg === '--overwrite') {
    options.overwrite = true;
    continue;
  }
  if (arg === '--dry-run') {
    options.dryRun = true;
    continue;
  }
  if (arg === '--no-supabase') {
    options.installSupabase = false;
    continue;
  }
  if (arg === '--no-git') {
    options.installGit = false;
    continue;
  }
  if (arg === '--no-shim') {
    options.installShim = false;
    continue;
  }
  if (arg === '--only') {
    const value = consumeValue(arg, i);
    i += 1;
    options.installSupabase = false;
    options.installGit = false;
    options.installShim = false;
    value.split(',').map((v) => v.trim()).forEach((v) => {
      if (v === 'supabase') options.installSupabase = true;
      if (v === 'git') options.installGit = true;
      if (v === 'shim') options.installShim = true;
    });
    continue;
  }
  if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  }
}

function printHelp() {
  console.log('shimwrappercheck install');
  console.log('');
  console.log('Options:');
  console.log('  --bin-dir <path>   Install path (default: ~/.local/bin)');
  console.log('  --overwrite        Overwrite existing shims');
  console.log('  --dry-run          Show actions without writing');
  console.log('  --no-supabase       Skip supabase shim');
  console.log('  --no-git            Skip git shim');
  console.log('  --no-shim           Skip generic shim');
  console.log('  --only <list>      Comma list: supabase,git,shim');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isInPath(binDir) {
  const pathEntries = (process.env.PATH || '').split(path.delimiter);
  return pathEntries.includes(binDir);
}

function writeShim(name, content) {
  const target = path.join(options.binDir, name);
  if (fs.existsSync(target) && !options.overwrite) {
    console.log(`Skip ${name}: exists (${target})`);
    return;
  }
  if (options.dryRun) {
    console.log(`[dry-run] write ${target}`);
    return;
  }
  fs.writeFileSync(target, content, { mode: 0o755 });
  console.log(`Installed ${name} -> ${target}`);
}

function shimHeader() {
  return '#!/usr/bin/env bash\nset -euo pipefail\n\n';
}

function pathWithoutBin() {
  return [
    'BIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'PATH_NO_BIN="$(echo "$PATH" | tr ":" "\n" | grep -v "^$BIN_DIR$" | paste -sd: -)"',
  ].join('\n');
}

function supabaseShim() {
  return [
    shimHeader(),
    pathWithoutBin(),
    'REAL_BIN="$(PATH="$PATH_NO_BIN" command -v supabase || true)"',
    'if [[ -n "$REAL_BIN" ]]; then export SUPABASE_REAL_BIN="$REAL_BIN"; fi',
    'exec npx --yes --package shimwrappercheck -- supabase "$@"',
    ''
  ].join('\n');
}

function gitShim() {
  return [
    shimHeader(),
    pathWithoutBin(),
    'REAL_BIN="$(PATH="$PATH_NO_BIN" command -v git || true)"',
    'if [[ -n "$REAL_BIN" ]]; then export SHIM_GIT_REAL_BIN="$REAL_BIN"; fi',
    'exec npx --yes --package shimwrappercheck -- git "$@"',
    ''
  ].join('\n');
}

function genericShim() {
  return [
    shimHeader(),
    'exec npx --yes --package shimwrappercheck -- shim "$@"',
    ''
  ].join('\n');
}

ensureDir(options.binDir);

if (options.installSupabase) writeShim('supabase', supabaseShim());
if (options.installGit) writeShim('git', gitShim());
if (options.installShim) writeShim('shim', genericShim());

if (!isInPath(options.binDir)) {
  console.log('');
  console.log(`Add to PATH: export PATH="${options.binDir}:$PATH"`);
}
