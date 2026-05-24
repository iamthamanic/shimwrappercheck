import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommand } from "../runners/command-runner.js";
import type { CodexRunResult } from "./types.js";

export type RunCodexReviewOptions = {
  codexPath: string;
  prompt: string;
  cwd: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
};

/**
 * Parse Codex JSONL stream for assistant message and token usage.
 * Mirrors jq loop in scripts/ai-code-review.sh.
 */
export function parseCodexJsonl(jsonl: string): {
  resultText: string;
  inputTokens?: number;
  outputTokens?: number;
} {
  let resultText = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;

  for (const line of jsonl.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const event = JSON.parse(line) as {
        type?: string;
        usage?: { input_tokens?: number; output_tokens?: number };
        item?: { item_type?: string; text?: string };
      };
      if (event.type === "turn.completed" && event.usage) {
        inputTokens = event.usage.input_tokens;
        outputTokens = event.usage.output_tokens;
      }
      if (
        event.type === "item.completed" &&
        event.item?.item_type === "assistant_message"
      ) {
        resultText = event.item.text ?? "";
      }
    } catch {
      // ignore malformed JSONL lines
    }
  }

  return { resultText, inputTokens, outputTokens };
}

/** Run `codex exec --json` with optional timeout wrapper (same as bash). */
export async function runCodexReview(
  options: RunCodexReviewOptions,
): Promise<CodexRunResult> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "shim-ai-review-"));
  const msgOut = path.join(tmpDir, "codex-last-message.txt");

  try {
    const timeoutSec = Math.max(1, Math.ceil(options.timeoutMs / 1000));
    const useTimeout = await hasTimeoutCommand();
    const codexArgs = ["exec", "--json", "-o", msgOut, options.prompt];

    const command = useTimeout ? "timeout" : options.codexPath;
    const args = useTimeout
      ? [String(timeoutSec), options.codexPath, ...codexArgs]
      : codexArgs;

    const result = await runCommand(command, args, {
      cwd: options.cwd,
      env: options.env,
      timeoutMs: options.timeoutMs + 5_000,
    });

    const parsed = parseCodexJsonl(result.stdout);
    let resultText = parsed.resultText;
    if (!resultText && fs.existsSync(msgOut)) {
      resultText = fs.readFileSync(msgOut, "utf8");
    }

    const timedOut =
      result.timedOut ||
      result.exitCode === 124 ||
      result.exitCode === 142;

    return {
      exitCode: result.exitCode ?? 1,
      timedOut,
      resultText,
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
      stderr: result.stderr,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

async function hasTimeoutCommand(): Promise<boolean> {
  const result = await runCommand("command", ["-v", "timeout"], {
    cwd: process.cwd(),
    timeoutMs: 5_000,
  });
  return result.exitCode === 0;
}
