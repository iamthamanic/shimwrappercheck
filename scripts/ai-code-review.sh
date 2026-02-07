#!/usr/bin/env bash
# AI code review: Codex only (Cursor disabled). Called from run-checks.sh.
# Prompt: senior-dev, decades-of-expertise, best-code bar.
# Codex: codex in PATH; use session after codex login (ChatGPT account, no API key in terminal).
# Diff: staged + unstaged; if clean (e.g. pre-push), uses diff of commits being pushed (@{u}...HEAD or HEAD~1...HEAD).
# Runs codex exec --json to get token usage from turn.completed; prints Token usage for agent to report.
# Diff limited to ~50KB head + tail. Timeout 180s when timeout(1) available.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

DIFF_FILE=""
cleanup() {
  [[ -n "$DIFF_FILE" ]] && [[ -f "$DIFF_FILE" ]] && rm -f "$DIFF_FILE"
}
trap cleanup EXIT

DIFF_FILE="$(mktemp)"
git diff --no-color >> "$DIFF_FILE" 2>/dev/null || true
git diff --cached --no-color >> "$DIFF_FILE" 2>/dev/null || true

# If working tree is clean (e.g. pre-push after commit), use diff of commits being pushed.
if [[ ! -s "$DIFF_FILE" ]] && command -v git >/dev/null 2>&1; then
  RANGE=""
  if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
    RANGE="@{u}...HEAD"
  elif git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    RANGE="HEAD~1...HEAD"
  fi
  if [[ -n "$RANGE" ]]; then
    git diff --no-color "$RANGE" >> "$DIFF_FILE" 2>/dev/null || true
  fi
fi

if [[ ! -s "$DIFF_FILE" ]]; then
  echo "Skipping AI review: no staged, unstaged, or pushed changes." >&2
  exit 0
fi

# Limit diff to first and last ~50KB to avoid token limits and timeouts
LIMIT_BYTES=51200
DIFF_LIMITED=""
if [[ $(wc -c < "$DIFF_FILE") -le $((LIMIT_BYTES * 2)) ]]; then
  DIFF_LIMITED="$(cat "$DIFF_FILE")"
else
  DIFF_LIMITED="$(head -c $LIMIT_BYTES "$DIFF_FILE")
...[truncated]...
$(tail -c $LIMIT_BYTES "$DIFF_FILE")"
fi

# Senior-dev review prompt: structured output with rating (1-100), positive, warnings, errors, recommendations.
# PASS only if rating >= 95 and no warnings and no errors.
PROMPT="You are a senior software engineer with decades of code review experience. Your goal is to ensure the highest possible code quality: production-ready, secure, maintainable, and aligned with project standards.

Review the following code diff with the rigor of a principal engineer. Evaluate:

1. Correctness and bugs: logic errors, edge cases, race conditions, off-by-one, null/undefined handling.
2. Security: injection, XSS, sensitive data exposure, auth/authz, input validation, dependency risks.
3. Performance: unnecessary work, N+1, memory leaks, blocking calls, inefficient algorithms or data structures.
4. Maintainability: clarity, naming, single responsibility, DRY, testability, documentation where needed.
5. Project compliance: AGENTS.md rules, existing patterns, lint/type discipline, error handling and logging.
6. Robustness: error paths, timeouts, retries, backward compatibility, defensive checks.

Reply with exactly the following structure (one label per line, use None when there are no warnings or errors). Do not modify any files or suggest edits in the response.

RATING: <1-100> (integer)
POSITIVE: <short points on what is good>
WARNINGS: <points or None>
ERRORS: <points or None>
RECOMMENDATIONS: <short recommendations>
VERDICT: PASS or VERDICT: FAIL

Rule: VERDICT must be PASS only if rating >= 95 and there are no warnings and no errors; otherwise VERDICT must be FAIL.

--- DIFF ---
$DIFF_LIMITED"

