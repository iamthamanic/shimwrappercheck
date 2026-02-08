# Agent instructions

This file is used by AI agents (Cursor, Codex, etc.) when working with this repo. Edit it here or via the shimwrappercheck dashboard (Config → AGENTS.md) so agents and humans share one source of truth.

## Mandatory workflow (do not bypass)

- **Always run checks before push or deploy.** Do not call the real Supabase binary or push without going through the checked workflow.
- **If any check fails, fix the reported issues and re-run.** Do not bypass the shim or hooks. Single source of checks: `scripts/run-checks.sh`.
- Prefer: `npm run checks` (if defined) or run the same steps as the shim. For push: `git push` runs pre-push checks automatically when hooks are installed. For Supabase: use the shim so checks run before the real CLI.

## Shim usage (shimwrappercheck)

- **Supabase:** Use `npx supabase ...` or `npm run supabase:checked -- ...` so checks run before deploy. Do not call the real `supabase` binary directly if you want checks to run.
- **Git push:** Use `npx git push` or `npm run git:checked -- push` so checks run before push. The pre-push hook runs `scripts/run-checks.sh` when installed.
- **Setup:** Run `npx shimwrappercheck init` for one-time setup; `npx shimwrappercheck install` to install PATH shims (e.g. `~/.local/bin`).

## Checks (what runs in `scripts/run-checks.sh`)

Checks are configured in the dashboard or `.shimwrappercheckrc` (toggles and order). Typical checks:

- **Frontend:** Lint, Check Mock Data, Test Run, npm Audit, Snyk (optional; set `SKIP_SNYK=1` to skip), **Update README** (syncs version from package.json into README).
- **Backend (Supabase/Deno):** Deno fmt, Deno lint, Deno audit.
- **AI review (Codex):** Runs by default after frontend/backend checks. Skip with `--no-ai-review` or `SKIP_AI_REVIEW=1` for the shim; **on git push** many projects require AI review (no skip). **Pass criteria:** rating **≥ 95%** and **no warnings and no errors**. If the review fails, fix the code and re-run until it passes. Reviews are saved to `.shimwrapper/reviews/` (gitignored). When you run the shim or push and the output includes the AI review, include token usage and the review result (PASS/FAIL, rating, warnings, errors) in your response.
- **Post-deploy hooks (optional):** Health Ping, Edge Logs after Supabase deploy.

If the project enforces **zero warnings** (e.g. ESLint `--max-warnings 0`), treat any warning as a failure.

## README and docs

When you add features, change behavior, or add new options, update the README (and changelog if present). The **Update README** check can sync the version from `package.json` into the README; content updates (features, usage, examples) are the agent’s responsibility.

## Dashboard (optional)

The project may use the shimwrappercheck dashboard (Next.js app in `node_modules/shimwrappercheck/dashboard/`). Start with `cd node_modules/shimwrappercheck/dashboard && npm install && npm run dev`. In the dashboard you can: view status, run checks, edit `.shimwrappercheckrc`, and **edit this AGENTS.md**.

## Customize below

Add project-specific rules, structure, and conventions so agents follow your repo.

### Repository structure

- Frontend: _e.g. `src/` or `src/modules/<domain>/`_
- Backend: _e.g. `supabase/functions/` or `src/supabase/functions/<domain>/`_
- Shared types / lib: _e.g. `src/lib/`, `src/types/`_

### Frontend rules

- TypeScript: strict mode, no `any` in new code, explicit return types for exported functions.
- Styling: _e.g. CSS Modules only, or Tailwind, or design system from ARCHITECTURE.md._
- Data: API calls in services/hooks only; no direct `fetch` in UI components. Prefer form libs + Zod for validation.
- Accessibility: semantic HTML, keyboard navigation, `aria-label` for icon-only controls.

### Backend rules (Supabase Edge Functions / Deno)

- Dependency injection for Supabase client, logger, config. No hardcoded secrets; use env + validation (e.g. Zod).
- Validate all inputs; keep routing/HTTP in the entry file; business logic in services.
- Standard response shape: _e.g. `{ success: true, data }` / `{ success: false, error: { code, message } }`._
- Use injected logger; avoid `console.*` in services.

### Security

- Never expose secrets in responses or logs. Validate and sanitize inputs. Do not store tokens in localStorage unless required and documented.

### Testing

- Frontend: _e.g. `npm run test:run` (Vitest/Jest)._ Backend: _e.g. `deno test` when applicable._

### Setup

- Run `npm run hooks:setup` (or equivalent) once to install git hooks. Ensure the shim is in PATH (e.g. `~/.local/bin` first) so `supabase` and `git` use the wrapper.

---

**Optional advanced checks:** SAST, architecture, complexity, mutation, E2E. Config templates in `node_modules/shimwrappercheck/templates/`. Run `npx shimwrappercheck init` to optionally copy them into the project.
