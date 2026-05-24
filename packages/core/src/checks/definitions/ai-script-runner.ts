import fs from "node:fs";
import path from "node:path";
import type { CheckContext, CheckResult } from "../types.js";
import { runCommand } from "../../runners/command-runner.js";
import { commandSucceeded } from "../../runners/result.js";
import { classifyCommandFailure } from "../../runners/error-classifier.js";
import { pass, skip } from "./helpers.js";

export type AiProvider = "auto" | "codex" | "api" | "custom";

/** Resolve CHECK_MODE for AI scripts (refactor forces full). */
export function resolveCheckMode(ctx: CheckContext): string {
  if (ctx.flags.refactor) return "full";
  const raw = ctx.env.CHECK_MODE ?? ctx.config.checkMode ?? "commit";
  if (raw === "mix") return "full";
  if (raw === "diff") return "snippet";
  return raw;
}

/** Whether AI review failures should block the overall run. */
export function isAiReviewBlocking(ctx: CheckContext): boolean {
  return (
    ctx.config.aiReview.blocking ||
    ctx.env.SHIM_AI_REVIEW_BLOCKING === "1" ||
    String(ctx.env.SHIM_AI_REVIEW_BLOCKING).toLowerCase() === "true"
  );
}

/** Whether Full Explanation failures should block the overall run. */
export function isExplanationBlocking(ctx: CheckContext): boolean {
  return (
    ctx.env.SHIM_EXPLANATION_BLOCKING === "1" ||
    String(ctx.env.SHIM_EXPLANATION_BLOCKING).toLowerCase() === "true"
  );
}

/** Resolve AI provider (auto prefers codex when script exists). */
export function resolveAiProvider(ctx: CheckContext): AiProvider {
  const configured = ctx.config.aiReview.provider ?? "auto";
  if (configured !== "auto") return configured;

  if (scriptExists(ctx, "scripts/ai-code-review.sh")) return "codex";
  if (scriptExists(ctx, "scripts/ai-deductive-review.js")) return "api";
  if (scriptExists(ctx, "scripts/ai-code-review.js")) return "custom";
  return "codex";
}

function scriptExists(ctx: CheckContext, relativePath: string): boolean {
  return resolveScriptPath(ctx, relativePath) != null;
}

