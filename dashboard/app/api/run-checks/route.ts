/**
 * POST /api/run-checks – run Node orchestrator (npx shimwrappercheck run) or fallback to scripts/run-checks.sh.
 * Saves last run stdout/stderr to .shimwrapper/last-run.json for the Logs tab.
 * Vercel-compatible; uses SHIM_PROJECT_ROOT. Runs in project root.
 */
import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { getProjectRoot } from "@/lib/projectRoot";

const execAsync = promisify(exec);

const LAST_RUN_FILENAME = "last-run.json";

function getLastRunPath(root: string): string {
  return path.join(root, ".shimwrapper", LAST_RUN_FILENAME);
}

function writeLastRun(root: string, stdout: string, stderr: string): void {
  try {
    const dir = path.join(root, ".shimwrapper");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const p = getLastRunPath(root);
    fs.writeFileSync(p, JSON.stringify({ stdout, stderr, timestamp: new Date().toISOString() }), "utf8");
  } catch (e) {
    console.warn("run-checks: could not write last-run.json", e);
  }
}

export async function POST() {
  try {
    const root = getProjectRoot();
    const opts = {
      cwd: root,
      maxBuffer: 4 * 1024 * 1024,
      shell: "/bin/bash",
      env: { ...process.env, SHIM_PROJECT_ROOT: root },
    };
    let stdout = "";
    let stderr = "";
    let code = 0;

    const runnerPath = path.join(root, "scripts", "shim-runner.js");
    const hasPackageRunner = fs.existsSync(
      path.join(root, "node_modules", "shimwrappercheck", "scripts", "shim-runner.js")
    );

    if (fs.existsSync(runnerPath)) {
      try {
        const out = await execAsync(`node "${runnerPath}"`, opts);
        stdout = out.stdout ?? "";
        stderr = out.stderr ?? "";
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; code?: number };
        stdout = err.stdout ?? "";
        stderr = err.stderr ?? (err instanceof Error ? err.message : String(e));
        code = err.code ?? 1;
      }
    } else if (hasPackageRunner) {
      try {
        const out = await execAsync("npx shimwrappercheck run", opts);
        stdout = out.stdout ?? "";
        stderr = out.stderr ?? "";
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; code?: number };
        stdout = err.stdout ?? "";
        stderr = err.stderr ?? (err instanceof Error ? err.message : String(e));
        code = err.code ?? 1;
      }
    } else {
      const scriptPath = path.join(root, "scripts", "run-checks.sh");
      if (!fs.existsSync(scriptPath)) {
        return NextResponse.json({
          error: "scripts/run-checks.sh not found; install shimwrappercheck for full runner.",
          stdout: "",
          stderr: "",
          code: 1,
        });
      }
      try {
        const out = await execAsync(`bash "${scriptPath}"`, { ...opts, maxBuffer: 2 * 1024 * 1024 });
        stdout = out.stdout ?? "";
        stderr = out.stderr ?? "";
      } catch (e: unknown) {
        const err = e as { stdout?: string; stderr?: string; code?: number };
        stdout = err.stdout ?? "";
        stderr = err.stderr ?? (err instanceof Error ? err.message : String(e));
        code = err.code ?? 1;
      }
    }

    writeLastRun(root, stdout, stderr);
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
