# shimwrappercheck

Supabase CLI shim wrapper that runs project checks before deploy/push, then calls the real Supabase CLI.

This package provides a `supabase` bin that you can use via `npx supabase ...` or `npm run supabase:checked -- ...`.
It is designed to be repo-agnostic: you plug in your own `scripts/run-checks.sh` and optional hooks.

## Features

- Wraps Supabase CLI and enforces checks before deploy/push
- Diff-aware checks (frontend/backend) based on staged/unstaged changes
- Command filtering (only run checks/hooks for specific Supabase commands)
- Network retry for flaky Supabase CLI calls
- Post-deploy hooks: health ping + logs
- Auto git push when ahead of upstream
- AI review integration (Codex default, Cursor fallback)
- Interactive setup wizard that scans your repo and configures everything

## Install

```bash
npm i -D shimwrappercheck
```

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

## Setup wizard (recommended)

Run the interactive init to scan your codebase and configure the shim:

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
- Optional git auto-push can be enabled.

## Usage

```bash
npx supabase functions deploy <function-name>
npm run supabase:checked -- db push
```

You can also run only checks:

```bash
npx supabase --checks-only functions deploy server
```

## Wrapper-only flags

These flags are consumed by the shim and are not passed to the Supabase CLI:

- `--no-checks`    Skip checks for this invocation.
- `--checks-only`  Run checks and exit without running Supabase.
- `--no-hooks`     Skip post-deploy hooks (health/logs).
- `--no-push`      Skip auto git push.
- `--no-ai-review` Passed through to the checks script (template supports it).
- `--with-frontend` Force frontend checks even if no `src/` changes are detected.
- `--ai-review`    Passed through to the checks script (template supports it).

## Command filtering

You can control for which Supabase commands checks and hooks should run:

- `SHIM_ENFORCE_COMMANDS="functions,db,migration"` to run checks only for those commands
- `SHIM_HOOK_COMMANDS="functions,db,migration"` to run hooks only for those commands
- Use `all` or `none` to enable/disable completely

Commands are matched by token (e.g. `functions`, `db`, `migration`).

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
- Hooks are resolved from your repo first (`scripts/ping-edge-health.sh`, `scripts/fetch-edge-logs.sh`) and fall back to the package scripts.

## License

UNLICENSED (update if you want a public license).
