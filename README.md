# shimwrappercheck

CLI shim that runs project checks before a real CLI command runs (for example Supabase or Git). Optional: web dashboard for configuring presets, trigger commands, checks, and `AGENTS.md`.

---

## Features

### CLI & Wrapper

- **Supabase, Git, and generic shim**: Wraps `supabase`, `git`, or arbitrary CLIs and runs checks first.
- **Diff-aware checks**: Frontend/backend checks depend on changed files (for example `src/` vs. `supabase/functions/` or `src/supabase/functions/`).
- **Command filters**: Run checks/hooks only for specific commands (for example `functions`, `db`, `migration`, `push`).
- **Network retry** for flaky Supabase CLI calls.
- **Post-deploy hooks**: Health ping and logs after deploy.
- **Optional auto-push**: Automatically run `git push` after success.
- **AI review**: Provider selectable (`SHIM_AI_REVIEW_PROVIDER=auto|codex|api`). **Strict:** senior software architect checklist (SOLID, performance, security, robustness, maintainability), starts at 100 points, deductions per violation. Output: score, deductions (point, minus, reason), verdict. **PASS only if score >= minimum (default 95%) and verdict ACCEPT.** Integrated into checks; reviews stored in `.shimwrapper/reviews/` and optionally as JSON report.
- **Refactor orchestration (optional)**: `SHIM_REFACTOR_MODE=interactive|agent` creates a TODO list, state, and `refactor-current-item.json` for resume/handoff per item.
- **Interactive setup wizard**: Repo scan and configuration in one run.
- **Terminal configuration mode**: Set options directly in the CLI (`npx shimwrappercheck config`) without the dashboard.
- **Automatic check dependency installation**: Install npm dependencies for active checks on demand (`install-check-deps`).
- **Global install**: PATH shims (`supabase`, `git`, `shim`) in for example `~/.local/bin`.

### Dashboard (Web UI)

- **Check Library**: All built-in checks with filters (Frontend / Backend / Enforce / Hooks), search, drag and drop into "My Shim". Per check: **tool status** (whether tools like ESLint/Deno are installed) and a **copy-paste command** to install missing tools. Check info follows a fixed schema (Purpose/Checks/Passed/Failed/Customize/Note).
- **My Shim (Sidebar)**:
  - **Trigger Commands**: Tags per tab (Enforce / Hooks), for example `git push`, `supabase functions deploy`. Confirm new tags with **Enter**; saving writes `.shimwrappercheckrc` and presets.
  - **My Checks**: Order of active checks, search, remove, drag to sort, and "updated" timestamp.
- **Settings**:
  - **Templates**: Select preset (for example "Vibe Code"), and for the active preset use **...** (options: export, rename). Custom preset: add provider (Supabase/Git). **Trigger Commands & My Checks** are configurable 1:1 like in the sidebar.
  - **Information**: Port/version, **status** (`.shimwrappercheckrc`, presets file, `AGENTS.md`, `run-checks.sh`, shim runner, Husky, Git pre-push, Supabase), project root, last check error, **actions** ("Run checks only", Config, `AGENTS.md`), latest check output.
- **Config (Raw)**: Edit `.shimwrappercheckrc` directly.
- **AGENTS.md**: Edit agent instructions for Cursor/Codex in the dashboard; changes apply immediately.

### Checks (Examples)

- **Frontend**: **Prettier**, **ESLint**, **TypeScript Check**, project rules, check mock data, **Vitest**, **Vite Build**, npm audit, Snyk, **Update README** (sync version from `package.json` into README).
- **Backend**: Deno fmt/lint/audit for Supabase Functions.
- **Both**: AI Review (strict: senior architect checklist, score >= 95%, verdict ACCEPT), SAST, Architecture, Complexity, Mutation, E2E (templates/planned).
- **Hooks**: Post-deploy health ping, edge logs.

### Configuration

- **Presets**: `.shimwrappercheck-presets.json` (presets, trigger commands, check order, toggles). The dashboard also writes `.shimwrappercheckrc` for the shell scripts.
- **Env & RC**: All options configurable via environment variables or `.shimwrappercheckrc`.
- **Check tools (per project):** Optional `.shimwrapper/checktools/` with its own `package.json` (ESLint, Prettier, TypeScript, Vitest, Vite). Can be created during `init`; then use `npx shimwrappercheck install-tools` or include active check dependencies via `npx shimwrappercheck install-tools --with-check-deps`. `run-checks.sh` uses these binaries if present, so tools stay isolated per project (variant B).

---

## Guide: Using shimwrappercheck

### 1. Install

```bash
npm i -D shimwrappercheck
```

