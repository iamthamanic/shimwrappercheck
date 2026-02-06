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

if [[ "$run_frontend" = true ]]; then
  echo "Running frontend checks..."
  npm run lint
  npm run check:mock-data
  npm run build
  npm run test:run
  echo "Running frontend security (npm audit)..."
  npm audit --audit-level=high
  if [[ -z "${SKIP_SNYK:-}" ]]; then
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
  deno fmt --check supabase/functions
  deno lint supabase/functions
  echo "Running backend security (deno audit)..."
  (cd supabase/functions/server && deno audit)
fi

if [[ "$run_ai_review" = true ]] && { [[ "$run_frontend" = true ]] || [[ "$run_backend" = true ]]; }; then
  bash "$ROOT_DIR/scripts/ai-code-review.sh"
fi
