import { describe, expect, it } from "vitest";
import type { GitRunner } from "../src/ai-review/chunk-diff.js";
import {
  buildCommitDiff,
  buildSnippetDiff,
  limitDiffBytes,
} from "../src/ai-review/chunk-diff.js";

describe("chunk-diff", () => {
  it("limitDiffBytes keeps small diffs intact", () => {
    const small = "line\n".repeat(10);
    expect(limitDiffBytes(small, 100)).toBe(small);
  });

  it("limitDiffBytes truncates large diffs with head and tail", () => {
    const large = "x".repeat(500);
    const limited = limitDiffBytes(large, 100);
    expect(limited).toContain("...[truncated");
    expect(Buffer.byteLength(limited, "utf8")).toBeLessThan(Buffer.byteLength(large, "utf8"));
  });

  it("buildCommitDiff returns empty when git diff is empty", async () => {
    const runGit: GitRunner = async (_git, args) => {
      if (args[0] === "rev-parse") return { stdout: "", exitCode: 0 };
      if (args[0] === "diff") return { stdout: "", exitCode: 0 };
      return { stdout: "", exitCode: 0 };
    };
    const result = await buildCommitDiff("/tmp", "/usr/bin/git", runGit);
    expect(result.empty).toBe(true);
    expect(result.source).toBe("commit");
  });

  it("buildSnippetDiff aggregates unstaged and staged output", async () => {
    const runGit: GitRunner = async (_git, args) => {
      if (args.includes("--cached")) return { stdout: "+cached\n", exitCode: 0 };
      if (args[0] === "diff") return { stdout: "+local\n", exitCode: 0 };
      return { stdout: "", exitCode: 1 };
    };
    const result = await buildSnippetDiff("/tmp", "/usr/bin/git", runGit);
    expect(result.empty).toBe(false);
    expect(result.content).toContain("+local");
    expect(result.content).toContain("+cached");
  });
});
