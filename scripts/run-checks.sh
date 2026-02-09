#!/usr/bin/env bash
# Shared checks for pre-push (GitHub) and supabase-checked (Supabase deploy).
# Usage: run-checks.sh [--frontend] [--backend] [--no-frontend] [--no-backend] [--no-ai-review] [--no-explanation-check]
#   With no args: run frontend and backend checks (same as --frontend --backend).
#   With args: set what runs (e.g. --no-frontend --no-ai-review to run only backend, no AI review).
#   AI review runs by default after frontend/backend checks; use --no-ai-review to disable (or SKIP_AI_REVIEW=1).
#   Full Explanation check runs by default after AI review; use --no-explanation-check to disable (or SKIP_EXPLANATION_CHECK=1).
# Includes security: npm audit (frontend), deno audit (backend). Optional: Snyk (frontend, skip with SKIP_SNYK=1).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Load .shimwrappercheckrc so CHECK_MODE, SHIM_AI_*, SHIM_RUN_* etc. are set (e.g. when dashboard runs this script)
if [[ -f "$ROOT_DIR/.shimwrappercheckrc" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$ROOT_DIR/.shimwrappercheckrc" 2>/dev/null || true
  set +a
fi

run_frontend=false
run_backend=false
run_ai_review=true
run_explanation_check=true
run_i18n_check=true
run_sast=true
run_gitleaks=true
run_license_checker=true

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
      --no-explanation-check) run_explanation_check=false ;;
      --no-i18n-check) run_i18n_check=false ;;
      --no-sast) run_sast=false ;;
      --no-gitleaks) run_gitleaks=false ;;
      --no-license-checker) run_license_checker=false ;;
      *) echo "Unknown option: $arg. Use --frontend, --backend, --no-frontend, --no-backend, --no-ai-review, --no-explanation-check, --no-i18n-check, --no-sast, --no-gitleaks, --no-license-checker." >&2; exit 1 ;;
    esac
  done
fi

# Opt-out via env: SKIP_AI_REVIEW=1 disables AI review; SKIP_EXPLANATION_CHECK=1 disables Full Explanation check
[[ -n "${SKIP_AI_REVIEW:-}" ]] && run_ai_review=false
[[ -n "${SKIP_EXPLANATION_CHECK:-}" ]] && run_explanation_check=false
[[ -n "${SKIP_I18N_CHECK:-}" ]] && run_i18n_check=false

# Granular toggles from .shimwrappercheckrc (SHIM_RUN_*=1|0). Default 1 when run_frontend/run_backend is true.
run_prettier="${SHIM_RUN_PRETTIER:-1}"
run_lint="${SHIM_RUN_LINT:-1}"
run_typecheck="${SHIM_RUN_TYPECHECK:-1}"
run_project_rules="${SHIM_RUN_PROJECT_RULES:-1}"
run_check_mock_data="${SHIM_RUN_CHECK_MOCK_DATA:-1}"
run_test_run="${SHIM_RUN_TEST_RUN:-1}"
run_vite_build="${SHIM_RUN_VITE_BUILD:-1}"
run_npm_audit="${SHIM_RUN_NPM_AUDIT:-1}"
run_snyk="${SHIM_RUN_SNYK:-1}"
run_deno_fmt="${SHIM_RUN_DENO_FMT:-1}"
run_deno_lint="${SHIM_RUN_DENO_LINT:-1}"
run_deno_audit="${SHIM_RUN_DENO_AUDIT:-1}"
run_update_readme="${SHIM_RUN_UPDATE_README:-1}"
run_explanation_check_rc="${SHIM_RUN_EXPLANATION_CHECK:-1}"
run_i18n_check_rc="${SHIM_RUN_I18N_CHECK:-1}"
run_sast_rc="${SHIM_RUN_SAST:-0}"
run_gitleaks_rc="${SHIM_RUN_GITLEAKS:-0}"
run_license_checker_rc="${SHIM_RUN_LICENSE_CHECKER:-0}"

