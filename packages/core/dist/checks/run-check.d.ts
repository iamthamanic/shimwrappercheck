import type { ShimConfig } from "../config/schema.js";
import type { RunAllChecksResult, RunChecksFlags } from "./types.js";
export type RunAllChecksOptions = {
    projectRoot: string;
    packageRoot: string;
    config: ShimConfig;
    flags: RunChecksFlags;
    env?: NodeJS.ProcessEnv;
    writeReport?: boolean;
    /** Wall-clock cap for the entire run (e.g. MCP run_checks timeoutSec). */
    timeoutSec?: number;
};
/** Parse argv flags from run-checks.sh / CLI / MCP. */
export declare function parseRunChecksFlags(argv: string[]): RunChecksFlags;
/** Build argv for core engine from MCP/structured options. */
export declare function buildRunChecksArgv(opts: {
    frontend?: boolean;
    backend?: boolean;
    noAiReview?: boolean;
    noExplanationCheck?: boolean;
    noI18nCheck?: boolean;
    noSast?: boolean;
    noGitleaks?: boolean;
    noFallow?: boolean;
    noRuff?: boolean;
    noShellcheck?: boolean;
    refactor?: boolean;
    until95?: boolean;
}): string[];
/** Resolve which checks to run based on config and flags. */
export declare function resolveCheckOrder(config: ShimConfig, flags: RunChecksFlags): string[];
/** Build process env with CHECK_MODE (refactor → full). */
export declare function buildRunChecksEnv(base: NodeJS.ProcessEnv, config: ShimConfig, flags: RunChecksFlags): NodeJS.ProcessEnv;
/** Run all enabled checks sequentially. */
export declare function runAllChecks(options: RunAllChecksOptions): Promise<RunAllChecksResult>;
//# sourceMappingURL=run-check.d.ts.map