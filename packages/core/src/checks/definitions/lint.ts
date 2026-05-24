import type { CheckDefinition } from "../types.js";
import { runNpmScriptIfPresent, runExternalTool } from "./helpers.js";

export const lintCheck: CheckDefinition = {
  id: "lint",
  label: "ESLint",
  category: "frontend",
  envKey: "SHIM_RUN_LINT",
  defaultEnabled: true,
  requiredTools: ["eslint"],
  async run(ctx) {
    const viaScript = await runNpmScriptIfPresent(
      ctx,
      "lint",
      "lint",
      "ESLint",
    );
    if (viaScript.status !== "skipped") return viaScript;

    return runExternalTool(
      ctx,
      "lint",
      "eslint",
      ["."],
      "ESLint",
      false,
      true,
      { ESLINT_USE_FLAT_CONFIG: "false" },
    );
  },
};
