#!/usr/bin/env bash
# Shared checks for pre-push (GitHub) and supabase-checked (Supabase deploy).
# Usage: run-checks.sh [--frontend] [--backend] [--refactor|--until-95] [--no-frontend] [--no-backend] [--no-ai-review] [--no-explanation-check] ...
#   With no args: run frontend and backend checks (same as --frontend --backend). CHECK_MODE defaults to full (whole-codebase AI review).
#   --refactor / --until-95: force CHECK_MODE=full (chunked full scan). Use for refactor loops until all chunks ≥95%.
#   Pre-push should set CHECK_MODE=snippet so AI review only runs on pushed changes; run-checks.sh does not override CHECK_MODE if already set.
#   AI review runs by default; use --no-ai-review to disable (or SKIP_AI_REVIEW=1).
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

# Project root for .shimwrapper/checktools (consumer project when script runs from node_modules)
PROJECT_ROOT="${SHIM_PROJECT_ROOT:-$ROOT_DIR}"
CHECKTOOLS_BIN=""
if [[ -d "$PROJECT_ROOT/.shimwrapper/checktools/node_modules/.bin" ]]; then
  CHECKTOOLS_BIN="$PROJECT_ROOT/.shimwrapper/checktools/node_modules/.bin"
fi

run_frontend=false
run_backend=false
run_ai_review=true
run_explanation_check=true
run_i18n_check=true
run_sast=true
run_gitleaks=true
run_license_checker=true
run_architecture=true
run_mutation=true
run_ruff=true
run_shellcheck=true
run_refactor=false

if [[ $# -eq 0 ]]; then
  run_frontend=true
  run_backend=true
else
  for arg in "$@"; do
    case "$arg" in
      --frontend) run_frontend=true ;;
      --backend) run_backend=true ;;
      --refactor|--until-95) run_refactor=true ;;
      --no-frontend) run_frontend=false ;;
      --no-backend) run_backend=false ;;
      --no-ai-review) run_ai_review=false ;;
      --no-explanation-check) run_explanation_check=false ;;
      --no-i18n-check) run_i18n_check=false ;;
      --no-sast) run_sast=false ;;
      --no-gitleaks) run_gitleaks=false ;;
      --no-license-checker) run_license_checker=false ;;
      --no-architecture) run_architecture=false ;;
      --no-complexity) run_complexity=false ;;
      --no-mutation) run_mutation=false ;;
      --no-ruff) run_ruff=false ;;
      --no-shellcheck) run_shellcheck=false ;;
      *) echo "Unknown option: $arg. Use --frontend, --backend, --refactor, --until-95, --no-frontend, --no-backend, --no-ai-review, --no-explanation-check, --no-i18n-check, --no-sast, --no-gitleaks, --no-license-checker, --no-architecture, --no-complexity, --no-mutation, --no-ruff, --no-shellcheck." >&2; exit 1 ;;
    esac
  done
fi

# CHECK_MODE: only set if not already set (e.g. pre-push sets CHECK_MODE=snippet). Default full for manual/refactor runs.
[[ "$run_refactor" = true ]] && CHECK_MODE=full
export CHECK_MODE="${CHECK_MODE:-full}"
[[ "$CHECK_MODE" == "mix" ]] && CHECK_MODE=full
[[ "$CHECK_MODE" == "diff" ]] && CHECK_MODE=snippet

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
run_architecture_rc="${SHIM_RUN_ARCHITECTURE:-0}"
run_complexity_rc="${SHIM_RUN_COMPLEXITY:-0}"
run_mutation_rc="${SHIM_RUN_MUTATION:-0}"
run_ruff_rc="${SHIM_RUN_RUFF:-0}"
run_shellcheck_rc="${SHIM_RUN_SHELLCHECK:-0}"

