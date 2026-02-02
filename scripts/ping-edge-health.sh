#!/usr/bin/env bash
# Ping deployed Edge Function health endpoints after deploy/push.
# Project ref: SUPABASE_PROJECT_REF env, or file supabase/project-ref (one line).
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

REF="${SUPABASE_PROJECT_REF:-}"
if [[ -z "$REF" ]] && [[ -f "$PROJECT_ROOT/supabase/project-ref" ]]; then
  REF="$(head -n1 "$PROJECT_ROOT/supabase/project-ref" | tr -d '\r\n' | tr -d ' ')"
fi

if [[ -z "$REF" ]]; then
  echo "Edge health: skipped (set SUPABASE_PROJECT_REF or create supabase/project-ref)"
  exit 0
fi

function_names=()
if [[ "$ARGS_TEXT" == *" functions "* ]] && [[ "$ARGS_TEXT" == *" deploy "* ]]; then
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

if [[ -n "${SHIM_HEALTH_FUNCTIONS:-}" ]]; then
  IFS=',' read -r -a extra_names <<< "${SHIM_HEALTH_FUNCTIONS}"
  for name in "${extra_names[@]}"; do
    name="$(echo "$name" | xargs)"
    [[ -n "$name" ]] && function_names+=("$name")
  done
fi

if [[ "${#function_names[@]}" -eq 0 ]]; then
  if [[ -z "${SHIM_DEFAULT_FUNCTION+x}" ]]; then
    default_fn="server"
  else
    default_fn="${SHIM_DEFAULT_FUNCTION}"
  fi
  if [[ -n "$default_fn" ]]; then
    function_names+=("$default_fn")
  else
    echo "Edge health: skipped (no function name detected; set SHIM_HEALTH_FUNCTIONS)"
    exit 0
  fi
fi

health_paths=()
if [[ -n "${SHIM_HEALTH_PATHS:-}" ]]; then
  IFS=',' read -r -a health_paths <<< "${SHIM_HEALTH_PATHS}"
else
  health_paths=("/functions/v1/{fn}/health" "/functions/v1/{fn}/{fn}/health")
fi

for fn in "${function_names[@]}"; do
  fn_ok=false
  last_code="000"
  last_url=""

  for path in "${health_paths[@]}"; do
    path_trimmed="$(echo "$path" | xargs)"
    [[ -z "$path_trimmed" ]] && continue
    if [[ "$path_trimmed" != *"{fn}"* ]]; then
      echo "Edge health: invalid SHIM_HEALTH_PATHS entry (missing {fn}): $path_trimmed" >&2
      continue
    fi
    url_path="${path_trimmed//\{fn\}/$fn}"
    url="https://${REF}.supabase.co${url_path}"
    code="$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 10 --max-time 15 "$url" 2>/dev/null || echo "000")"
    last_code="$code"
    last_url="$url"

    if [[ "$code" == "200" ]]; then
      fn_ok=true
      echo "Edge health: OK ($url)"
      break
    fi
  done

  if [[ "$fn_ok" != true ]]; then
    echo "Edge health: HTTP $last_code ($last_url)"
  fi
done

exit 0
