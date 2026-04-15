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

1. Resolve the project root.
2. Detect which checks to run based on changed files (e.g. `src/` vs backend paths from `SHIM_BACKEND_PATH_PATTERNS`, default `supabase/functions,src/supabase/functions`).
3. Run a checks script (repo-specific).
4. Call the real CLI (not the wrapper).
5. Run optional post-deploy hooks (health ping, logs).
6. Optionally push commits if ahead of upstream.

## Command filtering

You can limit which Supabase commands trigger checks and hooks:

- `SHIM_ENFORCE_COMMANDS="functions,db,migration"` to run checks only for these commands.
- `SHIM_HOOK_COMMANDS="functions,db,migration"` to run hooks only for these commands.
- `CHECK_MODE=snippet|full|diff|mix` to control AI review scope for manual `run-checks.sh` runs.
- `SHIM_GIT_CHECK_MODE_ON_PUSH=snippet|full` to control AI review scope for push-triggered checks.
- `SHIM_AI_REVIEW_PROVIDER=auto|codex|api` to choose AI review provider (`auto` prefers Codex CLI, fallback API key).
- `SHIM_REFACTOR_MODE=off|interactive|agent` to enable optional refactor item orchestration (`refactor-todo.json`, `refactor-current-item.json`).
- `SHIM_STRICT_NETWORK_CHECKS=1` to fail hard on network/TLS infrastructure errors in network-based checks (e.g. npm audit/Semgrep); default treats infra outages as warning.
- `SHIM_I18N_REQUIRE_MESSAGES_DIR=1` to fail i18n check when no messages directory exists; default skips in non-i18n projects.
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

## MCP Server

shimwrappercheck includes a **zero-dependency MCP server** (mcp/server.js) that lets AI agents control the shim via structured tool calls over stdio (JSON-RPC 2.0 / MCP protocol).

### Tools

- **run_checks**: Execute checks with structured results (pass/fail, stdout, stderr, last error for self-healing).
- **get_check_status**: Read .shim/last_error.json for the last check failure (check name, message, suggestion, raw output).
- **get_config** / **set_config**: Read/write .shimwrappercheckrc as structured key-value pairs.
- **list_checks**: List all available checks with labels, env-keys, and enabled status.
- **toggle_check**: Enable or disable a specific check by env-key.
- **get_latest_report**: Read the latest AI review report markdown.

### Agent workflow

1. Agent calls run_checks before push/deploy.
2. If failed: get_check_status returns the exact error for self-healing.
3. Agent fixes code, calls run_checks again.
4. Agent can toggle_check or set_config to adjust check scope.
5. get_latest_report for detailed AI review deductions.

### CLI integration

Start via CLI: npx shimwrappercheck mcp (auto-installs MCP deps if needed).

Structured CLI parity for the MCP core operations is also available:

- `npx shimwrappercheck config get --json`
- `npx shimwrappercheck config set KEY=VALUE --json`
- `npx shimwrappercheck checks list --json`
- `npx shimwrappercheck checks toggle SHIM_RUN_LINT off --json`
- `npx shimwrappercheck status last-error --json`
- `npx shimwrappercheck report latest --json`
- `npx shimwrappercheck agents-md --json`
- `npx shimwrappercheck mcp clients --json`
- `npx shimwrappercheck mcp configure --client codex-cli --dry-run --json`

Or add directly to MCP client config:

```json
{
  "mcpServers": {
    "shimwrappercheck": {
      "command": "node",
      "args": ["/path/to/shimwrappercheck/mcp/server.js"],
      "env": { "SHIM_PROJECT_ROOT": "/path/to/your/project" }
    }
  }
}
```

## Setup checklist

1. Add checks script (repo-specific).
2. Use shim wrapper instead of raw CLI.
3. Add a pre-push hook for redundancy.
4. Validate PATH (or use `npx supabase`).
5. Optionally run the dashboard to manage config and AGENTS.md.
6. Optionally add the MCP server to your AI agent config for structured tool access.
7. Optional terminal mode: `npx shimwrappercheck config` for full CLI-based configuration.
8. Optional dependency bootstrap: `npx shimwrappercheck install-check-deps`.
