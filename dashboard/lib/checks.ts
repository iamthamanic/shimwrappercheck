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

/** Option „Review-Report anlegen“: Bei Aktivierung wird pro Lauf ein .md-Report unter reviewOutputPath geschrieben. */
export const REVIEW_MODE_SETTING: CheckSettingOption = {
  key: "reviewMode",
  label: "Review-Report",
  type: "boolean",
  default: false,
};

export const CHECK_DEFINITIONS: CheckDef[] = [
  {
    id: "lint",
    label: "ESLint",
    tags: ["frontend"],
    role: "enforce",
    summary: "Findet Regel- und Qualitätsverstöße im Code.",
    info: "Zweck: Verhindert typische Fehler und Stilbrüche, bevor sie in Produktion landen. Prüft: Projektdateien mit ESLint-Regeln. Bestanden, wenn: Der ESLint-Lauf endet ohne Fehler (Exit 0). Nicht bestanden, wenn: ESLint Fehler meldet (Exit != 0). Anpassen: ESLint-Config und Regeln im Projekt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "prettier",
    label: "Prettier",
    tags: ["frontend"],
    role: "enforce",
    summary: "Sichert ein einheitliches Code-Format.",
    info: "Zweck: Einheitliche Formatierung ohne Diskussionen. Prüft: Dateien mit Prettier im Check-Modus. Bestanden, wenn: Keine Abweichungen gefunden werden (Exit 0). Nicht bestanden, wenn: Formatabweichungen gefunden werden. Anpassen: Prettier-Config im Projekt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "typecheck",
    label: "TypeScript Check",
    tags: ["frontend"],
    role: "enforce",
    summary: "Findet TypeScript-Typfehler vor dem Lauf.",
    info: "Zweck: Verhindert Laufzeitfehler durch falsche Typen. Prüft: `tsc --noEmit`. Bestanden, wenn: Keine Typfehler (Exit 0). Nicht bestanden, wenn: Der Compiler Fehler meldet. Anpassen: `tsconfig.json` und TypeScript-Regeln.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "testRun",
    label: "Vitest",
    tags: ["frontend"],
    role: "enforce",
    summary: "Führt Build und Tests aus.",
    info: "Zweck: Sicherstellen, dass die App nach Änderungen weiterhin funktioniert. Prüft: `npm run build` und `npm run test:run`. Bestanden, wenn: Build und Tests erfolgreich (Exit 0). Nicht bestanden, wenn: Build oder ein Test fehlschlägt. Anpassen: Build- und Test-Skripte im Projekt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "projectRules",
    label: "Projektregeln",
    tags: ["frontend"],
    role: "enforce",
    summary: "Erzwingt projektspezifische Regeln (z. B. Struktur, Imports).",
    info: "Zweck: Sichert Teamregeln, die Lint nicht abdeckt. Prüft: `scripts/checks/project-rules.sh` (falls vorhanden). Bestanden, wenn: Script endet ohne Fehler (Exit 0). Nicht bestanden, wenn: Script Fehler meldet (Exit != 0). Anpassen: Regeln im Script. Hinweis: Fehlt das Script, wird der Check übersprungen.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "npmAudit",
    label: "npm audit",
    tags: ["frontend"],
    role: "enforce",
    summary: "Scannt npm-Abhängigkeiten auf bekannte Sicherheitslücken.",
    info: "Zweck: Stoppt Builds bei bekannten Schwachstellen. Prüft: `npm audit` mit einstellbarem Schweregrad. Bestanden, wenn: Keine Findings mit Schweregrad >= Stufe. Nicht bestanden, wenn: Mindestens ein Finding ab der Stufe. Anpassen: `auditLevel` oder `SHIM_AUDIT_LEVEL`.",
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
      REVIEW_MODE_SETTING,
    ],
  },
  {
    id: "viteBuild",
    label: "Vite",
    tags: ["frontend"],
    role: "enforce",
    summary: "Stellt sicher, dass das Frontend gebaut werden kann.",
    info: "Zweck: Verhindert Deploys mit Build-Fehlern. Prüft: `npm run build`. Bestanden, wenn: Build erfolgreich endet (Exit 0). Nicht bestanden, wenn: Build fehlschlägt. Anpassen: Build-Skript in `package.json`.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "snyk",
    label: "Snyk",
    tags: ["frontend"],
    role: "enforce",
    summary: "Optionaler Security-Scan mit Snyk.",
    info: "Zweck: Findet zusätzliche Schwachstellen in Dependencies. Prüft: `snyk test`, wenn Snyk installiert ist. Bestanden, wenn: Keine Findings oder Snyk nicht installiert (übersprungen). Nicht bestanden, wenn: Snyk Findings meldet. Anpassen: `.snyk` Policy, Projekt-Settings; Skip mit `SKIP_SNYK=1`.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "denoFmt",
    label: "Deno fmt",
    tags: ["backend"],
    role: "enforce",
    summary: "Prüft Formatierung der Supabase Edge Functions.",
    info: "Zweck: Einheitliches Format im Deno-Code. Prüft: `deno fmt --check supabase/functions`. Bestanden, wenn: Keine Abweichungen gefunden werden. Nicht bestanden, wenn: Abweichungen vorhanden sind. Hinweis: Wird übersprungen, wenn `supabase/functions` fehlt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "denoLint",
    label: "Deno lint",
    tags: ["backend"],
    role: "enforce",
    summary: "Lintet Deno-Code der Edge Functions.",
    info: "Zweck: Findet Fehler und schlechte Praxis im Deno-Code. Prüft: `deno lint supabase/functions`. Bestanden, wenn: Keine Meldungen. Nicht bestanden, wenn: Linter Meldungen ausgibt. Hinweis: Wird übersprungen, wenn `supabase/functions` fehlt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "denoAudit",
    label: "Deno audit",
    tags: ["backend"],
    role: "enforce",
    summary: "Sicherheitscheck für Deno-Abhängigkeiten.",
    info: "Zweck: Schützt vor bekannten Sicherheitslücken in Deno-Dependencies. Prüft: `deno audit` in `supabase/functions/server`. Bestanden, wenn: Keine Findings. Nicht bestanden, wenn: Findings gemeldet werden. Hinweis: Wird übersprungen, wenn `supabase/functions` fehlt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "aiReview",
    label: "AI Review",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "KI-Review mit fester Checkliste (SOLID, DRY, Security, Robustheit, Wartbarkeit).",
    info: "Zweck: Zweitmeinung zu Architektur, Sicherheit und Wartbarkeit. Prüft: Codex bewertet anhand fester Checkliste (SOLID, DRY, Performance, Sicherheit, Robustheit, Wartbarkeit); Snippets (geänderten Code), Full-Scan oder Mix-Loop; Score + Verdict. Bestanden, wenn: Verdict `ACCEPT` und Score >= Mindestwert (Standard 95). Nicht bestanden, wenn: `REJECT` oder Score darunter. Anpassen: `CHECK_MODE`, Mindestscore, Timeout. Hinweis: Reviews liegen in `.shimwrapper/reviews/`.",
    settings: [
      { key: "enabled", label: "Aktiv", type: "boolean", default: true },
      { key: "timeoutSec", label: "Timeout (Sekunden)", type: "number", default: 180 },
      {
        key: "checkMode",
        label: "AI review scope",
        type: "select",
        default: "mix",
        options: [
          { value: "mix", label: "mix — refactor loop: full scan, push uses snippet" },
          { value: "snippet", label: "snippet — only changed code (staged/unstaged or pushed commits)" },
          { value: "full", label: "full — whole codebase (chunked per directory)" },
        ],
      },
      { key: "diffLimitBytes", label: "Max. Diff-Größe (Bytes)", type: "number", default: 51200 },
      { key: "minRating", label: "Mindest-Rating für PASS", type: "number", default: 95 },
      { key: "reviewDir", label: "Ausgabeordner Reviews", type: "string", default: ".shimwrapper/reviews" },
      REVIEW_MODE_SETTING,
    ],
  },
  {
    id: "explanationCheck",
    label: "Full Explanation",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Erfordert erklärten Code (Docstrings + Kommentare).",
    info: "Zweck: Erhöht Verständlichkeit und Wartbarkeit. Prüft: Codex bewertet, ob Funktionen Docstrings und nicht-triviale Zeilen Kommentare haben. Bestanden, wenn: Verdict `ACCEPT` und Score >= 95. Nicht bestanden, wenn: `REJECT` oder Score darunter. Hinweis: Report in `.shimwrapper/reviews/explanation-check-*.md`.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "i18nCheck",
    label: "i18n / Übersetzungen",
    tags: ["frontend"],
    role: "enforce",
    summary: "Sichert, dass alle Übersetzungs-Keys existieren.",
    info: "Zweck: Verhindert fehlende Texte in der UI. Prüft: Code-Keys gegen alle `messages/*.json`. Bestanden, wenn: Jeder verwendete Key in jeder Locale vorhanden ist. Nicht bestanden, wenn: Mindestens ein Key fehlt. Anpassen: `--fix` fügt Platzhalter ein. Hinweis: Wird übersprungen, wenn `scripts/i18n-check.js` fehlt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "checkMockData",
    label: "Check Mock Data",
    tags: ["frontend"],
    role: "enforce",
    summary: "Validiert projektinterne Mock- und Testdaten.",
    info: "Zweck: Verhindert fehlerhafte Tests durch ungültige Mock-Daten. Prüft: `npm run check:mock-data`. Bestanden, wenn: Script endet ohne Fehler (Exit 0). Nicht bestanden, wenn: Script fehlschlägt oder fehlt. Anpassen: Script im `package.json`.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "updateReadme",
    label: "Update README",
    tags: ["frontend"],
    role: "enforce",
    summary: "Aktualisiert README-Teile per Script.",
    info: "Zweck: Hält z. B. Versionsangaben konsistent. Prüft: `scripts/update-readme.js` (oder shimwrappercheck-Script). Bestanden, wenn: Script erfolgreich läuft. Nicht bestanden, wenn: Script fehlschlägt. Hinweis: Fehlt ein Script, wird der Check übersprungen.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "sast",
    label: "Semgrep",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "SAST-Scan mit Semgrep.",
    info: "Zweck: Findet Sicherheitsmuster im Code. Prüft: `semgrep scan --config auto` mit `--error`. Bestanden, wenn: Keine Findings. Nicht bestanden, wenn: Findings gemeldet werden. Hinweis: Wird übersprungen, wenn Semgrep nicht installiert ist.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "gitleaks",
    label: "Gitleaks",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Findet Secrets im Repository.",
    info: "Zweck: Verhindert, dass API-Keys oder Passwörter im Code landen. Prüft: `gitleaks detect` gegen den Arbeitsbaum (ohne Git-History). Bestanden, wenn: Keine Treffer. Nicht bestanden, wenn: Treffer gefunden werden. Anpassen: `.gitleaks.toml`. Hinweis: Wird übersprungen, wenn Gitleaks nicht installiert ist.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "licenseChecker",
    label: "license-checker",
    tags: ["frontend"],
    role: "enforce",
    summary: "Erstellt eine Lizenzübersicht der npm-Abhängigkeiten.",
    info: "Zweck: Macht sichtbar, welche Lizenzen eure Dependencies haben. Prüft: `npx license-checker --summary` (liest `.licensecheckerrc`). Bestanden, wenn: Der Befehl läuft erfolgreich und (falls konfiguriert) keine verbotenen Lizenzen gemeldet werden. Nicht bestanden, wenn: Der Befehl fehlschlägt oder verbotene Lizenzen gemeldet werden. Anpassen: `.licensecheckerrc` oder CLI-Optionen. Hinweis: Der Standard-Runner wertet den Exit-Code nicht strikt aus.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "architecture",
    label: "dependency-cruiser",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Prüft Architekturregeln und verbotene Abhängigkeiten.",
    info: "Zweck: Erzwingt Modulgrenzen und verhindert Zyklen. Prüft: dependency-cruiser gegen `.dependency-cruiser.json`. Bestanden, wenn: Keine Regelverstöße. Nicht bestanden, wenn: Zyklen oder verbotene Abhängigkeiten gefunden werden. Anpassen: Regeln in `.dependency-cruiser.json`. Hinweis: Wird übersprungen, wenn die Config fehlt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "complexity",
    label: "Complexity",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Begrenzt die Komplexität einzelner Funktionen.",
    info: "Zweck: Hält Funktionen klein und verständlich. Prüft: ESLint mit `eslint-plugin-complexity` und Config. Bestanden, wenn: Keine Funktion über dem Schwellwert. Nicht bestanden, wenn: Schwellwert überschritten. Anpassen: `eslint.complexity.json`. Hinweis: Wird übersprungen, wenn keine Config gefunden wird.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "mutation",
    label: "Stryker",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Misst Testqualität mit Mutationstests.",
    info: "Zweck: Prüft, ob Tests echte Fehler erkennen. Prüft: `npx stryker run` mit `stryker.config.json`. Bestanden, wenn: Mutations-Score über dem Schwellwert (Config). Nicht bestanden, wenn: Score darunter oder der Lauf fehlschlägt. Hinweis: Wird übersprungen, wenn `stryker.config.json` fehlt.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }, REVIEW_MODE_SETTING],
  },
  {
    id: "e2e",
    label: "E2E",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Option für End-to-End-Tests (muss im Projekt eingerichtet sein).",
    info: "Zweck: Testet komplette Nutzerflüsse. Prüft: Nur als Einstellung; der Standard-Runner führt E2E nicht aus. Bestanden/Nicht bestanden: Hängt von eurem E2E-Skript ab. Anpassen: E2E-Kommando im eigenen `run-checks.sh` ergänzen.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "healthPing",
    label: "Post-Deploy: Health Ping",
    tags: ["backend"],
    role: "hook",
    summary: "Nach dem Deploy: ruft Health-Endpoints auf.",
    info: "Zweck: Prüft, ob Functions nach dem Deploy wirklich antworten. Prüft: Konfigurierte Health-URLs der Edge Functions. Bestanden, wenn: Alle Antworten ok sind (z. B. HTTP 200). Nicht bestanden, wenn: Timeouts oder Fehlercodes auftreten. Anpassen: Project Ref, Funktionsnamen und Pfade.",
    settings: [
      { key: "defaultFunction", label: "Standard-Funktion", type: "string", default: "server" },
      { key: "healthFunctions", label: "Zusätzliche Funktionen (kommasepariert)", type: "string", default: "" },
      { key: "healthPaths", label: "Health-Pfade (kommasepariert, {fn})", type: "string", default: "" },
      { key: "projectRef", label: "Supabase Project Ref", type: "string", default: "" },
      REVIEW_MODE_SETTING,
    ],
  },
  {
    id: "edgeLogs",
    label: "Post-Deploy: Edge Logs",
    tags: ["backend"],
    role: "hook",
    summary: "Nach dem Deploy: zeigt die neuesten Edge-Logs.",
    info: "Zweck: Schnelle Sichtprüfung nach dem Deploy. Prüft: Ruft die neuesten Logzeilen der Functions ab. Bestanden/Nicht bestanden: Kein hartes Urteil; Logs dienen der manuellen Bewertung. Anpassen: Funktionsnamen und Log-Limit.",
    settings: [
      { key: "defaultFunction", label: "Standard-Funktion", type: "string", default: "server" },
      { key: "logFunctions", label: "Funktionen für Logs (kommasepariert)", type: "string", default: "" },
      { key: "logLimit", label: "Anzahl Log-Zeilen", type: "number", default: 30 },
      REVIEW_MODE_SETTING,
    ],
  },
];

/**
 * Empfohlene Laufreihenfolge der Checks (wie in run-checks.sh ohne SHIM_CHECK_ORDER).
 * Nur enforce-Checks; Hooks (healthPing, edgeLogs) sind nicht enthalten.
 */
export const IDEAL_CHECK_ORDER: CheckId[] = [
  "updateReadme",
  "prettier",
  "lint",
  "typecheck",
  "projectRules",
  "i18nCheck",
  "checkMockData",
  "viteBuild",
  "testRun",
  "npmAudit",
  "snyk",
  "denoFmt",
  "denoLint",
  "denoAudit",
  "aiReview",
  "explanationCheck",
  "sast",
  "gitleaks",
  "licenseChecker",
  "architecture",
  "complexity",
  "mutation",
  "e2e",
];

export function getCheckDef(id: CheckId): CheckDef | undefined {
  return CHECK_DEFINITIONS.find((c) => c.id === id);
}

export function getCheckRole(id: CheckId): CheckRole {
  return getCheckDef(id)?.role ?? "enforce";
}
