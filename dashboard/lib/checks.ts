/**
 * Check definitions: id, label, info text, and optional settings schema for each shim check.
 * Location: /lib/checks.ts
 */

import type { CheckToggles } from "./presets";

/** Canonical label for the Check Library (rechte Spalte: alle integrierten Checks). Frontend und Backend nutzen diesen Namen. */
export const CHECK_LIBRARY_LABEL = "Check Library";

export type CheckId = keyof CheckToggles | "healthPing" | "edgeLogs";

export interface CheckSettingOption {
  key: string;
  label: string;
  type: "boolean" | "number" | "string" | "select";
  default?: unknown;
  options?: { value: string; label: string }[];
}

export type CheckTag = "frontend" | "backend";

/** Laufzeit: vor Befehl (run-checks.sh) vs. nach Befehl/Deploy (Post-Deploy-Hooks). */
export type CheckRole = "enforce" | "hook";

export interface CheckDef {
  id: CheckId;
  label: string;
  /** Kurze Laien-Erklärung: Was macht dieser Check? (wird zuerst in der Box angezeigt) */
  summary: string;
  info: string;
  settings: CheckSettingOption[];
  /** Jedes Tool hat ein oder mehrere Tags; bei beidem: ["frontend", "backend"] */
  tags: CheckTag[];
  /** enforce = vor Befehl (run-checks.sh), hook = nach Deploy (z. B. Health-Ping, Edge Logs). */
  role: CheckRole;
}

