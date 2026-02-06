/**
 * POST /api/run-checks – run scripts/run-checks.sh and return stdout/stderr.
 * Vercel-compatible; uses SHIM_PROJECT_ROOT. Runs in project root.
 */
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { getProjectRoot } from "@/lib/projectRoot";

const execAsync = promisify(exec);

type ExecResult = { stdout: string; stderr: string; code?: number };

export async function POST() {
  try {
    const root = getProjectRoot();
    const scriptPath = path.join(root, "scripts", "run-checks.sh");
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({
        error: "scripts/run-checks.sh not found",
        stdout: "",
        stderr: "",
        code: 1,
      });
    }
    const opts = { cwd: root, maxBuffer: 2 * 1024 * 1024, shell: "/bin/bash" };
    let stdout = "";
    let stderr = "";
    let code = 0;
    try {
      const out = await execAsync(`bash "${scriptPath}"`, opts);
      stdout = out.stdout ?? "";
      stderr = out.stderr ?? "";
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; code?: number };
      stdout = err.stdout ?? "";
      stderr = err.stderr ?? (err instanceof Error ? err.message : String(e));
      code = err.code ?? 1;
    }
    return NextResponse.json({ stdout, stderr, code });
  } catch (err) {
    console.error("run-checks error:", err);
    return NextResponse.json(
      {
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        code: 1,
      },
      { status: 200 }
    );
  }
}
