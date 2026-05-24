import { z } from "zod";

/** v1 canonical config shape (internal); legacy RC maps to/from this. */
export const ShimConfigSchema = z.object({
  version: z.literal(1).default(1),
  checkMode: z.enum(["snippet", "commit", "full"]).default("full"),
  checkOrder: z.array(z.string()).optional(),
  checks: z.record(z.string(), z.boolean()).default({}),
  enforceCommands: z.string().optional(),
  hookCommands: z.string().optional(),
  autoPush: z.boolean().default(false),
  gitEnforceCommands: z.string().optional(),
  gitCheckModeOnPush: z.enum(["snippet", "commit", "full"]).optional(),
  auditLevel: z
    .enum(["low", "moderate", "high", "critical"])
    .default("moderate"),
  continueOnError: z.boolean().default(false),
  strictNetworkChecks: z.boolean().default(false),
  i18nRequireMessagesDir: z.boolean().default(true),
  aiReview: z
    .object({
      provider: z.enum(["auto", "codex", "api", "custom"]).default("auto"),
      /** When false, AI review failures are warnings (non-blocking). Set SHIM_AI_REVIEW_BLOCKING=1 to block. */
      blocking: z.boolean().default(false),
      minRating: z.number().min(0).max(100).default(95),
      timeoutSec: z.number().int().positive().optional(),
    })
    .default({}),
  explanationCheck: z
    .object({
      enabled: z.boolean().default(true),
      minRating: z.number().min(0).max(100).default(95),
    })
    .default({}),
  backendPathPatterns: z
    .string()
    .default("supabase/functions,src/supabase/functions"),
  projectRoot: z.string().optional(),
});

export type ShimConfig = z.infer<typeof ShimConfigSchema>;

/** Default catalog check IDs and their default enabled state. */
export const DEFAULT_CHECK_CATALOG: Array<{
  id: string;
  envKey: string;
  defaultEnabled: boolean;
}> = [
  {
    id: "updateReadme",
    envKey: "SHIM_RUN_UPDATE_README",
    defaultEnabled: true,
  },
  { id: "prettier", envKey: "SHIM_RUN_PRETTIER", defaultEnabled: true },
  { id: "lint", envKey: "SHIM_RUN_LINT", defaultEnabled: true },
  { id: "typecheck", envKey: "SHIM_RUN_TYPECHECK", defaultEnabled: true },
  {
    id: "projectRules",
    envKey: "SHIM_RUN_PROJECT_RULES",
    defaultEnabled: true,
  },
  { id: "i18nCheck", envKey: "SHIM_RUN_I18N_CHECK", defaultEnabled: true },
  {
    id: "checkMockData",
    envKey: "SHIM_RUN_CHECK_MOCK_DATA",
    defaultEnabled: true,
  },
  { id: "viteBuild", envKey: "SHIM_RUN_VITE_BUILD", defaultEnabled: true },
  { id: "testRun", envKey: "SHIM_RUN_TEST_RUN", defaultEnabled: true },
  { id: "npmAudit", envKey: "SHIM_RUN_NPM_AUDIT", defaultEnabled: true },
  { id: "snyk", envKey: "SHIM_RUN_SNYK", defaultEnabled: true },
  { id: "denoFmt", envKey: "SHIM_RUN_DENO_FMT", defaultEnabled: true },
  { id: "denoLint", envKey: "SHIM_RUN_DENO_LINT", defaultEnabled: true },
  { id: "denoAudit", envKey: "SHIM_RUN_DENO_AUDIT", defaultEnabled: true },
  { id: "aiReview", envKey: "SHIM_RUN_AI_REVIEW", defaultEnabled: true },
  {
    id: "explanationCheck",
    envKey: "SHIM_RUN_EXPLANATION_CHECK",
    defaultEnabled: true,
  },
  { id: "sast", envKey: "SHIM_RUN_SAST", defaultEnabled: false },
  { id: "gitleaks", envKey: "SHIM_RUN_GITLEAKS", defaultEnabled: false },
  {
    id: "licenseChecker",
    envKey: "SHIM_RUN_LICENSE_CHECKER",
    defaultEnabled: false,
  },
  {
    id: "architecture",
    envKey: "SHIM_RUN_ARCHITECTURE",
    defaultEnabled: false,
  },
  { id: "complexity", envKey: "SHIM_RUN_COMPLEXITY", defaultEnabled: false },
  { id: "mutation", envKey: "SHIM_RUN_MUTATION", defaultEnabled: false },
  { id: "e2e", envKey: "SHIM_RUN_E2E", defaultEnabled: false },
  { id: "ruff", envKey: "SHIM_RUN_RUFF", defaultEnabled: false },
  { id: "shellcheck", envKey: "SHIM_RUN_SHELLCHECK", defaultEnabled: false },
];

export const DEFAULT_CHECK_ORDER = [
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

/** Preferred key order when writing .shimwrappercheckrc (matches scripts/lib/project-config-api.js). */
export const CONFIG_KEY_ORDER = [
  "SHIM_ENFORCE_COMMANDS",
  "SHIM_HOOK_COMMANDS",
  "SHIM_AUTO_PUSH",
  "SHIM_GIT_ENFORCE_COMMANDS",
  "SHIM_GIT_CHECK_MODE_ON_PUSH",
  "SHIM_AI_REVIEW_PROVIDER",
  "CHECK_MODE",
  "SHIM_AUDIT_LEVEL",
  "SHIM_CONTINUE_ON_ERROR",
  "SHIM_STRICT_NETWORK_CHECKS",
  "SHIM_I18N_REQUIRE_MESSAGES_DIR",
  "SHIM_CHECK_ORDER",
  "SHIM_AI_REVIEW_BLOCKING",
  ...DEFAULT_CHECK_CATALOG.map((c) => c.envKey),
];
