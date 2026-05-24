import type { RunAllChecksResult } from "../checks/types.js";
import type { RunAllChecksOptions } from "../checks/run-check.js";
export type RunUntil95Options = RunAllChecksOptions & {
  /** When true, re-run checks until pass or max iterations (SHIM_UNTIL95_MAX_ITERATIONS). */
  until95?: boolean;
};
/** Read max loop iterations from env (default 10 for --until-95). */
export declare function resolveUntil95MaxIterations(
  env?: NodeJS.ProcessEnv,
): number;
/**
 * Run checks with optional --until-95 loop.
 * Each iteration runs all checks; stops when ok or max iterations reached.
 * Refactor orchestration runs after the final iteration when refactor/until95 is active.
 */
export declare function runChecksWithRefactorLoop(
  options: RunUntil95Options,
): Promise<
  RunAllChecksResult & {
    iterations: number;
  }
>;
//# sourceMappingURL=until-95-loop.d.ts.map
