import fs from "node:fs";
import path from "node:path";
import type { CheckContext, CheckResult } from "../checks/types.js";
import { resolveGitBinary } from "../binary/resolve-binary.js";
import {
  buildAiScriptEnv,
  isAiReviewBlocking,
  mapAiScriptResult,
  resolveCheckMode,
  runAiReviewScript,
} from "../checks/definitions/ai-script-runner.js";
import { pass, skip } from "../checks/definitions/helpers.js";
import { buildDiffForMode, defaultGitRunner, limitDiffBytes } from "./chunk-diff.js";
import { runCodexReview } from "./codex-runner.js";
import {
  passesReview,
  parseReviewJsonFromText,
  redactReviewText,
} from "./parse-review-output.js";
import { buildReviewPromptHead } from "./prompt.js";
import {
  canRunCoreAiReview,
  resolveAiProvider,
  resolveAiReviewEngine,
  resolveCodexBinary,
} from "./provider-resolver.js";
import { runApiOrCustomReview } from "./api-runner.js";
import type { ParsedReview } from "./types.js";

function toInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function resolveReviewsDir(ctx: CheckContext): string {
  const setting = ctx.env.SHIM_AI_REVIEW_DIR ?? ".shimwrapper/reviews";
  return path.isAbsolute(setting)
    ? setting
    : path.join(ctx.projectRoot, setting);
}

function formatReviewMarkdown(options: {
  mode: string;
  branch: string;
  parsed: ParsedReview | null;
  pass: boolean;
  minRating: number;
  diffSource: string;
  resultText: string;
  inputTokens?: number;
  outputTokens?: number;
}): string {
  const parsed = options.parsed;
  const score = parsed?.score ?? 0;
  const verdict = parsed?.verdict ?? "REJECT";
  const deductions = parsed?.deductions ?? [];
  const lines: string[] = [
    `# AI Code Review - Date ${new Date().toLocaleDateString("de-DE")}  Time ${new Date().toLocaleTimeString("de-DE")}`,
    "",
    "## Review Summary",
    `- **Mode:** ${options.mode}`,
    `- **Branch:** ${options.branch}`,
    `- **Status:** ${options.pass ? "PASS" : "FAIL"} (${verdict})`,
    `- **Score:** ${score}%`,
    `- **Min score for PASS:** ${options.minRating}%`,
    `- **Tokens:** ${options.inputTokens ?? "?"} input, ${options.outputTokens ?? "?"} output`,
    `- **Findings:** ${deductions.length}`,
    `- **Diff source:** ${options.diffSource}`,
    "",
    "## Checklist",
    "- Architektur & SOLID",
    "- Performance & Ressourcen",
    "- Sicherheit",
    "- Robustheit & Error Handling",
    "- Wartbarkeit & Lesbarkeit",
    "",
  ];

  if (deductions.length > 0) {
    lines.push("## Findings", "");
    for (const d of deductions) {
      lines.push(`- [FAIL] **${d.point}**: -${d.minus} -- ${d.reason}`);
    }
  } else {
    lines.push("## No findings from AI checklist", "", "- No deductions in this review scope.");
  }

  lines.push("", "## Raw response", "", "```", redactReviewText(options.resultText) || "(no review text)", "```");
  return lines.join("\n");
}

/** Map core review outcome to CheckResult (same policy as bash script mapper). */
function mapCoreReviewResult(
  passReview: boolean,
  blocking: boolean,
  details: Record<string, unknown>,
): CheckResult {
  if (passReview) {
    return pass("aiReview", "AI Review: passed", blocking);
  }
  if (!blocking) {
    return {
      id: "aiReview",
      status: "warning",
      blocking: false,
      message: "AI Review: review did not pass (non-blocking)",
      details,
    };
  }
  return {
    id: "aiReview",
    status: "failed",
    blocking: true,
    message: "AI Review: REJECT or score below minimum",
    details,
  };
}

/**
 * TypeScript AI review (commit/snippet + codex). Falls back to bash when
 * SHIM_AI_REVIEW_ENGINE=legacy, full mode, or codex unavailable.
 */
