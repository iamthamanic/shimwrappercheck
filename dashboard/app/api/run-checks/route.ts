/**
 * POST /api/run-checks – run Node orchestrator (npx shimwrappercheck run) or fallback to scripts/run-checks.sh.
 * Saves last run stdout/stderr to .shimwrapper/last-run.json for the Logs tab.
 * When review mode is on for a check, writes a .md report to reviewOutputPath.
 * If Accept: text/event-stream: streams SSE events (currentCheck, done) for live progress.
 * Vercel-compatible; uses SHIM_PROJECT_ROOT. Runs in project root.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { getProjectRoot } from "@/lib/projectRoot";
import { getCheckIdFromLine, parseLastRunLog } from "@/lib/runChecksLog";
import { DEFAULT_SETTINGS } from "@/lib/presets";

const PRESETS_FILE = ".shimwrappercheck-presets.json";

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

function getRunCommand(root: string): { cmd: string; args: string[] } | null {
  const runnerPath = path.join(root, "scripts", "shim-runner.js");
  const hasPackageRunner = fs.existsSync(
    path.join(root, "node_modules", "shimwrappercheck", "scripts", "shim-runner.js")
  );
  if (fs.existsSync(runnerPath)) {
    return { cmd: "node", args: [runnerPath] };
  }
  if (hasPackageRunner) {
    return { cmd: "npx", args: ["shimwrappercheck", "run"] };
  }
  const scriptPath = path.join(root, "scripts", "run-checks.sh");
  if (fs.existsSync(scriptPath)) {
    return { cmd: "bash", args: [scriptPath] };
  }
  return null;
}

function sendSSE(controller: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
  controller.enqueue(new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
}

function readReviewSettings(root: string): {
  reviewOutputPath: string;
  checkSettings: Record<string, Record<string, unknown>>;
} {
  const p = path.join(root, PRESETS_FILE);
  if (!fs.existsSync(p)) {
    return {
      reviewOutputPath: DEFAULT_SETTINGS.reviewOutputPath ?? "reports",
      checkSettings: {},
    };
  }
  try {
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as { reviewOutputPath?: string; checkSettings?: Record<string, Record<string, unknown>> };
    return {
      reviewOutputPath: typeof parsed.reviewOutputPath === "string" ? parsed.reviewOutputPath : DEFAULT_SETTINGS.reviewOutputPath ?? "reports",
      checkSettings: (parsed.checkSettings && typeof parsed.checkSettings === "object") ? parsed.checkSettings : {},
    };
  } catch {
    return {
      reviewOutputPath: DEFAULT_SETTINGS.reviewOutputPath ?? "reports",
      checkSettings: {},
    };
  }
}

function writeReviewReports(root: string, stdout: string, stderr: string): void {
  try {
    const { reviewOutputPath, checkSettings } = readReviewSettings(root);
    const outDir = path.join(root, reviewOutputPath.trim() || "reports");
    const { segments } = parseLastRunLog(stdout, stderr);
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 19).replace(/[-:T]/g, "").slice(0, 15);
    for (const [checkId, text] of Object.entries(segments)) {
      const cs = checkSettings[checkId];
      if (!cs || !cs.reviewMode) continue;
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const safeId = checkId.replace(/[^a-zA-Z0-9-_]/g, "_");
      const filename = `${safeId}-${dateStr}.md`;
      const fullPath = path.join(outDir, filename);
      const content = `# Review: ${checkId}\n\n**${now.toISOString()}**\n\n\`\`\`\n${text}\n\`\`\`\n`;
      fs.writeFileSync(fullPath, content, "utf8");
    }
  } catch (e) {
    console.warn("run-checks: could not write review reports", e);
  }
}

export async function POST(request: NextRequest) {
  const accept = request.headers.get("accept") ?? "";
  const streamResponse = accept.includes("text/event-stream");

  try {
    const root = getProjectRoot();
    const runCommand = getRunCommand(root);
    if (!runCommand) {
      return NextResponse.json({
        error: "scripts/run-checks.sh not found; install shimwrappercheck for full runner.",
        stdout: "",
        stderr: "",
        code: 1,
      });
    }

    if (streamResponse) {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const env = { ...process.env, SHIM_PROJECT_ROOT: root };
          const child = spawn(runCommand.cmd, runCommand.args, { cwd: root, env, shell: true });
          let stdout = "";
          let stderr = "";
          let lineBuffer = "";
          const pushChunk = (chunk: string, isErr: boolean) => {
            if (isErr) stderr += chunk;
            else stdout += chunk;
            lineBuffer += chunk;
            const lines = lineBuffer.split("\n");
            lineBuffer = lines.pop() ?? "";
            for (const line of lines) {
              const id = getCheckIdFromLine(line);
              if (id) sendSSE(controller, "currentCheck", { checkId: id });
            }
          };
          child.stdout?.on("data", (d) => pushChunk(String(d), false));
          child.stderr?.on("data", (d) => pushChunk(String(d), true));
          child.on("close", (code) => {
            writeLastRun(root, stdout, stderr);
            writeReviewReports(root, stdout, stderr);
            sendSSE(controller, "done", { code: code ?? 1, stdout, stderr });
            controller.close();
          });
          child.on("error", () => {
            sendSSE(controller, "done", { code: 1, stdout: "", stderr: "Process error" });
            controller.close();
          });
        },
      });
      return new Response(stream, {
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" },
      });
    }

    const opts = {
      cwd: root,
      maxBuffer: 4 * 1024 * 1024,
      shell: "/bin/bash",
      env: { ...process.env, SHIM_PROJECT_ROOT: root },
    };
    let stdout = "";
    let stderr = "";
    let code = 0;
    const shellCmd =
      runCommand.cmd === "bash"
        ? `bash "${runCommand.args[0]}"`
        : runCommand.cmd === "node"
          ? `node "${runCommand.args[0]}"`
          : "npx shimwrappercheck run";
    try {
      const out = await execAsync(shellCmd, {
        ...opts,
        maxBuffer: runCommand.cmd === "bash" ? 2 * 1024 * 1024 : opts.maxBuffer,
      });
      stdout = out.stdout ?? "";
      stderr = out.stderr ?? "";
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; code?: number };
      stdout = err.stdout ?? "";
      stderr = err.stderr ?? (err instanceof Error ? err.message : String(e));
      code = err.code ?? 1;
    }
    writeLastRun(root, stdout, stderr);
    writeReviewReports(root, stdout, stderr);
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
