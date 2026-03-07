/**
 * Kanonischer Check-Katalog für CLI-Tools (configure, install-check-deps).
 * Zweck: Eine gemeinsame Quelle für Check-IDs, Labels, Env-Keys, Default-Aktivierung, NPM-Deps und System-Hinweise.
 * Problem: Ohne dieses Modul müssten configure.js und install-check-deps.js eigene Listen pflegen und wären inkonsistent.
 * Eingabe: keine. Ausgabe: CHECK_CATALOG, DEFAULT_CHECK_ORDER, CHECK_NPM_DEPENDENCIES, CHECK_SYSTEM_HINTS.
 */
const CHECK_CATALOG = [
  // Liste aller vom Shim unterstützten Checks; ohne fehlt configure/install-deps die Definition von IDs und Env-Keys.
  {
    id: "updateReadme", // Eindeutige Check-ID für Skripte und Env; ohne können run-checks und Config den Check nicht ansprechen.
    label: "Update README", // Anzeigename in Config/UI; ohne bleibt der Check für Nutzer unkenntlich.
    envKey: "SHIM_RUN_UPDATE_README", // Env-Variable zum Aktivieren/Überspringen; ohne kann der Check nicht per Umgebung gesteuert werden.
    defaultEnabled: 1, // Standardmäßig an; ohne wäre das Default-Verhalten undefiniert.
  },
  {
    id: "prettier",
    label: "Prettier",
    envKey: "SHIM_RUN_PRETTIER",
    defaultEnabled: 1,
  },
  {
    id: "lint", // ESLint-Check; ohne fehlt der Lint-Eintrag im Katalog.
    label: "ESLint",
    envKey: "SHIM_RUN_LINT",
    defaultEnabled: 1,
  },
  {
    id: "typecheck",
    label: "TypeScript Check",
    envKey: "SHIM_RUN_TYPECHECK",
    defaultEnabled: 1,
  },
  {
    id: "projectRules",
    label: "Projektregeln",
    envKey: "SHIM_RUN_PROJECT_RULES",
    defaultEnabled: 1,
  },
  {
    id: "i18nCheck",
    label: "i18n Check",
    envKey: "SHIM_RUN_I18N_CHECK",
    defaultEnabled: 1,
  },
  {
    id: "checkMockData",
    label: "Check Mock Data",
    envKey: "SHIM_RUN_CHECK_MOCK_DATA",
    defaultEnabled: 1,
  },
  {
    id: "viteBuild",
    label: "Vite Build",
    envKey: "SHIM_RUN_VITE_BUILD",
    defaultEnabled: 1,
  },
  {
    id: "testRun",
    label: "Vitest/Test Run",
    envKey: "SHIM_RUN_TEST_RUN",
    defaultEnabled: 1,
  },
  {
    id: "npmAudit",
    label: "npm audit",
    envKey: "SHIM_RUN_NPM_AUDIT",
    defaultEnabled: 1,
  },
  {
    id: "snyk",
    label: "Snyk",
    envKey: "SHIM_RUN_SNYK",
    defaultEnabled: 1,
  },
  {
    id: "denoFmt",
    label: "Deno fmt",
    envKey: "SHIM_RUN_DENO_FMT",
    defaultEnabled: 1,
  },
  {
    id: "denoLint",
    label: "Deno lint",
    envKey: "SHIM_RUN_DENO_LINT",
    defaultEnabled: 1,
  },
  {
    id: "denoAudit",
    label: "Deno audit",
    envKey: "SHIM_RUN_DENO_AUDIT",
    defaultEnabled: 1,
  },
  {
    id: "aiReview",
    label: "AI Review",
    envKey: "SHIM_RUN_AI_REVIEW",
    defaultEnabled: 1,
  },
  {
    id: "explanationCheck",
    label: "Full Explanation",
    envKey: "SHIM_RUN_EXPLANATION_CHECK",
    defaultEnabled: 1,
  },
  {
    id: "sast",
    label: "Semgrep",
    envKey: "SHIM_RUN_SAST",
    defaultEnabled: 0, // Optional; ohne wäre SAST standardmäßig an und könnte Laufzeiten erhöhen.
  },
  {
    id: "gitleaks",
    label: "Gitleaks",
    envKey: "SHIM_RUN_GITLEAKS",
    defaultEnabled: 0,
  },
  {
    id: "licenseChecker",
    label: "License Checker",
    envKey: "SHIM_RUN_LICENSE_CHECKER",
    defaultEnabled: 0,
  },
  {
    id: "architecture",
    label: "dependency-cruiser",
    envKey: "SHIM_RUN_ARCHITECTURE",
    defaultEnabled: 0,
  },
  {
    id: "complexity",
    label: "Complexity",
    envKey: "SHIM_RUN_COMPLEXITY",
    defaultEnabled: 0,
  },
  {
    id: "mutation",
    label: "Stryker Mutation",
    envKey: "SHIM_RUN_MUTATION",
    defaultEnabled: 0,
  },
  {
    id: "e2e",
    label: "E2E",
    envKey: "SHIM_RUN_E2E",
    defaultEnabled: 0,
  },
  {
    id: "ruff",
    label: "Ruff",
    envKey: "SHIM_RUN_RUFF",
    defaultEnabled: 0,
  },
  {
    id: "shellcheck",
    label: "Shellcheck",
    envKey: "SHIM_RUN_SHELLCHECK",
    defaultEnabled: 0,
  },
];

