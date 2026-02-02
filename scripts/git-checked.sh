#!/usr/bin/env bash
# Shim wrapper for Git: run checks (optional), then call real git.
set -euo pipefail

WRAPPER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

resolve_project_root() {
  if [[ -n "${SHIM_PROJECT_ROOT:-}" ]]; then
    echo "$SHIM_PROJECT_ROOT"
    return
  fi
  if command -v git >/dev/null 2>&1; then
    local root
    root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
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

for arg in "${ARGS_IN[@]}"; do
  case "$arg" in
    --no-checks) RUN_CHECKS=false ;;
    --checks-only) CHECKS_ONLY=true ;;
    --no-ai-review|--ai-review) CHECKS_PASSTHROUGH+=("$arg") ;;
    *) GIT_ARGS+=("$arg") ;;
  esac
done

[[ -n "${SHIM_DISABLE_CHECKS:-}" ]] && RUN_CHECKS=false

if [[ "${#GIT_ARGS[@]}" -eq 0 ]] && [[ "$CHECKS_ONLY" != true ]]; then
  echo "No git command provided. Usage: git [shim flags] <git args>" >&2
  echo "Shim flags: --no-checks --checks-only --no-ai-review" >&2
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

  changed_files=""
  if command -v git >/dev/null 2>&1; then
    if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
      RANGE="@{u}...HEAD"
      changed_files="$(git diff --name-only --diff-filter=ACMR "$RANGE" || true)"
    else
      if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
        changed_files="$(git diff --name-only --diff-filter=ACMR HEAD~1...HEAD || true)"
      else
        changed_files="$(git diff --name-only --diff-filter=ACMR --root HEAD || true)"
      fi
    fi
  fi

  if [[ -n "$changed_files" ]]; then
    echo "$changed_files" | grep -q '^src/' && run_frontend=true
    echo "$changed_files" | grep -q '^supabase/functions/' && run_backend=true
  fi

  if [[ "$ARGS_TEXT_RAW" == *" --no-ai-review "* ]]; then
    run_ai_review=false
  fi
  if [[ -n "${SKIP_AI_REVIEW:-}" ]]; then
    run_ai_review=false
  fi

  if [[ "$run_frontend" = true ]] || [[ "$run_backend" = true ]]; then
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
      CHECKS_ARGS+=("${CHECKS_PASSTHROUGH[@]}")
      bash "$CHECKS_SCRIPT" "${CHECKS_ARGS[@]}"
    else
      echo "Git shim checks: no checks script found; skipping." >&2
    fi
  fi
fi

if [[ "$CHECKS_ONLY" = true ]]; then
  exit 0
fi

REAL_BIN="${SHIM_GIT_REAL_BIN:-${GIT_REAL_BIN:-}}"
if [[ -z "$REAL_BIN" ]]; then
  REAL_BIN="$(command -v git || true)"
fi
if [[ -n "$REAL_BIN" ]] && { [[ "$REAL_BIN" == *"node_modules"* ]] || [[ "$REAL_BIN" == "$WRAPPER_DIR"* ]]; }; then
  REAL_BIN=""
fi

if [[ -z "$REAL_BIN" ]]; then
  for candidate in /usr/bin/git /usr/local/bin/git /opt/homebrew/bin/git; do
    if [[ -x "$candidate" ]]; then
      REAL_BIN="$candidate"
      break
    fi
  done
fi

if [[ -z "$REAL_BIN" ]]; then
  echo "Real git binary not found. Set SHIM_GIT_REAL_BIN." >&2
  exit 1
fi

exec "$REAL_BIN" "${GIT_ARGS[@]}"
