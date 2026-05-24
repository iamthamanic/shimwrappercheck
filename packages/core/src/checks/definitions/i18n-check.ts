import type { CheckDefinition } from "../types.js";
import { skip, runNodeScriptIfExists } from "./helpers.js";

export const i18nCheck: CheckDefinition = {
  id: "i18nCheck",
  label: "i18n Check",
  category: "frontend",
  envKey: "SHIM_RUN_I18N_CHECK",
  defaultEnabled: true,
  requiredTools: [],
  async run(ctx) {
    if (ctx.flags.noI18nCheck) {
      return skip("i18nCheck", "i18n check disabled via --no-i18n-check");
    }
    return runNodeScriptIfExists(
      ctx,
      "i18nCheck",
      ["scripts/i18n-check.js"],
      "i18n check",
    );
  },
};
