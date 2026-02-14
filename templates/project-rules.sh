#!/usr/bin/env bash
# shimwrappercheck-project-rules v1
# RULES_JSON [{"type":"max_lines","maxLines":300}]
# Edit via dashboard (Projektregeln → Einstellungen → Formular) or here.
set -e
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

# rule 1: max_lines 300
find . -type f \( -name "*.ts" -o -name "*.tsx" \) 2>/dev/null | while read f; do n=$(wc -l < "$f" 2>/dev/null || echo 0); if [ "$n" -gt 300 ]; then echo "Projektregel verletzt: $f hat $n Zeilen (max 300)"; exit 1; fi; done
exit 0
