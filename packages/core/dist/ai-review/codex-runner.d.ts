import type { CodexRunResult } from "./types.js";
export type RunCodexReviewOptions = {
    codexPath: string;
    prompt: string;
    cwd: string;
    timeoutMs: number;
    env?: NodeJS.ProcessEnv;
};
/**
 * Parse Codex JSONL stream for assistant message and token usage.
 * Mirrors jq loop in scripts/ai-code-review.sh.
 */
export declare function parseCodexJsonl(jsonl: string): {
    resultText: string;
    inputTokens?: number;
    outputTokens?: number;
};
/** Run `codex exec --json` with optional timeout wrapper (same as bash). */
export declare function runCodexReview(options: RunCodexReviewOptions): Promise<CodexRunResult>;
//# sourceMappingURL=codex-runner.d.ts.map