#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");

const args = process.argv
  .slice(2)
  .filter((arg, idx) => !(idx === 0 && arg === "install"));

const options = {
  binDir: process.env.SHIM_BIN_DIR || path.join(os.homedir(), ".local", "bin"),
  installSupabase: true,
  installGit: true,
  installShim: true,
  overwrite: false,
  dryRun: false,
  interactive: args.length === 0,
  addPath: false,
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
  if (arg === "--bin-dir") {
    options.binDir = consumeValue(arg, i);
    i += 1;
    continue;
  }
  if (arg === "--interactive") {
    options.interactive = true;
    continue;
  }
  if (arg === "--no-interactive") {
    options.interactive = false;
    continue;
  }
  if (arg === "--add-path") {
    options.addPath = true;
    continue;
  }
  if (arg === "--overwrite") {
    options.overwrite = true;
    continue;
  }
  if (arg === "--dry-run") {
    options.dryRun = true;
    continue;
  }
  if (arg === "--no-supabase") {
    options.installSupabase = false;
    continue;
  }
  if (arg === "--no-git") {
    options.installGit = false;
    continue;
  }
  if (arg === "--no-shim") {
    options.installShim = false;
    continue;
  }
  if (arg === "--only") {
    const value = consumeValue(arg, i);
    i += 1;
    options.installSupabase = false;
    options.installGit = false;
    options.installShim = false;
    value
      .split(",")
      .map((v) => v.trim())
      .forEach((v) => {
        if (v === "supabase") options.installSupabase = true;
        if (v === "git") options.installGit = true;
        if (v === "shim") options.installShim = true;
      });
    continue;
  }
  if (arg === "--help" || arg === "-h") {
    printHelp();
    process.exit(0);
  }
}

