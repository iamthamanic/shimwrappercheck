import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { CheckContext } from "../src/checks/types.js";
import type { ShimConfig } from "../src/config/schema.js";
import {
  mapAiScriptResult,
  resolveCheckMode,
  isAiReviewBlocking,
  runAiReviewScript,
} from "../src/checks/definitions/ai-script-runner.js";
import { resolveAiReviewEngine } from "../src/ai-review/provider-resolver.js";
import { runAiReview } from "../src/ai-review/run-ai-review.js";
import * as commandRunner from "../src/runners/command-runner.js";

const baseConfig: ShimConfig = {
  version: 1,
  checkMode: "commit",
  checks: {},
  autoPush: false,
  auditLevel: "moderate",
  continueOnError: false,
  strictNetworkChecks: false,
  i18nRequireMessagesDir: true,
  aiReview: { provider: "codex", blocking: false, minRating: 95 },
  explanationCheck: { enabled: true, minRating: 95 },
  backendPathPatterns: "supabase/functions",
};

function makeCtx(overrides: Partial<CheckContext> = {}): CheckContext {
  return {
    projectRoot: "/proj",
    packageRoot: "/pkg",
    config: baseConfig,
    env: {},
    flags: {
      frontend: true,
      backend: true,
      noAiReview: false,
      noExplanationCheck: false,
      noI18nCheck: false,
      noSast: false,
      noGitleaks: false,
      noRuff: false,
      noShellcheck: false,
      refactor: false,
      until95: false,
    },
    ...overrides,
  };
}

describe("ai-script-runner", () => {
  it("resolveCheckMode forces full on --refactor", () => {
    const ctx = makeCtx({
      flags: { ...makeCtx().flags, refactor: true },
      env: { CHECK_MODE: "commit" },
    });
    expect(resolveCheckMode(ctx)).toBe("full");
  });

  it("isAiReviewBlocking respects config and env", () => {
    expect(isAiReviewBlocking(makeCtx())).toBe(false);
    expect(
      isAiReviewBlocking(
        makeCtx({
          config: {
            ...baseConfig,
            aiReview: { ...baseConfig.aiReview, blocking: true },
          },
        }),
      ),
    ).toBe(true);
    expect(
      isAiReviewBlocking(makeCtx({ env: { SHIM_AI_REVIEW_BLOCKING: "1" } })),
    ).toBe(true);
  });

  it("mapAiScriptResult returns warning when non-blocking and script fails", () => {
    const result = mapAiScriptResult(
      "aiReview",
      "AI Review",
      {
        command: "bash",
        args: [],
        cwd: "/proj",
        exitCode: 1,
        signal: null,
        stdout: "",
        stderr: "REJECT",
        durationMs: 10,
        timedOut: false,
      },
      false,
    );
    expect(result.status).toBe("warning");
    expect(result.blocking).toBe(false);
  });

  it("mapAiScriptResult returns failed when blocking and script fails", () => {
    const result = mapAiScriptResult(
      "aiReview",
      "AI Review",
      {
        command: "bash",
        args: [],
        cwd: "/proj",
        exitCode: 1,
        signal: null,
        stdout: "",
        stderr: "REJECT",
        durationMs: 10,
        timedOut: false,
      },
      true,
    );
    expect(result.status).toBe("failed");
    expect(result.blocking).toBe(true);
  });
});

describe("ai-review engine", () => {
  it("resolveAiReviewEngine defaults to core", () => {
    expect(resolveAiReviewEngine({})).toBe("core");
    expect(resolveAiReviewEngine({ SHIM_AI_REVIEW_ENGINE: "legacy" })).toBe(
      "legacy",
    );
  });
});

describe("runAiReviewScript", () => {
  beforeEach(() => {
    vi.spyOn(commandRunner, "runCommand").mockResolvedValue({
      command: "bash",
      args: [],
      cwd: "/proj",
      exitCode: 0,
      signal: null,
      stdout: "ACCEPT",
      stderr: "",
      durationMs: 5,
      timedOut: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runAiReview uses legacy bash when SHIM_AI_REVIEW_ENGINE=legacy", async () => {
    const ctx = makeCtx({
      projectRoot: process.cwd(),
      packageRoot: process.cwd(),
      env: { SHIM_AI_REVIEW_ENGINE: "legacy" },
    });
    await runAiReview(ctx);
    expect(commandRunner.runCommand).toHaveBeenCalled();
    const call = vi.mocked(commandRunner.runCommand).mock.calls[0];
    expect(call?.[0]).toBe("bash");
  });

  it("invokes ai-code-review.sh with CHECK_MODE from context", async () => {
    const ctx = makeCtx({
      projectRoot: process.cwd(),
      packageRoot: process.cwd(),
      env: { CHECK_MODE: "snippet" },
    });
    const result = await runAiReviewScript(ctx);
    expect(result.status).toBe("passed");
    expect(commandRunner.runCommand).toHaveBeenCalled();
    const call = vi.mocked(commandRunner.runCommand).mock.calls[0];
    expect(call?.[2]?.env?.CHECK_MODE).toBe("snippet");
  });
});
