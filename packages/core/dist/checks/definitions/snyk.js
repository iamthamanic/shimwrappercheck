import { skip, runExternalTool } from "./helpers.js";
export const snykCheck = {
    id: "snyk",
    label: "Snyk",
    category: "security",
    envKey: "SHIM_RUN_SNYK",
    defaultEnabled: true,
    requiredTools: ["snyk"],
    async run(ctx) {
        if (ctx.env.SKIP_SNYK === "1") {
            return skip("snyk", "Snyk skipped (SKIP_SNYK=1)");
        }
        return runExternalTool(ctx, "snyk", "snyk", ["test"], "Snyk", true);
    },
};
//# sourceMappingURL=snyk.js.map