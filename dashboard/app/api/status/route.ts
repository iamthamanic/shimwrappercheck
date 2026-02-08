/**
 * GET /api/status – project status for dashboard (checks script, config, AGENTS.md, husky).
 * Vercel-compatible; uses SHIM_PROJECT_ROOT when deployed.
 */
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "@/lib/projectRoot";

export async function GET() {
  try {
    const root = getProjectRoot();
    const hasRc = fs.existsSync(path.join(root, ".shimwrappercheckrc"));
    const hasPresets = fs.existsSync(path.join(root, ".shimwrappercheck-presets.json"));
    const hasAgents = fs.existsSync(path.join(root, "AGENTS.md"));
    const hasRunChecks = fs.existsSync(path.join(root, "scripts", "run-checks.sh"));
    const hasRunner =
      fs.existsSync(path.join(root, "scripts", "shim-runner.js")) ||
      fs.existsSync(path.join(root, "node_modules", "shimwrappercheck", "scripts", "shim-runner.js"));
    const hasHusky = fs.existsSync(path.join(root, ".husky", "pre-push"));
    const hasGitHook = fs.existsSync(path.join(root, ".git", "hooks", "pre-push"));
    const hasSupabase = fs.existsSync(path.join(root, "supabase", "config.toml"));

    let lastError: { check?: string; message?: string; suggestion?: string; timestamp?: string } | null = null;
    const lastErrorPath = path.join(root, ".shim", "last_error.json");
    if (fs.existsSync(lastErrorPath)) {
      try {
        lastError = JSON.parse(fs.readFileSync(lastErrorPath, "utf8"));
      } catch {
        lastError = { message: "(parse error)" };
      }
    }

    return NextResponse.json({
      projectRoot: root,
      config: hasRc,
      presetsFile: hasPresets,
      agentsMd: hasAgents,
      runChecksScript: hasRunChecks,
      shimRunner: hasRunner,
      prePushHusky: hasHusky,
      prePushGit: hasGitHook,
      supabase: hasSupabase,
      lastError,
    });
  } catch (err) {
    console.error("status error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
