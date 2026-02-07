# shimwrappercheck

CLI shim wrapper that enforces project checks before running a real CLI command.

Out of the box, this package ships **Supabase**, **Git**, and a **generic shim** (`supabase`, `git`, `shim` bins), but the pattern is generic:
you can reuse the scripts for other CLIs by copying/adapting them in your repo.

This package provides a `supabase` bin that you can use via `npx supabase ...` or `npm run supabase:checked -- ...`.
It is repo-agnostic: you plug in your own `scripts/run-checks.sh` and optional hooks.

## Features

- Wraps a CLI command and enforces checks before deploy/push (Supabase + Git wrappers included, generic shim for anything else)
- Diff-aware checks (frontend/backend) based on staged/unstaged changes
- Command filtering (only run checks/hooks for specific Supabase commands)
- Network retry for flaky Supabase CLI calls
- Post-deploy hooks: health ping + logs
- Auto git push when ahead of upstream (optional)
- AI review integration (Codex default, Cursor fallback)
- Interactive setup wizard that scans your repo and configures everything
- Global installer that drops PATH shims (`supabase`, `git`, `shim`)
- Generic shim supports pre/post hooks
- **Dashboard**: Web UI to view status, run checks, **Presets & check toggles** (Einstellungen), edit `.shimwrappercheckrc`, and **edit AGENTS.md**
- **Presets**: default "Vibe Code" (GitHub + Supabase, all commands); custom presets with provider toggles; check toggles (frontend, backend, AI review)

## Setup (one command)

Run the full setup in one go (installs package if needed, then runs the wizard):

```bash
npx shimwrappercheck setup
```

This installs `shimwrappercheck` as a devDependency if missing, then runs the init wizard (Supabase/Git shims, which commands, AI review, hooks, run-checks.sh, etc.). **After the wizard, the dashboard starts automatically and your browser opens at http://localhost:3000.**

## Dashboard (Web UI)

A Next.js dashboard lets you manage presets, checks, config, and AGENTS.md. When you run `npx shimwrappercheck setup`, it starts automatically at the end and opens in your browser. **A free port is chosen automatically** (3000, 3001, 3002, …) so it never conflicts with other apps. To start it again later:

```bash
cd node_modules/shimwrappercheck/dashboard && npm install && npm run dev
```

Then open the URL shown in the terminal (e.g. http://localhost:3000). **In this repo** you can also run from the project root:

```bash
npm run dashboard
```

You can:

- **Einstellungen**: Presets (Vibe Code default, custom presets), Supabase/Git command toggles (which commands run checks/hooks), check toggles (frontend, backend, AI review)
- View status (config, presets file, AGENTS.md, run-checks script, hooks)
- Run checks only (button)
- Edit `.shimwrappercheckrc` (Config, raw)
- Edit **AGENTS.md** (agent instructions for Cursor/Codex; changes apply immediately)

**AGENTS.md** is used by AI agents; editing it in the dashboard keeps agent instructions in sync. Set `SHIM_PROJECT_ROOT` when deploying the dashboard (e.g. on Vercel) to the repo root path where `.shimwrappercheckrc` and `AGENTS.md` live.

## Install

```bash
npm i -D shimwrappercheck
```

## Global install (PATH shims)

This installs small shims into a bin directory (default: `~/.local/bin`) so you can run
`supabase`, `git`, or `shim` directly without `npx`.

```bash
npx shimwrappercheck install
# options
# --bin-dir <path>   (default: ~/.local/bin)
# --interactive      (default when no flags)
# --no-interactive
# --add-path         (auto-append PATH in shell config)
# --overwrite
# --dry-run
# --no-supabase | --no-git | --no-shim
# --only supabase,git,shim
```

If the bin dir is not in PATH, add (or use `--add-path` to append automatically):

```bash
export PATH="$HOME/.local/bin:$PATH"
```

When multiple shell configs exist (e.g. `.zshrc` + `.zprofile`), the installer asks which file to update.

## Quick start

1) Add a checks script in your repo (example template below).
2) Use the shim instead of the raw CLI.

```bash
# Copy templates (customize to your repo)
cp node_modules/shimwrappercheck/templates/run-checks.sh scripts/run-checks.sh
cp node_modules/shimwrappercheck/templates/ai-code-review.sh scripts/ai-code-review.sh
cp node_modules/shimwrappercheck/templates/husky-pre-push .husky/pre-push

# Make scripts executable
chmod +x scripts/run-checks.sh scripts/ai-code-review.sh .husky/pre-push
```

