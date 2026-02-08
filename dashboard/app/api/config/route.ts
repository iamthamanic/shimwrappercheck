/**
 * GET/POST /api/config – read/write .shimwrappercheckrc (key=value + comments).
 * Vercel-compatible; uses SHIM_PROJECT_ROOT when deployed.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "@/lib/projectRoot";

const rcFileName = ".shimwrappercheckrc";

function getRcPath(): string {
  return path.join(getProjectRoot(), rcFileName);
}

export async function GET() {
  try {
    const p = getRcPath();
    if (!fs.existsSync(p)) {
      return NextResponse.json({ raw: "", exists: false });
    }
    const raw = fs.readFileSync(p, "utf8");
    return NextResponse.json({ raw, exists: true });
  } catch (err) {
    console.error("config get error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { raw } = (await request.json()) as { raw?: string };
    if (typeof raw !== "string") {
      return NextResponse.json({ error: "raw string required" }, { status: 400 });
    }
    const p = getRcPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(p, raw.endsWith("\n") ? raw : raw + "\n", "utf8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("config post error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
