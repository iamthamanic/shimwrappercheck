# @shimwrappercheck/core

TypeScript library that powers the shimwrappercheck check engine, config I/O, refactor orchestration, and structured CLI/MCP surfaces.

## Layout

| Path | Role |
|------|------|
| `src/config/` | Load/save `.shimwrappercheckrc`, Zod schema, env merge |
| `src/checks/` | Check registry, definitions, `runAllChecks` |
| `src/runners/` | Command runner, error classification, network policy |
| `src/binary/` | `resolve-checktools` (Variante B: `.shimwrapper/checktools`) |
| `src/refactor/` | Post-scan TODO/state orchestration (`--refactor`, `--until-95`) |
| `src/project-api/` | Config/report/agents-md helpers for structured CLI |
| `src/reports/` | `last_error.json` and check-run JSON reports |

## Engines

- **Core (default):** `packages/cli` → `runChecksWithRefactorLoop` → `runAllChecks`.
- **Catalog:** `@shimwrappercheck/core/catalog` exports check metadata and dashboard descriptions (single source of truth).

`scripts/run-checks.sh` is a thin wrapper that execs the core CLI when `packages/cli/dist` is built.

## Check-tools (Variante B)

Project-local tools live in `.shimwrapper/checktools/node_modules/.bin`. Core checks prefer these binaries for:

- `prettier`, `eslint`, `tsc`, `vite`, `vitest`
- ESLint complexity runs via checktools `eslint` when `eslint.complexity.json` is present

Install with `npx shimwrappercheck install-tools` (or project `init`).

## Refactor workflow

With `--refactor` or `--until-95`:

1. `CHECK_MODE=full` (chunked AI review).
2. After checks, `runRefactorOrchestration` runs `extract-refactor-todo.sh` and writes:
   - `.shimwrapper/refactor/refactor-todo.json`
   - `refactor-state.json`
   - `refactor-current-item.json`

`--until-95` additionally loops up to `SHIM_UNTIL95_MAX_ITERATIONS` (default 10) until all checks pass.

## Build & test

```bash
npm run build -w @shimwrappercheck/core
npm run test:unit
```

Consumers (MCP, structured CLI) should `import` the built `dist/` output after `npm run build` at the repo root.
