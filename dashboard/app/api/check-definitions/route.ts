/**
 * GET /api/check-definitions – returns all check definitions (built-in + optional project-level).
 * Used by the Check Library. Add new checks in lib/checks.ts; they appear automatically.
 * Future: merge with project .shimwrappercheck/checks.json for project-specific checks.
 */
import { NextResponse } from "next/server";
import { CHECK_DEFINITIONS } from "@/lib/checks";

export async function GET() {
  try {
    return NextResponse.json({ definitions: CHECK_DEFINITIONS });
  } catch (e) {
    console.error("check-definitions GET:", e);
    return NextResponse.json({ error: "Failed to load check definitions" }, { status: 500 });
  }
}
