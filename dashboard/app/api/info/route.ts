/**
 * GET /api/info – Version und Last-Updated für shimwrappercheck Dashboard.
 */
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export async function GET() {
  try {
    const dashboardPkgPath = path.join(process.cwd(), "package.json");
    let version = "0.1.0";
    if (fs.existsSync(dashboardPkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(dashboardPkgPath, "utf8"));
        version = pkg.version ?? version;
      } catch {
        // keep default
      }
    }
    const lastUpdated = process.env.NEXT_PUBLIC_BUILD_TIME ?? null;
    return NextResponse.json({ version, lastUpdated });
  } catch (err) {
    console.error("info error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
