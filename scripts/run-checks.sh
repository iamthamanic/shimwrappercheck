#!/usr/bin/env bash
# Shared checks for pre-push (GitHub) and supabase-checked (Supabase deploy).
# Engine: @shimwrappercheck/core via packages/cli (run `npm run build` first).
# Usage: run-checks.sh [--frontend] [--backend] [--refactor|--until-95] ...
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI_DIST="$ROOT_DIR/packages/cli/dist/index.js"

if [[ ! -f "$CLI_DIST" ]]; then
	echo "shimwrappercheck: core engine not built (missing packages/cli/dist). Run: npm run build" >&2
	exit 1
fi

cd "$ROOT_DIR"
export SHIM_PROJECT_ROOT="${SHIM_PROJECT_ROOT:-$ROOT_DIR}"
exec node "$CLI_DIST" run-checks "$@"
