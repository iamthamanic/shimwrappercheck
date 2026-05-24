import type { ParsedReview } from "./types.js";
/** Redact long token-like strings before persisting review text. */
export declare function redactReviewText(text: string): string;
/**
 * Extract and parse the first JSON object from Codex assistant text.
 * Mirrors scripts/ai-code-review.sh node -e JSON extraction.
 */
export declare function parseReviewJsonFromText(text: string): ParsedReview | null;
/** Whether score and verdict meet the configured minimum. */
export declare function passesReview(parsed: ParsedReview, minRating: number): boolean;
//# sourceMappingURL=parse-review-output.d.ts.map