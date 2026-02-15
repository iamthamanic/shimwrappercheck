#!/usr/bin/env node
const path = require("path");

// When installed shims run "npx shimwrappercheck@latest -- git ...", argv[2] is "--" and argv[3] is "git".
let cmd = process.argv[2];
let restArgs = process.argv.slice(3);
if (cmd === "--" && process.argv[3] && ["git", "supabase", "shim"].includes(process.argv[3])) {
  cmd = process.argv[3];
  restArgs = process.argv.slice(4);
}

if (cmd === "setup") {
  require(path.join(__dirname, "setup"));
  return;
}

if (!cmd || cmd === "init") {
  require(path.join(__dirname, "init"));
  return;
}

if (cmd === "install") {
  require(path.join(__dirname, "install"));
  return;
}

if (cmd === "install-tools") {
  require(path.join(__dirname, "install-tools"));
  return;
}

if (cmd === "run") {
  const runArgs = restArgs;
  process.argv = [
    process.argv[0],
    path.join(__dirname, "shim-runner.js"),
    ...runArgs,
  ];
  require(path.join(__dirname, "shim-runner.js"));
  return;
}

if (cmd === "git") {
  const { spawnSync } = require("child_process");
  const gitChecked = path.join(__dirname, "git-checked.sh");
  const result = spawnSync("bash", [gitChecked, ...restArgs], {
    stdio: "inherit",
    cwd: process.cwd(),
    env: { ...process.env, SHIM_PROJECT_ROOT: process.cwd() },
  });
  process.exit(result.status != null ? result.status : 1);
  return;
}

console.error("Unknown command:", cmd);
console.error(
  "Usage: shimwrappercheck [setup|init|install|install-tools|run|git]",
);
process.exit(1);
