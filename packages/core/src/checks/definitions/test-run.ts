import type { CheckDefinition } from "../types.js";
import { runNpmScriptIfPresent, runExternalTool } from "./helpers.js";

export const testRunCheck: CheckDefinition = {
  id: "testRun",
  label: "Vitest/Test Run",
  category: "frontend",
  envKey: "SHIM_RUN_TEST_RUN",
  defaultEnabled: true,
  requiredTools: ["vitest"],
  async run(ctx) {
    const build = await runNpmScriptIfPresent(
      ctx,
      "testRun",
      "build",
      "Test run (build)",
    );
    if (build.status !== "skipped" && build.status !== "passed") return build;

    const viaTestRun = await runNpmScriptIfPresent(
      ctx,
      "testRun",
      "test:run",
      "Test run",
    );
    if (viaTestRun.status !== "skipped") return viaTestRun;

    const viaTest = await runNpmScriptIfPresent(
      ctx,
      "testRun",
      "test",
      "Test run",
    );
    if (viaTest.status !== "skipped") return viaTest;

    return runExternalTool(
      ctx,
      "testRun",
      "vitest",
      ["run"],
      "Test run (vitest)",
      false,
      true,
    );
  },
};
