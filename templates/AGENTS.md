# Agent instructions

This file is used by AI agents (Cursor, Codex, etc.) when working with this repo. **Your project is this repo** (the application you are building – frontend, backend, etc.). The shimwrappercheck dashboard is only a configuration UI for the check runner; it is not your application. Edit AGENTS.md here or via the dashboard (Config → AGENTS.md) so agents and humans share one source of truth.

## Mandatory workflow (do not bypass)

- **Always run checks before push or deploy.** Do not call the real Supabase binary or push without going through the checked workflow.
- **Run checks until there are no errors and no warnings.** If any check fails or reports warnings, fix the issues and re-run the checks. Repeat until every check passes with zero errors and zero warnings. Do not push or deploy until all checks are green.
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
- **AI review (Codex):** Runs by default after frontend/backend checks. Skip with `--no-ai-review` or `SKIP_AI_REVIEW=1` for the shim; **on git push** many projects require AI review (no skip). **Pass criteria:** **score ≥ 95%** and **verdict ACCEPT** (strict Senior-Architect checklist: SOLID, performance, security, robustness, maintainability; deductions per violation). If the review fails, fix the code and re-run until it passes. Reviews are saved to `.shimwrapper/reviews/` (gitignored). When you run the shim or push and the output includes the AI review, include token usage and the review result (PASS/FAIL, score, deductions, verdict) in your response.
- **CHECK_MODE (AI review scope):** Default `diff` — AI reviews only changes. Whole codebase: `CHECK_MODE=full npm run checks` or `CHECK_MODE=full bash scripts/run-checks.sh`. Other checks always run on the full codebase; only the AI review input switches (diff vs whole-repo diff, truncated). Set in dashboard (Codex settings) or `.shimwrappercheckrc`.
- **When AI review REJECTs — address broadly:** Do not fix only the single mentioned point. For each affected file from the deductions, do a full pass over the checklist: IDOR/auth, rate limiting, input validation, error handling, edge cases. Then commit and re-run the review. See `docs/AI_REVIEW_WHY_NEW_ERRORS_AFTER_FIXES.md` for rationale and route checklist.
- **Full Explanation (Codex):** Separate check that enforces the **Mandatory Full Explanation Comments** standard (see below). Skip with `--no-explanation-check` or `SKIP_EXPLANATION_CHECK=1`. **If the check fails:** you must fix the code (add missing docstrings and inline comments), then run the checks again. Do not push or deploy until the Full Explanation check passes.
- **Post-deploy hooks (optional):** Health Ping, Edge Logs after Supabase deploy.

## Coding Standard: Mandatory Full Explanation Comments

All code must be delivered with full natural-language commentary. The **Full Explanation** check enforces this; if the code is not fully commented, the check fails.

**If the Full Explanation check does not pass:** Treat it as a hard requirement. Fix the reported issues (add docstrings and inline comments for every function and non-trivial line), then run the check again (e.g. `npm run checks` or `scripts/run-checks.sh`). Repeat until the check passes. Do not bypass the check or push without passing.

**Rules:**

1. Every function must include a docstring explaining: why it exists, what problem it solves, what inputs/outputs mean.
2. Every non-trivial line must be commented inline: what is happening, why it is necessary, what would break if removed.
3. No "clean code only" output is allowed. Explanation is mandatory.
4. Output must always be complete files, never partial snippets.

**Example required style:**

```ts
// We fetch the user here because later steps depend on having the full profile.
const user = await db.getUser(id);
// If the user does not exist, we stop immediately to avoid null crashes downstream.
if (!user) throw new Error("User not found");
```

**Additional rule:** If the code is not fully commented, the output is considered invalid. Regenerate until compliant.

If the project enforces **zero warnings** (e.g. ESLint `--max-warnings 0`), treat any warning as a failure.

## Timeouts

If a check runs too long and times out (e.g. **AI review** or **Full Explanation** with Codex, or other long-running checks), **increase the timeout** as needed:

- **AI / Codex checks:** Set `SHIM_AI_TIMEOUT_SEC` in `.shimwrappercheckrc` or in the dashboard (Config → check settings for the relevant check). Default is often 180 seconds; for large diffs or slow responses use e.g. `SHIM_AI_TIMEOUT_SEC=300` (5 minutes) or higher. Then re-run the checks.
- Other checks may have their own timeout or env vars (see dashboard check settings or `.shimwrappercheckrc`). Increase them if a check consistently times out, then run again until all checks pass with no errors or warnings.

