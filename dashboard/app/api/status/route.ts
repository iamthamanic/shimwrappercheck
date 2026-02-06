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
    const hasHusky = fs.existsSync(path.join(root, ".husky", "pre-push"));
    const hasGitHook = fs.existsSync(path.join(root, ".git", "hooks", "pre-push"));
    const hasSupabase = fs.existsSync(path.join(root, "supabase", "config.toml"));

    return NextResponse.json({
      projectRoot: root,
      config: hasRc,
      presetsFile: hasPresets,
      agentsMd: hasAgents,
      runChecksScript: hasRunChecks,
      prePushHusky: hasHusky,
      prePushGit: hasGitHook,
      supabase: hasSupabase,
    });
  } catch (err) {
    console.error("status error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
