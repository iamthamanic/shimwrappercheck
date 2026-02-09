#!/usr/bin/env bash
# AI code review: Codex only (Cursor disabled). Called from run-checks.sh.
# Prompt: Senior-Software-Architekt, 100 Punkte, Checkliste (SOLID, Performance, Sicherheit, Robustheit, Wartbarkeit), JSON score/deductions/verdict.
# When verdict is REJECT: address all checklist points per affected file in one pass — see AGENTS.md and docs/AI_REVIEW_WHY_NEW_ERRORS_AFTER_FIXES.md.
# Codex: codex in PATH; use session after codex login (ChatGPT account, no API key in terminal).
# CHECK_MODE controls which diff the AI gets:
#   CHECK_MODE=diff (default): Only changes (staged + unstaged, or commits being pushed). One Codex run; review file shows Mode: diff.
#   CHECK_MODE=full:          Chunked review per directory (src, supabase, scripts). Each chunk: git diff EMPTY_TREE..HEAD -- <dir>, up to 150KB per chunk; one Codex run per chunk; timeout 600s per chunk. PASS only if all chunks ACCEPT and score ≥ 95. Review file shows Mode: full (chunked) and sections ## Chunk: src, ## Chunk: supabase, ## Chunk: scripts.
# All other checks (format, lint, typecheck, …) always run on the full codebase.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
CHECK_MODE="${CHECK_MODE:-diff}"

DIFF_FILE=""
cleanup() {
  [[ -n "$DIFF_FILE" ]] && [[ -f "$DIFF_FILE" ]] && rm -f "$DIFF_FILE"
}
trap cleanup EXIT

DIFF_FILE="$(mktemp)"
if [[ "$CHECK_MODE" == "full" ]]; then
  # Chunked full review: one run per directory (src, supabase, scripts), 150KB per chunk, 600s timeout per chunk
  if ! command -v codex >/dev/null 2>&1; then
    echo "Skipping AI review: Codex CLI not available (run codex login or install codex in PATH)." >&2
    exit 0
  fi
  EMPTY_TREE="4b825dc642cb6eb9a060e54bf8d69288fbee4904"
  CHUNK_DIRS=""
  for d in src supabase scripts; do [[ -d "$ROOT_DIR/$d" ]] && CHUNK_DIRS="$CHUNK_DIRS $d"; done
  CHUNK_DIRS=$(echo $CHUNK_DIRS)
  if [[ -z "$CHUNK_DIRS" ]]; then
    echo "Skipping AI review (CHECK_MODE=full): none of src, supabase, scripts exist." >&2
    exit 0
  fi
  echo "AI review: CHECK_MODE=full (chunked per directory: $CHUNK_DIRS)." >&2
  CHUNK_LIMIT_BYTES=153600
  CHUNK_TIMEOUT="${SHIM_AI_CHUNK_TIMEOUT:-600}"
  REVIEWS_DIR="$ROOT_DIR/.shimwrapper/reviews"
  mkdir -p "$REVIEWS_DIR"
  REVIEW_FILE="$REVIEWS_DIR/review-$(date +%Y%m%d-%H%M%S).md"
  BRANCH=""
  [[ -n "${GIT_BRANCH:-}" ]] && BRANCH="$GIT_BRANCH" || BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")"
  OVERALL_PASS=1

  PROMPT_HEAD=$(cat << 'PROMPT_HEAD_END'
Du bist ein extrem strenger Senior-Software-Architekt. Deine Aufgabe ist es, einen Code-Diff zu bewerten.

Regeln:
Starte mit 100 Punkten. Gehe die folgende Checkliste durch und ziehe für jeden Verstoß die angegebenen Punkte ab. Sei gnadenlos. Ein "okay" reicht nicht für 95%. 95% bedeutet Weltklasse-Niveau.

1. Architektur & SOLID
- Single Responsibility (SRP): Hat die Klasse/Funktion mehr als einen Grund, sich zu ändern? (Abzug: -15)
- Dependency Inversion: Werden Abhängigkeiten (z.B. DB, APIs) hart instanziiert oder injiziert? (Abzug: -10)
- Kopplung: Zirkuläre Abhängigkeiten oder zu tief verschachtelte Importe? (Abzug: -10)
- YAGNI: Code für "zukünftige Fälle", der jetzt nicht gebraucht wird? (Abzug: -5)

2. Performance & Ressourcen
- Zeitkomplexität: Verschachtelte Schleifen O(n²), die bei großen Datenmengen explodieren? (Abzug: -20)
- N+1: Werden in einer Schleife Datenbankabfragen gemacht? (Abzug: -20)
- Memory Leaks: Event-Listener oder Streams geöffnet, aber nicht geschlossen? (Abzug: -15)
- Bundle-Size: Riesige Bibliotheken importiert für eine kleine Funktion? (Abzug: -5)

3. Sicherheit
- IDOR: API akzeptiert ID (z.B. user_id) ohne Prüfung, ob der User diese Ressource sehen darf? (Abzug: -25)
- Data Leakage: Sensible Daten in Logs oder Frontend? (Abzug: -20)
- Rate Limiting: Funktion durch massenhafte Aufrufe lahmlegbar? (Abzug: -10)

4. Robustheit & Error Handling
- Silent Fails: Leere catch-Blöcke, die Fehler verschlucken? (Abzug: -15)
- Input Validation: Externe Daten validiert vor Verarbeitung? (Abzug: -15)
- Edge Cases: null, undefined, [], extrem lange Strings? (Abzug: -10)

5. Wartbarkeit & Lesbarkeit
- Naming: Variablennamen beschreibend oder data, info, item? (Abzug: -5)
- Side Effects: Funktion verändert unvorhersehbar globale Zustände? (Abzug: -10)
- Kommentar-Qualität: Erklärt der Kommentar das "Warum" oder nur das "Was"? (Abzug: -2)

Gib das Ergebnis NUR als ein einziges gültiges JSON-Objekt aus, kein anderer Text. Format:
{"score": number, "deductions": [{"point": "Kurzname", "minus": number, "reason": "Begründung"}], "verdict": "ACCEPT" oder "REJECT"}
verdict: "ACCEPT" nur wenn score >= 95; sonst "REJECT".

--- DIFF ---
PROMPT_HEAD_END
)

  for chunk_dir in $CHUNK_DIRS; do
    CHUNK_DIFF=$(mktemp)
    git diff --no-color "$EMPTY_TREE"..HEAD -- "$chunk_dir" >> "$CHUNK_DIFF" 2>/dev/null || true
    CHUNK_PASS=1
    CHUNK_VERDICT="ACCEPT"
    CHUNK_RATING=100
    CHUNK_DEDUCTIONS="[]"
    CHUNK_RAW="(no diff)"
    CHUNK_NOTE=""
    if [[ ! -s "$CHUNK_DIFF" ]]; then
      CHUNK_NOTE="(skip: no changes in $chunk_dir)"
    else
      CHUNK_SIZE=$(wc -c < "$CHUNK_DIFF")
      CHUNK_CONTENT=""
      if [[ $CHUNK_SIZE -le $CHUNK_LIMIT_BYTES ]]; then
        CHUNK_CONTENT=$(cat "$CHUNK_DIFF")
      else
        HALF=$((CHUNK_LIMIT_BYTES / 2))
        CHUNK_CONTENT="$(head -c $HALF "$CHUNK_DIFF")
