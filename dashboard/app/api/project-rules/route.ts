/**
 * GET/POST /api/project-rules – read/write scripts/checks/project-rules.sh (project rules check script).
 * GET ?default=1 returns the AGENTS.md-based standard script without reading the file.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "@/lib/projectRoot";
import { PROJECT_RULES_DEFAULT_SCRIPT } from "@/lib/projectRulesDefault";

const SCRIPT_RELATIVE = path.join("scripts", "checks", "project-rules.sh");

function getScriptPath(): string {
  return path.join(getProjectRoot(), SCRIPT_RELATIVE);
}

export async function GET(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("default") === "1") {
      return NextResponse.json({ raw: PROJECT_RULES_DEFAULT_SCRIPT });
    }
    const p = getScriptPath();
    if (!fs.existsSync(p)) {
      return NextResponse.json({ raw: PROJECT_RULES_DEFAULT_SCRIPT, exists: false });
    }
    const raw = fs.readFileSync(p, "utf8");
    if (raw.trim() === "") {
      return NextResponse.json({ raw: PROJECT_RULES_DEFAULT_SCRIPT, exists: true, wasEmpty: true });
    }
    return NextResponse.json({ raw, exists: true });
  } catch (err) {
    console.error("project-rules get error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { raw?: string };
    const raw = body?.raw;
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "raw string required" }, { status: 400 });
    }
    const p = getScriptPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const content = raw.endsWith("\n") ? raw : raw + "\n";
    fs.writeFileSync(p, content, "utf8");
    return NextResponse.json({ ok: true, exists: true });
  } catch (err) {
    console.error("project-rules post error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
