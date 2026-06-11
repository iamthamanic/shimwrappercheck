import type { ShimConfig } from "../config/schema.js";
/**
 * Outcome of a single check run.
 * - `infra_error`: missing tool, timeout, or network/TLS failure — never treated as pass.
 *   Use `config.strictNetworkChecks` (SHIM_STRICT_NETWORK_CHECKS=1) to fail hard on network issues
 *   instead of `warning` for npm audit / Semgrep-style checks.
 */
export type CheckStatus = "passed" | "failed" | "skipped" | "warning" | "infra_error";
/** Structured result returned by every check definition. */
export type CheckResult = {
    id: string;
    status: CheckStatus;
    blocking: boolean;
    message: string;
    details?: Record<string, unknown>;
};
/** Runtime context passed into check `run` handlers. */
export type CheckContext = {
    projectRoot: string;
    packageRoot: string;
    config: ShimConfig;
    env: NodeJS.ProcessEnv;
    flags: RunChecksFlags;
};
/** CLI flags mirrored from legacy run-checks.sh / MCP run_checks. */
export type RunChecksFlags = {
    frontend: boolean;
    backend: boolean;
    noAiReview: boolean;
    noExplanationCheck: boolean;
    noI18nCheck: boolean;
    noSast: boolean;
    noGitleaks: boolean;
    noFallow: boolean;
    noRuff: boolean;
    noShellcheck: boolean;
    refactor: boolean;
    until95: boolean;
};
/** Catalog entry + executable runner. */
export type CheckDefinition = {
    id: string;
    label: string;
    category: "frontend" | "backend" | "security" | "ai" | "other";
    envKey: string;
    defaultEnabled: boolean;
    requiredTools: string[];
    run: (ctx: CheckContext) => Promise<CheckResult>;
};
/** Per-status counts for a full check run. */
export type CheckRunSummary = {
    passed: number;
    failed: number;
    skipped: number;
    warning: number;
    infra_error: number;
    total: number;
};
/** Aggregated run output for CLI/MCP consumers. */
export type RunAllChecksResult = {
    ok: boolean;
    exitCode: number;
    results: CheckResult[];
    failedIds: string[];
    /** Checks that failed due to missing tools, timeouts, or network/TLS — never treated as pass. */
    infraErrorIds: string[];
    /** Non-blocking warnings (e.g. optional tool issues when not strict). */
    warningIds: string[];
    summary: CheckRunSummary;
};
//# sourceMappingURL=types.d.ts.map