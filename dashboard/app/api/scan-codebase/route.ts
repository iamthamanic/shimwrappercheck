/**
 * GET /api/scan-codebase – detect which checks are relevant for the current project and why.
 * Returns recommendations: { [checkId]: reason } for purple tooltips in Check Library. No AI.
 * Reasons are grouped via prefixes:
 * - "Best Practice: ..." (useful defaults, even when tooling is not fully wired yet)
 * - "Ready to run: ..." (detected in this repo and likely runnable now)
 */
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "@/lib/projectRoot";
import { CHECK_DEFINITIONS } from "@/lib/checks";
import type { CheckId } from "@/lib/checks";

type Pkg = {
  devDependencies?: Record<string, string>;
  dependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

function hasDep(pkg: Pkg, names: string[]): boolean {
  const dev = { ...pkg.devDependencies, ...pkg.dependencies };
  const keys = Object.keys(dev);
  return names.some(
    (n) => keys.includes(n) || keys.some((k) => k === n || k.startsWith(n + "/") || k.startsWith("@" + n))
  );
}

function hasScript(pkg: Pkg, name: string): boolean {
  return !!pkg.scripts?.[name];
}

function readJson<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function setBestPractice(recommendations: Record<string, string>, checkId: string, reason: string): void {
  if (!recommendations[checkId]) recommendations[checkId] = `Best Practice: ${reason}`;
}

function setReadyToRun(recommendations: Record<string, string>, checkId: string, reason: string): void {
  recommendations[checkId] = `Ready to run: ${reason}`;
}

export async function GET() {
  try {
    const root = getProjectRoot();
    const recommendations: Record<string, string> = {};
    const pkg = readJson<Pkg>(path.join(root, "package.json"), {});
    const dashboardPkg = readJson<Pkg>(path.join(root, "dashboard", "package.json"), {});

    setBestPractice(recommendations, "prettier", "Consistent formatting improves readability and review quality.");
    setBestPractice(recommendations, "projectRules", "Project-specific rules keep architecture and workflow consistent.");
    setBestPractice(recommendations, "snyk", "A second dependency scanner can catch issues beyond npm audit.");
    setBestPractice(recommendations, "checkMockData", "Valid mock data reduces flaky tests and broken demos.");
    setBestPractice(recommendations, "updateReadme", "Automated README sync keeps docs aligned with real behavior.");
    setBestPractice(
      recommendations,
      "licenseChecker",
      "Dependency license visibility helps legal/compliance review (especially in npm projects)."
    );
    setBestPractice(
      recommendations,
      "architecture",
      "dependency-cruiser can enforce boundaries and prevent architectural drift."
    );
    setBestPractice(recommendations, "aiReview", "Cross-check code quality against architecture and security criteria.");
    setBestPractice(recommendations, "explanationCheck", "Enforced explanations improve maintainability and onboarding.");
    setBestPractice(recommendations, "sast", "Static analysis helps detect vulnerable code patterns early.");
    setBestPractice(recommendations, "gitleaks", "Secret scanning reduces risk of leaked credentials.");

    const hasNpm =
      fs.existsSync(path.join(root, "package.json")) || fs.existsSync(path.join(root, "dashboard", "package.json"));

    if (hasNpm) {
      if (
        hasDep(pkg, ["eslint", "@eslint/core", "biome"]) ||
        hasScript(pkg, "lint") ||
        hasDep(dashboardPkg, ["eslint"])
      ) {
        setReadyToRun(recommendations, "lint", "ESLint or lint script found in package.json.");
      }
      if (
        hasDep(pkg, ["prettier"]) ||
        hasScript(pkg, "format") ||
        hasScript(pkg, "format:check") ||
        hasDep(dashboardPkg, ["prettier"]) ||
        hasScript(dashboardPkg, "format:check")
      ) {
        setReadyToRun(recommendations, "prettier", "Prettier or format script found.");
      }
      if (
        (hasDep(pkg, ["typescript"]) && (hasScript(pkg, "typecheck") || hasScript(pkg, "type-check"))) ||
        hasScript(pkg, "typecheck") ||
        (hasDep(dashboardPkg, ["typescript"]) &&
          (hasScript(dashboardPkg, "typecheck") || hasScript(dashboardPkg, "type-check")))
      ) {
        setReadyToRun(recommendations, "typecheck", "TypeScript and typecheck script found.");
      }
      if (hasScript(pkg, "check:mock-data")) {
        setReadyToRun(recommendations, "checkMockData", "Script check:mock-data in package.json.");
      }
      if (
        hasDep(pkg, ["jest", "vitest", "mocha", "@jest/core"]) ||
        hasScript(pkg, "test") ||
        hasScript(pkg, "test:run") ||
        hasDep(dashboardPkg, ["vitest"])
      ) {
        setReadyToRun(recommendations, "testRun", "Test runner (e.g. Vitest) in package.json.");
      }
      if (fs.existsSync(path.join(root, "scripts", "checks", "project-rules.sh"))) {
        setReadyToRun(recommendations, "projectRules", "scripts/checks/project-rules.sh found.");
      }
      setReadyToRun(recommendations, "npmAudit", "npm project; npm audit checks dependencies.");
      if (hasDep(pkg, ["vite"]) || hasScript(pkg, "build") || hasDep(dashboardPkg, ["vite"])) {
        setReadyToRun(recommendations, "viteBuild", "Vite or build script found.");
      }
      if (hasDep(pkg, ["snyk"])) {
        setReadyToRun(recommendations, "snyk", "Snyk installed in project.");
      }
      if (
        fs.existsSync(path.join(root, "node_modules", "shimwrappercheck", "scripts", "update-readme.js")) ||
        fs.existsSync(path.join(root, "scripts", "update-readme.js"))
      ) {
        setReadyToRun(recommendations, "updateReadme", "Update-README script available.");
      }
      setReadyToRun(recommendations, "licenseChecker", "npm project; license-checker can verify licenses.");
    }

    const messagesRoot = path.join(root, "messages");
    const messagesDashboard = path.join(root, "dashboard", "messages");
    const dirHasJson = (dir: string) =>
      fs.existsSync(dir) && fs.statSync(dir).isDirectory() && fs.readdirSync(dir).some((f) => f.endsWith(".json"));
    const hasMessages = dirHasJson(messagesRoot) || dirHasJson(messagesDashboard);
    if (hasMessages) {
      setReadyToRun(recommendations, "i18nCheck", "messages/ or dashboard/messages/ with locale JSON files found.");
    }

    const hasSupabaseFunctions =
      fs.existsSync(path.join(root, "supabase", "functions")) ||
      fs.existsSync(path.join(root, "deno.json")) ||
      fs.existsSync(path.join(root, "deno.jsonc"));
    if (hasSupabaseFunctions) {
      setReadyToRun(recommendations, "denoFmt", "Supabase functions or deno.json found (Deno formatting).");
      setReadyToRun(recommendations, "denoLint", "Supabase functions or deno.json found (Deno lint).");
      setReadyToRun(recommendations, "denoAudit", "Supabase functions or deno.json found (Deno audit).");
      setReadyToRun(recommendations, "healthPing", "Supabase project; health ping after deploy.");
      setReadyToRun(recommendations, "edgeLogs", "Supabase project; edge logs after deploy.");
    }

    if (fs.existsSync(path.join(root, ".dependency-cruiser.json"))) {
      setReadyToRun(recommendations, "architecture", ".dependency-cruiser.json found.");
    }
    if (
      fs.existsSync(path.join(root, "eslint.complexity.json")) ||
      hasDep(pkg, ["eslint-plugin-complexity"]) ||
      hasDep(dashboardPkg, ["eslint-plugin-complexity"])
    ) {
      setReadyToRun(recommendations, "complexity", "eslint-plugin-complexity or eslint.complexity.json found.");
    }
    if (fs.existsSync(path.join(root, "stryker.config.json"))) {
      setReadyToRun(recommendations, "mutation", "stryker.config.json found.");
    }

    const validIds = new Set(CHECK_DEFINITIONS.map((c) => c.id));
    const filtered: Record<string, string> = {};
    for (const id of Object.keys(recommendations)) {
      if (validIds.has(id as CheckId)) filtered[id] = recommendations[id];
    }

    return NextResponse.json({ recommendations: filtered });
  } catch (err) {
    console.error("scan-codebase error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scan failed", recommendations: {} },
      { status: 500 }
    );
  }
}
