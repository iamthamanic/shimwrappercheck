import type { RunAllChecksResult } from "../checks/types.js";
import type { ShimConfig } from "../config/schema.js";
export type McpRunChecksOptions = {
    projectRoot: string;
    packageRoot: string;
    env?: NodeJS.ProcessEnv;
    checkMode?: string;
    frontend?: boolean;
    backend?: boolean;
    noAiReview?: boolean;
    noExplanationCheck?: boolean;
    noI18nCheck?: boolean;
    noSast?: boolean;
    noGitleaks?: boolean;
    noRuff?: boolean;
    noShellcheck?: boolean;
    refactor?: boolean;
    until95?: boolean;
    timeoutSec?: number;
    /** Optional config override (tests). */
    config?: ShimConfig;
};
export type McpRunChecksResponse = {
    engine: "core";
    exitCode: number;
    stdout: string;
    stderr: string;
    passed: boolean;
    failedIds: string[];
    infraErrorIds: string[];
    warningIds: string[];
    summary: RunAllChecksResult["summary"];
    results: RunAllChecksResult["results"];
    iterations: number;
};
/**
 * MCP `run_checks` core path — structured results without shelling to run-checks.sh.
 */
export declare function runChecksFromMcpOptions(opts: McpRunChecksOptions): Promise<McpRunChecksResponse>;
//# sourceMappingURL=mcp-run-checks.d.ts.map