export const CHECK_DEFINITIONS: CheckDef[] = [
  {
    id: "lint",
    label: "ESLint",
    tags: ["frontend"],
    role: "enforce",
    summary: "Lint (Frontend): Prüft Code auf Stil-Fehler und typische Fehlerquellen.",
    info: "Führt npm run lint aus (ESLint). Findet z. B. fehlende Semikolons, ungenutzte Variablen, Verstöße gegen Projekt-Regeln.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "prettier",
    label: "Prettier",
    tags: ["frontend"],
    role: "enforce",
    summary: "Format: Einheitliche Code-Formatierung vor dem Push.",
    info: "Führt Prettier aus (z. B. npm run format oder prettier --check). Stellt sicher, dass Einrückung, Anführungszeichen und Zeilenumbrüche einheitlich sind.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "typecheck",
    label: "TypeScript Check",
    tags: ["frontend"],
    role: "enforce",
    summary: "Typecheck: Prüft TypeScript-Typen vor dem Push.",
    info: "Führt den TypeScript-Compiler aus (z. B. npm run typecheck oder tsc --noEmit). Findet Typfehler ohne die App zu bauen.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "testRun",
    label: "Vitest",
    tags: ["frontend"],
    role: "enforce",
    summary: "Tests: Unit- und Integrationstests – nur bei Grün geht es weiter.",
    info: "Führt Tests aus (z. B. npm run test oder Vitest). Nur wenn alle Tests bestehen, wird der Befehl (z. B. Push/Deploy) fortgesetzt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "projectRules",
    label: "Projektregeln",
    tags: ["frontend"],
    role: "enforce",
    summary: "Projektregeln: Führt scripts/checks/project-rules.sh aus.",
    info: "Führt das Skript scripts/checks/project-rules.sh aus. Prüft projektspezifische Regeln (z. B. Verzeichnisstruktur, Namenskonventionen, erlaubte Imports).",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "npmAudit",
    label: "npm audit",
    tags: ["frontend"],
    role: "enforce",
    summary: "Dependency-Security: Bekannte Schwachstellen in npm-Paketen.",
    info: "Führt npm audit aus. Sucht nach bekannten Sicherheitslücken in Dependencies und warnt vor veralteten Versionen. Stufe konfigurierbar (critical, high, moderate, low).",
    settings: [
      { key: "enabled", label: "Aktiv", type: "boolean", default: true },
      {
        key: "auditLevel",
        label: "Audit-Stufe",
        type: "select",
        default: "high",
        options: [
          { value: "critical", label: "critical" },
          { value: "high", label: "high" },
          { value: "moderate", label: "moderate" },
          { value: "low", label: "low" },
        ],
      },
    ],
  },
  {
    id: "viteBuild",
    label: "Vite",
    tags: ["frontend"],
    role: "enforce",
    summary: "Build: Prüft, ob das Frontend-Projekt fehlerfrei baut.",
    info: "Führt den Vite-Build aus (z. B. npm run build). Nur wenn der Build durchläuft, geht es weiter – verhindert fehlerhafte Deployments.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "snyk",
    label: "Snyk",
    tags: ["frontend"],
    role: "enforce",
    summary: "Optional: Zusätzlicher Dependency-Scan (Snyk).",
    info: "Snyk Dependency-Scan. Findet Schwachstellen, die npm audit nicht kennt. Optional – nur wenn Snyk im Projekt installiert ist.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "denoFmt",
    label: "Deno fmt",
    tags: ["backend"],
    role: "enforce",
    summary: "Deno Format (Backend/Functions).",
    info: "Deno Format-Check für supabase/functions (deno fmt --check). Stellt einheitliche Formatierung von Edge-Function-Code sicher.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "denoLint",
    label: "Deno lint",
    tags: ["backend"],
    role: "enforce",
    summary: "Deno Lint (Backend/Functions).",
    info: "Deno Linter für supabase/functions (deno lint). Findet Fehler und schlechte Praxis in Deno-Code.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "denoAudit",
    label: "Deno audit",
    tags: ["backend"],
    role: "enforce",
    summary: "Deno Audit (Backend/Functions).",
    info: "Deno Security-Audit für supabase/functions (deno audit). Prüft Deno-Abhängigkeiten auf bekannte Schwachstellen.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "aiReview",
    label: "Codex",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "AI Code Review (ai-code-review.sh).",
    info: "Code-Review per Codex: Strenge Senior-Architekt-Checkliste (SOLID, Performance, Sicherheit, Robustheit, Wartbarkeit). Start 100 Punkte, Abzüge pro Verstoß. Ausgabe: score, deductions, verdict. PASS nur bei Score ≥ 95% und verdict ACCEPT. Review in .shimwrapper/reviews/.",
    settings: [
      { key: "enabled", label: "Aktiv", type: "boolean", default: true },
      { key: "timeoutSec", label: "Timeout (Sekunden)", type: "number", default: 180 },
      {
        key: "checkMode",
        label: "AI review scope",
        type: "select",
        default: "diff",
        options: [
          { value: "diff", label: "diff — only changes (staged/unstaged or pushed commits)" },
          { value: "full", label: "full — whole codebase (truncated to ~100KB)" },
        ],
      },
      { key: "diffLimitBytes", label: "Max. Diff-Größe (Bytes)", type: "number", default: 51200 },
      { key: "minRating", label: "Mindest-Rating für PASS", type: "number", default: 95 },
      { key: "reviewDir", label: "Ausgabeordner Reviews", type: "string", default: ".shimwrapper/reviews" },
    ],
  },
  {
    id: "explanationCheck",
    label: "Full Explanation",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Full Explanation Check (ai-explanation-check.sh).",
    info: "Prüft ausschließlich die Einhaltung des Standards „Mandatory Full Explanation Comments“: Docstrings pro Funktion, Inline-Kommentare für nicht-triviale Zeilen, keine reinen Snippets. Codex-basiert; PASS nur bei score ≥ 95% und verdict ACCEPT. Berichte in .shimwrapper/reviews/explanation-check-*.md.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "checkMockData",
    label: "Check Mock Data",
    tags: ["frontend"],
    role: "enforce",
    summary: "Stellt sicher, dass Mock-Daten konsistent und gültig sind.",
    info: "Führt check:mock-data aus – prüft Mock-Daten.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "updateReadme",
    label: "Update README",
    tags: ["frontend"],
    role: "enforce",
    summary: "Aktualisiert die README vor dem Push (z. B. Version aus package.json).",
    info: "Führt das Update-README-Skript aus. Hält die Doku im Projekt aktuell.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "sast",
    label: "SAST",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Statische Analyse: sucht im Code nach typischen Sicherheitslücken (geplant).",
    info: "Geplant / in Konfiguration vorhanden. Noch nicht im run-checks.sh Template umgesetzt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "architecture",
    label: "Architecture",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Prüft, ob die Projekt-Architektur Regeln einhält (geplant).",
    info: "Geplant / in Konfiguration vorhanden. Noch nicht im run-checks.sh Template umgesetzt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "complexity",
    label: "Complexity",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Warnt vor zu komplexem Code – z. B. zu tief verschachtelte Funktionen (geplant).",
    info: "Geplant / in Konfiguration vorhanden. Noch nicht im run-checks.sh Template umgesetzt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "mutation",
    label: "Mutation",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Testet, ob deine Tests wirklich etwas finden – durch kleine Code-Änderungen (geplant).",
    info: "Geplant / in Konfiguration vorhanden. Noch nicht im run-checks.sh Template umgesetzt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "e2e",
    label: "E2E",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "End-to-End-Tests: simuliert echte Nutzer und prüft die App von vorne bis hinten (geplant).",
    info: "Geplant / in Konfiguration vorhanden. Noch nicht im run-checks.sh Template umgesetzt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "healthPing",
    label: "Post-Deploy: Health Ping",
    tags: ["backend"],
    role: "hook",
    summary: "Nach dem Deploy wird geprüft, ob deine Supabase Functions erreichbar sind und antworten.",
    info: "Nach Supabase-Deploy werden Health-Endpoints der Edge Functions aufgerufen (ping-edge-health.sh). Nutzt Project Ref (SUPABASE_PROJECT_REF oder supabase/project-ref) und optional benutzerdefinierte Pfade.",
    settings: [
      { key: "defaultFunction", label: "Standard-Funktion", type: "string", default: "server" },
      { key: "healthFunctions", label: "Zusätzliche Funktionen (kommasepariert)", type: "string", default: "" },
      { key: "healthPaths", label: "Health-Pfade (kommasepariert, {fn})", type: "string", default: "" },
      { key: "projectRef", label: "Supabase Project Ref", type: "string", default: "" },
    ],
  },
  {
    id: "edgeLogs",
    label: "Post-Deploy: Edge Logs",
    tags: ["backend"],
    role: "hook",
    summary: "Lädt nach dem Deploy die neuesten Logs deiner Edge Functions – zum schnellen Prüfen, ob alles lief.",
    info: "Holt nach Deploy die letzten Logs der deployten Edge Function(s) (fetch-edge-logs.sh).",
    settings: [
      { key: "defaultFunction", label: "Standard-Funktion", type: "string", default: "server" },
      { key: "logFunctions", label: "Funktionen für Logs (kommasepariert)", type: "string", default: "" },
      { key: "logLimit", label: "Anzahl Log-Zeilen", type: "number", default: 30 },
    ],
  },
];

export function getCheckDef(id: CheckId): CheckDef | undefined {
  return CHECK_DEFINITIONS.find((c) => c.id === id);
}

export function getCheckRole(id: CheckId): CheckRole {
  return getCheckDef(id)?.role ?? "enforce";
}
