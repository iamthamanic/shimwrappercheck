/**
 * Generate project-rules.sh from form rules and parse script back to rules.
 * Used by CheckCard when editing Projektregeln in Form view.
 */

export type ProjectRuleForm =
  | { id: string; type: "forbidden_pattern"; pattern: string }
  | { id: string; type: "forbidden_regex"; pattern: string }
  | { id: string; type: "max_lines"; maxLines: number; glob?: string };

const RULES_MARKER = "# RULES_JSON ";

function escapeForBash(s: string): string {
  return s.replace(/'/g, "'\"'\"'");
}

/** Generate bash script content from form rules. */
export function generateScriptFromRules(rules: ProjectRuleForm[]): string {
  const json = JSON.stringify(
    rules.map((r) => ({
      type: r.type,
      pattern: "pattern" in r ? r.pattern : undefined,
      maxLines: "maxLines" in r ? r.maxLines : undefined,
      glob: "glob" in r ? r.glob : undefined,
    }))
  );
  const escapeForRegex = (s: string) => s.replace(/'/g, "'\"'\"'");
  const lines: string[] = [
    "#!/usr/bin/env bash",
    "# shimwrappercheck-project-rules v1",
    RULES_MARKER + json,
    "# Edit via dashboard (Projektregeln → Einstellungen → Formular) or here.",
    "set -e",
    'ROOT="$(cd "$(dirname "$0")/../.." && pwd)"',
    'cd "$ROOT"',
    "",
  ];

  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (r.type === "forbidden_pattern" && r.pattern.trim()) {
      const pat = escapeForBash(r.pattern.trim());
      lines.push(`# rule ${i + 1}: forbidden_pattern`);
      lines.push(
        `if grep -rFl --exclude-dir=node_modules --exclude-dir=.next '${pat}' . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster"; exit 1; fi`
      );
    } else if (r.type === "forbidden_regex" && r.pattern.trim()) {
      const pat = escapeForRegex(r.pattern.trim());
      lines.push(`# rule ${i + 1}: forbidden_regex`);
      lines.push(
        `if grep -rE --exclude-dir=node_modules --exclude-dir=.next --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.scss" --include="*.css" '${pat}' . 2>/dev/null | grep -q .; then echo "Projektregel verletzt: verbotenes Muster (Regex)"; exit 1; fi`
      );
    } else if (r.type === "max_lines" && r.maxLines > 0) {
      lines.push(`# rule ${i + 1}: max_lines ${r.maxLines}`);
      lines.push(
        `find . -type f \\( -name "*.ts" -o -name "*.tsx" \\) 2>/dev/null | while read f; do n=$(wc -l < "$f" 2>/dev/null || echo 0); if [ "$n" -gt ${r.maxLines} ]; then echo "Projektregel verletzt: $f hat $n Zeilen (max ${r.maxLines})"; exit 1; fi; done`
      );
    }
  }
  lines.push("exit 0");
  return lines.join("\n");
}

/** Parse script content and extract rules if it's our generated format. */
export function parseRulesFromScript(raw: string): ProjectRuleForm[] | null {
  const idx = raw.indexOf(RULES_MARKER);
  if (idx === -1) return null;
  const start = idx + RULES_MARKER.length;
  const end = raw.indexOf("\n", start);
  const jsonStr = end === -1 ? raw.slice(start) : raw.slice(start, end);
  try {
    const arr = JSON.parse(jsonStr) as { type: string; pattern?: string; maxLines?: number; glob?: string }[];
    return arr.map((item, i) => {
      const id = `rule-${i}-${Math.random().toString(36).slice(2, 9)}`;
      if (item.type === "forbidden_pattern")
        return { id, type: "forbidden_pattern" as const, pattern: item.pattern ?? "" };
      if (item.type === "forbidden_regex")
        return { id, type: "forbidden_regex" as const, pattern: item.pattern ?? "" };
      if (item.type === "max_lines")
        return { id, type: "max_lines" as const, maxLines: item.maxLines ?? 300, glob: item.glob };
      return { id, type: "forbidden_pattern" as const, pattern: "" };
    });
  } catch {
    return null;
  }
}
