#!/usr/bin/env node
/**
 * Thin CLI entry for core check engine.
 * Invoked by scripts/run-checks.sh (core engine).
 */
import { runChecksCommand } from "./run-checks.js";

const argv = process.argv.slice(2);
const sub = argv[0];

async function main(): Promise<void> {
  if (sub === "run-checks" || sub === "run") {
    const rest = sub === "run-checks" ? argv.slice(1) : argv.slice(1);
    const code = await runChecksCommand(rest);
    process.exit(code);
  }

  if (sub === "help" || sub === "--help" || sub === "-h") {
    console.log(`Usage: shimwrappercheck-core run-checks [options]
Options: --frontend --backend --no-frontend --no-backend
  --no-ai-review --no-explanation-check --no-i18n-check
  --no-sast --no-gitleaks --no-fallow --no-ruff --no-shellcheck --refactor|--until-95
Env: SHIM_PROJECT_ROOT, CHECK_MODE`);
    process.exit(0);
  }

  console.error("Unknown command. Use: run-checks");
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
