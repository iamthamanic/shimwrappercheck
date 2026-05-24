import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { resolveSemgrepBaselineCommit } from "../src/checks/definitions/sast.js";
import * as commandRunner from "../src/runners/command-runner.js";
import * as resolveBinary from "../src/binary/resolve-binary.js";

describe("resolveSemgrepBaselineCommit", () => {
  beforeEach(() => {
    vi.spyOn(resolveBinary, "resolveGitBinary").mockReturnValue({
      path: "/usr/bin/git",
      source: "fallback",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers merge-base with origin/main", async () => {
    vi.spyOn(commandRunner, "runCommand").mockImplementation(
      async (_cmd, args) => {
        if (args[0] === "merge-base") {
          return {
            command: "git",
            args,
            cwd: "/proj",
            exitCode: 0,
            signal: null,
            stdout: "abc123\n",
            stderr: "",
            durationMs: 1,
            timedOut: false,
          };
        }
        return {
          command: "git",
          args,
          cwd: "/proj",
          exitCode: 1,
          signal: null,
          stdout: "",
          stderr: "",
          durationMs: 1,
          timedOut: false,
        };
      },
    );

    const baseline = await resolveSemgrepBaselineCommit("/proj", "/pkg", {});
    expect(baseline).toBe("abc123");
  });

  it("falls back to HEAD~1 when merge-base fails", async () => {
    vi.spyOn(commandRunner, "runCommand").mockImplementation(
      async (_cmd, args) => {
        if (args[0] === "rev-parse") {
          return {
            command: "git",
            args,
            cwd: "/proj",
            exitCode: 0,
            signal: null,
            stdout: "def456\n",
            stderr: "",
            durationMs: 1,
            timedOut: false,
          };
        }
        return {
          command: "git",
          args,
          cwd: "/proj",
          exitCode: 1,
          signal: null,
          stdout: "",
          stderr: "",
          durationMs: 1,
          timedOut: false,
        };
      },
    );

    const baseline = await resolveSemgrepBaselineCommit("/proj", "/pkg", {});
    expect(baseline).toBe("def456");
  });
});