function printHelp() {
  console.log("shimwrappercheck install");
  console.log("");
  console.log("Options:");
  console.log("  --bin-dir <path>   Install path (default: ~/.local/bin)");
  console.log("  --interactive      Ask questions (default when no flags)");
  console.log("  --no-interactive   Disable prompts");
  console.log("  --add-path         Add bin dir to shell config");
  console.log("  --overwrite        Overwrite existing shims");
  console.log("  --dry-run          Show actions without writing");
  console.log("  --no-supabase       Skip supabase shim");
  console.log("  --no-git            Skip git shim");
  console.log("  --no-shim           Skip generic shim");
  console.log("  --only <list>      Comma list: supabase,git,shim");
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function isInPath(binDir) {
  const pathEntries = (process.env.PATH || "").split(path.delimiter);
  return pathEntries.includes(binDir);
}

function detectShellConfig() {
  const shell = process.env.SHELL || "";
  const home = os.homedir();
  if (shell.includes("zsh")) {
    const zshrc = path.join(home, ".zshrc");
    const zprofile = path.join(home, ".zprofile");
    if (fs.existsSync(zshrc)) return zshrc;
    if (fs.existsSync(zprofile)) return zprofile;
    return zshrc;
  }
  if (shell.includes("bash")) {
    const bashrc = path.join(home, ".bashrc");
    const bashProfile = path.join(home, ".bash_profile");
    if (fs.existsSync(bashrc)) return bashrc;
    if (fs.existsSync(bashProfile)) return bashProfile;
    return bashrc;
  }
  return path.join(home, ".profile");
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function appendPathExport(filePath, binDir, dryRun) {
  const marker = "# shimwrappercheck PATH";
  const line = `export PATH="${binDir}:$PATH"`;
  const content = readFileSafe(filePath);
  if (content.includes(line) || content.includes(marker)) {
    console.log(`PATH already configured in ${filePath}`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] append PATH to ${filePath}`);
    return;
  }
  const payload = `\n${marker}\n${line}\n`;
  fs.appendFileSync(filePath, payload);
  console.log(`Added PATH entry to ${filePath}`);
}

async function runInteractive() {
  const readline = require("readline");
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

  options.binDir = await askInput("Bin-Verzeichnis?", options.binDir);

  const installSupabase = await askYesNo(
    "Shim fuer supabase installieren?",
    options.installSupabase,
  );
  const installGit = await askYesNo(
    "Shim fuer git installieren?",
    options.installGit,
  );
  const installShim = await askYesNo(
    "Generischen shim installieren?",
    options.installShim,
  );

  options.installSupabase = installSupabase;
  options.installGit = installGit;
  options.installShim = installShim;

  options.overwrite = await askYesNo(
    "Vorhandene Dateien ueberschreiben?",
    options.overwrite,
  );
  options.dryRun = await askYesNo("Dry-run?", options.dryRun);

  if (!isInPath(options.binDir)) {
    options.addPath = await askYesNo("PATH automatisch erweitern?", false);
    if (options.addPath) {
      const shellConfig = detectShellConfig();
      const home = os.homedir();
      const shell = process.env.SHELL || "";
      const candidates = [];

      if (shell.includes("zsh")) {
        candidates.push(path.join(home, ".zshrc"));
        candidates.push(path.join(home, ".zprofile"));
      } else if (shell.includes("bash")) {
        candidates.push(path.join(home, ".bashrc"));
        candidates.push(path.join(home, ".bash_profile"));
      } else {
        candidates.push(path.join(home, ".profile"));
      }

      const existing = candidates.filter((file) => fs.existsSync(file));
      if (existing.length > 1) {
        console.log("Mehrere Shell-Configs gefunden:");
        existing.forEach((file, idx) => {
          console.log(`  [${idx + 1}] ${file}`);
        });
        const selection = await askInput(
          "Welche Datei soll geaendert werden?",
          String(existing.indexOf(shellConfig) + 1 || 1),
        );
        const selectedIdx =
          Math.max(1, Math.min(existing.length, Number(selection))) - 1;
        options.shellConfigOverride = existing[selectedIdx];
      } else if (existing.length === 1) {
        options.shellConfigOverride = existing[0];
      } else {
        options.shellConfigOverride = shellConfig;
      }
    }
  }

  rl.close();
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
  return "#!/usr/bin/env bash\nset -euo pipefail\n\n";
}

function pathWithoutBin() {
  return [
    'BIN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"',
    'PATH_NO_BIN="$(echo "$PATH" | tr ":" "\n" | grep -v "^$BIN_DIR$" | paste -sd: -)"',
  ].join("\n");
}

function supabaseShim() {
  return [
    shimHeader(),
    pathWithoutBin(),
    'REAL_BIN="$(PATH="$PATH_NO_BIN" command -v supabase || true)"',
    'if [[ -n "$REAL_BIN" ]]; then export SUPABASE_REAL_BIN="$REAL_BIN"; fi',
    'exec npx --yes shimwrappercheck@latest -- supabase "$@"',
    "",
  ].join("\n");
}

function gitShim() {
  return [
    shimHeader(),
    pathWithoutBin(),
    'REAL_BIN="$(PATH="$PATH_NO_BIN" command -v git || true)"',
    'if [[ -n "$REAL_BIN" ]]; then export SHIM_GIT_REAL_BIN="$REAL_BIN"; fi',
    'exec npx --yes shimwrappercheck@latest -- git "$@"',
    "",
  ].join("\n");
}

function genericShim() {
  return [
    shimHeader(),
    'exec npx --yes shimwrappercheck@latest -- shim "$@"',
    "",
  ].join("\n");
}

async function main() {
  if (options.interactive) {
    await runInteractive();
  }

  ensureDir(options.binDir);

  if (options.installSupabase) writeShim("supabase", supabaseShim());
  if (options.installGit) writeShim("git", gitShim());
  if (options.installShim) writeShim("shim", genericShim());

  if (!isInPath(options.binDir)) {
    console.log("");
    console.log(`Add to PATH: export PATH="${options.binDir}:$PATH"`);
    if (options.addPath) {
      const shellConfig = options.shellConfigOverride || detectShellConfig();
      appendPathExport(shellConfig, options.binDir, options.dryRun);
      console.log("Reload your shell or source the config file.");
    }
  }
}

main().catch((err) => {
  console.error("Install failed:", err);
  process.exit(1);
});
