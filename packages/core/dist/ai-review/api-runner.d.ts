import type { CheckContext } from "../checks/types.js";
import { runAiReviewScript } from "../checks/definitions/ai-script-runner.js";
/**
 * API/custom providers still use legacy JS scripts (ai-deductive-review.js / ai-code-review.js).
 * Core TypeScript path is codex-only for now.
 */
export declare function runApiOrCustomReview(ctx: CheckContext): Promise<Awaited<ReturnType<typeof runAiReviewScript>>>;
//# sourceMappingURL=api-runner.d.ts.map