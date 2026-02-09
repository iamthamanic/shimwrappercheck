# Agent instructions (shimwrappercheck)

This file is used by AI agents (Cursor, Codex, Claude, Gemini, Kimi, Deepseek etc.) when working with this repo.
It can be edited via the dashboard (Config → AGENTS.md) so agents and humans share one source of truth.

## Shim usage

- Use `npx supabase ...` or `npm run supabase:checked -- ...` so checks run before deploy.
- Use `npx git push` or `npm run git:checked -- push` so checks run before push.
- Run `npx shimwrappercheck init` for setup; `npx shimwrappercheck install` for PATH shims.

## Dashboard

- The project includes a **dashboard** (Next.js app in `dashboard/`). Start with `cd dashboard && npm install && npm run dev`.
- In the dashboard you can: view status, run checks, edit `.shimwrappercheckrc`, and **edit this AGENTS.md**.
- Agents should respect AGENTS.md; editing it via the dashboard keeps agent instructions in sync.
- **Checks and presets:** New check types are defined in `dashboard/lib/checks.ts` and appear in the Check Library; presets are per-project (no accounts). See `docs/CHECKS_AND_PRESETS.md` for how to add checks and how presets/export work.

## Coding Standard: Mandatory Full Explanation Comments

Projects can enforce the **Full Explanation** check (see `dashboard/lib/checks.ts` → `explanationCheck`). Standard: every function has a docstring (why it exists, what problem it solves, inputs/outputs); every non-trivial line has an inline comment (what happens, why needed, what breaks if removed); no clean-code-only output; output must be complete files, never partial snippets. **Additional rule:** If code is not fully commented, the output is invalid; regenerate until compliant. The check runs via `scripts/ai-explanation-check.sh` (Codex); skip with `--no-explanation-check` or `SKIP_EXPLANATION_CHECK=1`. **If the check fails:** fix the code (add docstrings and inline comments), then re-run the check until it passes; do not push without passing.

## Project rules

- **Checks until clean:** Run checks until there are no errors and no warnings; fix and re-run until all pass. Do not push with failing or warning checks.
- **Timeouts:** If a check times out (e.g. AI review, Full Explanation), increase the timeout (e.g. `SHIM_AI_TIMEOUT_SEC` in `.shimwrappercheckrc` or dashboard) and re-run.
- **CHECK_MODE (AI review scope):** Default `diff` — AI reviews only changes (staged/unstaged or commits being pushed). To review the whole codebase: `CHECK_MODE=full npm run checks` or `CHECK_MODE=full bash scripts/run-checks.sh`. Format, lint, typecheck, etc. always run on the full codebase; only the input to the AI review changes (diff vs whole-repo diff, truncated to ~100KB). Can be set in the dashboard (Codex check settings) or in `.shimwrappercheckrc`.
- **When AI review REJECTs — address broadly:** Do not fix only the single mentioned point. For each affected file from the deductions, do a full pass over the checklist: IDOR/auth, rate limiting, input validation, error handling, edge cases. Then commit and re-run the review. See `docs/AI_REVIEW_WHY_NEW_ERRORS_AFTER_FIXES.md` for rationale and route checklist.
- Keep checks fast; run lint/type/build in `scripts/run-checks.sh`.
- When changing shim behavior, update README and docs/SHIM_WRAPPER_CONCEPT.md if needed.
- **README / Changelog:** When you add features, change behavior, or add new checks or options, update the README (and changelog if present) so docs stay in sync. The "Update README" check can sync version from package.json; content updates (features, usage, examples) are the agent’s responsibility.

## Project rules (Backend / Frontend)

Core rules with brief rationale. Full rules and examples: see `BACKEND_RULES_DI-PATTERN.md` and `FRONTEND-RULES.en.md` (paths may be `docs/` or project root). For the **dashboard** in `dashboard/`, the Frontend rules apply; for backend-style code (e.g. API routes, scripts), the Backend rules apply.

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

### Frontend (React/Next.js etc., e.g. Dashboard)

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

## Hard Rules (optional tools)

For full shim checks (SAST, architecture, complexity, mutation, E2E, AI deductive review), projects can install: `dependency-cruiser`, `eslint-plugin-complexity`, `@stryker-mutator/core`, and optionally `semgrep` (CLI). Config templates live in `templates/` (e.g. `.dependency-cruiser.json`, `.semgrep.example.yml`, `stryker.config.json`, `eslint.complexity.json`). Run `npx shimwrappercheck init` to optionally copy these into the project.
