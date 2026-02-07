/**
 * Check definitions: id, label, info text, and optional settings schema for each shim check.
 * Location: /lib/checks.ts
 */

import type { CheckToggles } from "./presets";

/** Canonical label for the Check Library (rechte Spalte: alle integrierten Checks). Frontend und Backend nutzen diesen Namen. */
export const CHECK_LIBRARY_LABEL = "Check Library";

export type CheckId = keyof CheckToggles | "healthPing" | "edgeLogs";;

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
  info: string;
  settings: CheckSettingOption[];
  /** Jedes Tool hat ein oder mehrere Tags; bei beidem: ["frontend", "backend"] */
  tags: CheckTag[];
  /** enforce = vor Befehl (run-checks.sh), hook = nach Deploy (z. B. Health-Ping, Edge Logs). */
  role: CheckRole;
}

export const CHECK_DEFINITIONS: CheckDef[] = [
  { id: "lint", label: "Lint", tags: ["frontend"], role: "enforce", info: "Führt npm run lint aus (z. B. ESLint).", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "checkMockData", label: "Check Mock Data", tags: ["frontend"], role: "enforce", info: "Führt check:mock-data aus – prüft Mock-Daten.", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "testRun", label: "Test Run", tags: ["frontend"], role: "enforce", info: "Führt test:run aus (Unit-/Integrationstests).", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "npmAudit", label: "npm Audit", tags: ["frontend"], role: "enforce", info: "Führt npm audit aus (Security-Check für Dependencies). Stufe konfigurierbar.", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, { key: "auditLevel", label: "Audit-Stufe", type: "select", default: "high", options: [{ value: "critical", label: "critical" }, { value: "high", label: "high" }, { value: "moderate", label: "moderate" }, { value: "low", label: "low" }] }] },
  { id: "snyk", label: "Snyk", tags: ["frontend"], role: "enforce", info: "Snyk Dependency-Scan (falls installiert).", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "denoFmt", label: "Deno fmt", tags: ["backend"], role: "enforce", info: "Deno Format-Check für supabase/functions (deno fmt --check).", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "denoLint", label: "Deno lint", tags: ["backend"], role: "enforce", info: "Deno Linter für supabase/functions (deno lint).", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "denoAudit", label: "Deno audit", tags: ["backend"], role: "enforce", info: "Deno Security-Audit für supabase/functions (deno audit).", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "aiReview", label: "AI Review (Codex)", tags: ["frontend", "backend"], role: "enforce", info: "Code-Review per Codex: Git-Diff (staged/unstaged oder Push-Range), strukturierte Bewertung (Rating, Warnings, Errors, Verdict). PASS nur bei Rating ≥ 95 und ohne Warnings/Errors. Review wird in .shimwrapper/reviews/ gespeichert.", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, { key: "timeoutSec", label: "Timeout (Sekunden)", type: "number", default: 180 }, { key: "diffLimitBytes", label: "Max. Diff-Größe (Bytes)", type: "number", default: 51200 }, { key: "minRating", label: "Mindest-Rating für PASS", type: "number", default: 95 }, { key: "reviewDir", label: "Ausgabeordner Reviews", type: "string", default: ".shimwrapper/reviews" }] },
  { id: "sast", label: "SAST", tags: ["frontend", "backend"], role: "enforce", info: "Geplant / in Konfiguration vorhanden. Noch nicht im run-checks.sh Template umgesetzt.", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "architecture", label: "Architecture", tags: ["frontend", "backend"], role: "enforce", info: "Geplant / in Konfiguration vorhanden. Noch nicht im run-checks.sh Template umgesetzt.", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "complexity", label: "Complexity", tags: ["frontend", "backend"], role: "enforce", info: "Geplant / in Konfiguration vorhanden. Noch nicht im run-checks.sh Template umgesetzt.", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "mutation", label: "Mutation", tags: ["frontend", "backend"], role: "enforce", info: "Geplant / in Konfiguration vorhanden. Noch nicht im run-checks.sh Template umgesetzt.", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "e2e", label: "E2E", tags: ["frontend", "backend"], role: "enforce", info: "Geplant / in Konfiguration vorhanden. Noch nicht im run-checks.sh Template umgesetzt.", settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }] },
  { id: "healthPing", label: "Post-Deploy: Health Ping", tags: ["backend"], role: "hook", info: "Nach Supabase-Deploy werden Health-Endpoints der Edge Functions aufgerufen (ping-edge-health.sh). Nutzt Project Ref (SUPABASE_PROJECT_REF oder supabase/project-ref) und optional benutzerdefinierte Pfade.", settings: [{ key: "defaultFunction", label: "Standard-Funktion", type: "string", default: "server" }, { key: "healthFunctions", label: "Zusätzliche Funktionen (kommasepariert)", type: "string", default: "" }, { key: "healthPaths", label: "Health-Pfade (kommasepariert, {fn})", type: "string", default: "" }, { key: "projectRef", label: "Supabase Project Ref", type: "string", default: "" }] },
  { id: "edgeLogs", label: "Post-Deploy: Edge Logs", tags: ["backend"], role: "hook", info: "Holt nach Deploy die letzten Logs der deployten Edge Function(s) (fetch-edge-logs.sh).", settings: [{ key: "defaultFunction", label: "Standard-Funktion", type: "string", default: "server" }, { key: "logFunctions", label: "Funktionen für Logs (kommasepariert)", type: "string", default: "" }, { key: "logLimit", label: "Anzahl Log-Zeilen", type: "number", default: 30 }] },
];

export function getCheckDef(id: CheckId): CheckDef | undefined {
  return CHECK_DEFINITIONS.find((c) => c.id === id);
}

export function getCheckRole(id: CheckId): CheckRole {
  return getCheckDef(id)?.role ?? "enforce";
}
