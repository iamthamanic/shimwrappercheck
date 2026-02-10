/**
 * GET /api/check-tools – scan project for tools required by each check (package.json, deno in PATH).
 * Returns per-check status and optional install command for copy-paste.
 */
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { getProjectRoot } from "@/lib/projectRoot";

export type ToolStatus = { installed: boolean; label?: string; command?: string; repo?: string };

function hasDep(
  pkg: { devDependencies?: Record<string, string>; dependencies?: Record<string, string> },
  names: string[]
): boolean {
  const dev = { ...pkg.devDependencies, ...pkg.dependencies };
  const keys = Object.keys(dev);
  return names.some(
    (n) => keys.includes(n) || keys.some((k) => k === n || k.startsWith(n + "/") || k.startsWith("@" + n))
  );
}

function hasScript(pkg: { scripts?: Record<string, string> }, name: string): boolean {
  return !!pkg.scripts?.[name];
}

/** Returns the first dependency name that exists (as key or key prefix). */
function whichDep(
  pkg: { devDependencies?: Record<string, string>; dependencies?: Record<string, string> },
  candidates: { dep: string; label: string }[]
): string | null {
  const dev = { ...pkg.devDependencies, ...pkg.dependencies };
  const keys = Object.keys(dev);
  for (const { dep, label } of candidates) {
    if (keys.some((k) => k === dep || k.startsWith(dep + "/") || k.startsWith("@" + dep))) return label;
  }
  return null;
}

