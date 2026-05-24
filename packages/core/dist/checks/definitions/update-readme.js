import { runNodeScriptIfExists } from "./helpers.js";
export const updateReadmeCheck = {
    id: "updateReadme",
    label: "Update README",
    category: "frontend",
    envKey: "SHIM_RUN_UPDATE_README",
    defaultEnabled: true,
    requiredTools: [],
    async run(ctx) {
        return runNodeScriptIfExists(ctx, "updateReadme", [
            "node_modules/shimwrappercheck/scripts/update-readme.js",
            "scripts/update-readme.js",
        ], "Update README");
    },
};
//# sourceMappingURL=update-readme.js.map