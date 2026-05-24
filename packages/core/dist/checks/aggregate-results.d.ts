import type { CheckResult, CheckRunSummary, CheckStatus, RunAllChecksResult } from "./types.js";
/** Build status histogram from check results. */
export declare function summarizeCheckResults(results: CheckResult[]): CheckRunSummary;
/** Derive failed/infra/warning id lists and overall pass/fail from structured results. */
export declare function aggregateCheckResults(results: CheckResult[]): {
    failedIds: string[];
    infraErrorIds: string[];
    warningIds: string[];
    summary: CheckRunSummary;
    ok: boolean;
    exitCode: number;
};
/** Merge aggregate fields into RunAllChecksResult shape. */
export declare function toRunAllChecksResult(results: CheckResult[]): RunAllChecksResult;
/** Human-readable infra error block for stderr. */
export declare function formatInfraErrors(results: CheckResult[], infraErrorIds: string[]): string;
/** Type guard for known statuses when parsing external payloads. */
export declare function isCheckStatus(value: string): value is CheckStatus;
//# sourceMappingURL=aggregate-results.d.ts.map