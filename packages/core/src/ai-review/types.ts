/** Single checklist deduction from AI review JSON. */
export type ReviewDeduction = {
  point: string;
  minus: number;
  reason: string;
};

/** Parsed AI review payload (score / verdict / deductions). */
export type ParsedReview = {
  score: number;
  verdict: "ACCEPT" | "REJECT";
  deductions: ReviewDeduction[];
};

/** Result of building a git diff for review. */
export type DiffBuildResult = {
  content: string;
  source: string;
  empty: boolean;
  error?: string;
};

/** Codex CLI run outcome. */
export type CodexRunResult = {
  exitCode: number;
  timedOut: boolean;
  resultText: string;
  inputTokens?: number;
  outputTokens?: number;
  stderr: string;
};
