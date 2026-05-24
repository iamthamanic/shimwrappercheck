import { skip, fromCommandFailure } from "./helpers.js";
import { runCommand } from "../../runners/command-runner.js";
import { resolveGitBinary } from "../../binary/resolve-binary.js";
/** Resolve Semgrep baseline commit (merge-base with origin/main, else HEAD~1). */
export async function resolveSemgrepBaselineCommit(projectRoot, packageRoot, env) {
    const git = resolveGitBinary(packageRoot, env);
    if (!git)
        return undefined;
    const mergeBase = await runCommand(git.path, ["merge-base", "HEAD", "origin/main"], { cwd: projectRoot, env, timeoutMs: 30_000 });
    if (mergeBase.exitCode === 0 && mergeBase.stdout.trim()) {
        return mergeBase.stdout.trim();
    }
    const headPrev = await runCommand(git.path, ["rev-parse", "HEAD~1"], {
        cwd: projectRoot,
        env,
        timeoutMs: 30_000,
    });
    if (headPrev.exitCode === 0 && headPrev.stdout.trim()) {
        return headPrev.stdout.trim();
    }
    return undefined;
}
export const sastCheck = {
    id: "sast",
    label: "Semgrep",
    category: "security",
    envKey: "SHIM_RUN_SAST",
    defaultEnabled: false,
    requiredTools: ["semgrep"],
    async run(ctx) {
        if (ctx.flags.noSast) {
            return skip("sast", "Semgrep disabled via --no-sast");
        }
        const baseline = await resolveSemgrepBaselineCommit(ctx.projectRoot, ctx.packageRoot, ctx.env);
        const args = ["scan"];
        if (baseline) {
            args.push("--baseline-commit", baseline);
        }
        args.push("--config", "auto", ".", "--error");
        let result = await runCommand("semgrep", args, {
            cwd: ctx.projectRoot,
            env: ctx.env,
            timeoutMs: 600_000,
        });
        if (result.exitCode === 127 || /not found/i.test(result.stderr)) {
            result = await runCommand("npx", ["semgrep", ...args], {
                cwd: ctx.projectRoot,
                env: ctx.env,
                timeoutMs: 600_000,
            });
            if (result.exitCode === 127) {
                return skip("sast", "Semgrep not installed (pip install semgrep or npx semgrep)");
            }
        }
        return fromCommandFailure(ctx, "sast", result, "Semgrep", true);
    },
};
//# sourceMappingURL=sast.js.map