# Wenn SHIM_CHECK_ORDER gesetzt ist: Checks genau in dieser Reihenfolge ausführen (wie in My Checks).
run_one() {
  local id="$1"
  case "$id" in
    prettier) [[ "$run_prettier" = "1" ]] && { echo "Prettier...";
      if [[ -n "$CHECKTOOLS_BIN" ]] && [[ -x "$CHECKTOOLS_BIN/prettier" ]]; then "$CHECKTOOLS_BIN/prettier" --check .;
      else (npm run format:check 2>/dev/null) || npx prettier --check .; fi; } ;;
    lint) [[ "$run_lint" = "1" ]] && { echo "Lint...";
      if [[ -n "$CHECKTOOLS_BIN" ]] && [[ -x "$CHECKTOOLS_BIN/eslint" ]]; then "$CHECKTOOLS_BIN/eslint" .;
      else npm run lint; fi; } ;;
    typecheck) [[ "$run_typecheck" = "1" ]] && { echo "TypeScript check...";
      if [[ -n "$CHECKTOOLS_BIN" ]] && [[ -x "$CHECKTOOLS_BIN/tsc" ]]; then "$CHECKTOOLS_BIN/tsc" --noEmit;
      else (npm run typecheck 2>/dev/null) || npx tsc --noEmit; fi; } ;;
    projectRules) [[ "$run_project_rules" = "1" ]] && { echo "Projektregeln...";
      if [[ -f "$ROOT_DIR/scripts/checks/project-rules.sh" ]]; then bash "$ROOT_DIR/scripts/checks/project-rules.sh";
      else echo "Skipping Projektregeln: scripts/checks/project-rules.sh not found." >&2; fi; } ;;
    checkMockData) [[ "$run_check_mock_data" = "1" ]] && { echo "Check mock data..."; npm run check:mock-data; } ;;
    testRun) [[ "$run_test_run" = "1" ]] && { echo "Test run...";
      if [[ -n "$CHECKTOOLS_BIN" ]] && [[ -x "$CHECKTOOLS_BIN/vite" ]] && [[ -x "$CHECKTOOLS_BIN/vitest" ]]; then "$CHECKTOOLS_BIN/vite" build && "$CHECKTOOLS_BIN/vitest" run;
      else npm run build; npm run test:run; fi; } ;;
    viteBuild) [[ "$run_vite_build" = "1" ]] && { echo "Vite build...";
      if [[ -n "$CHECKTOOLS_BIN" ]] && [[ -x "$CHECKTOOLS_BIN/vite" ]]; then "$CHECKTOOLS_BIN/vite" build;
      else npm run build; fi; } ;;
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
    architecture) if [[ "$run_architecture_rc" = "1" ]] && [[ "$run_architecture" = true ]]; then
            if [[ -f "$ROOT_DIR/.dependency-cruiser.json" ]]; then
              echo "Architecture (dependency-cruiser)...";
              depcruise_entry="src"; [[ -d "$ROOT_DIR/dashboard" ]] && [[ ! -d "$ROOT_DIR/src" ]] && depcruise_entry="dashboard";
              npx depcruise "$depcruise_entry" --output-type err;
            else echo "Skipping Architecture: .dependency-cruiser.json not found." >&2; fi; fi ;;
    complexity) if [[ "$run_complexity_rc" = "1" ]] && [[ "$run_complexity" = true ]]; then
            echo "Complexity (eslint-plugin-complexity)...";
            if [[ -f "$ROOT_DIR/eslint.complexity.json" ]]; then
              npx eslint . -c "$ROOT_DIR/eslint.complexity.json";
            elif [[ -f "$ROOT_DIR/node_modules/shimwrappercheck/templates/eslint.complexity.json" ]]; then
              npx eslint . -c "$ROOT_DIR/node_modules/shimwrappercheck/templates/eslint.complexity.json";
            else echo "Skipping Complexity: add eslint.complexity.json or install shimwrappercheck and eslint-plugin-complexity." >&2; fi; fi ;;
    mutation) if [[ "$run_mutation_rc" = "1" ]] && [[ "$run_mutation" = true ]]; then
            if [[ -f "$ROOT_DIR/stryker.config.json" ]]; then
              echo "Mutation (Stryker)..."; npx stryker run;
            else echo "Skipping Mutation: stryker.config.json not found." >&2; fi; fi ;;
    ruff) if [[ "$run_ruff_rc" = "1" ]] && [[ "$run_ruff" = true ]]; then
            if command -v ruff >/dev/null 2>&1; then
              has_py=$(find . -maxdepth 4 \( -name '*.py' -o -name 'pyproject.toml' -o -name 'requirements.txt' \) 2>/dev/null | head -1)
              if [[ -n "$has_py" ]]; then
                echo "Ruff (Python)..."; ruff check . && ruff format --check .;
              else echo "Skipping Ruff: no Python files, pyproject.toml or requirements.txt found." >&2; fi
            else echo "Skipping Ruff: not installed (e.g. pip install ruff, brew install ruff)." >&2; fi; fi ;;
    shellcheck) if [[ "$run_shellcheck_rc" = "1" ]] && [[ "$run_shellcheck" = true ]]; then
            if command -v shellcheck >/dev/null 2>&1; then
              shfiles=$(find . -name '*.sh' ! -path './node_modules/*' ! -path './.git/*' 2>/dev/null)
              if [[ -n "$shfiles" ]]; then
                echo "Shellcheck..."; echo "$shfiles" | xargs shellcheck;
              else echo "Skipping Shellcheck: no .sh files found." >&2; fi
            else echo "Skipping Shellcheck: not installed (e.g. brew install shellcheck)." >&2; fi; fi ;;
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
    [[ "$run_prettier" = "1" ]] && { echo "Prettier..."; if [[ -n "$CHECKTOOLS_BIN" ]] && [[ -x "$CHECKTOOLS_BIN/prettier" ]]; then "$CHECKTOOLS_BIN/prettier" --check .; else (npm run format:check 2>/dev/null) || npx prettier --check .; fi; }
    [[ "$run_lint" = "1" ]] && { echo "Lint..."; if [[ -n "$CHECKTOOLS_BIN" ]] && [[ -x "$CHECKTOOLS_BIN/eslint" ]]; then "$CHECKTOOLS_BIN/eslint" .; else npm run lint; fi; }
    [[ "$run_typecheck" = "1" ]] && { echo "TypeScript check..."; if [[ -n "$CHECKTOOLS_BIN" ]] && [[ -x "$CHECKTOOLS_BIN/tsc" ]]; then "$CHECKTOOLS_BIN/tsc" --noEmit; else (npm run typecheck 2>/dev/null) || npx tsc --noEmit; fi; }
    if     [[ "$run_project_rules" = "1" ]] && [[ -f "$ROOT_DIR/scripts/checks/project-rules.sh" ]]; then
      echo "Projektregeln..."; bash "$ROOT_DIR/scripts/checks/project-rules.sh";
    fi
    if [[ "$run_i18n_check_rc" = "1" ]] && [[ "$run_i18n_check" = true ]]; then
      if [[ -f "$ROOT_DIR/scripts/i18n-check.js" ]]; then echo "i18n check..."; node "$ROOT_DIR/scripts/i18n-check.js";
      else echo "Skipping i18n check: scripts/i18n-check.js not found." >&2; fi
    fi
    [[ "$run_check_mock_data" = "1" ]] && { echo "Check mock data..."; npm run check:mock-data; }
    if [[ "$run_vite_build" = "1" ]] || [[ "$run_test_run" = "1" ]]; then
      if [[ -n "$CHECKTOOLS_BIN" ]] && [[ -x "$CHECKTOOLS_BIN/vite" ]]; then
        [[ "$run_vite_build" = "1" ]] && { echo "Vite build..."; "$CHECKTOOLS_BIN/vite" build; }
        if [[ "$run_test_run" = "1" ]]; then
          echo "Test run..."
          [[ "$run_vite_build" != "1" ]] && "$CHECKTOOLS_BIN/vite" build
          if [[ -x "$CHECKTOOLS_BIN/vitest" ]]; then "$CHECKTOOLS_BIN/vitest" run; else npm run test:run; fi
        fi
      else
        [[ "$run_vite_build" = "1" ]] && echo "Vite build..."
        npm run build
        [[ "$run_test_run" = "1" ]] && { echo "Test run..."; npm run test:run; }
      fi
    fi
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

  if [[ "$run_ruff_rc" = "1" ]] && [[ "$run_ruff" = true ]] && command -v ruff >/dev/null 2>&1; then
    has_py=$(find . -maxdepth 4 \( -name '*.py' -o -name 'pyproject.toml' -o -name 'requirements.txt' \) 2>/dev/null | head -1)
    if [[ -n "$has_py" ]]; then
      echo "Ruff (Python)..."; ruff check . && ruff format --check .;
    fi
  fi
  if [[ "$run_shellcheck_rc" = "1" ]] && [[ "$run_shellcheck" = true ]] && command -v shellcheck >/dev/null 2>&1; then
    shfiles=$(find . -name '*.sh' ! -path './node_modules/*' ! -path './.git/*' 2>/dev/null)
    if [[ -n "$shfiles" ]]; then
      echo "Shellcheck..."; echo "$shfiles" | xargs shellcheck;
    fi
  fi
fi

if [[ "$run_ai_review" = true ]] && { [[ "$run_frontend" = true ]] || [[ "$run_backend" = true ]]; }; then
  bash "$ROOT_DIR/scripts/ai-code-review.sh"
fi

if [[ "$run_explanation_check" = true ]] && [[ "$run_explanation_check_rc" = "1" ]] && { [[ "$run_frontend" = true ]] || [[ "$run_backend" = true ]]; }; then
  bash "$ROOT_DIR/scripts/ai-explanation-check.sh"
fi