## README and docs

When you add features, change behavior, or add new options, update the README (and changelog if present). The **Update README** check can sync the version from `package.json` into the README; content updates (features, usage, examples) are the agent’s responsibility.

## Shimwrappercheck dashboard (optional)

The **shimwrappercheck dashboard** is a config UI **only for controlling shimwrappercheck** (presets, which checks run, `.shimwrappercheckrc`, this AGENTS.md). It is **not** your project's application. Use it only if you want a GUI to: view status, run checks, edit `.shimwrappercheckrc`, and edit this AGENTS.md. Start with `cd node_modules/shimwrappercheck/dashboard && npm install && npm run dev`. Your codebase (frontend/backend in this repo) is the project the agent works on.

## Customize below

Add project-specific rules, structure, and conventions so agents follow your repo.

### Repository structure

- Frontend: _e.g. `src/` or `src/modules/<domain>/`_
- Backend: _e.g. `supabase/functions/` or `src/supabase/functions/<domain>/`_
- Shared types / lib: _e.g. `src/lib/`, `src/types/`_

## Project rules (Backend / Frontend)

Core rules with brief rationale. Full rules and examples: see `BACKEND_RULES_DI-PATTERN.md` and `FRONTEND-RULES.en.md` (paths may be `docs/` or project root).

### Backend (Node/Prisma/Express etc.)

- **Module independence:** A module must not import from other modules or `common/`.  
  *Why: Keeps modules swappable and testable; changes don't break other areas.*

- **Dependency Injection:** Inject all external dependencies (Prisma, Logger, Config) via DI; no hardcoded values.  
  *Why: Enables tests with mocks; no hidden dependencies.*

- **Logger always required:** Logger is a required dependency; no `console.log` in services.  
  *Why: Consistent logging, structured logs, controllable in production.*

- **File size:** Max 300 lines per file (hard limit 500).  
  *Why: Maintainability, single responsibility, better overview.*

- **DTOs everywhere:** Explicit DTOs for all API inputs and outputs; no Prisma types in responses.  
  *Why: Clear contracts; no accidental exposure of internal fields.*

- **Controllers HTTP only:** No business logic, no direct Prisma in controllers; validation (e.g. Zod) at controller level.  
  *Why: Clear layers; business logic testable in services.*

- **Standard response:** Unified format `{ success: true, data }` or `{ success: false, error: { code, message } }`.  
  *Why: Consistent API; simple error handling in the frontend.*

### Frontend (React/Next.js etc.)

- **Domain modules:** Structure by domains (`src/modules/<domain>/`), not by technology only.  
  *Why: Domain focus; clear boundaries between areas.*

- **File and component size:** Max 300 lines per file, max 150 lines per component.  
  *Why: Maintainability; small reusable units.*

- **CSS Modules / SCSS first:** Styling in CSS/SCSS files (e.g. `.module.scss`); no Tailwind classes in JSX.  
  *Why: Consistent styles; no styling chaos in markup.*

- **CSS variables only:** No hardcoded colors (`#hex`, `rgb()`, `hsl()`) in code; colors/spacing via CSS variables.  
  *Why: Theming and dark mode from one source; design system enforceable.*

- **No business logic in components:** Logic in services/hooks; keep pages slim.  
  *Why: Components testable; logic reusable.*

- **API in services only:** No direct `fetch`/Axios calls in UI components; React Query for server state.  
  *Why: Caching; loading/error state centralized; less duplicate code.*

- **Explicit types:** Strict TypeScript, no `any`, clear DTOs/interfaces.  
  *Why: Type safety; better IDE support; fewer runtime errors.*

- **Accessibility:** Semantic HTML, keyboard navigation, `aria-label` for icon-only buttons.  
  *Why: Usability for all; accessibility (WCAG).*

### Security

- Never expose secrets in responses or logs. Validate and sanitize inputs. Do not store tokens in localStorage unless required and documented.

### Testing

- Frontend: _e.g. `npm run test:run` (Vitest/Jest)._ Backend: _e.g. `deno test` when applicable._

### Setup

- Run `npm run hooks:setup` (or equivalent) once to install git hooks. Ensure the shim is in PATH (e.g. `~/.local/bin` first) so `supabase` and `git` use the wrapper.

---

**Optional advanced checks:** SAST, architecture, complexity, mutation, E2E. Config templates in `node_modules/shimwrappercheck/templates/`. Run `npx shimwrappercheck init` to optionally copy them into the project.
