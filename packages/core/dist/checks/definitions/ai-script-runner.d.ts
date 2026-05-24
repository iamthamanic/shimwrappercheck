import type { CheckContext, CheckResult } from "../types.js";
import { runCommand } from "../../runners/command-runner.js";
export type AiProvider = "auto" | "codex" | "api" | "custom";
/** Resolve CHECK_MODE for AI scripts (refactor forces full). */
export declare function resolveCheckMode(ctx: CheckContext): string;
/** Whether AI review failures should block the overall run. */
export declare function isAiReviewBlocking(ctx: CheckContext): boolean;
/** Whether Full Explanation failures should block the overall run. */
export declare function isExplanationBlocking(ctx: CheckContext): boolean;
/** Resolve AI provider (auto prefers codex when script exists). */
export declare function resolveAiProvider(ctx: CheckContext): AiProvider;
/** Find script under project or package root (supports node_modules shim layout). */
export declare function resolveScriptPath(
  ctx: CheckContext,
  relativePath: string,
): string | null;
/** Build env passed to AI bash/node scripts. */
export declare function buildAiScriptEnv(
  ctx: CheckContext,
  extra?: Record<string, string>,
): NodeJS.ProcessEnv;
/** Map script exit code to CheckResult with optional non-blocking AI policy. */
export declare function mapAiScriptResult(
  id: string,
  label: string,
  result: Awaited<ReturnType<typeof runCommand>>,
  blocking: boolean,
): CheckResult;
/** Run AI review via legacy scripts (Codex bash, API JS, or custom JS). */
export declare function runAiReviewScript(
  ctx: CheckContext,
): Promise<CheckResult>;
/** Run Full Explanation check via legacy bash or custom JS. */
export declare function runExplanationScript(
  ctx: CheckContext,
): Promise<CheckResult>;
//# sourceMappingURL=ai-script-runner.d.ts.map
