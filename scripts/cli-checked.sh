#!/usr/bin/env bash
# Generic CLI shim wrapper: run checks (optional), then call the real CLI.
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
CLI_NAME=""
CLI_ARGS=()
CHECKS_PASSTHROUGH=()

RUN_CHECKS=true
CHECKS_ONLY=false
FORCE_FRONTEND=false
RUN_PUSH=false

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

# Parse args: allow either `shim <cli> ...` or `shim --cli <cli> -- ...`
consume_cli=false
pass_through=false
for arg in "${ARGS_IN[@]}"; do
  if [[ "$arg" == "--" ]]; then
    pass_through=true
    continue
  fi

  if [[ "$pass_through" == true ]]; then
    if [[ -z "$CLI_NAME" ]]; then
      CLI_NAME="$arg"
    else
      CLI_ARGS+=("$arg")
    fi
    continue
  fi

  if [[ -z "$CLI_NAME" ]] && [[ "$arg" == "--cli" ]]; then
    consume_cli=true
    continue
  fi

  if [[ "$consume_cli" == true ]] && [[ -z "$CLI_NAME" ]]; then
    CLI_NAME="$arg"
    consume_cli=false
    continue
  fi

  if [[ -z "$CLI_NAME" ]] && [[ "$arg" != -* ]]; then
    CLI_NAME="$arg"
    continue
  fi

  case "$arg" in
    --no-checks) RUN_CHECKS=false ;;
    --checks-only) CHECKS_ONLY=true ;;
    --no-ai-review|--ai-review) CHECKS_PASSTHROUGH+=("$arg") ;;
    --with-frontend) FORCE_FRONTEND=true ;;
    --no-push) RUN_PUSH=false ;;
    --auto-push) RUN_PUSH=true ;;
    *) CLI_ARGS+=("$arg") ;;
  esac
done

[[ -n "${SHIM_DISABLE_CHECKS:-}" ]] && RUN_CHECKS=false
if [[ -n "${SHIM_CLI_AUTO_PUSH:-}" ]]; then
  case "${SHIM_CLI_AUTO_PUSH}" in
    1|true|TRUE|yes|YES) RUN_PUSH=true ;;
    0|false|FALSE|no|NO) RUN_PUSH=false ;;
  esac
fi

if [[ -z "$CLI_NAME" ]] && [[ "$CHECKS_ONLY" != true ]]; then
  echo "No CLI provided. Usage: shim <cli> [shim flags] <args>" >&2
  echo "or: shim --cli <cli> -- <args>" >&2
  exit 1
fi

ARGS_TEXT=" ${CLI_ARGS[*]:-} "
if [[ "$CHECKS_ONLY" != true ]]; then
  enforce_list="${SHIM_CLI_ENFORCE_COMMANDS:-${SHIM_ENFORCE_COMMANDS:-all}}"
  if ! matches_command_list "$enforce_list" "$ARGS_TEXT"; then
    RUN_CHECKS=false
  fi
fi

should_run_hooks=false
hook_list="${SHIM_CLI_HOOK_COMMANDS:-all}"
if matches_command_list "$hook_list" "$ARGS_TEXT"; then
  should_run_hooks=true
fi

resolve_hook_list() {
  local list="$1"
  local default_name="$2"
  local resolved=()

  if [[ -n "$list" ]]; then
    IFS=',' read -r -a items <<< "$list"
    for item in "${items[@]}"; do
      item="$(echo "$item" | xargs)"
      [[ -z "$item" ]] && continue
      if [[ "$item" != /* ]]; then
        item="$PROJECT_ROOT/$item"
      fi
      resolved+=("$item")
    done
  elif [[ -n "$default_name" ]] && [[ -f "$PROJECT_ROOT/scripts/$default_name" ]]; then
    resolved+=("$PROJECT_ROOT/scripts/$default_name")
  fi

  printf '%s\n' "${resolved[@]}"
}

resolve_checks_script() {
  local script="${SHIM_CLI_CHECKS_SCRIPT:-}"
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

  if [[ "$FORCE_FRONTEND" = true ]] || [[ "$ARGS_TEXT_RAW" == *" --with-frontend "* ]]; then
    run_frontend=true
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
      if [[ -n "${SHIM_CLI_CHECKS_ARGS:-}" ]]; then
        read -r -a CHECKS_ARGS <<< "${SHIM_CLI_CHECKS_ARGS}"
      elif [[ -n "${SHIM_CHECKS_ARGS:-}" ]]; then
        read -r -a CHECKS_ARGS <<< "${SHIM_CHECKS_ARGS}"
      fi
      [[ "$run_frontend" = true ]] && CHECKS_ARGS+=(--frontend)
      [[ "$run_backend" = true ]] && CHECKS_ARGS+=(--backend)
      [[ "$run_ai_review" = false ]] && CHECKS_ARGS+=(--no-ai-review)
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

REAL_BIN="${SHIM_CLI_REAL_BIN:-${SHIM_REAL_BIN:-}}"
if [[ -z "$REAL_BIN" ]]; then
  REAL_BIN="$(command -v "$CLI_NAME" || true)"
fi
if [[ -n "$REAL_BIN" ]] && { [[ "$REAL_BIN" == *"node_modules"* ]] || [[ "$REAL_BIN" == "$WRAPPER_DIR"* ]]; }; then
  REAL_BIN=""
fi

if [[ -z "$REAL_BIN" ]]; then
  echo "Real binary for '$CLI_NAME' not found. Set SHIM_CLI_REAL_BIN." >&2
  exit 1
fi

pre_hooks="$(resolve_hook_list "${SHIM_CLI_PRE_HOOKS:-}" "cli-pre-hook.sh")"
post_hooks="$(resolve_hook_list "${SHIM_CLI_POST_HOOKS:-}" "cli-post-hook.sh")"

if [[ "$should_run_hooks" = true ]] && [[ -n "$pre_hooks" ]]; then
  while IFS= read -r hook; do
    [[ -z "$hook" ]] && continue
    if [[ -f "$hook" ]]; then
      bash "$hook" "$CLI_NAME" "${CLI_ARGS[@]}"
    else
      echo "Pre-hook not found: $hook" >&2
    fi
  done <<< "$pre_hooks"
fi

set +e
if [[ "$(basename "$REAL_BIN")" == "$CLI_NAME" ]]; then
  "$REAL_BIN" "${CLI_ARGS[@]}"
else
  "$REAL_BIN" "$CLI_NAME" "${CLI_ARGS[@]}"
fi
CLI_RC=$?
set -e

if [[ $CLI_RC -ne 0 ]]; then
  exit $CLI_RC
fi

if [[ "$should_run_hooks" = true ]] && [[ -n "$post_hooks" ]]; then
  while IFS= read -r hook; do
    [[ -z "$hook" ]] && continue
    if [[ -f "$hook" ]]; then
      bash "$hook" "$CLI_NAME" "${CLI_ARGS[@]}" || true
    else
      echo "Post-hook not found: $hook" >&2
    fi
  done <<< "$post_hooks"
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
