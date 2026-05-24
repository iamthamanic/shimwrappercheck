import type { RunAllChecksResult } from "../checks/types.js";
import type { RunAllChecksOptions } from "../checks/run-check.js";
import { runAllChecks } from "../checks/run-check.js";
import { runRefactorOrchestration } from "./orchestration.js";

export type RunUntil95Options = RunAllChecksOptions & {
  /** When true, re-run checks until pass or max iterations (SHIM_UNTIL95_MAX_ITERATIONS). */
  until95?: boolean;
};

/** Read max loop iterations from env (default 10 for --until-95). */
export function resolveUntil95MaxIterations(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw =
    env.SHIM_UNTIL95_MAX_ITERATIONS ?? env.SHIM_REFACTOR_MAX_ITERATIONS ?? "10";
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/**
 * Run checks with optional --until-95 loop.
 * Each iteration runs all checks; stops when ok or max iterations reached.
 * Refactor orchestration runs after the final iteration when refactor/until95 is active.
 */
export async function runChecksWithRefactorLoop(
  options: RunUntil95Options,
): Promise<RunAllChecksResult & { iterations: number }> {
  const env = options.env ?? process.env;
  const maxIterations = options.until95
    ? resolveUntil95MaxIterations(env)
    : options.flags.refactor
      ? 1
      : 1;

  let lastResult: RunAllChecksResult = {
    ok: false,
    exitCode: 1,
    results: [],
    failedIds: [],
    infraErrorIds: [],
    warningIds: [],
    summary: {
      passed: 0,
      failed: 0,
      skipped: 0,
      warning: 0,
      infra_error: 0,
      total: 0,
    },
  };
  let iterationsUsed = 0;

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    iterationsUsed = iteration;
    if (maxIterations > 1) {
      console.log(`\n▶ Until-95 iteration ${iteration}/${maxIterations}…`);
    }

    lastResult = await runAllChecks(options);
    if (lastResult.ok) break;

    if (iteration < maxIterations) {
      console.log(
        `Checks failed (iteration ${iteration}); retrying until all pass or max iterations…`,
      );
    }
  }

  const refactorRequested = options.flags.refactor || Boolean(options.until95);
  if (refactorRequested) {
    await runRefactorOrchestration({
      projectRoot: options.projectRoot,
      packageRoot: options.packageRoot,
      env,
      refactorRequested: true,
    });
  }

  return { ...lastResult, iterations: iterationsUsed };
}
