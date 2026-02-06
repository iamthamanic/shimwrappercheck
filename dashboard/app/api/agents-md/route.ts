/**
 * GET/POST /api/agents-md – read/write AGENTS.md (agent instructions, editable by GUI).
 * Vercel-compatible; uses SHIM_PROJECT_ROOT when deployed.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "@/lib/projectRoot";

const agentsFileName = "AGENTS.md";

function getAgentsPath(): string {
  return path.join(getProjectRoot(), agentsFileName);
}

const defaultAgentsContent = `# Agent instructions (shimwrappercheck)

This file is used by AI agents (Cursor, Codex, etc.) when working with this repo.
Edit it here or via the dashboard so agents know how to use the shim and this project.

## Shim usage

- Use \`npx supabase ...\` or \`npm run supabase:checked -- ...\` so checks run before deploy.
- Use \`npx git push\` or \`npm run git:checked -- push\` so checks run before push.
- Run \`npx shimwrappercheck init\` for setup; \`npx shimwrappercheck install\` for PATH shims.

## Project rules

- Keep checks fast; run lint/type/build in scripts/run-checks.sh.
- AGENTS.md can be edited via the dashboard (Config → AGENTS.md).
`;

export async function GET() {
  try {
    const p = getAgentsPath();
    if (!fs.existsSync(p)) {
      return NextResponse.json({ raw: defaultAgentsContent, exists: false });
    }
    const raw = fs.readFileSync(p, "utf8");
    return NextResponse.json({ raw, exists: true });
  } catch (err) {
    console.error("agents-md get error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { raw } = (await request.json()) as { raw?: string };
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "raw string required" }, { status: 400 });
    }
    const p = getAgentsPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, raw.endsWith("\n") ? raw : raw + "\n", "utf8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("agents-md post error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
