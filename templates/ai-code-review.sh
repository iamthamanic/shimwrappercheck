#!/usr/bin/env bash
# AI code review: Codex (default), optional Cursor second pass (RUN_CURSOR_REVIEW=1).
# Called from run-checks.sh. Prompt: senior-dev, decades-of-expertise, best-code bar.
# Codex (default): codex in PATH; use session after codex login (ChatGPT account, no API key in terminal).
# Cursor (optional): RUN_CURSOR_REVIEW=1, agent in PATH; use session after agent login (no API key in terminal).
# Diff limited to ~50KB head + tail. Timeout 120s when timeout(1) available.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Prefer Cursor CLI in common install location if not on PATH (for optional second pass)
if ! command -v agent >/dev/null 2>&1 && [[ -x "$HOME/.cursor/bin/agent" ]]; then
  export PATH="$HOME/.cursor/bin:$PATH"
fi

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

# Senior-dev review prompt: decades of expertise, best-code-ever bar (used for Cursor and Codex).
PROMPT="You are a senior software engineer with decades of code review experience. Your goal is to ensure the highest possible code quality: production-ready, secure, maintainable, and aligned with project standards.

Review the following code diff with the rigor of a principal engineer. Evaluate:

1. Correctness and bugs: logic errors, edge cases, race conditions, off-by-one, null/undefined handling.
2. Security: injection, XSS, sensitive data exposure, auth/authz, input validation, dependency risks.
3. Performance: unnecessary work, N+1, memory leaks, blocking calls, inefficient algorithms or data structures.
4. Maintainability: clarity, naming, single responsibility, DRY, testability, documentation where needed.
5. Project compliance: AGENTS.md rules, existing patterns, lint/type discipline, error handling and logging.
6. Robustness: error paths, timeouts, retries, backward compatibility, defensive checks.

Reply with exactly one line: PASS or FAIL: <brief reason>. If FAIL, state the single most critical issue. Do not modify any files or suggest edits in the response.

--- DIFF ---
$DIFF_LIMITED"

OUTPUT_FILE="$(mktemp)"
CODEX_OUTPUT="$(mktemp)"
cleanup() {
  [[ -n "$DIFF_FILE" ]] && [[ -f "$DIFF_FILE" ]] && rm -f "$DIFF_FILE"
  [[ -n "$OUTPUT_FILE" ]] && [[ -f "$OUTPUT_FILE" ]] && rm -f "$OUTPUT_FILE"
  [[ -n "$CODEX_OUTPUT" ]] && [[ -f "$CODEX_OUTPUT" ]] && rm -f "$CODEX_OUTPUT"
}
trap cleanup EXIT

TIMEOUT_SEC=120
CODEX_AVAILABLE=false
CURSOR_AVAILABLE=false
command -v codex >/dev/null 2>&1 && CODEX_AVAILABLE=true
command -v agent >/dev/null 2>&1 && CURSOR_AVAILABLE=true

if [[ "$CODEX_AVAILABLE" != true ]] && [[ "$CURSOR_AVAILABLE" != true ]]; then
  echo "Skipping AI review: Codex and Cursor CLI not available (run codex login or install codex/agent in PATH)." >&2
  exit 0
fi

# --- Default: Codex first ---
if [[ "$CODEX_AVAILABLE" = true ]]; then
  echo "Running Codex AI review (default)..." >&2
  CODEX_RC=0
  if command -v timeout >/dev/null 2>&1; then
    timeout "$TIMEOUT_SEC" codex exec "$PROMPT" 2>/dev/null > "$CODEX_OUTPUT" || CODEX_RC=$?
  else
    codex exec "$PROMPT" 2>/dev/null > "$CODEX_OUTPUT" || CODEX_RC=$?
  fi

  if [[ $CODEX_RC -eq 124 ]] || [[ $CODEX_RC -eq 142 ]]; then
    echo "Codex AI review timed out after ${TIMEOUT_SEC}s." >&2
    exit 1
  fi

  CODEX_RESULT="$(cat "$CODEX_OUTPUT")"
  if [[ $CODEX_RC -ne 0 ]]; then
    echo "Codex AI review command failed (exit $CODEX_RC)." >&2
    echo "$CODEX_RESULT" >&2
    exit 1
  fi

  if echo "$CODEX_RESULT" | grep -q "FAIL"; then
    echo "Codex AI review: FAIL" >&2
    echo "$CODEX_RESULT" >&2
    exit 1
  fi

  echo "Codex AI review: PASS" >&2
fi