... (chunk truncated, was ${CHUNK_SIZE} bytes) ...
$(tail -c $HALF "$CHUNK_DIFF")"
        CHUNK_NOTE="(chunk truncated from ${CHUNK_SIZE} bytes to ${CHUNK_LIMIT_BYTES})"
      fi
      CODEX_JSON_C=$(mktemp)
      CODEX_MSG_C=$(mktemp)
      CHUNK_PROMPT="${PROMPT_HEAD}
${CHUNK_CONTENT}"
      CODEX_RC=0
      if command -v timeout >/dev/null 2>&1; then
        timeout "$CHUNK_TIMEOUT" codex exec --json -o "$CODEX_MSG_C" "$CHUNK_PROMPT" 2>/dev/null > "$CODEX_JSON_C" || CODEX_RC=$?
      else
        codex exec --json -o "$CODEX_MSG_C" "$CHUNK_PROMPT" 2>/dev/null > "$CODEX_JSON_C" || CODEX_RC=$?
      fi
      if [[ $CODEX_RC -eq 124 ]] || [[ $CODEX_RC -eq 142 ]]; then
        CHUNK_PASS=0
        CHUNK_VERDICT="REJECT"
        CHUNK_RATING=0
        CHUNK_RAW="(timeout after ${CHUNK_TIMEOUT}s)"
        CHUNK_NOTE="(timeout)"
      elif [[ $CODEX_RC -ne 0 ]]; then
        CHUNK_PASS=0
        CHUNK_VERDICT="REJECT"
        CHUNK_RAW="(codex exit $CODEX_RC)"
      else
        RESULT_TEXT_C=""
        if command -v jq >/dev/null 2>&1; then
          while IFS= read -r line; do
            [[ -z "$line" ]] && continue
            type="$(echo "$line" | jq -r '.type // empty')"
            if [[ "$type" == "item.completed" ]]; then
              item_type="$(echo "$line" | jq -r '.item.item_type // empty')"
              if [[ "$item_type" == "assistant_message" ]]; then
                RESULT_TEXT_C="$(echo "$line" | jq -r '.item.text // empty')"
              fi
            fi
          done < "$CODEX_JSON_C"
        fi
        [[ -z "$RESULT_TEXT_C" ]] && [[ -s "$CODEX_MSG_C" ]] && RESULT_TEXT_C="$(cat "$CODEX_MSG_C")"
        CHUNK_RAW="${RESULT_TEXT_C:- (no response)}"
        if [[ -n "$RESULT_TEXT_C" ]] && command -v node >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
          RESULT_TMP=$(mktemp)
          printf '%s' "$RESULT_TEXT_C" > "$RESULT_TMP"
          RESULT_JSON_C=$(node -e "
            const fs = require('fs');
            const d = fs.readFileSync(process.argv[1], 'utf8');
            const m = d.match(/\{[\s\S]*\}/);
            if (!m) process.exit(1);
            try { console.log(JSON.stringify(JSON.parse(m[0]))); } catch (e) { process.exit(2); }
          " "$RESULT_TMP" 2>/dev/null)
          rm -f "$RESULT_TMP"
          if [[ -n "$RESULT_JSON_C" ]]; then
            CHUNK_RATING=$(echo "$RESULT_JSON_C" | jq -r '.score // 0')
            CHUNK_VERDICT=$(echo "$RESULT_JSON_C" | jq -r '.verdict // "REJECT"')
            CHUNK_DEDUCTIONS=$(echo "$RESULT_JSON_C" | jq -r '.deductions // []')
            CHUNK_VERDICT=$(echo "$CHUNK_VERDICT" | tr '[:lower:]' '[:upper:]')
            [[ "$CHUNK_VERDICT" != "ACCEPT" ]] && CHUNK_VERDICT="REJECT"
            [[ "$CHUNK_RATING" =~ ^[0-9]+$ ]] || CHUNK_RATING=0
            [[ "$CHUNK_RATING" -lt 95 ]] 2>/dev/null && CHUNK_PASS=0
            [[ "$CHUNK_VERDICT" != "ACCEPT" ]] && CHUNK_PASS=0
          fi
        fi
      fi
      rm -f "$CODEX_JSON_C" "$CODEX_MSG_C"
    fi
    rm -f "$CHUNK_DIFF"
    [[ $CHUNK_PASS -ne 1 ]] && OVERALL_PASS=0
    {
      echo ""
      echo "## Chunk: $chunk_dir"
      echo ""
      echo "- **Verdict:** $([ "$CHUNK_PASS" -eq 1 ] && echo "PASS" || echo "FAIL") ($CHUNK_VERDICT)"
      echo "- **Score:** ${CHUNK_RATING}%"
      [[ -n "$CHUNK_NOTE" ]] && echo "- **Note:** $CHUNK_NOTE"
      echo ""
      echo "### Deductions"
      echo ""
      if [[ -n "$CHUNK_DEDUCTIONS" ]] && [[ "$CHUNK_DEDUCTIONS" != "[]" ]]; then
        echo "$CHUNK_DEDUCTIONS" | jq -r '.[] | "- **\(.point)**: -\(.minus) — \(.reason)"' 2>/dev/null || echo "$CHUNK_DEDUCTIONS"
      else
        echo "(none)"
      fi
      echo ""
      echo "### Raw response"
      echo ""
      echo '```'
      echo "$CHUNK_RAW"
      echo '```'
    } >> "$REVIEW_FILE"
  done

  {
    echo "# AI Code Review — $(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S%z')"
    echo ""
    echo "- **Mode:** full (chunked)"
    echo "- **Branch:** $BRANCH"
    echo "- **Verdict:** $([ "$OVERALL_PASS" -eq 1 ] && echo "PASS" || echo "FAIL") (all chunks must be ACCEPT and score ≥ 95)"
    echo ""
    echo "---"
  } > "$REVIEW_FILE.tmp" && cat "$REVIEW_FILE.tmp" "$REVIEW_FILE" > "$REVIEW_FILE.new" && mv "$REVIEW_FILE.new" "$REVIEW_FILE" && rm -f "$REVIEW_FILE.tmp"

  echo "Review saved: $REVIEW_FILE" >&2
  if [[ $OVERALL_PASS -eq 1 ]]; then
    echo "Codex AI review: PASS (all chunks)" >&2
  else
    echo "Codex AI review: FAIL (one or more chunks failed)" >&2
  fi
  exit $([[ $OVERALL_PASS -eq 1 ]] && echo 0 || echo 1)
fi

# Diff path (CHECK_MODE=diff)
git diff --no-color >> "$DIFF_FILE" 2>/dev/null || true
git diff --cached --no-color >> "$DIFF_FILE" 2>/dev/null || true
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
  echo "Skipping AI review: no staged, unstaged, or pushed changes (CHECK_MODE=diff)." >&2
  exit 0
fi
echo "AI review: CHECK_MODE=diff (changes only)." >&2

# Limit diff to first and last ~50KB to avoid token limits and timeouts. With CHECK_MODE=full the repo diff can be large; the AI then only sees head and tail.
LIMIT_BYTES=51200
DIFF_LIMITED=""
if [[ $(wc -c < "$DIFF_FILE") -le $((LIMIT_BYTES * 2)) ]]; then
  DIFF_LIMITED="$(cat "$DIFF_FILE")"
else
  DIFF_LIMITED="$(head -c $LIMIT_BYTES "$DIFF_FILE")
...[truncated]...
$(tail -c $LIMIT_BYTES "$DIFF_FILE")"
fi

# Senior-Software-Architekt: 100 Punkte, Checkliste durchgehen, Abzüge anwenden. Ausgabe nur JSON.
PROMPT=$(cat << 'PROMPT_END'
Du bist ein extrem strenger Senior-Software-Architekt. Deine Aufgabe ist es, einen Code-Diff zu bewerten.

Regeln:
Starte mit 100 Punkten. Gehe die folgende Checkliste durch und ziehe für jeden Verstoß die angegebenen Punkte ab. Sei gnadenlos. Ein "okay" reicht nicht für 95%. 95% bedeutet Weltklasse-Niveau.

1. Architektur & SOLID
- Single Responsibility (SRP): Hat die Klasse/Funktion mehr als einen Grund, sich zu ändern? (Abzug: -15)
- Dependency Inversion: Werden Abhängigkeiten (z.B. DB, APIs) hart instanziiert oder injiziert? (Abzug: -10)
- Kopplung: Zirkuläre Abhängigkeiten oder zu tief verschachtelte Importe? (Abzug: -10)
- YAGNI: Code für "zukünftige Fälle", der jetzt nicht gebraucht wird? (Abzug: -5)

2. Performance & Ressourcen
- Zeitkomplexität: Verschachtelte Schleifen O(n²), die bei großen Datenmengen explodieren? (Abzug: -20)
- N+1: Werden in einer Schleife Datenbankabfragen gemacht? (Abzug: -20)
- Memory Leaks: Event-Listener oder Streams geöffnet, aber nicht geschlossen? (Abzug: -15)
- Bundle-Size: Riesige Bibliotheken importiert für eine kleine Funktion? (Abzug: -5)

3. Sicherheit
- IDOR: API akzeptiert ID (z.B. user_id) ohne Prüfung, ob der User diese Ressource sehen darf? (Abzug: -25)
- Data Leakage: Sensible Daten in Logs oder Frontend? (Abzug: -20)
- Rate Limiting: Funktion durch massenhafte Aufrufe lahmlegbar? (Abzug: -10)

4. Robustheit & Error Handling
- Silent Fails: Leere catch-Blöcke, die Fehler verschlucken? (Abzug: -15)
- Input Validation: Externe Daten validiert vor Verarbeitung? (Abzug: -15)
- Edge Cases: null, undefined, [], extrem lange Strings? (Abzug: -10)

5. Wartbarkeit & Lesbarkeit
- Naming: Variablennamen beschreibend oder data, info, item? (Abzug: -5)
- Side Effects: Funktion verändert unvorhersehbar globale Zustände? (Abzug: -10)
- Kommentar-Qualität: Erklärt der Kommentar das "Warum" oder nur das "Was"? (Abzug: -2)

Gib das Ergebnis NUR als ein einziges gültiges JSON-Objekt aus, kein anderer Text. Format:
{"score": number, "deductions": [{"point": "Kurzname", "minus": number, "reason": "Begründung"}], "verdict": "ACCEPT" oder "REJECT"}
verdict: "ACCEPT" nur wenn score >= 95; sonst "REJECT".

--- DIFF ---
PROMPT_END
)
PROMPT="${PROMPT}
${DIFF_LIMITED}"

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

# Parse JSON review: score, deductions, verdict. Fallback: score=0, verdict=REJECT.
REVIEW_RATING=0
REVIEW_VERDICT="REJECT"
REVIEW_DEDUCTIONS=""

if [[ -n "$RESULT_TEXT" ]]; then
  RESULT_JSON=""
  if command -v node >/dev/null 2>&1; then
    RESULT_TMP=$(mktemp)
    printf '%s' "$RESULT_TEXT" > "$RESULT_TMP"
    RESULT_JSON=$(node -e "
      const fs = require('fs');
      const d = fs.readFileSync(process.argv[1], 'utf8');
      const m = d.match(/\{[\s\S]*\}/);
      if (!m) process.exit(1);
      try { console.log(JSON.stringify(JSON.parse(m[0]))); } catch (e) { process.exit(2); }
    " "$RESULT_TMP" 2>/dev/null)
    rm -f "$RESULT_TMP"
  fi
  if [[ -n "$RESULT_JSON" ]] && command -v jq >/dev/null 2>&1; then
    REVIEW_RATING=$(echo "$RESULT_JSON" | jq -r '.score // 0')
    REVIEW_VERDICT=$(echo "$RESULT_JSON" | jq -r '.verdict // "REJECT"')
    REVIEW_DEDUCTIONS=$(echo "$RESULT_JSON" | jq -r '.deductions // []')
  fi
  [[ -z "$REVIEW_RATING" ]] && REVIEW_RATING=0
  [[ "$REVIEW_RATING" =~ ^[0-9]+$ ]] || REVIEW_RATING=0
  [[ "$REVIEW_RATING" -lt 0 ]] 2>/dev/null && REVIEW_RATING=0
  [[ "$REVIEW_RATING" -gt 100 ]] 2>/dev/null && REVIEW_RATING=100
  REVIEW_VERDICT=$(echo "$REVIEW_VERDICT" | tr '[:lower:]' '[:upper:]')
  [[ "$REVIEW_VERDICT" != "ACCEPT" ]] && REVIEW_VERDICT="REJECT"
fi

# Pass only if verdict ACCEPT and score >= 95
PASS=0
if [[ "$REVIEW_VERDICT" == "ACCEPT" ]] && [[ "$REVIEW_RATING" -ge 95 ]]; then
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
  echo "- **Mode:** $CHECK_MODE"
  echo "- **Branch:** $BRANCH"
  echo "- **Verdict:** $([ "$PASS" -eq 1 ] && echo "PASS" || echo "FAIL") ($REVIEW_VERDICT)"
  echo "- **Score:** ${REVIEW_RATING}%"
  echo "- **Tokens:** ${INPUT_T:-?} input, ${OUTPUT_T:-?} output"
  echo ""
  echo "## Deductions"
  echo ""
  if [[ -n "$REVIEW_DEDUCTIONS" ]] && [[ "$REVIEW_DEDUCTIONS" != "[]" ]]; then
    echo "$REVIEW_DEDUCTIONS" | jq -r '.[] | "- **\(.point)**: -\(.minus) — \(.reason)"' 2>/dev/null || echo "$REVIEW_DEDUCTIONS"
  else
    echo "(none)"
  fi
  echo ""
  echo "## Raw response"
  echo ""
  echo '```'
  [[ -n "$RESULT_TEXT" ]] && echo "$RESULT_TEXT" || echo "(no review text)"
  echo '```'
} >> "$REVIEW_FILE"
echo "Review saved: $REVIEW_FILE" >&2

# Always print review result
if [[ $PASS -eq 1 ]]; then
  echo "Codex AI review: PASS" >&2
else
  echo "Codex AI review: FAIL" >&2
fi
echo "Score: ${REVIEW_RATING}%" >&2
echo "Verdict: ${REVIEW_VERDICT}" >&2
if [[ -n "$REVIEW_DEDUCTIONS" ]] && [[ "$REVIEW_DEDUCTIONS" != "[]" ]]; then
  echo "Deductions:" >&2
  echo "$REVIEW_DEDUCTIONS" | jq -r '.[] | "  - \(.point): -\(.minus) — \(.reason)"' 2>/dev/null || echo "$REVIEW_DEDUCTIONS" >&2
fi
if [[ $PASS -ne 1 ]]; then
  echo "Address deductions above (or in $REVIEW_FILE). Do a broad pass per affected file (IDOR, rate limiting, input validation, error handling, edge cases) before re-running — see AGENTS.md and docs/AI_REVIEW_WHY_NEW_ERRORS_AFTER_FIXES.md." >&2
fi

[[ $PASS -eq 1 ]] && exit 0 || exit 1