export async function runAiReview(ctx: CheckContext): Promise<CheckResult> {
  if (resolveAiReviewEngine(ctx.env) === "legacy") {
    return runAiReviewScript(ctx);
  }

  const provider = resolveAiProvider(ctx);
  if (provider === "api" || provider === "custom") {
    return runApiOrCustomReview(ctx);
  }

  if (!canRunCoreAiReview(ctx)) {
    return runAiReviewScript(ctx);
  }

  const blocking = isAiReviewBlocking(ctx);
  const mode = resolveCheckMode(ctx);
  const minRating = ctx.config.aiReview.minRating;
  const limitBytes = toInt(ctx.env.SHIM_AI_DIFF_LIMIT_BYTES, 51_200);
  const timeoutMs =
    (ctx.config.aiReview.timeoutSec ?? toInt(ctx.env.SHIM_AI_TIMEOUT_SEC, 180)) *
    1000;

  const git = resolveGitBinary(ctx.packageRoot, ctx.env);
  if (!git) {
    return {
      id: "aiReview",
      status: "infra_error",
      blocking: true,
      message: "AI Review: git not available",
    };
  }

  const codex = resolveCodexBinary(ctx.env);
  if (!codex) {
    return runAiReviewScript(ctx);
  }

  const diff = await buildDiffForMode(mode, ctx.projectRoot, git.path);
  if (diff.error) {
    return {
      id: "aiReview",
      status: "failed",
      blocking,
      message: `AI Review: ${diff.error}`,
    };
  }
  if (diff.empty) {
    return skip("aiReview", `AI review (${mode}): no changes to review`);
  }

  const limited = limitDiffBytes(diff.content, limitBytes);
  const prompt = `${buildReviewPromptHead(minRating)}\n${limited}`;
  const env = buildAiScriptEnv(ctx);

  const codexResult = await runCodexReview({
    codexPath: codex.path,
    prompt,
    cwd: ctx.projectRoot,
    timeoutMs,
    env,
  });

  if (codexResult.timedOut) {
    return {
      id: "aiReview",
      status: "infra_error",
      blocking: true,
      message: `AI Review: Codex timed out after ${timeoutMs / 1000}s`,
    };
  }
  if (codexResult.exitCode !== 0) {
    return mapAiScriptResult(
      "aiReview",
      "AI Review",
      {
        command: codex.path,
        args: ["exec"],
        cwd: ctx.projectRoot,
        exitCode: codexResult.exitCode,
        signal: null,
        stdout: codexResult.resultText,
        stderr: codexResult.stderr,
        durationMs: 0,
        timedOut: false,
      },
      blocking,
    );
  }

  const parsed = parseReviewJsonFromText(codexResult.resultText);
  const passReview = parsed ? passesReview(parsed, minRating) : false;

  const reviewsDir = resolveReviewsDir(ctx);
  fs.mkdirSync(reviewsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reviewFile = path.join(reviewsDir, `review-${mode}-${stamp}.md`);

  let branch = String(ctx.env.GIT_BRANCH ?? "").trim();
  if (!branch) {
    const branchResult = await defaultGitRunner(
      git.path,
      ["rev-parse", "--abbrev-ref", "HEAD"],
      ctx.projectRoot,
    );
    branch = branchResult.stdout.trim() || "unknown";
  }

  fs.writeFileSync(
    reviewFile,
    formatReviewMarkdown({
      mode,
      branch,
      parsed,
      pass: passReview,
      minRating,
      diffSource: diff.source,
      resultText: codexResult.resultText,
      inputTokens: codexResult.inputTokens,
      outputTokens: codexResult.outputTokens,
    }),
    "utf8",
  );

  const reviewFailedJson = path.join(
    path.dirname(reviewsDir),
    "review-failed.json",
  );
  if (passReview) {
    try {
      fs.unlinkSync(reviewFailedJson);
    } catch {
      // ignore missing file
    }
  } else {
    fs.mkdirSync(path.dirname(reviewFailedJson), { recursive: true });
    fs.writeFileSync(
      reviewFailedJson,
      JSON.stringify({
        verdict: parsed?.verdict ?? "REJECT",
        score: parsed?.score ?? 0,
        review_file: reviewFile,
        timestamp: new Date().toISOString(),
      }),
      "utf8",
    );
  }

  return mapCoreReviewResult(passReview, blocking, {
    score: parsed?.score,
    verdict: parsed?.verdict,
    reviewFile,
    engine: "core",
  });
}