# --- Fallback: Cursor when Codex not available ---
if [[ "$CODEX_AVAILABLE" != true ]] && [[ "$CURSOR_AVAILABLE" = true ]]; then
  echo "Running Cursor AI review (fallback)..." >&2
  run_cursor() {
    if command -v timeout >/dev/null 2>&1; then
      timeout "$TIMEOUT_SEC" agent -p "$PROMPT" --mode=ask --output-format json 2>&1 | tee "$OUTPUT_FILE"
      return "${PIPESTATUS[0]}"
    fi
    agent -p "$PROMPT" --mode=ask --output-format json 2>&1 | tee "$OUTPUT_FILE"
    return "${PIPESTATUS[0]}"
  }
  run_cursor
  AGENT_RC=$?

  if [[ $AGENT_RC -eq 124 ]] || [[ $AGENT_RC -eq 142 ]]; then
    echo "Cursor AI review timed out after ${TIMEOUT_SEC}s." >&2
    exit 1
  fi
  if [[ $AGENT_RC -ne 0 ]]; then
    echo "Cursor AI review command failed with exit code $AGENT_RC." >&2
    cat "$OUTPUT_FILE" >&2
    exit 1
  fi

  RESULT_LINE=""
  while IFS= read -r line; do [[ -n "$line" ]] && RESULT_LINE="$line"; done < "$OUTPUT_FILE"
  if command -v jq >/dev/null 2>&1 && [[ -n "$RESULT_LINE" ]]; then
    DURATION_MS="$(echo "$RESULT_LINE" | jq -r '.duration_ms // empty')"
    [[ -n "$DURATION_MS" ]] && echo "Review duration: ${DURATION_MS} ms" >&2
    INPUT_T="$(echo "$RESULT_LINE" | jq -r '.usage.input_tokens // .usage.input // empty')"
    OUTPUT_T="$(echo "$RESULT_LINE" | jq -r '.usage.output_tokens // .usage.output // empty')"
    if [[ -n "$INPUT_T" && -n "$OUTPUT_T" ]]; then
      echo "Token usage: ${INPUT_T} input, ${OUTPUT_T} output (total $((INPUT_T + OUTPUT_T)))" >&2
    else
      echo "Token usage: not reported by Cursor CLI" >&2
    fi
    RESULT_TEXT="$(echo "$RESULT_LINE" | jq -r '.result // empty')"
  else
    RESULT_TEXT="$(cat "$OUTPUT_FILE")"
    echo "Token usage: not reported by Cursor CLI" >&2
  fi

  if echo "$RESULT_TEXT" | grep -q "FAIL"; then
    echo "Cursor AI review: FAIL" >&2
    echo "$RESULT_TEXT" >&2
    exit 1
  fi
  echo "Cursor AI review: PASS" >&2
fi

# --- Optional second pass: Cursor after Codex (RUN_CURSOR_REVIEW=1) ---
if [[ "$CODEX_AVAILABLE" = true ]] && [[ -n "${RUN_CURSOR_REVIEW:-}" ]] && [[ "$CURSOR_AVAILABLE" = true ]]; then
  echo "Running Cursor AI review (optional second pass)..." >&2
  run_cursor() {
    if command -v timeout >/dev/null 2>&1; then
      timeout "$TIMEOUT_SEC" agent -p "$PROMPT" --mode=ask --output-format json 2>&1 | tee "$OUTPUT_FILE"
      return "${PIPESTATUS[0]}"
    fi
    agent -p "$PROMPT" --mode=ask --output-format json 2>&1 | tee "$OUTPUT_FILE"
    return "${PIPESTATUS[0]}"
  }
  run_cursor
  AGENT_RC=$?

  if [[ $AGENT_RC -eq 124 ]] || [[ $AGENT_RC -eq 142 ]]; then
    echo "Cursor AI review timed out after ${TIMEOUT_SEC}s." >&2
    exit 1
  fi
  if [[ $AGENT_RC -ne 0 ]]; then
    echo "Cursor AI review command failed with exit code $AGENT_RC." >&2
    cat "$OUTPUT_FILE" >&2
    exit 1
  fi

  RESULT_LINE=""
  while IFS= read -r line; do [[ -n "$line" ]] && RESULT_LINE="$line"; done < "$OUTPUT_FILE"
  if command -v jq >/dev/null 2>&1 && [[ -n "$RESULT_LINE" ]]; then
    DURATION_MS="$(echo "$RESULT_LINE" | jq -r '.duration_ms // empty')"
    [[ -n "$DURATION_MS" ]] && echo "Review duration: ${DURATION_MS} ms" >&2
    RESULT_TEXT="$(echo "$RESULT_LINE" | jq -r '.result // empty')"
  else
    RESULT_TEXT="$(cat "$OUTPUT_FILE")"
  fi

  if echo "$RESULT_TEXT" | grep -q "FAIL"; then
    echo "Cursor AI review: FAIL" >&2
    echo "$RESULT_TEXT" >&2
    exit 1
  fi
  echo "Cursor AI review: PASS" >&2
fi

exit 0
