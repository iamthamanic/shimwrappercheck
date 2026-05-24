import { resolveBinary } from "../binary/resolve-binary.js";
import { resolveAiProvider, resolveCheckMode, } from "../checks/definitions/ai-script-runner.js";
/** SHIM_AI_REVIEW_ENGINE=legacy forces bash; otherwise prefer TypeScript core. */
export function resolveAiReviewEngine(env = process.env) {
    const raw = String(env.SHIM_AI_REVIEW_ENGINE ?? "core").toLowerCase();
    return raw === "legacy" ? "legacy" : "core";
}
export { resolveAiProvider };
/** Locate codex CLI on PATH (not blocked under node_modules shims). */
export function resolveCodexBinary(env = process.env) {
    const resolved = resolveBinary({
        envKeys: ["SHIM_CODEX_BIN"],
        commandName: "codex",
        blockedPathSubstrings: ["node_modules"],
        env,
    });
    return resolved ? { path: resolved.path } : null;
}
/** Whether core TypeScript review can run for this context. */
export function canRunCoreAiReview(ctx) {
    if (resolveAiReviewEngine(ctx.env) === "legacy")
        return false;
    if (resolveAiProvider(ctx) !== "codex")
        return false;
    if (!resolveCodexBinary(ctx.env))
        return false;
    if (resolveCheckMode(ctx) === "full")
        return false;
    return true;
}
//# sourceMappingURL=provider-resolver.js.map