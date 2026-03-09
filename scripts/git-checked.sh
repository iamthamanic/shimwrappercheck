#!/usr/bin/env bash
# Shim wrapper for Git: run checks (optional), then call real git.
# Uses real git binary for all git calls so PATH-based shim recursion is avoided.
set -euo pipefail

WRAPPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Resolve real git once: avoid using PATH so we never call this shim again.
resolve_real_git() {
  local r="${SHIM_GIT_REAL_BIN:-${GIT_REAL_BIN:-}}"
  if [[ -z "$r" ]]; then
    r="$(command -v git 2>/dev/null || true)"
  fi
  if [[ -n "$r" ]] && { [[ "$r" == *"node_modules"* ]] || [[ "$r" == "$WRAPPER_DIR"* ]]; }; then
    r=""
  fi
  if [[ -z "$r" ]]; then
    for c in /usr/bin/git /usr/local/bin/git /opt/homebrew/bin/git; do
      if [[ -x "$c" ]]; then echo "$c"; return; fi
    done
  fi
  [[ -n "$r" ]] && echo "$r"
}

GIT_CMD="$(resolve_real_git)"

resolve_project_root() {
  if [[ -n "${SHIM_PROJECT_ROOT:-}" ]]; then
    echo "$SHIM_PROJECT_ROOT"
    return
  fi
  if [[ -n "$GIT_CMD" ]] && [[ -x "$GIT_CMD" ]]; then
    local root
    root="$("$GIT_CMD" rev-parse --show-toplevel 2>/dev/null || true)"
    if [[ -n "$root" ]]; then
      echo "$root"
      return
    fi
  fi
  pwd
}

PROJECT_ROOT="$(resolve_project_root)"
cd "$PROJECT_ROOT"

CONFIG_FILE="${SHIM_CONFIG_FILE:-$PROJECT_ROOT/.shimwrappercheckrc}"
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

ARGS_IN=("$@")
ARGS_TEXT_RAW=" ${*:-} "
GIT_ARGS=()
CHECKS_PASSTHROUGH=()

RUN_CHECKS=true
CHECKS_ONLY=false

matches_command_list() {
  local list="$1"
  local text="$2"

  list="$(echo "$list" | tr '[:upper:]' '[:lower:]')"
  text="$(echo "$text" | tr '[:upper:]' '[:lower:]')"

  if [[ -z "$list" ]] || [[ "$list" == "all" ]]; then
    return 0
  fi
  if [[ "$list" == "none" ]]; then
    return 1
  fi

  IFS=',' read -r -a items <<< "$list"
  for item in "${items[@]}"; do
    item="$(echo "$item" | xargs)"
    [[ -z "$item" ]] && continue
    if [[ "$text" == *" $item "* ]]; then
      return 0
    fi
  done
  return 1
}

trim() {
  local s="$1"
  # shellcheck disable=SC2001
  s="$(echo "$s" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  echo "$s"
}

has_backend_changes() {
  local files="$1"
  local patterns="${SHIM_BACKEND_PATH_PATTERNS:-supabase/functions,src/supabase/functions}"
  local line=""
  local raw=""
  local prefix=""

  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    IFS=',' read -r -a items <<< "$patterns"
    for raw in "${items[@]}"; do
      prefix="$(trim "$raw")"
      prefix="${prefix#/}"
      prefix="${prefix%/}"
      [[ -z "$prefix" ]] && continue
      if [[ "$line" == "$prefix/"* ]]; then
        return 0
      fi
    done
  done <<< "$files"

  return 1
}

normalize_push_check_mode() {
  local mode="$1"
  mode="$(echo "$mode" | tr '[:upper:]' '[:lower:]')"
  case "$mode" in
    ""|snippet|full|commit) echo "$mode" ;;
    diff) echo "snippet" ;;
    mix) echo "full" ;;
    *) echo "commit" ;;
  esac
}

for arg in "${ARGS_IN[@]}"; do
  case "$arg" in
    --no-checks) RUN_CHECKS=false ;;
    --checks-only) CHECKS_ONLY=true ;;
    --no-ai-review|--ai-review) CHECKS_PASSTHROUGH+=("$arg") ;;
    --no-explanation-check|--explanation-check) CHECKS_PASSTHROUGH+=("$arg") ;;
    *) GIT_ARGS+=("$arg") ;;
  esac
done

[[ -n "${SHIM_DISABLE_CHECKS:-}" ]] && RUN_CHECKS=false
case "${SHIM_ENABLED:-1}" in
  0|false|FALSE|no|NO|off|OFF) RUN_CHECKS=false ;;
esac

