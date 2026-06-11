import { skip, fromCommandFailure, projectFileExists } from "./helpers.js";
import { runCommand } from "../../runners/command-runner.js";
export const fallowCheck = {
    id: "fallow",
    label: "Fallow",
    category: "other",
    envKey: "SHIM_RUN_FALLOW",
    defaultEnabled: false,
    requiredTools: ["fallow"],
    async run(ctx) {
        if (ctx.flags.noFallow) {
            return skip("fallow", "Fallow disabled via --no-fallow");
        }
        if (!projectFileExists(ctx, "package.json")) {
            return skip("fallow", "Fallow: no package.json");
        }
        const result = await runCommand("npx", ["fallow"], {
            cwd: ctx.projectRoot,
            env: ctx.env,
            timeoutMs: 600_000,
        });
        return fromCommandFailure(ctx, "fallow", result, "Fallow", true);
    },
};
//# sourceMappingURL=fallow.js.map