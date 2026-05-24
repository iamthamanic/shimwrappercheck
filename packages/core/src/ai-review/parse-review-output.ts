import type { ParsedReview, ReviewDeduction } from "./types.js";

/** Redact long token-like strings before persisting review text. */
export function redactReviewText(text: string): string {
  if (!text) return text;
  return text.replace(/[A-Za-z0-9+/=]{48,}/g, "***REDACTED***");
}

/**
 * Extract and parse the first JSON object from Codex assistant text.
 * Mirrors scripts/ai-code-review.sh node -e JSON extraction.
 */
export function parseReviewJsonFromText(text: string): ParsedReview | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    const raw = JSON.parse(match[0]) as {
      score?: unknown;
      verdict?: unknown;
      deductions?: unknown;
    };
    const score = normalizeScore(raw.score);
    const verdict = normalizeVerdict(raw.verdict);
    const deductions = normalizeDeductions(raw.deductions);
    return { score, verdict, deductions };
  } catch {
    return null;
  }
}

/** Whether score and verdict meet the configured minimum. */
export function passesReview(parsed: ParsedReview, minRating: number): boolean {
  return parsed.verdict === "ACCEPT" && parsed.score >= minRating;
}

function normalizeScore(value: unknown): number {
  const n =
    typeof value === "number"
      ? value
      : Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.trunc(n)));
}

function normalizeVerdict(value: unknown): "ACCEPT" | "REJECT" {
  const upper = String(value ?? "REJECT").toUpperCase();
  return upper === "ACCEPT" ? "ACCEPT" : "REJECT";
}

function normalizeDeductions(value: unknown): ReviewDeduction[] {
  if (!Array.isArray(value)) return [];
  const out: ReviewDeduction[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    out.push({
      point: String(row.point ?? "Finding"),
      minus: Number.parseInt(String(row.minus ?? "0"), 10) || 0,
      reason: String(row.reason ?? ""),
    });
  }
  return out;
}
