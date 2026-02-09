/**
 * GET /api/run-checks/log – last run-checks output, parsed into per-check segments for the Logs tab.
 */
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "@/lib/projectRoot";
import { parseLastRunLog } from "@/lib/runChecksLog";

const LAST_RUN_FILENAME = "last-run.json";

export async function GET() {
  try {
    const root = getProjectRoot();
    const p = path.join(root, ".shimwrapper", LAST_RUN_FILENAME);
    if (!fs.existsSync(p)) {
      return NextResponse.json({ full: "", segments: {}, timestamp: null });
    }
    const raw = fs.readFileSync(p, "utf8");
    let data: { stdout?: string; stderr?: string; timestamp?: string };
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json({ full: "", segments: {}, timestamp: null });
    }
    const stdout = data.stdout ?? "";
    const stderr = data.stderr ?? "";
    const { full, segments } = parseLastRunLog(stdout, stderr);
    return NextResponse.json({
      full,
      segments,
      timestamp: data.timestamp ?? null,
    });
  } catch (err) {
    console.error("run-checks/log get error:", err);
    return NextResponse.json(
      { full: "", segments: {}, timestamp: null, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
