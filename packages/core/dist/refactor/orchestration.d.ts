export type RefactorMode = "off" | "interactive" | "agent";
export type RefactorTodoItem = {
  id: string;
  status: string;
  chunk?: string;
  point?: string;
  minus?: number;
  reason?: string;
  title?: string;
};
export type RefactorPaths = {
  refactorDir: string;
  todoFile: string;
  stateFile: string;
  currentItemFile: string;
  reviewsDir: string;
};
export type RefactorState = {
  mode: RefactorMode;
  phase: "scan" | "item" | "verify";
  workflowPhases: string[];
  sourceReview: string;
  currentIndex: number;
  totalItems: number;
  updatedAt: string;
};
export type RefactorOrchestrationResult = {
  skipped: boolean;
  reason?: string;
  message?: string;
  paths?: RefactorPaths;
  openItems?: number;
};
/** Normalize SHIM_REFACTOR_MODE env value. */
export declare function normalizeRefactorMode(
  raw: string | undefined,
): RefactorMode;
/** Resolve refactor artifact paths (mirrors scripts/run-checks.sh). */
export declare function resolveRefactorPaths(
  projectRoot: string,
  env?: NodeJS.ProcessEnv,
): RefactorPaths;
/** Locate extract-refactor-todo.sh in project or package root. */
export declare function resolveExtractRefactorScript(
  projectRoot: string,
  packageRoot: string,
): string | null;
/** Find newest review-full-*.md, then any review-*.md. */
export declare function findLatestReviewFile(reviewsDir: string): string | null;
/** Update state/current-item JSON from TODO list (port of embedded node in bash). */
export declare function buildRefactorHandoff(
  todoPath: string,
  statePath: string,
  currentItemPath: string,
  sourceReviewPath: string,
  mode: RefactorMode,
  options?: {
    overrideIndex?: string;
    advance?: boolean;
  },
): {
  message: string;
  openItems: RefactorTodoItem[];
  state: RefactorState;
};
export type RunRefactorOrchestrationOptions = {
  projectRoot: string;
  packageRoot: string;
  env?: NodeJS.ProcessEnv;
  refactorRequested: boolean;
};
/**
 * Post-check refactor orchestration (extract TODO + handoff artifacts).
 * Mirrors run_refactor_orchestration in scripts/run-checks.sh.
 */
export declare function runRefactorOrchestration(
  options: RunRefactorOrchestrationOptions,
): Promise<RefactorOrchestrationResult>;
//# sourceMappingURL=orchestration.d.ts.map
