import type { CheckDefinition } from "./types.js";
import { prettierCheck } from "./definitions/prettier.js";
import { lintCheck } from "./definitions/lint.js";
import { typecheckCheck } from "./definitions/typecheck.js";
import { npmAuditCheck } from "./definitions/npm-audit.js";
import { gitleaksCheck } from "./definitions/gitleaks.js";
import { aiReviewCheck } from "./definitions/ai-review.js";
import { updateReadmeCheck } from "./definitions/update-readme.js";
import { projectRulesCheck } from "./definitions/project-rules.js";
import { i18nCheck } from "./definitions/i18n-check.js";
import { checkMockDataCheck } from "./definitions/check-mock-data.js";
import { viteBuildCheck } from "./definitions/vite-build.js";
import { testRunCheck } from "./definitions/test-run.js";
import { snykCheck } from "./definitions/snyk.js";
import {
  denoFmtCheck,
  denoLintCheck,
  denoAuditCheck,
} from "./definitions/deno-checks.js";
import { explanationCheck } from "./definitions/explanation-check.js";
import { sastCheck } from "./definitions/sast.js";
import { ruffCheck } from "./definitions/ruff.js";
import { shellcheckCheck } from "./definitions/shellcheck.js";
import {
  licenseCheckerCheck,
  architectureCheck,
  complexityCheck,
  mutationCheck,
  e2eCheck,
} from "./definitions/optional-checks.js";
import { DEFAULT_CHECK_ORDER } from "../config/schema.js";
import { CHECK_CATALOG_METADATA } from "./catalog-metadata.js";

/** Canonical check registry (Phase 2 — parity with scripts/lib/check-catalog.js). */
export const CHECK_REGISTRY: CheckDefinition[] = [
  updateReadmeCheck,
  prettierCheck,
  lintCheck,
  typecheckCheck,
  projectRulesCheck,
  ruffCheck,
  shellcheckCheck,
  i18nCheck,
  checkMockDataCheck,
  viteBuildCheck,
  testRunCheck,
  npmAuditCheck,
  snykCheck,
  denoFmtCheck,
  denoLintCheck,
  denoAuditCheck,
  aiReviewCheck,
  explanationCheck,
  sastCheck,
  gitleaksCheck,
  licenseCheckerCheck,
  architectureCheck,
  complexityCheck,
  mutationCheck,
  e2eCheck,
];

const byId = new Map(CHECK_REGISTRY.map((c) => [c.id, c]));

/** Lookup a check definition by id. */
export function getCheckDefinition(id: string): CheckDefinition | undefined {
  return byId.get(id);
}

/** Ordered list of registered check ids (defaults + registry intersection). */
export function getDefaultRunOrder(): string[] {
  const registered = new Set(CHECK_REGISTRY.map((c) => c.id));
  return DEFAULT_CHECK_ORDER.filter((id) => registered.has(id));
}

/** Catalog metadata for CLI/dashboard/MCP parity. */
export function listCheckCatalog(): Array<{
  id: string;
  label: string;
  envKey: string;
  defaultEnabled: boolean;
  category: string;
}> {
  const metaById = new Map(CHECK_CATALOG_METADATA.map((m) => [m.id, m]));
  return CHECK_REGISTRY.map((c) => {
    const meta = metaById.get(c.id);
    return {
      id: c.id,
      label: meta?.label ?? c.label,
      envKey: meta?.envKey ?? c.envKey,
      defaultEnabled: meta?.defaultEnabled ?? c.defaultEnabled,
      category: meta?.category ?? c.category,
    };
  });
}
