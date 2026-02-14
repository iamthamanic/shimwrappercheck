/**
 * Catalog of project rules (7Style-DDD / AGENTS.md style). Generic and modular:
 * each entry can be turned into a script check. Used for default preset and
 * (later) Form UI to pick rules by name.
 * Location: dashboard/lib/projectRulesCatalog.ts
 */

import type { ProjectRuleForm } from "./projectRulesScript";

export type RuleCategory = "frontend" | "backend" | "both";

export interface CatalogRule {
  id: string;
  label: string;
  description: string;
  category: RuleCategory;
  /** Form-compatible rule (id will be set when used). */
  form: Omit<ProjectRuleForm, "id">;
}

/** 7Style / AGENTS.md–style rules: one source of truth, easy to extend. */
export const PROJECT_RULES_CATALOG: CatalogRule[] = [
  {
    id: "max_lines_file",
    label: "Max. Zeilen pro Datei (300)",
    description: "AGENTS.md / 7Style: Max 300 Zeilen pro Datei (hard limit 500).",
    category: "both",
    form: { type: "max_lines", maxLines: 300 },
  },
  {
    id: "no_hardcoded_hex",
    label: "Keine Hardcoded-Farben (#hex)",
    description: "7Style Frontend: Keine #hex-Werte; nur CSS-Variablen.",
    category: "frontend",
    form: { type: "forbidden_regex", pattern: "#[0-9a-fA-F]{3,8}\\b" },
  },
  {
    id: "no_hardcoded_rgb_hsl",
    label: "Keine rgb()/hsl() im Code",
    description: "7Style Frontend: Keine rgb(, rgba(, hsl(, hsla( im Code; nur CSS-Variablen.",
    category: "frontend",
    form: { type: "forbidden_regex", pattern: "\\b(rgb|rgba|hsl|hsla)\\s*\\(" },
  },
  {
    id: "no_inline_styles",
    label: "Keine Inline-Styles (style={{)",
    description: "7Style Frontend: Kein style={{ }} in JSX; Styles in CSS/SCSS.",
    category: "frontend",
    form: { type: "forbidden_regex", pattern: "style=\\{\\{" },
  },
  {
    id: "no_tailwind_arbitrary_colors",
    label: "Keine Tailwind-Arbitrary-Farben (text-[# / bg-[#)",
    description: "7Style Frontend: Keine text-[#..., bg-[#... im JSX.",
    category: "frontend",
    form: { type: "forbidden_regex", pattern: "(text|bg|border)-\\[#" },
  },
  {
    id: "no_deep_relative_imports",
    label: "Keine tiefen relativen Imports (../..)",
    description: "7Style: Kein from '../..' oder tiefer; Pfad-Aliase nutzen.",
    category: "both",
    form: { type: "forbidden_regex", pattern: "from\\s+['\"]\\.\\./\\.\\./" },
  },
  {
    id: "no_console_log",
    label: "Kein console.log im Produktionscode",
    description: "7Style Backend: Kein console.log/error/warn; Logger nutzen.",
    category: "backend",
    form: { type: "forbidden_regex", pattern: "console\\.(log|error|warn)\\s*\\(" },
  },
  {
    id: "no_any_type",
    label: "Kein TypeScript any",
    description: "7Style: Kein : any oder as any; explizite Typen.",
    category: "both",
    form: { type: "forbidden_regex", pattern: "(:\\s*any\\b|as\\s+any\\b)" },
  },
];

/** IDs of rules to use for the default "Standard (AGENTS.md)" script. Modular: change here to adjust default. */
export const DEFAULT_PRESET_RULE_IDS = [
  "max_lines_file",
  "no_hardcoded_hex",
  "no_hardcoded_rgb_hsl",
  "no_inline_styles",
  "no_deep_relative_imports",
  "no_any_type",
];

/** Build form rules for the default preset (for script generation and Form UI). */
export function getDefaultPresetRules(): ProjectRuleForm[] {
  const byId = new Map(PROJECT_RULES_CATALOG.map((r) => [r.id, r]));
  return DEFAULT_PRESET_RULE_IDS.map((id, i) => {
    const entry = byId.get(id);
    if (!entry) return null;
    return { ...entry.form, id: `catalog-${id}-${i}` } as ProjectRuleForm;
  }).filter((r): r is ProjectRuleForm => r !== null);
}
