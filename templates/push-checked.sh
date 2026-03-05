#!/usr/bin/env bash
# Push wrapper: run checks (AI review in commit mode), then git push.
# Use: npm run push [-- <git push args>]
# Full codebase review: run-checks.sh --refactor (or CHECK_MODE=full), then after push run full again.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export CHECK_MODE="${CHECK_MODE:-commit}"
bash "$ROOT_DIR/scripts/run-checks.sh"

# Optional: update README "Last updated" (same as pre-push)
if [[ -f "$ROOT_DIR/scripts/update-readme-on-push.sh" ]]; then
  bash "$ROOT_DIR/scripts/update-readme-on-push.sh"
  if ! git diff --quiet README.md 2>/dev/null; then
    git add README.md
    git commit -m "docs: update README (auto on push)"
  fi
fi

exec git push "$@"
