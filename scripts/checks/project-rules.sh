#!/usr/bin/env bash
# shimwrappercheck-project-rules v1
# RULES_JSON [{"type":"max_lines","maxLines":300},{"type":"forbidden_regex","pattern":"#[0-9a-fA-F]{3,8}\\b"},{"type":"forbidden_regex","pattern":"\\b(rgb|rgba|hsl|hsla)\\s*\\("},{"type":"forbidden_regex","pattern":"style=\\{\\{"},{"type":"forbidden_regex","pattern":"from\\s+['\"]\\.\\./\\.\\./"},{"type":"forbidden_regex","pattern":"(:\\s*any\\b|as\\s+any\\b)"}]
# Edit via dashboard (Projektregeln → Einstellungen → Formular) or here.
# Qualitätsregeln (u. a. SOLID, DRY) werden zusätzlich im AI-Review geprüft (scripts/ai-code-review.sh / AGENTS.md).
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

GREP_EXCLUDES=()
for dir in "${EXCLUDED_DIRS[@]}"; do
  GREP_EXCLUDES+=(--exclude-dir="$dir")
done

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
# rule 2: forbidden_regex
if grep -rE "${GREP_EXCLUDES[@]}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" '#[0-9a-fA-F]{3,8}\b' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi
# rule 3: forbidden_regex
if grep -rE "${GREP_EXCLUDES[@]}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" '\b(rgb|rgba|hsl|hsla)\s*\(' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi
# rule 4: forbidden_regex
if grep -rE "${GREP_EXCLUDES[@]}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" 'style=\{\{' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi
# rule 5: forbidden_regex
if grep -rE "${GREP_EXCLUDES[@]}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" 'from\s+['"'"'"]\.\./\.\./' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi
# rule 6: forbidden_regex
if grep -rE "${GREP_EXCLUDES[@]}" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" '(:\s*any\b|as\s+any\b)' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi
exit 0
