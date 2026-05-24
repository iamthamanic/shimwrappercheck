import type { CheckContext, CheckResult } from "../checks/types.js";
/**
 * TypeScript AI review (commit/snippet + codex). Falls back to bash when
 * SHIM_AI_REVIEW_ENGINE=legacy, full mode, or codex unavailable.
 */
export declare function runAiReview(ctx: CheckContext): Promise<CheckResult>;
//# sourceMappingURL=run-ai-review.d.ts.map