import fs from "node:fs";
import path from "node:path";
import { skip, fromCommandFailure } from "./helpers.js";
import { runCommand } from "../../runners/command-runner.js";
export const gitleaksCheck = {
    id: "gitleaks",
    label: "Gitleaks",
    category: "security",
    envKey: "SHIM_RUN_GITLEAKS",
    defaultEnabled: false,
    requiredTools: ["gitleaks"],
    async run(ctx) {
        if (ctx.flags.noGitleaks) {
            return skip("gitleaks", "Gitleaks disabled via --no-gitleaks");
        }
        const configPath = path.join(ctx.projectRoot, ".gitleaks.toml");
        const args = fs.existsSync(configPath)
            ? [
                "detect",
                "--config",
                configPath,
                "--no-git",
                "--source",
                ".",
                "--verbose",
            ]
            : ["detect", "--no-git", "--source", ".", "--verbose"];
        const result = await runCommand("gitleaks", args, {
            cwd: ctx.projectRoot,
            env: ctx.env,
            timeoutMs: 300_000,
        });
        return fromCommandFailure(ctx, "gitleaks", result, "Gitleaks", true);
    },
};
//# sourceMappingURL=gitleaks.js.map