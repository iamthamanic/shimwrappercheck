# Shim Wrapper Concept (Enforced Checks)

## Why

Teams often want a guaranteed flow: change code -> run checks -> deploy/push.
A shim wrapper ensures checks run even when developers or agents use the CLI directly.

## Core idea

- Put a wrapper earlier in PATH (or use local npm bin).
- The wrapper runs checks first.
- Only after checks pass, the real CLI runs.
- Git hooks provide a second safety net.

## Wrapper design

1) Resolve the project root.
2) Detect which checks to run based on changed files (e.g. `src/` vs `supabase/functions/`).
3) Run a checks script (repo-specific).
4) Call the real CLI (not the wrapper).
5) Run optional post-deploy hooks (health ping, logs).
6) Optionally push commits if ahead of upstream.

## Command filtering

You can limit which Supabase commands trigger checks and hooks:

- `SHIM_ENFORCE_COMMANDS="functions,db,migration"` to run checks only for these commands.
- `SHIM_HOOK_COMMANDS="functions,db,migration"` to run hooks only for these commands.
- Use `all` or `none` to enable/disable completely.

Persist these settings in `.shimwrappercheckrc` (or set `SHIM_CONFIG_FILE`).

## Avoiding recursion

When the wrapper is called via `npx` or local `node_modules/.bin`, it must not call itself.
To avoid recursion:

- Set `SUPABASE_REAL_BIN` to the real CLI path.
- Or store the real path in `~/.supabase-real-bin`.
- If no real CLI is found, use `npx --package supabase supabase ...`.

## Recommended layers

- Shim wrapper (this package).
- Git pre-push hook running the same checks.
- CI checks for extra safety.

## Typical flows

### Backend repo

- `supabase functions deploy <name>`
- Wrapper runs backend checks
- Deploy happens only if checks pass

### Frontend repo

- `git push`
- Hook runs lint/test/build
- Push is blocked on failure

### Mixed repo

- Wrapper runs backend checks for deploy
- Hook runs path-specific checks for push

## Dashboard and AGENTS.md

- The **dashboard** (`dashboard/`) is a Next.js Web UI: status, run checks, edit `.shimwrappercheckrc`, and edit **AGENTS.md**.
- **AGENTS.md** at project root is read by AI agents (Cursor, Codex). It can be edited via the dashboard so agents and humans share one source of truth; agents should respect its content.

## Setup checklist

1) Add checks script (repo-specific).
2) Use shim wrapper instead of raw CLI.
3) Add a pre-push hook for redundancy.
4) Validate PATH (or use `npx supabase`).
5) Optionally run the dashboard to manage config and AGENTS.md.
