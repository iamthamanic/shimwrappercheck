#!/usr/bin/env bash
# shimwrappercheck-project-rules v1
# RULES_JSON [{"type":"max_lines","maxLines":300},{"type":"forbidden_regex","pattern":"#[0-9a-fA-F]{3,8}\\b"},{"type":"forbidden_regex","pattern":"\\b(rgb|rgba|hsl|hsla)\\s*\\("},{"type":"forbidden_regex","pattern":"style=\\{\\{"},{"type":"forbidden_regex","pattern":"from\\s+['\"]\\.\\./\\.\\./"},{"type":"forbidden_regex","pattern":"(:\\s*any\\b|as\\s+any\\b)"}]
# Edit via dashboard (Projektregeln → Einstellungen → Formular) or here.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# rule 1: max_lines 300
find . -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | while read f; do n=$(wc -l < "$f" 2>/dev/null || echo 0); if [ "$n" -gt 300 ]; then echo "Projektregel verletzt: $f hat $n Zeilen (max 300)"; exit 1; fi; done
# rule 2: forbidden_regex
if grep -rE --exclude-dir=node_modules --exclude-dir=.next --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" '#[0-9a-fA-F]{3,8}\b' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi
# rule 3: forbidden_regex
if grep -rE --exclude-dir=node_modules --exclude-dir=.next --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" '\b(rgb|rgba|hsl|hsla)\s*\(' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi
# rule 4: forbidden_regex
if grep -rE --exclude-dir=node_modules --exclude-dir=.next --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" 'style=\{\{' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi
# rule 5: forbidden_regex
if grep -rE --exclude-dir=node_modules --exclude-dir=.next --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" 'from\s+['"'"'"]\.\./\.\./' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi
# rule 6: forbidden_regex
if grep -rE --exclude-dir=node_modules --exclude-dir=.next --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" '(:\s*any\b|as\s+any\b)' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi
exit 0
