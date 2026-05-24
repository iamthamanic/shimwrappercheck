import type { CheckDefinition } from "../types.js";
import { runNpmScriptIfPresent, runExternalTool } from "./helpers.js";

export const viteBuildCheck: CheckDefinition = {
  id: "viteBuild",
  label: "Vite Build",
  category: "frontend",
  envKey: "SHIM_RUN_VITE_BUILD",
  defaultEnabled: true,
  requiredTools: ["vite"],
  async run(ctx) {
    const viaScript = await runNpmScriptIfPresent(
      ctx,
      "viteBuild",
      "build",
      "Vite build",
    );
    if (viaScript.status !== "skipped") return viaScript;

    return runExternalTool(
      ctx,
      "viteBuild",
      "vite",
      ["build"],
      "Vite build",
      false,
      true,
    );
  },
};
