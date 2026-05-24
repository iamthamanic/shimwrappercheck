import fs from "node:fs";
import path from "node:path";
import { runNpmScriptIfPresent, runExternalTool } from "./helpers.js";
export const typecheckCheck = {
    id: "typecheck",
    label: "TypeScript Check",
    category: "frontend",
    envKey: "SHIM_RUN_TYPECHECK",
    defaultEnabled: true,
    requiredTools: ["typescript"],
    async run(ctx) {
        const viaScript = await runNpmScriptIfPresent(ctx, "typecheck", "typecheck", "TypeScript");
        if (viaScript.status !== "skipped")
            return viaScript;
        const dashTs = path.join(ctx.projectRoot, "dashboard/tsconfig.json");
        const args = fs.existsSync(dashTs)
            ? ["--noEmit", "-p", dashTs]
            : ["--noEmit"];
        return runExternalTool(ctx, "typecheck", "tsc", args, "TypeScript", false, true);
    },
};
//# sourceMappingURL=typecheck.js.map