CODEX_JSON_FILE="$(mktemp)"
CODEX_LAST_MSG_FILE="$(mktemp)"
cleanup() {
  [[ -n "$DIFF_FILE" ]] && [[ -f "$DIFF_FILE" ]] && rm -f "$DIFF_FILE"
  [[ -n "$CODEX_JSON_FILE" ]] && [[ -f "$CODEX_JSON_FILE" ]] && rm -f "$CODEX_JSON_FILE"
  [[ -n "$CODEX_LAST_MSG_FILE" ]] && [[ -f "$CODEX_LAST_MSG_FILE" ]] && rm -f "$CODEX_LAST_MSG_FILE"
}
trap cleanup EXIT

if ! command -v codex >/dev/null 2>&1; then
  echo "Skipping AI review: Codex CLI not available (run codex login or install codex in PATH)." >&2
  exit 0
fi

TIMEOUT_SEC=180
echo "Running Codex AI review..." >&2

# Run with --json to get turn.completed (token usage) and item.completed (assistant message). Use -o to get final message for PASS/FAIL.
CODEX_RC=0
if command -v timeout >/dev/null 2>&1; then
  timeout "$TIMEOUT_SEC" codex exec --json -o "$CODEX_LAST_MSG_FILE" "$PROMPT" 2>/dev/null > "$CODEX_JSON_FILE" || CODEX_RC=$?
else
  codex exec --json -o "$CODEX_LAST_MSG_FILE" "$PROMPT" 2>/dev/null > "$CODEX_JSON_FILE" || CODEX_RC=$?
fi

if [[ $CODEX_RC -eq 124 ]] || [[ $CODEX_RC -eq 142 ]]; then
  echo "Codex AI review timed out after ${TIMEOUT_SEC}s." >&2
  exit 1
fi

if [[ $CODEX_RC -ne 0 ]]; then
  echo "Codex AI review command failed (exit $CODEX_RC)." >&2
  cat "$CODEX_JSON_FILE" 2>/dev/null | head -50 >&2
  exit 1
fi

# Parse JSONL: turn.completed has usage (input_tokens, output_tokens); last assistant_message is in item.completed.
INPUT_T=""
OUTPUT_T=""
RESULT_TEXT=""
if command -v jq >/dev/null 2>&1; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    type="$(echo "$line" | jq -r '.type // empty')"
    if [[ "$type" == "turn.completed" ]]; then
      INPUT_T="$(echo "$line" | jq -r '.usage.input_tokens // empty')"
      OUTPUT_T="$(echo "$line" | jq -r '.usage.output_tokens // empty')"
    fi
    if [[ "$type" == "item.completed" ]]; then
      item_type="$(echo "$line" | jq -r '.item.item_type // empty')"
      if [[ "$item_type" == "assistant_message" ]]; then
        RESULT_TEXT="$(echo "$line" | jq -r '.item.text // empty')"
      fi
    fi
  done < "$CODEX_JSON_FILE"
fi

# Fallback: use --output-last-message file for PASS/FAIL if we didn't get assistant_message from JSONL
if [[ -z "$RESULT_TEXT" ]] && [[ -s "$CODEX_LAST_MSG_FILE" ]]; then
  RESULT_TEXT="$(cat "$CODEX_LAST_MSG_FILE")"
fi

# Parse structured review: RATING, POSITIVE, WARNINGS, ERRORS, RECOMMENDATIONS. Fallback: rating=0, has_warnings/errors=1.
REVIEW_RATING=0
REVIEW_POSITIVE=""
REVIEW_WARNINGS=""
REVIEW_ERRORS=""
REVIEW_RECOMMENDATIONS=""
HAS_WARNINGS=1
HAS_ERRORS=1

