import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildRefactorHandoff,
  findLatestReviewFile,
  normalizeRefactorMode,
  resolveRefactorPaths,
  runRefactorOrchestration,
} from "../src/refactor/orchestration.js";

describe("refactor orchestration", () => {
  it("normalizeRefactorMode accepts interactive and agent", () => {
    expect(normalizeRefactorMode("interactive")).toBe("interactive");
    expect(normalizeRefactorMode("AGENT")).toBe("agent");
    expect(normalizeRefactorMode("bogus")).toBe("off");
  });

  it("resolveRefactorPaths uses env overrides", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swc-refactor-"));
    const paths = resolveRefactorPaths(tmp, {
      SHIM_REFACTOR_DIR: ".shim/custom-refactor",
      SHIM_AI_REVIEW_DIR: ".shim/custom-reviews",
    });
    expect(paths.refactorDir).toBe(path.join(tmp, ".shim/custom-refactor"));
    expect(paths.reviewsDir).toBe(path.join(tmp, ".shim/custom-reviews"));
  });

  it("buildRefactorHandoff writes state and picks current item", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swc-handoff-"));
    const todoPath = path.join(tmp, "todo.json");
    const statePath = path.join(tmp, "state.json");
    const currentPath = path.join(tmp, "current.json");

    fs.writeFileSync(
      todoPath,
      JSON.stringify({
        items: [
          { id: "a", status: "todo", title: "First" },
          { id: "b", status: "done", title: "Done" },
          { id: "c", status: "todo", title: "Second" },
        ],
      }),
      "utf8",
    );

    const result = buildRefactorHandoff(
      todoPath,
      statePath,
      currentPath,
      "/reviews/review-full-x.md",
      "interactive",
      { overrideIndex: "1" },
    );

    expect(result.openItems).toHaveLength(2);
    expect(result.message).toContain("Second");
    expect(fs.existsSync(statePath)).toBe(true);
    expect(fs.existsSync(currentPath)).toBe(true);
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    expect(state.phase).toBe("item");
    expect(state.totalItems).toBe(2);
  });

  it("findLatestReviewFile prefers review-full-*", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swc-reviews-"));
    fs.writeFileSync(path.join(tmp, "review-commit-a.md"), "# commit", "utf8");
    const fullPath = path.join(tmp, "review-full-b.md");
    fs.writeFileSync(fullPath, "# full", "utf8");
    const latest = new Date(Date.now() + 1000);
    fs.utimesSync(path.join(tmp, "review-commit-a.md"), latest, latest);

    expect(findLatestReviewFile(tmp)).toBe(fullPath);
  });

  it("runRefactorOrchestration skips when mode off", async () => {
    const result = await runRefactorOrchestration({
      projectRoot: os.tmpdir(),
      packageRoot: os.tmpdir(),
      refactorRequested: true,
      env: { SHIM_REFACTOR_MODE: "off" },
    });
    expect(result.skipped).toBe(true);
  });
});

describe("until-95 loop", () => {
  it("resolveUntil95MaxIterations reads env", async () => {
    const { resolveUntil95MaxIterations } =
      await import("../src/refactor/until-95-loop.js");
    expect(
      resolveUntil95MaxIterations({ SHIM_UNTIL95_MAX_ITERATIONS: "3" }),
    ).toBe(3);
    expect(resolveUntil95MaxIterations({})).toBe(10);
  });
});
