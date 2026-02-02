#!/usr/bin/env bash
# Template: customize checks for your repo.
# Usage: run-checks.sh [--frontend] [--backend] [--no-ai-review]
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
      --no-ai-review) run_ai_review=false ;;
      *) echo "Unknown option: $arg. Use --frontend, --backend, and/or --no-ai-review." >&2; exit 1 ;;
    esac
  done
fi

# Opt-out via env
[[ -n "${SKIP_AI_REVIEW:-}" ]] && run_ai_review=false

if [[ "$run_frontend" = true ]]; then
  echo "Running frontend checks..."
  # TODO: customize
  # npm run lint
  # npm run test:run
  # npm run build
  echo "(template) frontend checks completed"
fi

if [[ "$run_backend" = true ]]; then
  echo "Running backend checks..."
  # TODO: customize
  # deno fmt --check supabase/functions
  # deno lint supabase/functions
  echo "(template) backend checks completed"
fi

if [[ "$run_ai_review" = true ]] && [[ -x "$ROOT_DIR/scripts/ai-code-review.sh" ]]; then
  bash "$ROOT_DIR/scripts/ai-code-review.sh"
fi
