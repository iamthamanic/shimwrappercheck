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
    summary: "Prüft den Code auf Stilfehler und typische Fehlerquellen.",
    info: "Kontext: Ungenutzte Variablen oder Verstöße gegen Projektregeln führen zu Fehlern. Lösung: ESLint wird ausgeführt. Bestanden: Exit-Code 0. Nicht bestanden: Fehler oder Warnungen.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "prettier",
    label: "Prettier",
    tags: ["frontend"],
    role: "enforce",
    summary: "Stellt einheitliche Code-Formatierung sicher.",
    info: "Kontext: Uneinheitliche Formatierung lenkt ab. Lösung: Prettier im Prüfmodus. Bestanden: Alle Dateien formatkonform. Nicht bestanden: Mindestens eine Datei weicht ab.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "typecheck",
    label: "TypeScript Check",
    tags: ["frontend"],
    role: "enforce",
    summary: "Prüft, ob die TypeScript-Typen zusammenpassen.",
    info: "Kontext: TypeScript findet viele Fehler vor dem Lauf. Lösung: tsc --noEmit. Bestanden: Keine Typfehler. Nicht bestanden: Compiler meldet Fehler.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "testRun",
    label: "Vitest",
    tags: ["frontend"],
    role: "enforce",
    summary: "Führt automatische Tests aus; nur bei Erfolg geht es weiter.",
    info: "Kontext: Ohne Tests können Änderungen unbemerkt etwas kaputt machen. Lösung: Test-Suite wird ausgeführt. Bestanden: Alle grün. Nicht bestanden: Mindestens ein Test schlägt fehl.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "projectRules",
    label: "Projektregeln",
    tags: ["frontend"],
    role: "enforce",
    summary: "Prüft projektspezifische Regeln (Struktur, Namenskonventionen, Imports).",
    info: "Kontext: Projektregeln halten die Codebase ordentlich. Lösung: scripts/checks/project-rules.sh. Bestanden: Exit 0. Nicht bestanden: Verstöße. Skript muss im Projekt existieren.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "npmAudit",
    label: "npm audit",
    tags: ["frontend"],
    role: "enforce",
    summary: "Sucht in npm-Abhängigkeiten nach bekannten Sicherheitslücken.",
    info: "Kontext: Bibliotheken können Sicherheitslücken haben. Lösung: npm audit. Stufe legt Schwellwert fest. Bestanden: Keine Lücken auf/über der Stufe. Nicht bestanden: Mindestens eine Lücke.",
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
    summary: "Prüft, ob das Frontend fehlerfrei gebaut werden kann.",
    info: "Kontext: Schlägt der Build fehl, schlägt auch das Deployment fehl. Lösung: Build wird ausgeführt. Bestanden: Build endet ohne Fehler. Nicht bestanden: Build bricht ab.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "snyk",
    label: "Snyk",
    tags: ["frontend"],
    role: "enforce",
    summary: "Zusätzliche Prüfung auf Sicherheitslücken (wenn Snyk installiert ist).",
    info: "Kontext: Snyk kann weitere Schwachstellen kennen. Lösung: Snyk wird ausgeführt, falls installiert. Bestanden: Keine Meldungen oder Snyk nicht installiert (übersprungen). Ohne Installation läuft der Check nicht.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "denoFmt",
    label: "Deno fmt",
    tags: ["backend"],
    role: "enforce",
    summary: "Prüft Formatierung des Backend-/Edge-Codes (Deno).",
    info: "Kontext: Einheitliche Formatierung in supabase/functions. Lösung: deno fmt --check. Bestanden: Code formatkonform. Nicht bestanden: Dateien weichen ab.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "denoLint",
    label: "Deno lint",
    tags: ["backend"],
    role: "enforce",
    summary: "Prüft Deno-Code auf Fehler und schlechte Praxis.",
    info: "Kontext: Lint findet Fehler vor dem Deploy. Lösung: deno lint für supabase/functions. Bestanden: Keine Meldungen. Nicht bestanden: Linter meldet Verstöße.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "denoAudit",
    label: "Deno audit",
    tags: ["backend"],
    role: "enforce",
    summary: "Sucht in Deno-Abhängigkeiten nach bekannten Sicherheitslücken.",
    info: "Kontext: Deno-Dependencies können Schwachstellen haben. Lösung: deno audit. Bestanden: Keine Meldungen. Nicht bestanden: Lücken gemeldet.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "aiReview",
    label: "AI Review",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Lässt eine KI (Codex) den Code anhand einer Checkliste prüfen.",
    info: "Kontext: Code kann Schwächen in Architektur/Sicherheit haben; die KI gibt eine zweite Meinung. Lösung: Code wird an Codex geschickt, Bewertung und Urteil (ACCEPT/REJECT). Bestanden: ACCEPT und Score ≥ eingestellt (Standard 95). Nicht bestanden: REJECT oder Score darunter. Codex-CLI nötig. Berichte in .shimwrapper/reviews/.",
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
    summary: "Prüft, ob jeder Code-Abschnitt erklärt ist (Docstrings und Kommentare).",
    info: "Kontext: Unerklärter Code ist schwer wartbar; das Projekt verlangt Begründungen. Lösung: Codex prüft auf Docstrings und sinnvolle Kommentare. Bestanden: Score ≥ 95 und ACCEPT. Nicht bestanden: darunter oder REJECT. Berichte in .shimwrapper/reviews/explanation-check-*.md.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "i18nCheck",
    label: "i18n / Übersetzungen",
    tags: ["frontend"],
    role: "enforce",
    summary: "Prüft, ob alle im Code verwendeten Texte in allen Sprachdateien vorhanden sind.",
    info: "Kontext: Fehlende Einträge zeigen Nutzern Schlüssel oder falsche Texte. Lösung: Abgleich Code mit messages/*.json. Bestanden: Jeder verwendete Schlüssel in jeder Locale. Nicht bestanden: Mindestens ein Schlüssel fehlt. Optional: --fix ergänzt Platzhalter.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "checkMockData",
    label: "Check Mock Data",
    tags: ["frontend"],
    role: "enforce",
    summary: "Prüft, ob Mock-/Testdaten gültig und konsistent sind.",
    info: "Kontext: Ungültige Mock-Daten können Tests verfälschen. Lösung: check:mock-data des Projekts (falls definiert). Bestanden: Exit 0. Nicht bestanden: Fehlercode. Ohne Skript: übersprungen.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "updateReadme",
    label: "Update README",
    tags: ["frontend"],
    role: "enforce",
    summary: "Führt ein Skript aus, das z. B. die Version in der README aktualisiert.",
    info: "Kontext: README veraltet; ein Skript kann Teile (z. B. Version) anpassen. Lösung: Update-README-Skript wird ausgeführt. Bestanden: Skript läuft. Nicht bestanden: Skript schlägt fehl. Inhalt weiterhin manuell.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "sast",
    label: "Semgrep",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Statische Analyse mit Semgrep: sucht nach Sicherheitsmustern und Regelverstößen im Code.",
    info: "Kontext: Semgrep ist ein Tool für statische Code-Analyse (SAST) mit regelbasierten Checks. Lösung: semgrep scan wird ausgeführt (z. B. mit --config auto). Bestanden: Keine Findings. Nicht bestanden: Semgrep meldet Treffer. Tool muss installiert sein (pip install semgrep oder npx semgrep).",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "gitleaks",
    label: "Gitleaks",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Scannt das Repo auf versehentlich committete Secrets (API-Keys, Passwörter).",
    info: "Kontext: Gitleaks erkennt bekannte Secret-Muster in der Codebasis und im Git-Verlauf. Lösung: gitleaks detect wird ausgeführt. Bestanden: Keine Treffer. Nicht bestanden: Mindestens ein Secret gefunden. Tool muss installiert sein (z. B. Homebrew oder gitleaks.io).",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "licenseChecker",
    label: "license-checker",
    tags: ["frontend"],
    role: "enforce",
    summary: "Prüft Lizenzen der npm-Abhängigkeiten; schlägt bei nicht erlaubten Lizenzen fehl.",
    info: "Kontext: Das Tool license-checker listet Lizenzen aller Dependencies. Lösung: npx license-checker wird mit konfigurierbaren erlaubten/verbotenen Lizenzen ausgeführt. Bestanden: Keine verbotenen Lizenzen. Nicht bestanden: Mindestens eine verbotene Lizenz. Über .licensecheckerrc oder CLI-Optionen konfigurierbar.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "architecture",
    label: "Architecture",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Prüft Einhaltung von Architekturregeln (derzeit nur Option).",
    info: "Kontext: Architekturregeln halten die Codebase strukturiert. Lösung: In Konfiguration, im Standard-run-checks.sh nicht ausgeführt. Aktivieren speichert nur die Einstellung; Prüfung muss im Projekt umgesetzt werden.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "complexity",
    label: "Complexity",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Warnt vor zu komplexem Code (derzeit nur Option).",
    info: "Kontext: Sehr verschachtelter Code ist fehleranfällig. Lösung: In Konfiguration, im Standard-run-checks.sh nicht ausgeführt. Aktivieren speichert nur die Einstellung; Prüfung muss im Projekt umgesetzt werden.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "mutation",
    label: "Mutation",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "Prüft, ob Tests echte Fehler finden (derzeit nur Option).",
    info: "Kontext: Mutationstests prüfen Test-Abdeckung. Lösung: In Konfiguration, im Standard-run-checks.sh nicht ausgeführt. Aktivieren speichert nur die Einstellung; Prüfung muss im Projekt umgesetzt werden.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "e2e",
    label: "E2E",
    tags: ["frontend", "backend"],
    role: "enforce",
    summary: "End-to-End-Tests über die ganze App (derzeit nur Option).",
    info: "Kontext: E2E-Tests simulieren echte Nutzer. Lösung: In Konfiguration, im Standard-run-checks.sh nicht ausgeführt. Aktivieren speichert nur die Einstellung; Tests müssen im Projekt eingerichtet sein.",
    settings: [{ key: "enabled", label: "Aktiv", type: "boolean", default: true }],
  },
  {
    id: "healthPing",
    label: "Post-Deploy: Health Ping",
    tags: ["backend"],
    role: "hook",
    summary: "Nach dem Deploy: Prüft, ob die Supabase Functions erreichbar sind und antworten.",
    info: "Kontext: Nach Deploy kann die App trotzdem nicht erreichbar sein; ein Aufruf bestätigt die Antwort. Lösung: Health-URLs der Edge Functions werden aufgerufen. Bestanden: Endpoints antworten (z. B. HTTP 200). Nicht bestanden: Keine Antwort oder Fehler. Project Ref und ggf. Health-Pfade nötig.",
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
    summary: "Lädt nach dem Deploy die neuesten Logs der Edge Functions zur Kontrolle.",
    info: "Kontext: Logs zeigen, ob Funktionen fehlerfrei gestartet sind. Lösung: Neueste Log-Zeilen werden abgerufen. Kein klares Bestanden/Nicht bestanden – Logs werden nur bereitgestellt; Bewertung liegt bei Ihnen.",
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
