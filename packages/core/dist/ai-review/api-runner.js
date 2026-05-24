import { runAiReviewScript } from "../checks/definitions/ai-script-runner.js";
/**
 * API/custom providers still use legacy JS scripts (ai-deductive-review.js / ai-code-review.js).
 * Core TypeScript path is codex-only for now.
 */
export async function runApiOrCustomReview(ctx) {
    return runAiReviewScript(ctx);
}
//# sourceMappingURL=api-runner.js.map