// Reihenfolge, in der Checks in run-checks und Config erscheinen; ohne wäre die Abfolge undefiniert und zwischen Tools inkonsistent.
const DEFAULT_CHECK_ORDER = [
  "updateReadme", // README-Sync zuerst; ohne könnte die Reihenfolge mit Dokumentations-Checks kollidieren.
  "prettier",
  "lint",
  "typecheck",
  "projectRules",
  "ruff", // Vor i18n/Check-Mock, damit Formatierung früh greift; ohne weicht die Reihenfolge von der erwarteten Pipeline ab.
  "shellcheck",
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
  "e2e", // E2E typisch am Ende; ohne könnten schnelle Checks nach langen E2E-Läufen erscheinen.
];

// Pro Check-ID die NPM-Pakete, die install-check-deps anbietet; ohne wüsste der Installer nicht, welche deps zu welchem Check gehören.
const CHECK_NPM_DEPENDENCIES = {
  prettier: ["prettier"], // Prettier-Check braucht das prettier-Paket; ohne fehlt dem Installer der Eintrag.
  lint: ["eslint"],
  typecheck: ["typescript"],
  viteBuild: ["vite"],
  testRun: ["vite", "vitest"], // Vitest baut oft auf Vite; ohne könnten Test-Installationen unvollständig sein.
  snyk: ["snyk"],
  licenseChecker: ["license-checker"],
  architecture: ["dependency-cruiser"],
  complexity: ["eslint", "eslint-plugin-complexity"], // Complexity braucht ESLint plus Plugin; ohne fehlt eine Abhängigkeit.
  mutation: ["@stryker-mutator/core"],
  e2e: ["@playwright/test"],
  sast: ["semgrep"],
};

// Pro Check-ID Hinweistext, wenn das Tool systemseitig installiert werden muss (nicht NPM); ohne zeigt der Installer keine Anleitung.
const CHECK_SYSTEM_HINTS = {
  denoFmt: "Deno CLI installieren (z. B. `brew install deno`).", // Nutzerhinweis für Deno-Checks; ohne weiß der Nutzer nicht, wie er Deno nachrüstet.
  denoLint: "Deno CLI installieren (z. B. `brew install deno`).",
  denoAudit: "Deno CLI installieren (z. B. `brew install deno`).",
  gitleaks: "Gitleaks installieren (z. B. `brew install gitleaks`).",
  ruff: "Ruff installieren (z. B. `brew install ruff`).",
  shellcheck: "Shellcheck installieren (z. B. `brew install shellcheck`).",
  aiReview:
    "Codex CLI login (`codex login`) oder API-Keys für AI Review konfigurieren.", // AI Review braucht externen Zugang; ohne fehlt die Konfigurationsanleitung.
};

module.exports = {
  CHECK_CATALOG, // Katalog für configure und install-deps bereitstellen; ohne können die Consumer den Katalog nicht importieren.
  DEFAULT_CHECK_ORDER, // Reihenfolge exportieren; ohne würden Aufrufer eigene Reihenfolge definieren und abweichen.
  CHECK_NPM_DEPENDENCIES, // Dep-Mapping exportieren; ohne kann install-check-deps keine Paketliste anbieten.
  CHECK_SYSTEM_HINTS, // System-Hinweise exportieren; ohne fehlen Nutzerhinweise für nicht-NPM-Tools.
};
