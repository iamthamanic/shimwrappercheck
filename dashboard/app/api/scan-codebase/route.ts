/**
 * GET /api/scan-codebase – detect which checks are relevant for the current project and why.
 * Returns recommendations: { [checkId]: reason } for purple tooltips in Check Library. No AI.
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

export async function GET() {
  try {
    const root = getProjectRoot();
    const recommendations: Record<string, string> = {};
    const pkg = readJson<Pkg>(path.join(root, "package.json"), {});
    const dashboardPkg = readJson<Pkg>(path.join(root, "dashboard", "package.json"), {});

    const hasNpm =
      fs.existsSync(path.join(root, "package.json")) || fs.existsSync(path.join(root, "dashboard", "package.json"));

    if (hasNpm) {
      if (
        hasDep(pkg, ["eslint", "@eslint/core", "biome"]) ||
        hasScript(pkg, "lint") ||
        hasDep(dashboardPkg, ["eslint"])
      ) {
        recommendations.lint = "ESLint or lint script found in package.json.";
      }
      if (
        hasDep(pkg, ["prettier"]) ||
        hasScript(pkg, "format") ||
        hasScript(pkg, "format:check") ||
        hasDep(dashboardPkg, ["prettier"]) ||
        hasScript(dashboardPkg, "format:check")
      ) {
        recommendations.prettier = "Prettier or format script found.";
      }
      if (
        (hasDep(pkg, ["typescript"]) && (hasScript(pkg, "typecheck") || hasScript(pkg, "type-check"))) ||
        hasScript(pkg, "typecheck") ||
        (hasDep(dashboardPkg, ["typescript"]) &&
          (hasScript(dashboardPkg, "typecheck") || hasScript(dashboardPkg, "type-check")))
      ) {
        recommendations.typecheck = "TypeScript and typecheck script found.";
      }
      if (hasScript(pkg, "check:mock-data")) {
        recommendations.checkMockData = "Script check:mock-data in package.json.";
      }
      if (
        hasDep(pkg, ["jest", "vitest", "mocha", "@jest/core"]) ||
        hasScript(pkg, "test") ||
        hasScript(pkg, "test:run") ||
        hasDep(dashboardPkg, ["vitest"])
      ) {
        recommendations.testRun = "Test runner (e.g. Vitest) in package.json.";
      }
      if (fs.existsSync(path.join(root, "scripts", "checks", "project-rules.sh"))) {
        recommendations.projectRules = "scripts/checks/project-rules.sh found.";
      }
      recommendations.npmAudit = "npm project; npm audit checks dependencies.";
      if (hasDep(pkg, ["vite"]) || hasScript(pkg, "build") || hasDep(dashboardPkg, ["vite"])) {
        recommendations.viteBuild = "Vite or build script found.";
      }
      if (hasDep(pkg, ["snyk"])) {
        recommendations.snyk = "Snyk installed in project.";
      }
      if (
        fs.existsSync(path.join(root, "node_modules", "shimwrappercheck", "scripts", "update-readme.js")) ||
        fs.existsSync(path.join(root, "scripts", "update-readme.js"))
      ) {
        recommendations.updateReadme = "Update-README script available.";
      }
      recommendations.licenseChecker = "npm project; license-checker can verify licenses.";
    }

    const messagesRoot = path.join(root, "messages");
    const messagesDashboard = path.join(root, "dashboard", "messages");
    const dirHasJson = (dir: string) =>
      fs.existsSync(dir) && fs.statSync(dir).isDirectory() && fs.readdirSync(dir).some((f) => f.endsWith(".json"));
    const hasMessages = dirHasJson(messagesRoot) || dirHasJson(messagesDashboard);
    if (hasMessages) {
      recommendations.i18nCheck = "messages/ or dashboard/messages/ with locale JSON files found.";
    }

    const hasSupabaseFunctions =
      fs.existsSync(path.join(root, "supabase", "functions")) ||
      fs.existsSync(path.join(root, "deno.json")) ||
      fs.existsSync(path.join(root, "deno.jsonc"));
    if (hasSupabaseFunctions) {
      recommendations.denoFmt = "Supabase functions or deno.json found (Deno formatting).";
      recommendations.denoLint = "Supabase functions or deno.json found (Deno lint).";
      recommendations.denoAudit = "Supabase functions or deno.json found (Deno audit).";
      recommendations.healthPing = "Supabase project; health ping after deploy.";
      recommendations.edgeLogs = "Supabase project; edge logs after deploy.";
    }

    recommendations.aiReview = "AI review applies to any codebase.";
    recommendations.explanationCheck = "Explanation check applies to any codebase.";

    if (fs.existsSync(path.join(root, ".dependency-cruiser.json"))) {
      recommendations.architecture = ".dependency-cruiser.json found.";
    }
    if (
      fs.existsSync(path.join(root, "eslint.complexity.json")) ||
      hasDep(pkg, ["eslint-plugin-complexity"]) ||
      hasDep(dashboardPkg, ["eslint-plugin-complexity"])
    ) {
      recommendations.complexity = "eslint-plugin-complexity or eslint.complexity.json found.";
    }
    if (fs.existsSync(path.join(root, "stryker.config.json"))) {
      recommendations.mutation = "stryker.config.json found.";
    }
    recommendations.sast = "Semgrep can scan any repo for security patterns.";
    recommendations.gitleaks = "Gitleaks can scan any repo for committed secrets.";

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