Add a package.json script (optional):

```json
{
  "scripts": {
    "supabase:checked": "supabase"
  }
}
```

Then run:

```bash
npm run supabase:checked -- functions deploy <function-name>
# or
npx supabase functions deploy <function-name>
```

## Hard Rules (optional tools and configs)

For the full check pipeline (SAST, architecture, complexity, mutation testing, E2E, AI deductive review), install in your project:

- **dependency-cruiser**: `npm i -D dependency-cruiser` — enforces no circular deps and layer separation
- **eslint-plugin-complexity**: `npm i -D eslint-plugin-complexity` — cyclomatic complexity max 10 per function
- **Stryker**: `npm i -D @stryker-mutator/core` — mutation testing (min 80% score in full mode)
- **semgrep**: `pip install semgrep` or `brew install semgrep` (or use `npx semgrep`); optional SAST

Config templates are in `templates/`: `.dependency-cruiser.json`, `.semgrep.example.yml`, `stryker.config.json`, `eslint.complexity.json`. Copy into your project root or use the init wizard to optionally install them.

## Setup wizard (init)

Run the interactive init to scan your codebase and configure the shim (or use `npx shimwrappercheck setup` to install + init in one step):

```bash
npx shimwrappercheck init
# or
npm exec shimwrappercheck init
```

The wizard can (defaults are tuned based on repo type):

- detect Supabase and Git usage
- ask which commands should trigger checks/hooks
- install pre-push hooks
- enable AI review and guide you through login
- create a `.shimwrappercheckrc` config

## How it works

- The shim determines which checks to run based on git changes (e.g. `src/` vs `supabase/functions/`).
- The shim runs your checks script first (default: `scripts/run-checks.sh`).
- If checks pass, it calls the real Supabase CLI.
- Optional hooks run after deploy to ping health and fetch logs.
- Optional git auto-push can be enabled (this is **not** a git wrapper; it runs after the CLI succeeds).
- Git push checks are enforced via pre-push hooks (template provided).

## Usage

```bash
npx supabase functions deploy <function-name>
npm run supabase:checked -- db push

# git wrapper
npx git push
npm run git:checked -- push

# generic shim (any CLI)
npm exec --package shimwrappercheck -- shim docker build .
npm exec --package shimwrappercheck -- shim --cli terraform -- plan
```

Generic shim hooks:

```bash
export SHIM_CLI_PRE_HOOKS="scripts/cli-pre-hook.sh"
export SHIM_CLI_POST_HOOKS="scripts/cli-post-hook.sh"
shim docker build .
```

Tip: Use `--` to separate shim flags from CLI args when needed:

```bash
npm exec --package shimwrappercheck -- shim --cli docker -- build .
```

You can also run only checks:

```bash
npx supabase --checks-only functions deploy server
```

## Wrapper-only flags

These flags are consumed by the shim and are not passed to the wrapped CLI:

- `--no-checks`    Skip checks for this invocation.
- `--checks-only`  Run checks and exit without running Supabase.
- `--no-hooks`     Skip post-deploy hooks (health/logs).
- `--no-push`      Skip auto git push.
- `--no-ai-review` Passed through to the checks script (template supports it).
- `--with-frontend` Force frontend checks even if no `src/` changes are detected.
- `--ai-review`    Passed through to the checks script (template supports it).
- `--auto-push`    Generic shim: enable git auto-push after command.

## Command filtering

You can control for which Supabase commands checks and hooks should run:

- `SHIM_ENFORCE_COMMANDS="functions,db,migration"` to run checks only for those commands
- `SHIM_HOOK_COMMANDS="functions,db,migration"` to run hooks only for those commands
- Use `all` or `none` to enable/disable completely

Commands are matched by token (e.g. `functions`, `db`, `migration`).

Note: If you want checks for `supabase push`, add `push` to `SHIM_ENFORCE_COMMANDS`.

For Git, use `SHIM_GIT_ENFORCE_COMMANDS` (default: `push`). You can include `commit,merge,rebase` etc.

## Environment variables

