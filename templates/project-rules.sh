#!/usr/bin/env bash
# shimwrappercheck-project-rules v1
# RULES_JSON [{"type":"max_lines","maxLines":300}]
# Edit via dashboard (Projektregeln → Einstellungen → Formular) or here.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EXCLUDED_DIRS=(
  "node_modules"
  ".git"
  ".next"
  "dist"
  "build"
  ".shim"
  ".shimwrapper"
  ".stryker-tmp"
  ".codex-home"
  "coverage"
  "dashboard/node_modules"
  "dashboard/.next"
)

# rule 1: max_lines 300
while IFS= read -r f; do
  n=$(wc -l < "$f" 2>/dev/null || echo 0)
  if [ "$n" -gt 300 ]; then
    echo "Projektregel verletzt: $f hat $n Zeilen (max 300)"
    exit 1
  fi
done < <(
  find . \
    \( -path './node_modules' -o -path './.git' -o -path './.next' -o -path './dist' -o -path './build' -o -path './.shim' -o -path './.shimwrapper' -o -path './.stryker-tmp' -o -path './.codex-home' -o -path './coverage' -o -path './dashboard/node_modules' -o -path './dashboard/.next' \) -prune \
    -o -type f \( -name "*.ts" -o -name "*.tsx" \) -print
)
exit 0