if [[ "${#GIT_ARGS[@]}" -eq 0 ]] && [[ "$CHECKS_ONLY" != true ]]; then
  echo "No git command provided. Usage: git [shim flags] <git args>" >&2
  echo "Shim flags: --no-checks --checks-only --no-ai-review --no-explanation-check" >&2
  exit 1
fi

ARGS_TEXT=" ${GIT_ARGS[*]:-} "
if [[ "$CHECKS_ONLY" != true ]]; then
  enforce_list="${SHIM_GIT_ENFORCE_COMMANDS:-push}"
  if ! matches_command_list "$enforce_list" "$ARGS_TEXT"; then
    RUN_CHECKS=false
  fi
fi

resolve_checks_script() {
  local script="${SHIM_GIT_CHECKS_SCRIPT:-}"
  if [[ -n "$script" ]]; then
    if [[ "$script" != /* ]]; then
      script="$PROJECT_ROOT/$script"
    fi
    echo "$script"
    return
  fi
  script="${SHIM_CHECKS_SCRIPT:-}"
  if [[ -n "$script" ]]; then
    if [[ "$script" != /* ]]; then
      script="$PROJECT_ROOT/$script"
    fi
    echo "$script"
    return
  fi
  local candidates=("scripts/run-checks.sh" "scripts/shim-checks.sh")
  for candidate in "${candidates[@]}"; do
    if [[ -f "$PROJECT_ROOT/$candidate" ]]; then
      echo "$PROJECT_ROOT/$candidate"
      return
    fi
  done
  echo ""
}

if [[ "$RUN_CHECKS" = true ]]; then
  run_frontend=false
  run_backend=false
  run_ai_review=true
  run_explanation_check=true

  changed_files=""
  if [[ -n "$GIT_CMD" ]] && [[ -x "$GIT_CMD" ]]; then
    if "$GIT_CMD" rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
      RANGE="@{u}...HEAD"
      changed_files="$("$GIT_CMD" diff --name-only --diff-filter=ACMR "$RANGE" || true)"
    else
      if "$GIT_CMD" rev-parse --verify HEAD~1 >/dev/null 2>&1; then
        changed_files="$("$GIT_CMD" diff --name-only --diff-filter=ACMR HEAD~1...HEAD || true)"
      else
        changed_files="$("$GIT_CMD" diff --name-only --diff-filter=ACMR --root HEAD || true)"
      fi
    fi
  fi

  if [[ -n "$changed_files" ]]; then
    echo "$changed_files" | grep -q '^src/' && run_frontend=true
    if has_backend_changes "$changed_files"; then
      run_backend=true
    fi
  fi

  if [[ "$ARGS_TEXT_RAW" == *" --no-ai-review "* ]]; then
    run_ai_review=false
  fi
  if [[ -n "${SKIP_AI_REVIEW:-}" ]]; then
    run_ai_review=false
  fi
  # On push: AI review always runs in commit mode and must pass; no bypass.
  if [[ "$ARGS_TEXT_RAW" == *" push "* ]]; then
    run_ai_review=true
  fi
  if [[ "$ARGS_TEXT_RAW" == *" --no-explanation-check "* ]]; then
    run_explanation_check=false
  fi
  if [[ -n "${SKIP_EXPLANATION_CHECK:-}" ]]; then
    run_explanation_check=false
  fi

  if [[ "$run_frontend" = true ]] || [[ "$run_backend" = true ]]; then
    RUNNER_FULL=""
    PUSH_CHECK_MODE=""
    if [[ "$ARGS_TEXT_RAW" == *" push "* ]]; then
      RUNNER_FULL="--full"
      PUSH_CHECK_MODE="commit"
    fi
    HAS_RUNNER=false
    [[ -f "$PROJECT_ROOT/scripts/shim-runner.js" ]] && HAS_RUNNER=true
    [[ -f "$PROJECT_ROOT/node_modules/shimwrappercheck/scripts/shim-runner.js" ]] && HAS_RUNNER=true
    if [[ "$HAS_RUNNER" = true ]]; then
      CHECKS_ARGS=()
      [[ "$run_frontend" = true ]] && CHECKS_ARGS+=(--frontend)
      [[ "$run_backend" = true ]] && CHECKS_ARGS+=(--backend)
      [[ "$run_ai_review" = false ]] && CHECKS_ARGS+=(--no-ai-review)
      [[ "$run_explanation_check" = false ]] && CHECKS_ARGS+=(--no-explanation-check)
      if [[ "$ARGS_TEXT_RAW" == *" push "* ]]; then
        for a in "${CHECKS_PASSTHROUGH[@]}"; do
          [[ "$a" != "--no-ai-review" ]] && CHECKS_ARGS+=("$a")
        done
      else
        CHECKS_ARGS+=("${CHECKS_PASSTHROUGH[@]}")
      fi
      if [[ -f "$PROJECT_ROOT/scripts/cli.js" ]]; then
        if [[ -n "$PUSH_CHECK_MODE" ]]; then
          env -u SKIP_AI_REVIEW CHECK_MODE="$PUSH_CHECK_MODE" node "$PROJECT_ROOT/scripts/cli.js" run ${RUNNER_FULL:+"$RUNNER_FULL"} "${CHECKS_ARGS[@]}"
        else
          node "$PROJECT_ROOT/scripts/cli.js" run ${RUNNER_FULL:+"$RUNNER_FULL"} "${CHECKS_ARGS[@]}"
        fi
      elif command -v npx >/dev/null 2>&1; then
        if [[ -n "$PUSH_CHECK_MODE" ]]; then
          env -u SKIP_AI_REVIEW CHECK_MODE="$PUSH_CHECK_MODE" npx shimwrappercheck run ${RUNNER_FULL:+"$RUNNER_FULL"} "${CHECKS_ARGS[@]}"
        else
          npx shimwrappercheck run ${RUNNER_FULL:+"$RUNNER_FULL"} "${CHECKS_ARGS[@]}"
        fi
      else
        echo "Git shim: neither local scripts/cli.js nor npx found; skipping checks." >&2
      fi
    else
      CHECKS_SCRIPT="$(resolve_checks_script)"
      if [[ -n "$CHECKS_SCRIPT" ]]; then
        CHECKS_ARGS=()
        if [[ -n "${SHIM_GIT_CHECKS_ARGS:-}" ]]; then
          read -r -a CHECKS_ARGS <<< "${SHIM_GIT_CHECKS_ARGS}"
        elif [[ -n "${SHIM_CHECKS_ARGS:-}" ]]; then
          read -r -a CHECKS_ARGS <<< "${SHIM_CHECKS_ARGS}"
        fi
        [[ "$run_frontend" = true ]] && CHECKS_ARGS+=(--frontend)
        [[ "$run_backend" = true ]] && CHECKS_ARGS+=(--backend)
        [[ "$run_ai_review" = false ]] && CHECKS_ARGS+=(--no-ai-review)
        [[ "$run_explanation_check" = false ]] && CHECKS_ARGS+=(--no-explanation-check)
        if [[ "$ARGS_TEXT_RAW" == *" push "* ]]; then
          for a in "${CHECKS_PASSTHROUGH[@]}"; do
            [[ "$a" != "--no-ai-review" ]] && CHECKS_ARGS+=("$a")
          done
        else
          CHECKS_ARGS+=("${CHECKS_PASSTHROUGH[@]}")
        fi
        if [[ -n "$PUSH_CHECK_MODE" ]]; then
          env -u SKIP_AI_REVIEW CHECK_MODE="$PUSH_CHECK_MODE" bash "$CHECKS_SCRIPT" "${CHECKS_ARGS[@]}"
        else
          bash "$CHECKS_SCRIPT" "${CHECKS_ARGS[@]}"
        fi
      else
        echo "Git shim checks: no checks script found; skipping." >&2
      fi
    fi
  fi
fi

# Enforce single commit when pushing: AI review (commit mode) only reviews HEAD~1..HEAD; older commits would stay unreviewed.
# Only when upstream exists (normal push); first push (no upstream yet) is not enforced.
if [[ "$ARGS_TEXT_RAW" == *" push "* ]] && [[ -n "$GIT_CMD" ]] && [[ -x "$GIT_CMD" ]]; then
  if "$GIT_CMD" rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
    AHEAD="$("$GIT_CMD" rev-list --count @{u}..HEAD 2>/dev/null || true)"
    if [[ -n "$AHEAD" ]] && [[ "$AHEAD" =~ ^[0-9]+$ ]] && [[ "$AHEAD" -gt 1 ]]; then
      echo "Pre-push: Multiple local commits ($AHEAD) ahead of upstream. AI review only reviews the latest commit. Squash (e.g. git rebase -i @{u}) or push one commit at a time." >&2
      exit 1
    fi
  fi
fi

if [[ "$CHECKS_ONLY" = true ]]; then
  exit 0
fi

if [[ -z "$GIT_CMD" ]] || [[ ! -x "$GIT_CMD" ]]; then
  echo "Real git binary not found. Set SHIM_GIT_REAL_BIN or ensure /usr/bin/git exists." >&2
  exit 1
fi

exec "$GIT_CMD" "${GIT_ARGS[@]}"
