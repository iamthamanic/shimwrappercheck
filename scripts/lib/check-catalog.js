/**
 * Canonical check catalog for CLI tools.
 * Shared by terminal config and dependency installer.
 */
const CHECK_CATALOG = [
  { id: "updateReadme", label: "Update README", envKey: "SHIM_RUN_UPDATE_README", defaultEnabled: 1 },
  { id: "prettier", label: "Prettier", envKey: "SHIM_RUN_PRETTIER", defaultEnabled: 1 },
  { id: "lint", label: "ESLint", envKey: "SHIM_RUN_LINT", defaultEnabled: 1 },
  { id: "typecheck", label: "TypeScript Check", envKey: "SHIM_RUN_TYPECHECK", defaultEnabled: 1 },
  { id: "projectRules", label: "Projektregeln", envKey: "SHIM_RUN_PROJECT_RULES", defaultEnabled: 1 },
  { id: "i18nCheck", label: "i18n Check", envKey: "SHIM_RUN_I18N_CHECK", defaultEnabled: 1 },
  { id: "checkMockData", label: "Check Mock Data", envKey: "SHIM_RUN_CHECK_MOCK_DATA", defaultEnabled: 1 },
  { id: "viteBuild", label: "Vite Build", envKey: "SHIM_RUN_VITE_BUILD", defaultEnabled: 1 },
  { id: "testRun", label: "Vitest/Test Run", envKey: "SHIM_RUN_TEST_RUN", defaultEnabled: 1 },
  { id: "npmAudit", label: "npm audit", envKey: "SHIM_RUN_NPM_AUDIT", defaultEnabled: 1 },
  { id: "snyk", label: "Snyk", envKey: "SHIM_RUN_SNYK", defaultEnabled: 1 },
  { id: "denoFmt", label: "Deno fmt", envKey: "SHIM_RUN_DENO_FMT", defaultEnabled: 1 },
  { id: "denoLint", label: "Deno lint", envKey: "SHIM_RUN_DENO_LINT", defaultEnabled: 1 },
  { id: "denoAudit", label: "Deno audit", envKey: "SHIM_RUN_DENO_AUDIT", defaultEnabled: 1 },
  { id: "aiReview", label: "AI Review", envKey: "SHIM_RUN_AI_REVIEW", defaultEnabled: 1 },
  { id: "explanationCheck", label: "Full Explanation", envKey: "SHIM_RUN_EXPLANATION_CHECK", defaultEnabled: 1 },
  { id: "sast", label: "Semgrep", envKey: "SHIM_RUN_SAST", defaultEnabled: 0 },
  { id: "gitleaks", label: "Gitleaks", envKey: "SHIM_RUN_GITLEAKS", defaultEnabled: 0 },
  { id: "licenseChecker", label: "License Checker", envKey: "SHIM_RUN_LICENSE_CHECKER", defaultEnabled: 0 },
  { id: "architecture", label: "dependency-cruiser", envKey: "SHIM_RUN_ARCHITECTURE", defaultEnabled: 0 },
  { id: "complexity", label: "Complexity", envKey: "SHIM_RUN_COMPLEXITY", defaultEnabled: 0 },
  { id: "mutation", label: "Stryker Mutation", envKey: "SHIM_RUN_MUTATION", defaultEnabled: 0 },
  { id: "e2e", label: "E2E", envKey: "SHIM_RUN_E2E", defaultEnabled: 0 },
  { id: "ruff", label: "Ruff", envKey: "SHIM_RUN_RUFF", defaultEnabled: 0 },
  { id: "shellcheck", label: "Shellcheck", envKey: "SHIM_RUN_SHELLCHECK", defaultEnabled: 0 },
];

const DEFAULT_CHECK_ORDER = [
  "updateReadme",
  "prettier",
  "lint",
  "typecheck",
  "projectRules",
  "ruff",
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
  "e2e",
];

const CHECK_NPM_DEPENDENCIES = {
  prettier: ["prettier"],
  lint: ["eslint"],
  typecheck: ["typescript"],
  viteBuild: ["vite"],
  testRun: ["vite", "vitest"],
  snyk: ["snyk"],
  licenseChecker: ["license-checker"],
  architecture: ["dependency-cruiser"],
  complexity: ["eslint", "eslint-plugin-complexity"],
  mutation: ["@stryker-mutator/core"],
  e2e: ["@playwright/test"],
  sast: ["semgrep"],
};

const CHECK_SYSTEM_HINTS = {
  denoFmt: "Deno CLI installieren (z. B. `brew install deno`).",
  denoLint: "Deno CLI installieren (z. B. `brew install deno`).",
  denoAudit: "Deno CLI installieren (z. B. `brew install deno`).",
  gitleaks: "Gitleaks installieren (z. B. `brew install gitleaks`).",
  ruff: "Ruff installieren (z. B. `brew install ruff`).",
  shellcheck: "Shellcheck installieren (z. B. `brew install shellcheck`).",
  aiReview: "Codex CLI login (`codex login`) oder API-Keys für AI Review konfigurieren.",
};

module.exports = {
  CHECK_CATALOG,
  DEFAULT_CHECK_ORDER,
  CHECK_NPM_DEPENDENCIES,
  CHECK_SYSTEM_HINTS,
};
