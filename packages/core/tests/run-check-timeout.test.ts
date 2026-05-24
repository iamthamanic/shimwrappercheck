import { describe, expect, it } from "vitest";
import { runAllChecks } from "../src/checks/run-check.js";
import type { ShimConfig } from "../src/config/schema.js";

const minimalConfig: ShimConfig = {
  version: 1,
  checkMode: "commit",
  checks: {},
  autoPush: false,
  auditLevel: "moderate",
  continueOnError: false,
  strictNetworkChecks: false,
  i18nRequireMessagesDir: true,
  aiReview: { provider: "auto", blocking: false, minRating: 95 },
  explanationCheck: { enabled: true, minRating: 95 },
  backendPathPatterns: "supabase/functions",
};

describe("runAllChecks timeoutSec", () => {
  it("accepts timeoutSec and completes when no checks run", async () => {
    const { config } = await import("../src/config/load-config.js").then((m) =>
      m.loadConfig({ projectRoot: process.cwd() }),
    );
    const allDisabled = Object.fromEntries(
      Object.keys(config.checks).map((id) => [id, false]),
    );

    const result = await runAllChecks({
      projectRoot: process.cwd(),
      packageRoot: process.cwd(),
      config: { ...config, checks: allDisabled },
      flags: {
        frontend: true,
        backend: true,
        noAiReview: true,
        noExplanationCheck: true,
        noI18nCheck: true,
        noSast: true,
        noGitleaks: true,
        noRuff: true,
        noShellcheck: true,
        refactor: false,
        until95: false,
      },
      writeReport: false,
      timeoutSec: 600,
    });
    expect(result.ok).toBe(true);
  });

  it("returns infra_error when timeoutSec elapses before checks finish", async () => {
    const slowConfig: ShimConfig = {
      ...minimalConfig,
      checks: { aiReview: true },
      checkOrder: ["aiReview"],
    };

    const result = await runAllChecks({
      projectRoot: process.cwd(),
      packageRoot: process.cwd(),
      config: slowConfig,
      flags: {
        frontend: true,
        backend: false,
        noAiReview: false,
        noExplanationCheck: true,
        noI18nCheck: true,
        noSast: true,
        noGitleaks: true,
        noRuff: true,
        noShellcheck: true,
        refactor: false,
        until95: false,
      },
      env: {
        SHIM_AI_TIMEOUT_SEC: "600",
      },
      writeReport: false,
      timeoutSec: 0.001,
    });

    expect(result.ok).toBe(false);
    expect(result.failedIds).toContain("runAllChecks");
    expect(result.infraErrorIds).toContain("runAllChecks");
    expect(result.summary.infra_error).toBe(1);
  });
});
