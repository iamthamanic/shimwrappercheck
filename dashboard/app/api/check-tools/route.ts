/**
 * GET /api/check-tools – scan project for tools required by each check (package.json, deno in PATH).
 * Returns per-check status and optional install command for copy-paste.
 */
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { getProjectRoot } from "@/lib/projectRoot";

export type ToolStatus = { installed: boolean; label?: string; command?: string };

function hasDep(pkg: { devDependencies?: Record<string, string>; dependencies?: Record<string, string> }, names: string[]): boolean {
  const dev = { ...pkg.devDependencies, ...pkg.dependencies };
  const keys = Object.keys(dev);
  return names.some((n) => keys.includes(n) || keys.some((k) => k === n || k.startsWith(n + "/") || k.startsWith("@" + n)));
}

function hasScript(pkg: { scripts?: Record<string, string> }, name: string): boolean {
  return !!pkg.scripts?.[name];
}

export async function GET() {
  try {
    const root = getProjectRoot();
    const pkgPath = path.join(root, "package.json");
    let pkg: { devDependencies?: Record<string, string>; dependencies?: Record<string, string>; scripts?: Record<string, string> } = {};
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

    // lint: npm run lint → eslint / biome
    const lintOk = hasDep(pkg, ["eslint", "@eslint/core", "biome"]) || hasScript(pkg, "lint");
    tools.lint = lintOk
      ? { installed: true, label: "Linter (z. B. ESLint) erkannt" }
      : { installed: false, label: "Kein Linter gefunden", command: "npm i -D eslint" };

    // checkMockData: script check:mock-data
    const mockOk = hasScript(pkg, "check:mock-data");
    tools.checkMockData = mockOk
      ? { installed: true, label: "Script check:mock-data vorhanden" }
      : { installed: false, label: "Script fehlt", command: 'Füge in package.json unter "scripts": "check:mock-data": "..." hinzu' };

    // testRun: jest / vitest / mocha
    const testOk = hasDep(pkg, ["jest", "vitest", "mocha", "@jest/core"]) || hasScript(pkg, "test") || hasScript(pkg, "test:run");
    tools.testRun = testOk
      ? { installed: true, label: "Test-Runner erkannt" }
      : { installed: false, label: "Kein Test-Runner gefunden", command: "npm i -D vitest" };

    // npmAudit: built-in
    tools.npmAudit = { installed: true, label: "npm audit (eingebaut)" };

    // snyk
    const snykOk = hasDep(pkg, ["snyk"]);
    tools.snyk = snykOk ? { installed: true, label: "Snyk erkannt" } : { installed: false, label: "Snyk nicht installiert", command: "npm i -D snyk" };

    // deno*
    const denoLabel = denoInPath ? "Deno (PATH) erkannt" : "Deno nicht im PATH";
    const denoCmd = "Installation: https://deno.land";
    tools.denoFmt = denoInPath ? { installed: true, label: denoLabel } : { installed: false, label: denoLabel, command: denoCmd };
    tools.denoLint = denoInPath ? { installed: true, label: denoLabel } : { installed: false, label: denoLabel, command: denoCmd };
    tools.denoAudit = denoInPath ? { installed: true, label: denoLabel } : { installed: false, label: denoLabel, command: denoCmd };

    // aiReview: no single package; script/Codex
    tools.aiReview = { installed: true, label: "Skript/Codex" };

    // Optional / geplant: SAST, architecture, complexity, mutation, e2e
    tools.sast = { installed: true, label: "Optional (z. B. semgrep)" };
    tools.architecture = { installed: true, label: "Optional (z. B. dependency-cruiser)" };
    tools.complexity = { installed: true, label: "Optional (z. B. eslint-plugin-complexity)" };
    tools.mutation = { installed: true, label: "Optional (z. B. Stryker)" };
    tools.e2e = { installed: true, label: "Optional (z. B. Playwright)" };

    // Hooks: keine lokale Tool-Installation
    tools.healthPing = { installed: true, label: "Supabase/Shell" };
    tools.edgeLogs = { installed: true, label: "Supabase/Shell" };

    return NextResponse.json({ tools });
  } catch (err) {
    console.error("check-tools error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
