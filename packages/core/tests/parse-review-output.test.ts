import { describe, expect, it } from "vitest";
import {
  parseReviewJsonFromText,
  passesReview,
  redactReviewText,
} from "../src/ai-review/parse-review-output.js";

describe("parse-review-output", () => {
  it("parses JSON embedded in assistant text", () => {
    const text = `Here is the review:
{"score": 96, "verdict": "ACCEPT", "deductions": [{"point": "DRY", "minus": 4, "reason": "dup"}]}
Thanks.`;
    const parsed = parseReviewJsonFromText(text);
    expect(parsed).not.toBeNull();
    expect(parsed?.score).toBe(96);
    expect(parsed?.verdict).toBe("ACCEPT");
    expect(parsed?.deductions).toHaveLength(1);
  });

  it("passesReview requires ACCEPT and min score", () => {
    const parsed = parseReviewJsonFromText(
      '{"score": 94, "verdict": "ACCEPT", "deductions": []}',
    );
    expect(parsed).not.toBeNull();
    expect(passesReview(parsed!, 95)).toBe(false);
    expect(passesReview(parsed!, 94)).toBe(true);
  });

  it("redactReviewText masks long token-like strings", () => {
    const token = "a".repeat(50);
    expect(redactReviewText(`secret ${token} end`)).toContain("***REDACTED***");
  });
});
