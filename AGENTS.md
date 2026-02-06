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

## Project rules

- Keep checks fast; run lint/type/build in `scripts/run-checks.sh`.
- When changing shim behavior, update README and docs/SHIM_WRAPPER_CONCEPT.md if needed.
