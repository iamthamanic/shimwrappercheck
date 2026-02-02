#!/usr/bin/env bash
# Fetch recent Edge Function logs after deploy (optional).
# Runs: supabase functions logs <function> --limit <n>
set -euo pipefail

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

ARGS=("$@")
ARGS_TEXT=" ${*:-} "

# Only fetch logs when we just deployed functions
if [[ "$ARGS_TEXT" != *" functions "* ]]; then
  exit 0
fi

function_names=()
if [[ "$ARGS_TEXT" == *" deploy "* ]]; then
  for i in "${!ARGS[@]}"; do
    if [[ "${ARGS[$i]}" == "deploy" ]]; then
      next_index=$((i + 1))
      if [[ $next_index -lt ${#ARGS[@]} ]]; then
        candidate="${ARGS[$next_index]}"
        if [[ -n "$candidate" ]] && [[ "$candidate" != -* ]]; then
          function_names+=("$candidate")
        fi
      fi
      break
    fi
  done
fi

if [[ -n "${SHIM_LOG_FUNCTIONS:-}" ]]; then
  IFS=',' read -r -a extra_names <<< "${SHIM_LOG_FUNCTIONS}"
  for name in "${extra_names[@]}"; do
    name="$(echo "$name" | xargs)"
    [[ -n "$name" ]] && function_names+=("$name")
  done
fi

if [[ "${#function_names[@]}" -eq 0 ]]; then
  echo "Edge logs: skipped (no function name detected; set SHIM_LOG_FUNCTIONS)"
  exit 0
fi

REAL_BIN="${SHIM_SUPABASE_BIN:-${SUPABASE_REAL_BIN:-}}"
if [[ -z "$REAL_BIN" ]] && [[ -f "$HOME/.supabase-real-bin" ]]; then
  REAL_BIN="$(cat "$HOME/.supabase-real-bin")"
fi
if [[ -z "$REAL_BIN" ]]; then
  REAL_BIN="$(command -v supabase || true)"
fi
if [[ -n "$REAL_BIN" ]] && { [[ "$REAL_BIN" == *"node_modules"* ]] || [[ "$REAL_BIN" == "$PROJECT_ROOT"* ]]; }; then
  REAL_BIN=""
fi

log_limit="${SHIM_LOG_LIMIT:-30}"
if ! [[ "$log_limit" =~ ^[0-9]+$ ]]; then
  log_limit=30
fi

for fn in "${function_names[@]}"; do
  echo "Edge logs ($fn):"
  if [[ -n "$REAL_BIN" ]] && [[ -x "$REAL_BIN" ]]; then
    "$REAL_BIN" functions logs "$fn" --limit "$log_limit" 2>/dev/null || true
  else
    npx --yes --package supabase supabase functions logs "$fn" --limit "$log_limit" 2>/dev/null || true
  fi
done

exit 0