/** Find script under project or package root (supports node_modules shim layout). */
export function resolveScriptPath(
  ctx: CheckContext,
  relativePath: string,
): string | null {
  const candidates = [
    path.join(ctx.projectRoot, relativePath),
    path.join(ctx.packageRoot, relativePath),
    path.join(
      ctx.projectRoot,
      "node_modules",
      "shimwrappercheck",
      relativePath,
    ),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

/** Build env passed to AI bash/node scripts. */
export function buildAiScriptEnv(
  ctx: CheckContext,
  extra: Record<string, string> = {},
): NodeJS.ProcessEnv {
  const checkMode = resolveCheckMode(ctx);
  const env: NodeJS.ProcessEnv = {
    ...ctx.env,
    CHECK_MODE: checkMode,
    SHIM_AI_MIN_RATING: String(ctx.config.aiReview.minRating),
    SHIM_EXPLANATION_MIN_RATING: String(ctx.config.explanationCheck.minRating),
  };

  if (ctx.config.aiReview.timeoutSec != null) {
    env.SHIM_AI_TIMEOUT_SEC = String(ctx.config.aiReview.timeoutSec);
  } else if (ctx.env.SHIM_AI_TIMEOUT_SEC) {
    env.SHIM_AI_TIMEOUT_SEC = ctx.env.SHIM_AI_TIMEOUT_SEC;
  }

  if (ctx.env.SHIM_AI_REVIEW_PROVIDER) {
    env.SHIM_AI_REVIEW_PROVIDER = ctx.env.SHIM_AI_REVIEW_PROVIDER;
  } else if (ctx.config.aiReview.provider) {
    env.SHIM_AI_REVIEW_PROVIDER = ctx.config.aiReview.provider;
  }

  return { ...env, ...extra };
}

function aiTimeoutMs(ctx: CheckContext): number {
  const fromConfig = ctx.config.aiReview.timeoutSec;
  if (fromConfig != null && fromConfig > 0) return fromConfig * 1000;
  const fromEnv = Number.parseInt(ctx.env.SHIM_AI_TIMEOUT_SEC ?? "180", 10);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv * 1000 : 180_000;
}

/** Map script exit code to CheckResult with optional non-blocking AI policy. */
export function mapAiScriptResult(
  id: string,
  label: string,
  result: Awaited<ReturnType<typeof runCommand>>,
  blocking: boolean,
): CheckResult {
  if (commandSucceeded(result)) {
    return pass(id, `${label}: passed`, blocking);
  }

  const classified = classifyCommandFailure(result, label);
  if (classified.infra) {
    return {
      id,
      status: "infra_error",
      blocking: true,
      message: classified.message,
      details: { stderr: result.stderr.slice(0, 2000) },
    };
  }

  if (!blocking) {
    return {
      id,
      status: "warning",
      blocking: false,
      message: `${label}: review did not pass (non-blocking)`,
      details: {
        exitCode: result.exitCode,
        stderr: result.stderr.slice(0, 2000),
      },
    };
  }

  return {
    id,
    status: "failed",
    blocking: true,
    message: classified.message,
    details: {
      exitCode: result.exitCode,
      stderr: result.stderr.slice(0, 2000),
    },
  };
}

/** Run AI review via legacy scripts (Codex bash, API JS, or custom JS). */
export async function runAiReviewScript(
  ctx: CheckContext,
): Promise<CheckResult> {
  const blocking = isAiReviewBlocking(ctx);
  const provider = resolveAiProvider(ctx);
  const env = buildAiScriptEnv(ctx);
  const timeoutMs = aiTimeoutMs(ctx);

  if (provider === "api") {
    const script = resolveScriptPath(ctx, "scripts/ai-deductive-review.js");
    if (!script) {
      return skip(
        "aiReview",
        "AI review (api): ai-deductive-review.js not found",
      );
    }
    const result = await runCommand(process.execPath, [script], {
      cwd: ctx.projectRoot,
      env,
      timeoutMs,
    });
    return mapAiScriptResult("aiReview", "AI Review", result, blocking);
  }

  if (provider === "custom") {
    const script = resolveScriptPath(ctx, "scripts/ai-code-review.js");
    if (!script) {
      return skip(
        "aiReview",
        "AI review (custom): ai-code-review.js not found",
      );
    }
    const result = await runCommand(process.execPath, [script], {
      cwd: ctx.projectRoot,
      env,
      timeoutMs,
    });
    return mapAiScriptResult("aiReview", "AI Review", result, blocking);
  }

  const script = resolveScriptPath(ctx, "scripts/ai-code-review.sh");
  if (!script) {
    return skip("aiReview", "AI review (codex): ai-code-review.sh not found");
  }

  const result = await runCommand("bash", [script], {
    cwd: ctx.projectRoot,
    env,
    timeoutMs: Math.max(timeoutMs, 600_000),
  });
  return mapAiScriptResult("aiReview", "AI Review", result, blocking);
}

/** Run Full Explanation check via legacy bash or custom JS. */
export async function runExplanationScript(
  ctx: CheckContext,
): Promise<CheckResult> {
  if (ctx.config.explanationCheck.enabled === false) {
    return skip("explanationCheck", "Full Explanation disabled in config");
  }

  const blocking = isExplanationBlocking(ctx);
  const provider = resolveAiProvider(ctx);
  const env = buildAiScriptEnv(ctx);
  const timeoutMs = aiTimeoutMs(ctx);

  if (provider === "custom") {
    const script = resolveScriptPath(ctx, "scripts/ai-explanation-check.js");
    if (!script) {
      return skip(
        "explanationCheck",
        "Full Explanation (custom): ai-explanation-check.js not found",
      );
    }
    const result = await runCommand(process.execPath, [script], {
      cwd: ctx.projectRoot,
      env,
      timeoutMs,
    });
    return mapAiScriptResult(
      "explanationCheck",
      "Full Explanation",
      result,
      blocking,
    );
  }

  const script = resolveScriptPath(ctx, "scripts/ai-explanation-check.sh");
  if (!script) {
    return skip(
      "explanationCheck",
      "Full Explanation: ai-explanation-check.sh not found",
    );
  }

  const result = await runCommand("bash", [script], {
    cwd: ctx.projectRoot,
    env,
    timeoutMs,
  });
  return mapAiScriptResult(
    "explanationCheck",
    "Full Explanation",
    result,
    blocking,
  );
}