- `SHIM_PROJECT_ROOT`           Override project root detection.
- `SHIM_CHECKS_SCRIPT`          Path to your checks script (relative to project root or absolute).
- `SHIM_CHECKS_ARGS`            Extra args passed to checks script.
- `SHIM_CONFIG_FILE`            Custom path to config file (default: `.shimwrappercheckrc`).
- `SHIM_DISABLE_CHECKS=1`       Disable checks (same as `--no-checks`).
- `SHIM_DISABLE_HOOKS=1`        Disable hooks (same as `--no-hooks`).
- `SHIM_AUTO_PUSH=1|0`          Enable/disable auto git push after success (default: on).
- `SHIM_DEFAULT_FUNCTION`       Default function name for health/log hooks (default: `server`).
- `SHIM_ENFORCE_COMMANDS`       Comma list for which CLI commands checks should run (`all`, `none`, or e.g. `functions,db,migration`).
- `SHIM_HOOK_COMMANDS`          Comma list for which CLI commands hooks should run (same format).
- `SHIM_PING_SCRIPT`            Override path to health ping script.
- `SHIM_LOG_SCRIPT`             Override path to logs script.
- `SHIM_GIT_ENFORCE_COMMANDS`   Comma list for which git commands checks should run (`push`, `all`, `none`).
- `SHIM_GIT_CHECKS_SCRIPT`      Override checks script for git wrapper.
- `SHIM_GIT_CHECKS_ARGS`        Extra args passed to checks script (git wrapper only).
- `SHIM_GIT_REAL_BIN`           Absolute path to the real git binary (avoids recursion).
- `SHIM_CLI_ENFORCE_COMMANDS`   Generic shim: comma list for which subcommands checks should run.
- `SHIM_CLI_CHECKS_SCRIPT`      Generic shim: override checks script.
- `SHIM_CLI_CHECKS_ARGS`        Generic shim: extra args passed to checks script.
- `SHIM_CLI_REAL_BIN`           Generic shim: absolute path to real CLI binary (avoids recursion).
- `SHIM_CLI_AUTO_PUSH`          Generic shim: enable git auto-push after command (0/1).
- `SHIM_CLI_PRE_HOOKS`          Generic shim: comma list of pre-hook scripts to run.
- `SHIM_CLI_POST_HOOKS`         Generic shim: comma list of post-hook scripts to run.
- `SHIM_CLI_HOOK_COMMANDS`      Generic shim: comma list for which subcommands hooks should run.

Network retry (Supabase CLI):

- `SUPABASE_RETRY_MAX`                 Number of retries on network errors (default: 1).
- `SUPABASE_RETRY_BACKOFF_SECONDS`     Comma-separated backoff seconds (default: `5,15`).
- `SUPABASE_RETRY_EXTRA_ARGS`          Extra args added only on retry attempts.

Supabase CLI resolution:

- `SUPABASE_REAL_BIN`           Absolute path to the real Supabase CLI.
- `SHIM_SUPABASE_BIN`           Same as above (alias).
- `~/.supabase-real-bin`        If present, read as real CLI path.

Post-deploy hooks:

- `SHIM_HEALTH_FUNCTIONS`       Comma-separated function names to ping (fallback if not detected).
- `SHIM_LOG_FUNCTIONS`          Comma-separated function names to fetch logs for.
- `SHIM_LOG_LIMIT`              Log lines to fetch (default: 30).
- `SUPABASE_PROJECT_REF`        Project ref for health ping (or `supabase/project-ref`).
- `SHIM_HEALTH_PATHS`           Comma-separated URL paths with `{fn}` placeholder.

## Config file (optional)

Create `.shimwrappercheckrc` in your project root to persist settings:

```bash
SHIM_ENFORCE_COMMANDS="functions,db,migration"
SHIM_HOOK_COMMANDS="functions,db,migration"
SHIM_DEFAULT_FUNCTION="server"
SHIM_AUTO_PUSH=1
SHIM_CHECKS_ARGS="--no-ai-review"
```

Note: `.shimwrappercheckrc` is sourced as a shell file.

## Templates

- `templates/run-checks.sh`     Minimal checks runner; customize for your repo.
- `templates/ai-code-review.sh` Optional AI review step (Codex default, Cursor fallback).
- `templates/husky-pre-push`    Husky pre-push hook that runs checks.
- `templates/git-pre-push`      Plain git hook version of the same.

## Notes

- If the shim is installed locally, it avoids recursion by resolving the real Supabase CLI.
- If no real CLI is found, it runs `npx --package supabase supabase ...`.
- The git wrapper should be invoked via `npx git` or `npm run git:checked` to avoid shadowing your system git.
- Hooks are resolved from your repo first (`scripts/ping-edge-health.sh`, `scripts/fetch-edge-logs.sh`) and fall back to the package scripts.
- Generic shim hooks default to `scripts/cli-pre-hook.sh` and `scripts/cli-post-hook.sh` if present.

## License

UNLICENSED (update if you want a public license).
