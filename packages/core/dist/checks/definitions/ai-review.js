import { skip } from "./helpers.js";
import { runAiReview } from "../../ai-review/run-ai-review.js";
/**
 * AI code review via @shimwrappercheck/core (commit/snippet + Codex) with bash fallback
 * (SHIM_AI_REVIEW_ENGINE=legacy or full-mode chunking). API/custom still use legacy JS scripts.
 */
export const aiReviewCheck = {
    id: "aiReview",
    label: "AI Review",
    category: "ai",
    envKey: "SHIM_RUN_AI_REVIEW",
    defaultEnabled: true,
    requiredTools: [],
    async run(ctx) {
        if (ctx.flags.noAiReview) {
            return skip("aiReview", "AI review disabled via --no-ai-review");
        }
        return runAiReview(ctx);
    },
};
//# sourceMappingURL=ai-review.js.map