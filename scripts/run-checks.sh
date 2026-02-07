#!/usr/bin/env bash
# Shared checks for pre-push (GitHub) and supabase-checked (Supabase deploy).
# Usage: run-checks.sh [--frontend] [--backend] [--no-frontend] [--no-backend] [--no-ai-review]
#   With no args: run frontend and backend checks (same as --frontend --backend).
#   With args: set what runs (e.g. --no-frontend --no-ai-review to run only backend, no AI review).
#   AI review runs by default after frontend/backend checks; use --no-ai-review to disable (or SKIP_AI_REVIEW=1).
# Includes security: npm audit (frontend), deno audit (backend). Optional: Snyk (frontend, skip with SKIP_SNYK=1).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

run_frontend=false
run_backend=false
run_ai_review=true

if [[ $# -eq 0 ]]; then
  run_frontend=true
  run_backend=true
else
  for arg in "$@"; do
    case "$arg" in
      --frontend) run_frontend=true ;;
      --backend) run_backend=true ;;
      --no-frontend) run_frontend=false ;;
      --no-backend) run_backend=false ;;
      --no-ai-review) run_ai_review=false ;;
      *) echo "Unknown option: $arg. Use --frontend, --backend, --no-frontend, --no-backend, and/or --no-ai-review." >&2; exit 1 ;;
    esac
  done
fi

# Opt-out via env: SKIP_AI_REVIEW=1 disables AI review
[[ -n "${SKIP_AI_REVIEW:-}" ]] && run_ai_review=false

# Granular toggles from .shimwrappercheckrc (SHIM_RUN_*=1|0). Default 1 when run_frontend/run_backend is true.
run_lint="${SHIM_RUN_LINT:-1}"
run_check_mock_data="${SHIM_RUN_CHECK_MOCK_DATA:-1}"
run_test_run="${SHIM_RUN_TEST_RUN:-1}"
run_npm_audit="${SHIM_RUN_NPM_AUDIT:-1}"
run_snyk="${SHIM_RUN_SNYK:-1}"
run_deno_fmt="${SHIM_RUN_DENO_FMT:-1}"
run_deno_lint="${SHIM_RUN_DENO_LINT:-1}"
run_deno_audit="${SHIM_RUN_DENO_AUDIT:-1}"

# Wenn SHIM_CHECK_ORDER gesetzt ist: Checks genau in dieser Reihenfolge ausführen (wie in My Checks).
run_one() {
  local id="$1"
  case "$id" in
    lint) [[ "$run_lint" = "1" ]] && { echo "Lint..."; npm run lint; } ;;
    checkMockData) [[ "$run_check_mock_data" = "1" ]] && { echo "Check mock data..."; npm run check:mock-data; } ;;
    testRun) [[ "$run_test_run" = "1" ]] && { echo "Test run..."; npm run build; npm run test:run; } ;;
    npmAudit) [[ "$run_npm_audit" = "1" ]] && { echo "npm audit..."; npm audit --audit-level="${SHIM_AUDIT_LEVEL:-high}"; } ;;
    snyk) if [[ "$run_snyk" = "1" ]] && [[ -z "${SKIP_SNYK:-}" ]]; then
            if command -v snyk >/dev/null 2>&1; then echo "Snyk..."; snyk test;
            elif npm exec --yes snyk -- --version >/dev/null 2>&1; then echo "Snyk..."; npx snyk test;
            else echo "Skipping Snyk: not installed." >&2; fi
          fi ;;
    denoFmt) [[ "$run_deno_fmt" = "1" ]] && { echo "Deno fmt..."; deno fmt --check supabase/functions; } ;;
    denoLint) [[ "$run_deno_lint" = "1" ]] && { echo "Deno lint..."; deno lint supabase/functions; } ;;
    denoAudit) [[ "$run_deno_audit" = "1" ]] && { echo "Deno audit..."; (cd supabase/functions/server && deno audit); } ;;
    aiReview) [[ "$run_ai_review" = true ]] && { echo "AI Review..."; bash "$ROOT_DIR/scripts/ai-code-review.sh"; } ;;
    *) echo "Unknown check id: $id" >&2 ;;
  esac
}

if [[ -n "${SHIM_CHECK_ORDER:-}" ]]; then
  echo "Running checks in My Checks order..."
  for id in $(echo "$SHIM_CHECK_ORDER" | tr ',' ' '); do
    run_one "$id"
  done
else
  if [[ "$run_frontend" = true ]]; then
    echo "Running frontend checks..."
    [[ "$run_lint" = "1" ]] && { echo "Lint..."; npm run lint; }
    [[ "$run_check_mock_data" = "1" ]] && { echo "Check mock data..."; npm run check:mock-data; }
    npm run build
    [[ "$run_test_run" = "1" ]] && { echo "Test run..."; npm run test:run; }
    if [[ "$run_npm_audit" = "1" ]]; then
      echo "Running frontend security (npm audit)..."
      npm audit --audit-level="${SHIM_AUDIT_LEVEL:-high}"
    fi
    if [[ "$run_snyk" = "1" ]] && [[ -z "${SKIP_SNYK:-}" ]]; then
      if command -v snyk >/dev/null 2>&1; then
        echo "Running Snyk (dependency scan)..."
        snyk test
      elif npm exec --yes snyk -- --version >/dev/null 2>&1; then
        echo "Running Snyk (dependency scan)..."
        npx snyk test
      else
        echo "Skipping Snyk: not installed (optional; set SKIP_SNYK=1 to suppress)." >&2
      fi
    fi
  fi

  if [[ "$run_backend" = true ]]; then
    echo "Running Supabase edge function checks..."
    [[ "$run_deno_fmt" = "1" ]] && { echo "Deno fmt..."; deno fmt --check supabase/functions; }
    [[ "$run_deno_lint" = "1" ]] && { echo "Deno lint..."; deno lint supabase/functions; }
    if [[ "$run_deno_audit" = "1" ]]; then
      echo "Running backend security (deno audit)..."
      (cd supabase/functions/server && deno audit)
    fi
  fi
fi

if [[ "$run_ai_review" = true ]] && { [[ "$run_frontend" = true ]] || [[ "$run_backend" = true ]]; }; then
  bash "$ROOT_DIR/scripts/ai-code-review.sh"
fi
