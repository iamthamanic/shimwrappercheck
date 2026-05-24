import fs from "node:fs";
import path from "node:path";
import { resolveBackendDir } from "../resolve-backend-dir.js";
import { fromCommandFailure, skip } from "./helpers.js";
import { runCommand } from "../../runners/command-runner.js";
async function runDenoInBackend(ctx, id, args, label) {
    const backendDir = resolveBackendDir(ctx.projectRoot, ctx.config.backendPathPatterns);
    if (!backendDir) {
        return skip(id, `${label}: no backend path in SHIM_BACKEND_PATH_PATTERNS`);
    }
    const result = await runCommand("deno", args, {
        cwd: ctx.projectRoot,
        env: ctx.env,
        timeoutMs: 600_000,
    });
    return fromCommandFailure(ctx, id, result, label, true);
}
export const denoFmtCheck = {
    id: "denoFmt",
    label: "Deno fmt",
    category: "backend",
    envKey: "SHIM_RUN_DENO_FMT",
    defaultEnabled: true,
    requiredTools: ["deno"],
    async run(ctx) {
        const backendDir = resolveBackendDir(ctx.projectRoot, ctx.config.backendPathPatterns);
        if (!backendDir) {
            return skip("denoFmt", "Deno fmt: no backend directory found");
        }
        return runDenoInBackend(ctx, "denoFmt", ["fmt", "--check", backendDir], "Deno fmt");
    },
};
export const denoLintCheck = {
    id: "denoLint",
    label: "Deno lint",
    category: "backend",
    envKey: "SHIM_RUN_DENO_LINT",
    defaultEnabled: true,
    requiredTools: ["deno"],
    async run(ctx) {
        const backendDir = resolveBackendDir(ctx.projectRoot, ctx.config.backendPathPatterns);
        if (!backendDir) {
            return skip("denoLint", "Deno lint: no backend directory found");
        }
        return runDenoInBackend(ctx, "denoLint", ["lint", backendDir], "Deno lint");
    },
};
export const denoAuditCheck = {
    id: "denoAudit",
    label: "Deno audit",
    category: "backend",
    envKey: "SHIM_RUN_DENO_AUDIT",
    defaultEnabled: true,
    requiredTools: ["deno"],
    async run(ctx) {
        const backendDir = resolveBackendDir(ctx.projectRoot, ctx.config.backendPathPatterns);
        if (!backendDir) {
            return skip("denoAudit", "Deno audit: no backend directory found");
        }
        const serverDir = path.join(backendDir, "server");
        if (!fs.existsSync(serverDir)) {
            return skip("denoAudit", "Deno audit: backend server dir not found");
        }
        const result = await runCommand("deno", ["audit"], {
            cwd: serverDir,
            env: ctx.env,
            timeoutMs: 300_000,
        });
        return fromCommandFailure(ctx, "denoAudit", result, "Deno audit", true);
    },
};
//# sourceMappingURL=deno-checks.js.map