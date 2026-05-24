import { describe, expect, it } from "vitest";
import {
  classifyCommandFailure,
  isBlockingStatus,
} from "../src/runners/error-classifier.js";
import type { CommandRunResult } from "../src/runners/result.js";

function baseResult(overrides: Partial<CommandRunResult>): CommandRunResult {
  return {
    command: "test",
    args: [],
    cwd: "/tmp",
    exitCode: 1,
    signal: null,
    stdout: "",
    stderr: "",
    durationMs: 10,
    timedOut: false,
    ...overrides,
  };
}

describe("classifyCommandFailure", () => {
  it("classifies timeout as infra_error", () => {
    const c = classifyCommandFailure(
      baseResult({ timedOut: true, durationMs: 5000 }),
      "Lint",
    );
    expect(c.status).toBe("infra_error");
    expect(c.infra).toBe(true);
  });

  it("classifies command not found as infra_error", () => {
    const c = classifyCommandFailure(
      baseResult({ exitCode: 127, stderr: "command not found" }),
      "Lint",
    );
    expect(c.status).toBe("infra_error");
  });

  it("classifies normal failure as failed", () => {
    const c = classifyCommandFailure(baseResult({ exitCode: 2 }), "Lint");
    expect(c.status).toBe("failed");
  });
});

describe("isBlockingStatus", () => {
  it("infra_error always blocks", () => {
    expect(isBlockingStatus("infra_error", false)).toBe(true);
  });

  it("failed respects blocking flag", () => {
    expect(isBlockingStatus("failed", true)).toBe(true);
    expect(isBlockingStatus("failed", false)).toBe(false);
  });
});
