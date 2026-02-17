#!/usr/bin/env bash
# Shim wrapper for Supabase CLI: run checks, call real CLI, then run optional hooks.
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
SUPABASE_ARGS=()
CHECKS_PASSTHROUGH=()

RUN_CHECKS=true
CHECKS_ONLY=false
RUN_HOOKS=true
RUN_PUSH=true
FORCE_FRONTEND=false

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

for arg in "${ARGS_IN[@]}"; do
  case "$arg" in
    --no-checks) RUN_CHECKS=false ;;
    --checks-only) CHECKS_ONLY=true ;;
    --no-hooks) RUN_HOOKS=false ;;
    --no-push) RUN_PUSH=false ;;
    --with-frontend) FORCE_FRONTEND=true ;;
    --no-ai-review) CHECKS_PASSTHROUGH+=("$arg") ;;
    --ai-review) CHECKS_PASSTHROUGH+=("$arg") ;;
    --no-explanation-check) CHECKS_PASSTHROUGH+=("$arg") ;;
    --explanation-check) CHECKS_PASSTHROUGH+=("$arg") ;;
    *) SUPABASE_ARGS+=("$arg") ;;
  esac
done

[[ -n "${SHIM_DISABLE_CHECKS:-}" ]] && RUN_CHECKS=false
[[ -n "${SHIM_DISABLE_HOOKS:-}" ]] && RUN_HOOKS=false
if [[ -n "${SHIM_AUTO_PUSH:-}" ]]; then
  case "${SHIM_AUTO_PUSH}" in
    1|true|TRUE|yes|YES) RUN_PUSH=true ;;
    0|false|FALSE|no|NO) RUN_PUSH=false ;;
  esac
fi

if [[ "${#SUPABASE_ARGS[@]}" -eq 0 ]] && [[ "$CHECKS_ONLY" != true ]]; then
  echo "No Supabase command provided. Usage: supabase [shim flags] <supabase args>" >&2
  echo "Shim flags: --no-checks --checks-only --no-hooks --no-push --no-ai-review --no-explanation-check" >&2
  exit 1
fi

ARGS_TEXT=" ${SUPABASE_ARGS[*]:-} "
if [[ "$CHECKS_ONLY" != true ]]; then
  enforce_list="${SHIM_ENFORCE_COMMANDS:-all}"
  if ! matches_command_list "$enforce_list" "$ARGS_TEXT"; then
    RUN_CHECKS=false
  fi
fi