if [[ -n "$RESULT_TEXT" ]]; then
  REVIEW_RATING=$(echo "$RESULT_TEXT" | grep -iE '^RATING:[[:space:]]*[0-9]+' | head -1 | sed 's/.*:[[:space:]]*//' | tr -d '\r' | grep -oE '[0-9]+' | head -1)
  [[ -z "$REVIEW_RATING" ]] && REVIEW_RATING=0
  [[ "$REVIEW_RATING" -lt 0 ]] 2>/dev/null && REVIEW_RATING=0
  [[ "$REVIEW_RATING" -gt 100 ]] 2>/dev/null && REVIEW_RATING=100

  # Sections: content from label line (after colon) until next label (sed '$d' = drop last line, macOS-compatible)
  REVIEW_POSITIVE=$(echo "$RESULT_TEXT" | sed -n '/^POSITIVE:/,/^WARNINGS:/p' | tail -n +1 | sed '$d' | sed 's/^POSITIVE:[[:space:]]*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  REVIEW_WARNINGS=$(echo "$RESULT_TEXT" | sed -n '/^WARNINGS:/,/^ERRORS:/p' | tail -n +1 | sed '$d' | sed 's/^WARNINGS:[[:space:]]*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  REVIEW_ERRORS=$(echo "$RESULT_TEXT" | sed -n '/^ERRORS:/,/^RECOMMENDATIONS:/p' | tail -n +1 | sed '$d' | sed 's/^ERRORS:[[:space:]]*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  REVIEW_RECOMMENDATIONS=$(echo "$RESULT_TEXT" | sed -n '/^RECOMMENDATIONS:/,/^VERDICT:/p' | tail -n +1 | sed '$d' | sed 's/^RECOMMENDATIONS:[[:space:]]*//' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')

  # has_warnings/has_errors: 0 only if content is empty or "None" (case-insensitive)
  WNORM=$(echo "$REVIEW_WARNINGS" | tr -d '\r' | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  ENORM=$(echo "$REVIEW_ERRORS" | tr -d '\r' | tr '[:upper:]' '[:lower:]' | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  [[ -z "$WNORM" || "$WNORM" == "none" ]] && HAS_WARNINGS=0 || HAS_WARNINGS=1
  [[ -z "$ENORM" || "$ENORM" == "none" ]] && HAS_ERRORS=0 || HAS_ERRORS=1
fi

# Pass only if rating >= 95 and no warnings and no errors
PASS=0
if [[ "$REVIEW_RATING" -ge 95 ]] && [[ "$HAS_WARNINGS" -eq 0 ]] && [[ "$HAS_ERRORS" -eq 0 ]]; then
  PASS=1
fi

# Always print token usage
if [[ -n "$INPUT_T" && -n "$OUTPUT_T" ]]; then
  TOTAL=$((INPUT_T + OUTPUT_T))
  echo "Token usage: ${INPUT_T} input, ${OUTPUT_T} output (total ${TOTAL})" >&2
else
  echo "Token usage: not reported by Codex CLI" >&2
fi

# Save review to .shimwrapper/reviews/ as markdown (always, pass or fail)
REVIEWS_DIR="$ROOT_DIR/.shimwrapper/reviews"
mkdir -p "$REVIEWS_DIR"
REVIEW_FILE="$REVIEWS_DIR/review-$(date +%Y%m%d-%H%M%S).md"
BRANCH=""
[[ -n "${GIT_BRANCH:-}" ]] && BRANCH="$GIT_BRANCH" || BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
{
  echo "# AI Code Review — $(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
  echo ""
  echo "- **Branch:** $BRANCH"
  echo "- **Verdict:** $([ "$PASS" -eq 1 ] && echo "PASS" || echo "FAIL")"
  echo "- **Rating:** ${REVIEW_RATING}%"
  echo "- **Tokens:** ${INPUT_T:-?} input, ${OUTPUT_T:-?} output"
  echo ""
  echo "## Structured review"
  echo ""
  echo '```'
  [[ -n "$RESULT_TEXT" ]] && echo "$RESULT_TEXT" || echo "(no review text)"
  echo '```'
} >> "$REVIEW_FILE"
echo "Review saved: $REVIEW_FILE" >&2

# Always print review result and full structured review
if [[ $PASS -eq 1 ]]; then
  echo "Codex AI review: PASS" >&2
else
  echo "Codex AI review: FAIL" >&2
fi
echo "Rating: ${REVIEW_RATING}%" >&2
echo "Positive: ${REVIEW_POSITIVE:-"(none)"}" >&2
echo "Warnings: ${REVIEW_WARNINGS:-"(none)"}" >&2
echo "Errors: ${REVIEW_ERRORS:-"(none)"}" >&2
echo "Recommendations: ${REVIEW_RECOMMENDATIONS:-"(none)"}" >&2

[[ $PASS -eq 1 ]] && exit 0 || exit 1