# Wenn SHIM_CHECK_ORDER gesetzt ist: Checks genau in dieser Reihenfolge ausführen (wie in My Checks).
run_one() {
  local id="$1"
  case "$id" in
    prettier) [[ "$run_prettier" = "1" ]] && { echo "Prettier...";
      (npm run format:check 2>/dev/null) || npx prettier --check .; } ;;
    lint) [[ "$run_lint" = "1" ]] && { echo "Lint..."; npm run lint; } ;;
    typecheck) [[ "$run_typecheck" = "1" ]] && { echo "TypeScript check...";
      (npm run typecheck 2>/dev/null) || npx tsc --noEmit; } ;;
    projectRules) [[ "$run_project_rules" = "1" ]] && { echo "Projektregeln...";
      if [[ -f "$ROOT_DIR/scripts/checks/project-rules.sh" ]]; then bash "$ROOT_DIR/scripts/checks/project-rules.sh";
      else echo "Skipping Projektregeln: scripts/checks/project-rules.sh not found." >&2; fi; } ;;
    checkMockData) [[ "$run_check_mock_data" = "1" ]] && { echo "Check mock data..."; npm run check:mock-data; } ;;
    testRun) [[ "$run_test_run" = "1" ]] && { echo "Test run..."; npm run build; npm run test:run; } ;;
    viteBuild) [[ "$run_vite_build" = "1" ]] && { echo "Vite build..."; npm run build; } ;;
    npmAudit) [[ "$run_npm_audit" = "1" ]] && { echo "npm audit..."; npm audit --audit-level="${SHIM_AUDIT_LEVEL:-high}"; } ;;
    snyk) if [[ "$run_snyk" = "1" ]] && [[ -z "${SKIP_SNYK:-}" ]]; then
            if command -v snyk >/dev/null 2>&1; then echo "Snyk..."; snyk test;
            elif npm exec --yes snyk -- --version >/dev/null 2>&1; then echo "Snyk..."; npx snyk test;
            else echo "Skipping Snyk: not installed." >&2; fi
          fi ;;
    denoFmt) [[ "$run_deno_fmt" = "1" ]] && { if [[ -d "$ROOT_DIR/supabase/functions" ]]; then echo "Deno fmt..."; deno fmt --check supabase/functions; else echo "Skipping Deno fmt: supabase/functions not found." >&2; fi; } ;;
    denoLint) [[ "$run_deno_lint" = "1" ]] && { if [[ -d "$ROOT_DIR/supabase/functions" ]]; then echo "Deno lint..."; deno lint supabase/functions; else echo "Skipping Deno lint: supabase/functions not found." >&2; fi; } ;;
    denoAudit) [[ "$run_deno_audit" = "1" ]] && { if [[ -d "$ROOT_DIR/supabase/functions" ]]; then echo "Deno audit..."; (cd supabase/functions/server && deno audit); else echo "Skipping Deno audit: supabase/functions not found." >&2; fi; } ;;
    aiReview) [[ "$run_ai_review" = true ]] && { echo "AI Review..."; bash "$ROOT_DIR/scripts/ai-code-review.sh"; } ;;
    explanationCheck) [[ "$run_explanation_check_rc" = "1" ]] && [[ "$run_explanation_check" = true ]] && { echo "Full Explanation check..."; bash "$ROOT_DIR/scripts/ai-explanation-check.sh"; } ;;
    i18nCheck) [[ "$run_i18n_check_rc" = "1" ]] && [[ "$run_i18n_check" = true ]] && { echo "i18n check..."; node "$ROOT_DIR/scripts/i18n-check.js"; } ;;
    updateReadme) [[ "$run_update_readme" = "1" ]] && { echo "Update README...";
      if [[ -f "$ROOT_DIR/node_modules/shimwrappercheck/scripts/update-readme.js" ]]; then node "$ROOT_DIR/node_modules/shimwrappercheck/scripts/update-readme.js";
      elif [[ -f "$ROOT_DIR/scripts/update-readme.js" ]]; then node "$ROOT_DIR/scripts/update-readme.js";
      else echo "Skipping Update README: no scripts/update-readme.js (use shimwrappercheck script or add own)." >&2; fi; } ;;
    sast) if [[ "$run_sast_rc" = "1" ]] && [[ "$run_sast" = true ]]; then
            echo "Semgrep..."; if command -v semgrep >/dev/null 2>&1; then semgrep scan --config auto . --error --no-git-ignore;
            elif npm exec --yes semgrep -- --version >/dev/null 2>&1; then npx semgrep scan --config auto . --error --no-git-ignore;
            else echo "Skipping Semgrep: not installed (pip install semgrep or npx semgrep)." >&2; fi; fi ;;
    gitleaks) if [[ "$run_gitleaks_rc" = "1" ]] && [[ "$run_gitleaks" = true ]]; then
            echo "Gitleaks..."; if command -v gitleaks >/dev/null 2>&1; then
              gitleaks_opts="detect --no-git --source . --verbose"; [[ -f "$ROOT_DIR/.gitleaks.toml" ]] && gitleaks_opts="detect --config $ROOT_DIR/.gitleaks.toml --no-git --source . --verbose"; gitleaks $gitleaks_opts;
            else echo "Skipping Gitleaks: not installed (e.g. brew install gitleaks)." >&2; fi; fi ;;
    licenseChecker) if [[ "$run_license_checker_rc" = "1" ]] && [[ "$run_license_checker" = true ]]; then
            echo "license-checker..."; npx license-checker --summary 2>/dev/null || true; fi ;;
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
    if [[ "$run_update_readme" = "1" ]]; then
      echo "Update README..."
      if [[ -f "$ROOT_DIR/node_modules/shimwrappercheck/scripts/update-readme.js" ]]; then node "$ROOT_DIR/node_modules/shimwrappercheck/scripts/update-readme.js";
      elif [[ -f "$ROOT_DIR/scripts/update-readme.js" ]]; then node "$ROOT_DIR/scripts/update-readme.js";
      else echo "Skipping Update README: no scripts/update-readme.js (use shimwrappercheck script or add own)." >&2; fi
    fi
    [[ "$run_prettier" = "1" ]] && { echo "Prettier..."; (npm run format:check 2>/dev/null) || npx prettier --check .; }
    [[ "$run_lint" = "1" ]] && { echo "Lint..."; npm run lint; }
    [[ "$run_typecheck" = "1" ]] && { echo "TypeScript check..."; (npm run typecheck 2>/dev/null) || npx tsc --noEmit; }
    if     [[ "$run_project_rules" = "1" ]] && [[ -f "$ROOT_DIR/scripts/checks/project-rules.sh" ]]; then
      echo "Projektregeln..."; bash "$ROOT_DIR/scripts/checks/project-rules.sh";
    fi
    if [[ "$run_i18n_check_rc" = "1" ]] && [[ "$run_i18n_check" = true ]]; then
      if [[ -f "$ROOT_DIR/scripts/i18n-check.js" ]]; then echo "i18n check..."; node "$ROOT_DIR/scripts/i18n-check.js";
      else echo "Skipping i18n check: scripts/i18n-check.js not found." >&2; fi
    fi
    [[ "$run_check_mock_data" = "1" ]] && { echo "Check mock data..."; npm run check:mock-data; }
    if [[ "$run_vite_build" = "1" ]] || [[ "$run_test_run" = "1" ]]; then
      [[ "$run_vite_build" = "1" ]] && echo "Vite build..."
      npm run build
    fi
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

  if [[ "$run_backend" = true ]] && [[ -d "$ROOT_DIR/supabase/functions" ]]; then
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

if [[ "$run_explanation_check" = true ]] && [[ "$run_explanation_check_rc" = "1" ]] && { [[ "$run_frontend" = true ]] || [[ "$run_backend" = true ]]; }; then
  bash "$ROOT_DIR/scripts/ai-explanation-check.sh"
fi
