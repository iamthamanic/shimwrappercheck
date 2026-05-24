import { runBashScriptIfExists } from "./helpers.js";
export const projectRulesCheck = {
    id: "projectRules",
    label: "Projektregeln",
    category: "frontend",
    envKey: "SHIM_RUN_PROJECT_RULES",
    defaultEnabled: true,
    requiredTools: ["bash"],
    async run(ctx) {
        return runBashScriptIfExists(ctx, "projectRules", "scripts/checks/project-rules.sh", "Projektregeln");
    },
};
//# sourceMappingURL=project-rules.js.map