#!/usr/bin/env bash
# Template: delegates to project scripts/run-checks.sh (core CLI).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$ROOT_DIR/scripts/run-checks.sh" ]]; then
	exec bash "$ROOT_DIR/scripts/run-checks.sh" "$@"
fi

echo "run-checks.sh: no check runner found under $ROOT_DIR/scripts" >&2
exit 1