export async function GET() {
  try {
    const root = getProjectRoot();
    const pkgPath = path.join(root, "package.json");
    let pkg: {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    } = {};
    if (fs.existsSync(pkgPath)) {
      try {
        pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      } catch {
        // ignore
      }
    }

    let denoInPath = false;
    try {
      execSync("which deno", { encoding: "utf8" });
      denoInPath = true;
    } catch {
      // deno not in PATH
    }

    const tools: Record<string, ToolStatus> = {};

    const dashboardPkgPath = path.join(root, "dashboard", "package.json");
    let dashboardPkg: {
      devDependencies?: Record<string, string>;
      dependencies?: Record<string, string>;
      scripts?: Record<string, string>;
    } = {};
    if (fs.existsSync(dashboardPkgPath)) {
      try {
        dashboardPkg = JSON.parse(fs.readFileSync(dashboardPkgPath, "utf8"));
      } catch {
        // ignore
      }
    }

    // lint: npm run lint → eslint / biome (genauer Toolname)
    const lintTool =
      whichDep(pkg, [
        { dep: "eslint", label: "ESLint" },
        { dep: "@eslint/core", label: "ESLint" },
        { dep: "biome", label: "Biome" },
      ]) ??
      whichDep(dashboardPkg, [
        { dep: "eslint", label: "ESLint" },
        { dep: "@eslint/core", label: "ESLint" },
        { dep: "biome", label: "Biome" },
      ]);
    const lintOk = !!lintTool || hasScript(pkg, "lint") || hasScript(dashboardPkg, "lint");
    tools.lint = lintOk
      ? {
          installed: true,
          label: lintTool ? `${lintTool} erkannt` : "Lint-Script erkannt",
          repo: lintTool === "Biome" ? "https://github.com/biomejs/biome" : "https://github.com/eslint/eslint",
        }
      : {
          installed: false,
          label: "Kein Linter gefunden",
          command: "npm i -D eslint",
          repo: "https://github.com/eslint/eslint",
        };

    // prettier: root or dashboard (monorepo)
    const prettierOk =
      hasDep(pkg, ["prettier"]) ||
      hasScript(pkg, "format") ||
      hasScript(pkg, "format:check") ||
      hasDep(dashboardPkg, ["prettier"]) ||
      hasScript(dashboardPkg, "format:check");
    tools.prettier = prettierOk
      ? { installed: true, label: "Prettier erkannt", repo: "https://github.com/prettier/prettier" }
      : {
          installed: false,
          label: "Prettier nicht gefunden",
          command: "npm i -D prettier",
          repo: "https://github.com/prettier/prettier",
        };

    // typecheck: root or dashboard (monorepo)
    const typecheckOk =
      (hasDep(pkg, ["typescript"]) && (hasScript(pkg, "typecheck") || hasScript(pkg, "type-check"))) ||
      hasScript(pkg, "typecheck") ||
      (hasDep(dashboardPkg, ["typescript"]) &&
        (hasScript(dashboardPkg, "typecheck") || hasScript(dashboardPkg, "type-check")));
    tools.typecheck = typecheckOk
      ? { installed: true, label: "TypeScript erkannt", repo: "https://github.com/microsoft/TypeScript" }
      : {
          installed: false,
          label: "TypeScript oder typecheck-Script fehlt",
          command: "npm i -D typescript",
          repo: "https://github.com/microsoft/TypeScript",
        };

    // checkMockData: script check:mock-data
    const mockOk = hasScript(pkg, "check:mock-data");
    tools.checkMockData = mockOk
      ? { installed: true, label: "check:mock-data-Script erkannt" }
      : {
          installed: false,
          label: "Script fehlt",
          command: 'Füge in package.json unter "scripts": "check:mock-data": "..." hinzu',
        };

    // testRun: jest / vitest / mocha (genauer Toolname)
    const testTool =
      whichDep(pkg, [
        { dep: "vitest", label: "Vitest" },
        { dep: "jest", label: "Jest" },
        { dep: "@jest/core", label: "Jest" },
        { dep: "mocha", label: "Mocha" },
      ]) ??
      whichDep(dashboardPkg, [
        { dep: "vitest", label: "Vitest" },
        { dep: "jest", label: "Jest" },
        { dep: "@jest/core", label: "Jest" },
        { dep: "mocha", label: "Mocha" },
      ]);
    const testOk = !!testTool || hasScript(pkg, "test") || hasScript(pkg, "test:run");
    const testRepo =
      testTool === "Jest"
        ? "https://github.com/jestjs/jest"
        : testTool === "Mocha"
          ? "https://github.com/mochajs/mocha"
          : "https://github.com/vitest-dev/vitest";
    tools.testRun = testOk
      ? {
          installed: true,
          label: testTool ? `${testTool} erkannt` : "Test-Script erkannt",
          repo: testRepo,
        }
      : {
          installed: false,
          label: "Kein Test-Runner gefunden",
          command: "npm i -D vitest",
          repo: "https://github.com/vitest-dev/vitest",
        };

    // projectRules: scripts/checks/project-rules.sh
    const projectRulesPath = path.join(root, "scripts", "checks", "project-rules.sh");
    tools.projectRules = fs.existsSync(projectRulesPath)
      ? { installed: true, label: "project-rules.sh erkannt" }
      : {
          installed: false,
          label: "Skript fehlt",
          command: "Erstelle scripts/checks/project-rules.sh (ausführbar)",
        };

    // npmAudit: built-in
    tools.npmAudit = { installed: true, label: "npm audit erkannt", repo: "https://github.com/npm/cli" };

    // viteBuild: Vite oder nur build-Script
    const viteOk = hasDep(pkg, ["vite"]) || hasScript(pkg, "build") || hasDep(dashboardPkg, ["vite"]);
    tools.viteBuild = viteOk
      ? {
          installed: true,
          label: hasDep(pkg, ["vite"]) || hasDep(dashboardPkg, ["vite"]) ? "Vite erkannt" : "Build-Script erkannt",
          repo: "https://github.com/vitejs/vite",
        }
      : {
          installed: false,
          label: "Vite/build nicht gefunden",
          command: "npm i -D vite",
          repo: "https://github.com/vitejs/vite",
        };

    // snyk
    const snykOk = hasDep(pkg, ["snyk"]);
    tools.snyk = snykOk
      ? { installed: true, label: "Snyk erkannt", repo: "https://github.com/snyk/cli" }
      : {
          installed: false,
          label: "Snyk nicht installiert (optional)",
          command: "npm i -D snyk",
          repo: "https://github.com/snyk/cli",
        };

    // deno*
    const denoLabel = denoInPath ? "Deno erkannt" : "Deno nicht im PATH";
    const denoCmd = "Installation: https://deno.land";
    const denoRepo = "https://github.com/denoland/deno";
    tools.denoFmt = denoInPath
      ? { installed: true, label: denoLabel, repo: denoRepo }
      : { installed: false, label: denoLabel, command: denoCmd, repo: denoRepo };
    tools.denoLint = denoInPath
      ? { installed: true, label: denoLabel, repo: denoRepo }
      : { installed: false, label: denoLabel, command: denoCmd, repo: denoRepo };
    tools.denoAudit = denoInPath
      ? { installed: true, label: denoLabel, repo: denoRepo }
      : { installed: false, label: denoLabel, command: denoCmd, repo: denoRepo };

    // aiReview: no single package; script/Codex
    tools.aiReview = { installed: true, label: "Skript/Codex" };

    // explanationCheck: script/Codex (ai-explanation-check.sh)
    tools.explanationCheck = { installed: true, label: "Skript/Codex (ai-explanation-check.sh)" };

    // i18nCheck: scripts/i18n-check.js
    const i18nCheckInProject = fs.existsSync(path.join(root, "scripts", "i18n-check.js"));
    const i18nCheckInPkg = fs.existsSync(
      path.join(root, "node_modules", "shimwrappercheck", "scripts", "i18n-check.js")
    );
    tools.i18nCheck =
      i18nCheckInProject || i18nCheckInPkg
        ? { installed: true, label: "i18n-Check (scripts/i18n-check.js) erkannt" }
        : { installed: false, label: "Skript fehlt", command: "scripts/i18n-check.js" };

    // updateReadme: script from package or project
    const updateReadmeInPkg = fs.existsSync(
      path.join(root, "node_modules", "shimwrappercheck", "scripts", "update-readme.js")
    );
    const updateReadmeInProject = fs.existsSync(path.join(root, "scripts", "update-readme.js"));
    tools.updateReadme =
      updateReadmeInPkg || updateReadmeInProject
        ? { installed: true, label: "Update-README-Skript erkannt" }
        : {
            installed: false,
            label: "Skript fehlt",
            command:
              "Wird von run-checks aus node_modules/shimwrappercheck/scripts/ ausgeführt, wenn das Paket installiert ist",
          };

    // Semgrep (SAST)
    let semgrepInstalled = false;
    try {
      execSync("which semgrep", { encoding: "utf8", stdio: "pipe" });
      semgrepInstalled = true;
    } catch {
      try {
        execSync("npm exec --yes semgrep -- --version", { cwd: root, stdio: "pipe" });
        semgrepInstalled = true;
      } catch {
        // not installed
      }
    }
    tools.sast = semgrepInstalled
      ? { installed: true, label: "Semgrep erkannt", repo: "https://github.com/semgrep/semgrep" }
      : {
          installed: false,
          label: "Semgrep",
          command: "pip install semgrep oder npx semgrep",
          repo: "https://github.com/semgrep/semgrep",
        };

    // Gitleaks
    let gitleaksInstalled = false;
    try {
      execSync("which gitleaks", { encoding: "utf8", stdio: "pipe" });
      gitleaksInstalled = true;
    } catch {
      // not in PATH
    }
    tools.gitleaks = gitleaksInstalled
      ? { installed: true, label: "Gitleaks erkannt", repo: "https://github.com/gitleaks/gitleaks" }
      : {
          installed: false,
          label: "Gitleaks",
          command: "z. B. brew install gitleaks",
          repo: "https://github.com/gitleaks/gitleaks",
        };

    // license-checker (npx)
    let licenseCheckerInstalled = false;
    try {
      execSync("npx license-checker --version", { cwd: root, stdio: "pipe" });
      licenseCheckerInstalled = true;
    } catch {
      // npx will install on first run
    }
    tools.licenseChecker = licenseCheckerInstalled
      ? { installed: true, label: "license-checker erkannt", repo: "https://github.com/davglass/license-checker" }
      : {
          installed: false,
          label: "license-checker",
          command: "npx license-checker",
          repo: "https://github.com/davglass/license-checker",
        };

    // Architecture: dependency-cruiser (npx depcruise)
    const hasDepcruiseConfig = fs.existsSync(path.join(root, ".dependency-cruiser.json"));
    let depcruiseAvailable = false;
    try {
      execSync("npx depcruise --version", { cwd: root, stdio: "pipe" });
      depcruiseAvailable = true;
    } catch {
      // npx will install on first run
    }
    const depcruiseRepo = "https://github.com/dependency-cruiser/dependency-cruiser";
    tools.architecture =
      hasDepcruiseConfig && depcruiseAvailable
        ? { installed: true, label: "dependency-cruiser erkannt", repo: depcruiseRepo }
        : hasDepcruiseConfig
          ? {
              installed: false,
              label: "dependency-cruiser",
              command: "npx depcruise (Config vorhanden)",
              repo: depcruiseRepo,
            }
          : {
              installed: false,
              label: "dependency-cruiser",
              command: ".dependency-cruiser.json anlegen (z. B. aus templates/)",
              repo: depcruiseRepo,
            };

    // Complexity: eslint-plugin-complexity + eslint.complexity.json
    const hasComplexityConfig =
      fs.existsSync(path.join(root, "eslint.complexity.json")) ||
      fs.existsSync(path.join(root, "node_modules", "shimwrappercheck", "templates", "eslint.complexity.json"));
    tools.complexity = hasComplexityConfig
      ? { installed: true, label: "eslint-plugin-complexity erkannt", repo: "https://github.com/eslint/eslint" }
      : {
          installed: false,
          label: "eslint-plugin-complexity",
          command: "eslint.complexity.json anlegen oder templates/ nutzen",
          repo: "https://github.com/eslint/eslint",
        };

    // Mutation: Stryker
    const hasStrykerConfig = fs.existsSync(path.join(root, "stryker.config.json"));
    let strykerAvailable = false;
    try {
      execSync("npx stryker --version", { cwd: root, stdio: "pipe" });
      strykerAvailable = true;
    } catch {
      // npx will install on first run
    }
    const strykerRepo = "https://github.com/stryker-mutator/stryker-js";
    tools.mutation =
      hasStrykerConfig && strykerAvailable
        ? { installed: true, label: "Stryker erkannt", repo: strykerRepo }
        : hasStrykerConfig
          ? {
              installed: false,
              label: "Stryker",
              command: "npx @stryker-mutator/core (Config vorhanden)",
              repo: strykerRepo,
            }
          : {
              installed: false,
              label: "Stryker",
              command: "stryker.config.json anlegen (z. B. aus templates/)",
              repo: strykerRepo,
            };

    tools.e2e = {
      installed: true,
      label: "E2E optional (z. B. Playwright)",
      repo: "https://github.com/microsoft/playwright",
    };

    // Hooks: keine lokale Tool-Installation
    tools.healthPing = { installed: true, label: "Supabase/Shell" };
    tools.edgeLogs = { installed: true, label: "Supabase/Shell" };

    return NextResponse.json({ tools });
  } catch (err) {
    console.error("check-tools error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
