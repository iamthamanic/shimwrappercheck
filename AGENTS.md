# Agent instructions (shimwrappercheck)

This file is used by AI agents (Cursor, Codex, Claude, Gemini, Kimi, Deepseek etc.) when working with this repo.
It can be edited via the dashboard (Config → AGENTS.md) so agents and humans share one source of truth.

**What concerns shimwrappercheck:** This repo _is_ shimwrappercheck (the CLI shim + dashboard). The sections below either describe how to _use_ the shim in this repo (Shim usage, Dashboard, Project rules re checks/timeouts/CHECK*MODE), how to \_extend* it (Checks and presets, Hard Rules), or how to _develop_ it (Coding Standard, Project rules re README/docs, Backend/Frontend rules for dashboard and scripts). Each section header is annotated with **→ Shimwrappercheck:** so you can see the link at a glance.

## Shim usage

**→ Shimwrappercheck:** How the shim is _invoked_ in this repo. Use the wrapped commands (`npx supabase`, `npx git push`) so that `scripts/run-checks.sh` runs before the real CLI. `init` / `install` set up the project and PATH so the shim is used by default.

- Use `npx supabase ...` or `npm run supabase:checked -- ...` so checks run before deploy.
- Use `npx git push` or `npm run git:checked -- push` so checks run before push.
- Run `npx shimwrappercheck init` for setup; `npx shimwrappercheck install` for PATH shims (installed shims call `shimwrappercheck@latest` so they stay current).
- **Check-Tools (Variante B):** Tools (ESLint, Prettier, TypeScript, Vitest, Vite) können **projektlos** in `.shimwrapper/checktools/` liegen. Beim `init` optional anlegen; danach `npx shimwrappercheck install-tools` (oder `npm install` in `.shimwrapper/checktools`). `run-checks.sh` nutzt diese Binaries, wenn vorhanden; sonst Projekt-`node_modules`/npm-Skripte. So bleiben Checks pro Projekt getrennt.

## Dashboard

**→ Shimwrappercheck:** The dashboard _is part of_ shimwrappercheck. It lives in `dashboard/` and is the config UI for the shim (status, run checks, edit `.shimwrappercheckrc`, edit this AGENTS.md). Adding new check types or changing presets touches `dashboard/lib/checks.ts` and related docs.

- The project includes a **dashboard** (Next.js app in `dashboard/`). Start with `cd dashboard && npm install && npm run dev`.
- In the dashboard you can: view status, run checks, edit `.shimwrappercheckrc`, and **edit this AGENTS.md**.
- Agents should respect AGENTS.md; editing it via the dashboard keeps agent instructions in sync.
- **Checks and presets:** New check types are defined in `dashboard/lib/checks.ts` and appear in the Check Library; presets are per-project (no accounts). See `docs/CHECKS_AND_PRESETS.md` for how to add checks and how presets/export work.

## Check descriptions

**→ Shimwrappercheck:** Check texts in the dashboard must be understandable for non-experts and precise for experts.

- Follow the schema in `docs/CHECK_DESCRIPTION_STYLE.md` for every check description (`summary` and `info`).
- Ensure descriptions match real behavior (commands, pass/fail logic, and skip conditions).

## Coding Standard: Mandatory Full Explanation Comments

**→ Shimwrappercheck:** The **Full Explanation** check is implemented in `scripts/ai-explanation-check.sh` and wired in `dashboard/lib/checks.ts` (explanationCheck). When you add or change code in this repo, it must satisfy this standard if the check is enabled. Changing the check logic or skip flags affects the shim and the dashboard check list.

Projects can enforce the **Full Explanation** check (see `dashboard/lib/checks.ts` → `explanationCheck`). Standard: every function has a docstring (why it exists, what problem it solves, inputs/outputs); every non-trivial line has an inline comment (what happens, why needed, what breaks if removed); no clean-code-only output; output must be complete files, never partial snippets. **Additional rule:** If code is not fully commented, the output is invalid; regenerate until compliant. The check runs via `scripts/ai-explanation-check.sh` (Codex); skip with `--no-explanation-check` or `SKIP_EXPLANATION_CHECK=1`. **If the check fails:** fix the code (add docstrings and inline comments), then re-run the check until it passes; do not push without passing.

## Project rules

**→ Shimwrappercheck:** These rules govern _running and configuring_ the shim in this repo. Checks run via `scripts/run-checks.sh`; timeouts and CHECK_MODE are read from `.shimwrappercheckrc` (or the dashboard). When you change shim behavior (e.g. new flags, new checks), update README and `docs/SHIM_WRAPPER_CONCEPT.md` so the shipped product stays documented.

