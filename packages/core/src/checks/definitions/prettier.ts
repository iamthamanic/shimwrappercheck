import type { CheckDefinition } from "../types.js";
import { runNpmScriptIfPresent } from "./helpers.js";

export const prettierCheck: CheckDefinition = {
  id: "prettier",
  label: "Prettier",
  category: "frontend",
  envKey: "SHIM_RUN_PRETTIER",
  defaultEnabled: true,
  requiredTools: ["prettier"],
  async run(ctx) {
    const viaScript = await runNpmScriptIfPresent(
      ctx,
      "prettier",
      "format:check",
      "Prettier",
    );
    if (viaScript.status !== "skipped") return viaScript;
    const { runExternalTool } = await import("./helpers.js");
    return runExternalTool(
      ctx,
      "prettier",
      "prettier",
      ["--check", "."],
      "Prettier",
      false,
      true,
    );
  },
};
