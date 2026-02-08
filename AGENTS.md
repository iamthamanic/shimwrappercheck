# Agent instructions (shimwrappercheck)

This file is used by AI agents (Cursor, Codex, etc.) when working with this repo.
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

## Project rules

- Keep checks fast; run lint/type/build in `scripts/run-checks.sh`.
- When changing shim behavior, update README and docs/SHIM_WRAPPER_CONCEPT.md if needed.
- **README / Changelog:** When you add features, change behavior, or add new checks or options, update the README (and changelog if present) so docs stay in sync. The „Update README“ check can sync version from package.json; content updates (features, usage, examples) are the agent’s responsibility.

## Hard Rules (optional tools)

For full shim checks (SAST, architecture, complexity, mutation, E2E, AI deductive review), projects can install: `dependency-cruiser`, `eslint-plugin-complexity`, `@stryker-mutator/core`, and optionally `semgrep` (CLI). Config templates live in `templates/` (e.g. `.dependency-cruiser.json`, `.semgrep.example.yml`, `stryker.config.json`, `eslint.complexity.json`). Run `npx shimwrappercheck init` to optionally copy these into the project.
