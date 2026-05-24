import type { CheckContext } from "../checks/types.js";
import { resolveAiProvider, type AiProvider } from "../checks/definitions/ai-script-runner.js";
export type AiReviewEngine = "core" | "legacy";
/** SHIM_AI_REVIEW_ENGINE=legacy forces bash; otherwise prefer TypeScript core. */
export declare function resolveAiReviewEngine(env?: NodeJS.ProcessEnv): AiReviewEngine;
export { resolveAiProvider, type AiProvider };
/** Locate codex CLI on PATH (not blocked under node_modules shims). */
export declare function resolveCodexBinary(env?: NodeJS.ProcessEnv): {
    path: string;
} | null;
/** Whether core TypeScript review can run for this context. */
export declare function canRunCoreAiReview(ctx: CheckContext): boolean;
//# sourceMappingURL=provider-resolver.d.ts.map