resolve_checks_script() {
  local script="${SHIM_CHECKS_SCRIPT:-}"
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
  if command -v git >/dev/null 2>&1; then
    unstaged=$(git diff --name-only --diff-filter=ACMR || true)
    staged=$(git diff --name-only --cached --diff-filter=ACMR || true)
    changed_files=$(printf "%s\n%s\n" "$unstaged" "$staged")
  fi

  if [[ -n "$changed_files" ]]; then
    echo "$changed_files" | grep -q '^src/' && run_frontend=true
    if has_backend_changes "$changed_files"; then
      run_backend=true
    fi
  fi

  ARGS_TEXT=" ${SUPABASE_ARGS[*]:-} "
  if [[ "$ARGS_TEXT" == *" functions "* ]]; then
    run_backend=true
  fi

  if [[ "$FORCE_FRONTEND" = true ]] || [[ "$ARGS_TEXT_RAW" == *" --with-frontend "* ]]; then
    run_frontend=true
  fi

  if [[ "$ARGS_TEXT_RAW" == *" --no-ai-review "* ]]; then
    run_ai_review=false
  fi
  if [[ -n "${SKIP_AI_REVIEW:-}" ]]; then
    run_ai_review=false
  fi
  if [[ "$ARGS_TEXT_RAW" == *" --no-explanation-check "* ]]; then
    run_explanation_check=false
  fi
  if [[ -n "${SKIP_EXPLANATION_CHECK:-}" ]]; then
    run_explanation_check=false
  fi

  if [[ "$run_frontend" = true ]] || [[ "$run_backend" = true ]]; then
    CHECKS_SCRIPT="$(resolve_checks_script)"
    if [[ -n "$CHECKS_SCRIPT" ]]; then
      CHECKS_ARGS=()
      if [[ -n "${SHIM_CHECKS_ARGS:-}" ]]; then
        read -r -a CHECKS_ARGS <<< "${SHIM_CHECKS_ARGS}"
      fi
      [[ "$run_frontend" = true ]] && CHECKS_ARGS+=(--frontend)
      [[ "$run_backend" = true ]] && CHECKS_ARGS+=(--backend)
      [[ "$run_ai_review" = false ]] && CHECKS_ARGS+=(--no-ai-review)
      [[ "$run_explanation_check" = false ]] && CHECKS_ARGS+=(--no-explanation-check)
      CHECKS_ARGS+=("${CHECKS_PASSTHROUGH[@]}")
      bash "$CHECKS_SCRIPT" "${CHECKS_ARGS[@]}"
    else
      echo "Shim checks: no checks script found; skipping." >&2
    fi
  fi
fi

if [[ "$CHECKS_ONLY" = true ]]; then
  exit 0
fi

REAL_BIN="${SHIM_SUPABASE_BIN:-${SUPABASE_REAL_BIN:-}}"
if [[ -z "$REAL_BIN" ]] && [[ -f "$HOME/.supabase-real-bin" ]]; then
  REAL_BIN="$(cat "$HOME/.supabase-real-bin")"
fi
if [[ -z "$REAL_BIN" ]]; then
  REAL_BIN="$(command -v supabase || true)"
fi
if [[ -n "$REAL_BIN" ]] && { [[ "$REAL_BIN" == *"node_modules"* ]] || [[ "$REAL_BIN" == "$WRAPPER_DIR"* ]]; }; then
  REAL_BIN=""
fi

retry_max=${SUPABASE_RETRY_MAX:-1}
if ! [[ "$retry_max" =~ ^[0-9]+$ ]]; then
  retry_max=1
fi

retry_backoffs="${SUPABASE_RETRY_BACKOFF_SECONDS:-5,15}"
IFS=',' read -r -a retry_backoff_list <<< "$retry_backoffs"

retry_extra_args=()
if [[ -n "${SUPABASE_RETRY_EXTRA_ARGS:-}" ]]; then
  read -r -a retry_extra_args <<< "${SUPABASE_RETRY_EXTRA_ARGS}"
fi

run_supabase_cli() {
  local retry_mode="${1:-false}"
  local -a cmd_args=("${SUPABASE_ARGS[@]}")

  if [[ "$retry_mode" == "true" ]] && [[ "${#retry_extra_args[@]}" -gt 0 ]]; then
    cmd_args+=("${retry_extra_args[@]}")
  fi

  RUN_OUTPUT_FILE="$(mktemp)"
  set +e
  if [[ -z "$REAL_BIN" ]] || [[ ! -x "$REAL_BIN" ]]; then
    # Use registry package to avoid recursion when shim is the local bin.
    npx --yes --package supabase supabase "${cmd_args[@]}" 2>&1 | tee "$RUN_OUTPUT_FILE"
  else
    "$REAL_BIN" "${cmd_args[@]}" 2>&1 | tee "$RUN_OUTPUT_FILE"
  fi
  local rc=${PIPESTATUS[0]}
  set -e
  return $rc
}

is_network_error() {
  local file="$1"
  local pattern="(timed out|timeout|context deadline exceeded|connection (reset|refused|aborted|closed|lost)|network is unreachable|temporary failure in name resolution|no such host|tls handshake timeout|i/o timeout|EOF|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|EAI_AGAIN|ENOTFOUND|dial tcp)"
  grep -E -i -q "$pattern" "$file"
}

attempt=1
max_attempts=$((retry_max + 1))
while true; do
  if [[ "$attempt" -gt 1 ]]; then
    echo "Supabase CLI retry stage ${attempt}/${max_attempts}..."
  fi

  if run_supabase_cli "$([[ "$attempt" -gt 1 ]] && echo true || echo false)"; then
    rm -f "$RUN_OUTPUT_FILE"
    break
  fi

  rc=$?
  if ! is_network_error "$RUN_OUTPUT_FILE"; then
    rm -f "$RUN_OUTPUT_FILE"
    exit $rc
  fi

  rm -f "$RUN_OUTPUT_FILE"

  if [[ "$attempt" -ge "$max_attempts" ]]; then
    echo "Supabase CLI failed after ${attempt} attempt(s) due to network error."
    exit $rc
  fi

  backoff_index=$((attempt - 1))
  if [[ "${#retry_backoff_list[@]}" -gt 0 ]]; then
    if [[ "$backoff_index" -ge "${#retry_backoff_list[@]}" ]]; then
      backoff_seconds="${retry_backoff_list[-1]}"
    else
      backoff_seconds="${retry_backoff_list[$backoff_index]}"
    fi
  else
    backoff_seconds=5
  fi

  if [[ ! "$backoff_seconds" =~ ^[0-9]+$ ]]; then
    backoff_seconds=5
  fi

  echo "Network error detected. Retrying in ${backoff_seconds}s with extended wait."
  sleep "$backoff_seconds"
  attempt=$((attempt + 1))
done

should_run_hooks=false
ARGS_TEXT=" ${SUPABASE_ARGS[*]:-} "
hook_list="${SHIM_HOOK_COMMANDS:-functions,db,migration}"
if matches_command_list "$hook_list" "$ARGS_TEXT"; then
  should_run_hooks=true
fi

resolve_hook_script() {
  local env_var="$1"
  local name="$2"
  local script=""
  script="${!env_var:-}"
  if [[ -n "$script" ]]; then
    if [[ "$script" != /* ]]; then
      script="$PROJECT_ROOT/$script"
    fi
    echo "$script"
    return
  fi
  if [[ -f "$PROJECT_ROOT/scripts/$name" ]]; then
    echo "$PROJECT_ROOT/scripts/$name"
    return
  fi
  if [[ -f "$WRAPPER_DIR/scripts/$name" ]]; then
    echo "$WRAPPER_DIR/scripts/$name"
    return
  fi
  echo ""
}

# SHIM_HOOK_CHECK_ORDER = aktivierte Hook-Checks aus My Checks (z. B. "healthPing,edgeLogs"). Fehlt die Var, laufen alle Hooks wie bisher.
hook_check_list="${SHIM_HOOK_CHECK_ORDER:-healthPing,edgeLogs}"
run_health_ping=false
run_edge_logs=false
if [[ "$hook_check_list" != "none" ]] && [[ "$hook_check_list" != "" ]]; then
  case "$hook_check_list" in
    *healthPing*) run_health_ping=true ;;
  esac
  case "$hook_check_list" in
    *edgeLogs*) run_edge_logs=true ;;
  esac
fi

if [[ "$RUN_HOOKS" = true ]] && [[ "$should_run_hooks" = true ]]; then
  if [[ "$run_health_ping" = true ]]; then
    PING_SCRIPT="$(resolve_hook_script SHIM_PING_SCRIPT ping-edge-health.sh)"
    if [[ -n "$PING_SCRIPT" ]]; then
      SHIM_PROJECT_ROOT="$PROJECT_ROOT" bash "$PING_SCRIPT" "${SUPABASE_ARGS[@]}" || true
    fi
  fi
  if [[ "$run_edge_logs" = true ]]; then
    LOG_SCRIPT="$(resolve_hook_script SHIM_LOG_SCRIPT fetch-edge-logs.sh)"
    if [[ -n "$LOG_SCRIPT" ]]; then
      SHIM_PROJECT_ROOT="$PROJECT_ROOT" bash "$LOG_SCRIPT" "${SUPABASE_ARGS[@]}" || true
    fi
  fi
fi

if [[ "$RUN_PUSH" = true ]] && command -v git >/dev/null 2>&1; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
      ahead=$(git rev-list --count @{u}..HEAD)
      if [[ "${ahead:-0}" -gt 0 ]]; then
        echo "Pushing commits to remote..."
        git push
      else
        echo "No commits to push."
      fi
    else
      echo "No upstream configured; skipping git push."
    fi
  fi
fi