- **Checks until clean:** Run checks until there are no errors and no warnings; fix and re-run until all pass. Do not push with failing or warning checks.
- **Timeouts:** If a check times out (e.g. AI review, Full Explanation), increase the timeout (e.g. `SHIM_AI_TIMEOUT_SEC` in `.shimwrappercheckrc` or dashboard) and re-run.
- **CHECK_MODE (AI review scope):** Default `diff` — AI reviews only changes (staged/unstaged or commits being pushed). With `CHECK_MODE=full` the review runs **chunked per directory**: only existing dirs among `src`, `supabase`, `scripts` are used; for each dir a separate diff (`git diff EMPTY_TREE..HEAD -- <dir>`) is sent to Codex, up to 150 KB per chunk (truncated with a note if larger). One Codex run per chunk (timeout 600 s per chunk, configurable via `SHIM_AI_CHUNK_TIMEOUT`). PASS only if all chunks get ACCEPT and score ≥ 95. The saved review file shows **Mode: diff** or **Mode: full (chunked)** and has sections `## Chunk: src`, `## Chunk: supabase`, etc. To add more dirs (e.g. `docs`), extend the `for d in src supabase scripts` line in `scripts/ai-code-review.sh`. Can be set in the dashboard (Codex check settings) or in `.shimwrappercheckrc`.
- **When AI review REJECTs — address broadly:** Do not fix only the single mentioned point. For each affected file from the deductions, do a full pass over the checklist: IDOR/auth, rate limiting, input validation, error handling, edge cases. Then commit and re-run the review. See `docs/AI_REVIEW_WHY_NEW_ERRORS_AFTER_FIXES.md` for rationale and route checklist.
- Keep checks fast; run lint/type/build in `scripts/run-checks.sh`.
- **i18n check:** `scripts/i18n-check.js` ensures all translation keys used in code (useTranslations/t("key")) exist in every locale under `dashboard/messages` (or `messages/`). Run with `--fix` to add missing keys as placeholders; skip with `--no-i18n-check` or `SKIP_I18N_CHECK=1`.
- When changing shim behavior, update README and docs/SHIM_WRAPPER_CONCEPT.md if needed.
- **README / Changelog:** When you add features, change behavior, or add new checks or options, update the README (and changelog if present) so docs stay in sync. The "Update README" check can sync version from package.json; content updates (features, usage, examples) are the agent’s responsibility.

## Project rules (Backend / Frontend)

**→ Shimwrappercheck:** These are _code quality rules_ for developing shimwrappercheck itself. The **dashboard** (`dashboard/`) follows the Frontend rules; scripts and API routes follow the Backend rules. They do not define how consumer projects use the shim—only how we build and maintain this repo.

Core rules with brief rationale. Full rules and examples: see `BACKEND_RULES_DI-PATTERN.md` and `FRONTEND-RULES.en.md` (paths may be `docs/` or project root). For the **dashboard** in `dashboard/`, the Frontend rules apply; for backend-style code (e.g. API routes, scripts), the Backend rules apply.

### Backend (Node/Prisma/Express etc.)

- **Module independence:** A module must not import from other modules or `common/`.  
  _Why: Keeps modules swappable and testable; changes don't break other areas._

- **Dependency Injection:** Inject all external dependencies (Prisma, Logger, Config) via DI; no hardcoded values.  
  _Why: Enables tests with mocks; no hidden dependencies._

- **Logger always required:** Logger is a required dependency; no `console.log` in services.  
  _Why: Consistent logging, structured logs, controllable in production._

- **File size:** Max 300 lines per file (hard limit 500).  
  _Why: Maintainability, single responsibility, better overview._

- **DTOs everywhere:** Explicit DTOs for all API inputs and outputs; no Prisma types in responses.  
  _Why: Clear contracts; no accidental exposure of internal fields._

- **Controllers HTTP only:** No business logic, no direct Prisma in controllers; validation (e.g. Zod) at controller level.  
  _Why: Clear layers; business logic testable in services._

- **Standard response:** Unified format `{ success: true, data }` or `{ success: false, error: { code, message } }`.  
  _Why: Consistent API; simple error handling in the frontend._

### Frontend (React/Next.js etc., e.g. Dashboard)

- **Domain modules:** Structure by domains (`src/modules/<domain>/`), not by technology only.  
  _Why: Domain focus; clear boundaries between areas._

- **File and component size:** Max 300 lines per file, max 150 lines per component.  
  _Why: Maintainability; small reusable units._

- **CSS Modules / SCSS first:** Styling in CSS/SCSS files (e.g. `.module.scss`); no Tailwind classes in JSX.  
  _Why: Consistent styles; no styling chaos in markup._

- **CSS variables only:** No hardcoded colors (`#hex`, `rgb()`, `hsl()`) in code; colors/spacing via CSS variables.  
  _Why: Theming and dark mode from one source; design system enforceable._

- **No business logic in components:** Logic in services/hooks; keep pages slim.  
  _Why: Components testable; logic reusable._

- **API in services only:** No direct `fetch`/Axios calls in UI components; React Query for server state.  
  _Why: Caching; loading/error state centralized; less duplicate code._

- **Explicit types:** Strict TypeScript, no `any`, clear DTOs/interfaces.  
  _Why: Type safety; better IDE support; fewer runtime errors._

- **Accessibility:** Semantic HTML, keyboard navigation, `aria-label` for icon-only buttons.  
  _Why: Usability for all; accessibility (WCAG)._

## Hard Rules (optional tools)

**→ Shimwrappercheck:** Optional _check types_ that can be offered by the shim. Config templates live in `templates/`; `npx shimwrappercheck init` can copy them into a project. Adding or changing these affects `templates/`, `scripts/run-checks.sh` (or the template), and optionally `dashboard/lib/checks.ts` so they appear in the Check Library.

For full shim checks (SAST, architecture, complexity, mutation, E2E, AI deductive review), projects can install: `dependency-cruiser`, `eslint-plugin-complexity`, `@stryker-mutator/core`, and optionally `semgrep` (CLI). Config templates live in `templates/` (e.g. `.dependency-cruiser.json`, `.semgrep.example.yml`, `stryker.config.json`, `eslint.complexity.json`). Run `npx shimwrappercheck init` to optionally copy these into the project.
