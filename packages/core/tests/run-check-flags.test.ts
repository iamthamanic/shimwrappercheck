import { describe, expect, it } from "vitest";
import {
  buildRunChecksArgv,
  parseRunChecksFlags,
} from "../src/checks/run-check.js";

describe("parseRunChecksFlags", () => {
  it("parses --no-i18n-check and security skip flags", () => {
    const flags = parseRunChecksFlags([
      "--no-i18n-check",
      "--no-sast",
      "--no-gitleaks",
      "--no-ruff",
      "--no-shellcheck",
    ]);
    expect(flags.noI18nCheck).toBe(true);
    expect(flags.noSast).toBe(true);
    expect(flags.noGitleaks).toBe(true);
    expect(flags.noRuff).toBe(true);
    expect(flags.noShellcheck).toBe(true);
  });
});

describe("buildRunChecksArgv", () => {
  it("round-trips MCP-style options", () => {
    const argv = buildRunChecksArgv({
      frontend: false,
      noAiReview: true,
      noI18nCheck: true,
      refactor: true,
    });
    expect(argv).toContain("--no-frontend");
    expect(argv).toContain("--no-ai-review");
    expect(argv).toContain("--no-i18n-check");
    expect(argv).toContain("--refactor");
  });
});
