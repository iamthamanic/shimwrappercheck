import type { CheckDefinition } from "../types.js";
import { skip } from "./helpers.js";
import { runExplanationScript } from "./ai-script-runner.js";

/**
 * Full Explanation check via scripts/ai-explanation-check.sh (Codex) or custom JS.
 * Blocking only when SHIM_EXPLANATION_BLOCKING is set.
 */
export const explanationCheck: CheckDefinition = {
  id: "explanationCheck",
  label: "Full Explanation",
  category: "ai",
  envKey: "SHIM_RUN_EXPLANATION_CHECK",
  defaultEnabled: true,
  requiredTools: [],
  async run(ctx) {
    if (ctx.flags.noExplanationCheck) {
      return skip(
        "explanationCheck",
        "Full Explanation disabled via --no-explanation-check",
      );
    }
    return runExplanationScript(ctx);
  },
};