### 2. One-time setup (Wizard + Dashboard)

Everything in one step: install package, run the wizard, start the dashboard:

```bash
npx shimwrappercheck setup
```

The wizard asks about:

- Supabase/Git usage
- Which commands trigger checks/hooks
- Pre-push hooks (Husky)
- AI review (strict: checklist, score >= 95%, verdict ACCEPT; can be disabled with `--no-ai-review`)
- Creates `.shimwrappercheckrc` and optionally `scripts/run-checks.sh`, templates.

**Afterwards, the dashboard starts automatically** and opens in the browser (for example http://localhost:3000). A free port (3000, 3001, ...) is selected automatically.

### 3. Use the dashboard

**Start the dashboard later** (from the project root that contains `node_modules/shimwrappercheck`):

```bash
cd node_modules/shimwrappercheck/dashboard && npm install && npm run dev
```

Or from the repo root (if `npm run dashboard` exists in `package.json`):

```bash
npm run dashboard
```

Then open the URL shown in the terminal in your browser.

**In the dashboard:**

1. **Trigger Commands (My Shim, left)**
   - Select tab **Enforce** or **Hooks**.
   - Type commands (for example `git push`, `supabase functions deploy`) and confirm each tag with **Enter**.
   - Changes are saved and applied to `.shimwrappercheckrc` / presets.

2. **My Checks (My Shim, left)**
   - Drag checks from the **Check Library** (right) into "My Checks".
   - Reorder with drag and drop, remove individual checks.
   - Per check: info/settings; **tool status** shows whether the tool (for example ESLint, Deno) is available and offers a **Copy** command to install it.

3. **Check Library (right)**
   - Filters: Frontend, Backend, Enforce, Hooks (multi-select).
   - Search, then drag to My Shim to enable.

4. **Settings**
   - **Templates**: Switch preset, use ... on the active preset for export/rename; edit Trigger Commands & My Checks like in the sidebar.
   - **Information**: Status of all files/scripts, "Run checks only", links to Config and `AGENTS.md`.

5. **Config / AGENTS.md**
   - Via Settings -> Information or navigation: raw editor for `.shimwrappercheckrc` and editor for `AGENTS.md`.

### 4. Run checked commands

After setup, use the shim instead of the "bare" CLI:

```bash
# Supabase (checks run before the real command)
npx supabase functions deploy <name>
npm run supabase:checked -- db push

# Git (for example pre-push or manual)
npx git push
npm run git:checked -- push
```

**Run checks only** (without Supabase/Git):

- In the dashboard under **Settings -> Information**, click "Run checks only",  
  or
- CLI: `npx supabase --checks-only functions deploy server`

**Wrapper flags** (not forwarded to the real CLI):

- `--no-checks` skip checks
- `--checks-only` checks only, no Supabase/Git
- `--no-hooks` skip post-deploy hooks
- `--no-push` skip auto-push

### 5. Configuration files

- **`.shimwrappercheckrc`** (project root): Written by the dashboard when saving (trigger commands, presets, checks). Contains values like `SHIM_ENFORCE_COMMANDS`, `SHIM_HOOK_COMMANDS`, `SHIM_CHECK_ORDER`, toggles.
- **`.shimwrappercheck-presets.json`**: Full preset and check data; the dashboard reads/writes this file and derives the RC from it.

For a **Vercel/hosted dashboard**: set `SHIM_PROJECT_ROOT` to the path of the repo root (where RC and `AGENTS.md` are located).

---

## Install

```bash
npm i -D shimwrappercheck
```

## Global Install (PATH shims)

Install shims into a bin directory (for example `~/.local/bin`) so `supabase` / `git` / `shim` can be used without `npx`:

```bash
npx shimwrappercheck install
# Options: --bin-dir <path>, --add-path, --overwrite, --no-supabase | --no-git | --no-shim
```

If the bin directory is not in your PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

## Quick Start (without wizard)

1. Create checks script and hooks:

```bash
cp node_modules/shimwrappercheck/templates/run-checks.sh scripts/run-checks.sh
cp node_modules/shimwrappercheck/templates/ai-code-review.sh scripts/ai-code-review.sh
cp node_modules/shimwrappercheck/templates/husky-pre-push .husky/pre-push
chmod +x scripts/run-checks.sh scripts/ai-code-review.sh .husky/pre-push
```

2. Optional in `package.json`:

```json
{
  "scripts": {
    "supabase:checked": "supabase",
    "git:checked": "git"
  }
}
```

3. Use:

```bash
npm run supabase:checked -- functions deploy <function-name>
npx git push
```

## Setup Wizard (`init`)

Run only the interactive init (without reinstalling):

```bash
npx shimwrappercheck init
```

Detects Supabase/Git, asks for commands used for checks/hooks, pre-push hooks, AI review (strict: senior architect checklist, score >= 95%), AI review provider (`auto|codex|api`) and AI review scope (`full|snippet|diff`), then creates `.shimwrappercheckrc`. Optional: create `.shimwrapper/checktools/` (check tools per project).

### Terminal configuration (without dashboard)

If you want to manage settings later entirely in the terminal:

```bash
npx shimwrappercheck config
```

This mode asks about trigger commands, AI review provider/scope, check toggles, check order, and can then automatically install dependencies for active checks.

### Check tools (project-local tools folder)

If `.shimwrapper/checktools/` was created during `init` (or created manually with `package.json` from `templates/checktools-package.json`), install tools there:

```bash
npx shimwrappercheck install-tools
```

`run-checks.sh` will then use ESLint, Prettier, `tsc`, Vitest, and Vite from that folder if available; otherwise it falls back to the project's `node_modules` or npm scripts.

With automatic installation of dependencies for currently active checks:

```bash
npx shimwrappercheck install-tools --with-check-deps
```

Or separately (reads active checks from `.shimwrappercheckrc`):

```bash
npx shimwrappercheck install-check-deps
```

## How it works

- Based on the configured **trigger commands**, the shim decides whether checks/hooks should run for the executed command (for example `functions`, `db`, `push`).
- First, your **`run-checks.sh`** runs (frontend/backend depending on the diff).
- On success, the real CLI (Supabase/Git) is called.
- Optional: post-deploy hooks (health ping, logs), optional auto-push.
- Git push checks run via the pre-push hook (Husky or `.git/hooks/pre-push`).

## Usage (Overview)

```bash
npx supabase functions deploy <name>
npm run supabase:checked -- db push

npx git push
npm run git:checked -- push

# Checks only
npx supabase --checks-only functions deploy server

# Terminal config + dependency installer
npx shimwrappercheck config
npx shimwrappercheck install-check-deps

# Generic shim
npm exec --package shimwrappercheck -- shim docker build .
npm exec --package shimwrappercheck -- shim --cli terraform -- plan
```

## Wrapper Flags

- `--no-checks` Skip checks for this invocation
- `--checks-only` Checks only, no Supabase/Git
- `--no-hooks` Skip post-deploy hooks
- `--no-push` Skip auto-push
- `--no-ai-review` Forwarded to `run-checks.sh`
- `--with-frontend` Force frontend checks
- `--ai-review` Forwarded to `run-checks.sh`
- `--auto-push` (generic shim) Auto-push after command

## Command Filters

- **Supabase**: `SHIM_ENFORCE_COMMANDS="functions,db,migration"`, `SHIM_HOOK_COMMANDS="functions,db,migration"` (or `all` / `none`).
- **Git**: `SHIM_GIT_ENFORCE_COMMANDS` (for example `push`, `commit`, `merge`, `rebase`).

Commands are matched as tokens (for example `functions`, `db`, `push`).

## Environment Variables (Selection)

- `SHIM_PROJECT_ROOT` Project root (for example for dashboard on Vercel)
- `SHIM_CHECKS_SCRIPT` Path to the checks script
- `SHIM_CHECKS_ARGS` Additional arguments for `run-checks`
- `SHIM_CONFIG_FILE` Config file (default: `.shimwrappercheckrc`)
- `SHIM_DISABLE_CHECKS=1` Disable checks
- `SHIM_DISABLE_HOOKS=1` Disable hooks
- `SHIM_AUTO_PUSH=1|0` Auto-push after success
- `SHIM_ENFORCE_COMMANDS` Supabase commands for checks
- `SHIM_HOOK_COMMANDS` Supabase commands for hooks
- `SHIM_GIT_ENFORCE_COMMANDS` Git commands for checks
- `SHIM_GIT_CHECK_MODE_ON_PUSH=snippet|full` AI review scope on push (default: `snippet`)
- `CHECK_MODE=snippet|full|diff|mix` AI review scope for `run-checks.sh`/manual runs (`diff` = `snippet`)
- `SHIM_AI_REVIEW_PROVIDER=auto|codex|api` AI review provider (`auto`: prefer Codex, fallback to API key)
- `SHIM_BACKEND_PATH_PATTERNS` Backend paths for diff/check detection (default: `supabase/functions,src/supabase/functions`)
- `SHIM_CONTINUE_ON_ERROR=1` Collect check failures and fail at the end (instead of aborting immediately)
- `SHIM_STRICT_NETWORK_CHECKS=1` Treat network/TLS infrastructure errors in `npm audit`/Semgrep as hard failures (default: warn/skip on infrastructure error)
- `SHIM_I18N_REQUIRE_MESSAGES_DIR=1` Fail i18n check if no `messages` directory exists (default: skip)
- `SHIM_REFACTOR_MODE=off|interactive|agent` Optional refactor item flow for `--refactor`
- `SHIM_REFACTOR_DIR`, `SHIM_REFACTOR_TODO_FILE`, `SHIM_REFACTOR_STATE_FILE`, `SHIM_REFACTOR_CURRENT_ITEM_FILE`
- `SHIM_REFACTOR_ITEM_INDEX=<n>`, `SHIM_REFACTOR_ADVANCE=1` Resume/next-item control
- `SHIM_REPORT_FILE` Optional JSON report for AI review
- `REFACTOR_REPORT_FILE` Alias for `SHIM_REPORT_FILE`
- `AI_REVIEW_DIFF_RANGE`, `AI_REVIEW_DIFF_FILE`, `AI_REVIEW_CHUNK` Additional AI review inputs (diff range, diff file, full chunk)
- `SHIM_AI_TIMEOUT_SEC`, `SHIM_AI_CHUNK_TIMEOUT`, `SHIM_AI_DIFF_LIMIT_BYTES`, `SHIM_AI_MIN_RATING`, `SHIM_AI_REVIEW_DIR`
- `SHIM_DEFAULT_FUNCTION` Default function for health/logs
- `SHIM_HEALTH_FUNCTIONS`, `SHIM_LOG_FUNCTIONS`, `SHIM_LOG_LIMIT`
- `SUPABASE_PROJECT_REF`, `SHIM_HEALTH_PATHS`
- Network retry: `SUPABASE_RETRY_MAX`, `SUPABASE_RETRY_BACKOFF_SECONDS`
- Generic shim: `SHIM_CLI_*`, `SHIM_CLI_PRE_HOOKS`, `SHIM_CLI_POST_HOOKS`

## Config File

`.shimwrappercheckrc` in the project root (filled by the dashboard; can be adjusted manually):

```bash
SHIM_ENFORCE_COMMANDS="functions,db,migration"
SHIM_HOOK_COMMANDS="functions,db,migration"
SHIM_DEFAULT_FUNCTION="server"
SHIM_AUTO_PUSH=1
SHIM_CHECKS_ARGS="--no-ai-review"
SHIM_BACKEND_PATH_PATTERNS="supabase/functions,src/supabase/functions"
SHIM_GIT_CHECK_MODE_ON_PUSH="snippet"
CHECK_MODE="full"
SHIM_AI_REVIEW_PROVIDER="auto"
SHIM_REFACTOR_MODE="off"
# Optional:
# SHIM_CONTINUE_ON_ERROR=1
# SHIM_STRICT_NETWORK_CHECKS=1
# SHIM_I18N_REQUIRE_MESSAGES_DIR=1
# SHIM_REPORT_FILE=".shimwrapper/reports/ai-review.json"
```

The file is loaded as a shell script.

## Templates

- `templates/run-checks.sh` Runner for lint, tests, Deno, AI review, etc.
- `templates/ai-code-review.sh` Optional AI review step (strict: senior architect checklist, 100 points, deductions, JSON score/deductions/verdict; PASS at >= 95% and ACCEPT)
- `templates/extract-refactor-todo.sh` Extract TODO items from AI review reports (for refactor handoff)
- `templates/husky-pre-push` Husky pre-push hook
- `templates/git-pre-push` Plain Git hook

## Hard Rules (optional tools)

For SAST, architecture, complexity, mutation, E2E:

- **dependency-cruiser**: `npm i -D dependency-cruiser`
- **eslint-plugin-complexity**: `npm i -D eslint-plugin-complexity`
- **Stryker**: `npm i -D @stryker-mutator/core`
- **semgrep**: for example `brew install semgrep` or `npx semgrep`

Config templates in `templates/`: `.dependency-cruiser.json`, `.semgrep.example.yml`, `stryker.config.json`, `eslint.complexity.json`. Optional setup via the init wizard.

Install automatically (depending on active checks):

```bash
npx shimwrappercheck install-check-deps
```

## Notes

- For local installs, the shim avoids recursion by detecting the real Supabase CLI.
- The Git wrapper should be called via `npx git` or `npm run git:checked` so it does not overwrite the system Git.
- Hooks are searched in the repo first (`scripts/ping-edge-health.sh`, `scripts/fetch-edge-logs.sh`), then in the package.

## License

MIT (see `package.json`).
