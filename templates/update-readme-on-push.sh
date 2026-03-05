#!/usr/bin/env bash
# Optional: run before/after push to keep README in sync (e.g. "Last updated" line).
# Called from pre-push hook or push-checked.sh. Customize for your project.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Example: update a "Last updated" line in README.md (uncomment and adjust)
# if [[ -f README.md ]]; then
#   sed -i.bak "s/Last updated: .*/Last updated: $(date +%Y-%m-%d)/" README.md
#   rm -f README.md.bak
# fi

exit 0
