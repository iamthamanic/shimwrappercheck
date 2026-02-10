/**
 * GET/POST /api/project-rules – read/write scripts/checks/project-rules.sh (project rules check script).
 * Same pattern as agents-md; creates scripts/checks/ when writing.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "@/lib/projectRoot";

const SCRIPT_RELATIVE = path.join("scripts", "checks", "project-rules.sh");

function getScriptPath(): string {
  return path.join(getProjectRoot(), SCRIPT_RELATIVE);
}

const defaultScriptContent = `#!/usr/bin/env bash
# Project rules check – edit in dashboard (Projektregeln → Regeln) or here.
# Exit 0 = pass, non-zero = fail.
set -e
# Add your checks below, e.g.:
# if grep -r "forbidden-pattern" src/; then exit 1; fi
exit 0
`;

export async function GET() {
  try {
    const p = getScriptPath();
    if (!fs.existsSync(p)) {
      return NextResponse.json({ raw: defaultScriptContent, exists: false });
    }
    const raw = fs.readFileSync(p, "utf8");
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
