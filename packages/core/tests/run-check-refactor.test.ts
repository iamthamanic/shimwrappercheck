import { describe, expect, it } from "vitest";
import {
  buildRunChecksEnv,
  parseRunChecksFlags,
} from "../src/checks/run-check.js";
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

describe("buildRunChecksEnv", () => {
  it("sets CHECK_MODE=full when --refactor is passed", () => {
    const flags = parseRunChecksFlags(["--refactor"]);
    const env = buildRunChecksEnv(
      { CHECK_MODE: "commit" },
      minimalConfig,
      flags,
    );
    expect(env.CHECK_MODE).toBe("full");
  });

  it("preserves explicit CHECK_MODE when not refactoring", () => {
    const flags = parseRunChecksFlags([]);
    const env = buildRunChecksEnv(
      { CHECK_MODE: "snippet" },
      minimalConfig,
      flags,
    );
    expect(env.CHECK_MODE).toBe("snippet");
  });
});

describe("parseRunChecksFlags refactor", () => {
  it("sets refactor for --until-95 and until95 flag", () => {
    const flags = parseRunChecksFlags(["--until-95"]);
    expect(flags.refactor).toBe(true);
    expect(flags.until95).toBe(true);
  });
});
