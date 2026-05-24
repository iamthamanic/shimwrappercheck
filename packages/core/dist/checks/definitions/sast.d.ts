import type { CheckDefinition } from "../types.js";
/** Resolve Semgrep baseline commit (merge-base with origin/main, else HEAD~1). */
export declare function resolveSemgrepBaselineCommit(
  projectRoot: string,
  packageRoot: string,
  env: NodeJS.ProcessEnv,
): Promise<string | undefined>;
export declare const sastCheck: CheckDefinition;
//# sourceMappingURL=sast.d.ts.map
