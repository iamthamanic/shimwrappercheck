import { DEFAULT_CHECK_CATALOG, ShimConfigSchema } from "./schema.js";
import { isRcEnabled } from "./legacy-rc-parser.js";
/**
 * Deterministic merge: base config < RC-derived < process.env overrides.
 * CHECK_MODE from env wins when set (pre-push behavior).
 */
export function mergeConfig(base, env = process.env) {
    const merged = {
        ...base,
        checks: { ...base.checks },
        aiReview: { ...base.aiReview },
        explanationCheck: { ...base.explanationCheck },
    };
    if (env.CHECK_MODE) {
        let mode = env.CHECK_MODE.toLowerCase();
        if (mode === "mix")
            mode = "full";
        if (mode === "diff")
            mode = "snippet";
        if (mode === "snippet" || mode === "commit" || mode === "full") {
            merged.checkMode = mode;
        }
    }
    if (env.SHIM_PROJECT_ROOT) {
        merged.projectRoot = env.SHIM_PROJECT_ROOT;
    }
    for (const entry of DEFAULT_CHECK_CATALOG) {
        const envVal = env[entry.envKey];
        if (envVal != null && envVal !== "") {
            merged.checks[entry.id] = isRcEnabled(envVal, entry.defaultEnabled);
        }
    }
    if (env.SKIP_AI_REVIEW === "1" || env.SHIM_SKIP_AI_REVIEW === "1") {
        merged.checks.aiReview = false;
    }
    if (env.SKIP_EXPLANATION_CHECK === "1") {
        merged.checks.explanationCheck = false;
    }
    if (env.SHIM_AI_REVIEW_PROVIDER) {
        const p = env.SHIM_AI_REVIEW_PROVIDER.toLowerCase();
        if (p === "codex" || p === "api" || p === "custom" || p === "auto") {
            merged.aiReview.provider = p;
        }
    }
    if (env.SHIM_AI_REVIEW_BLOCKING != null &&
        env.SHIM_AI_REVIEW_BLOCKING !== "") {
        merged.aiReview.blocking = isRcEnabled(env.SHIM_AI_REVIEW_BLOCKING, false);
    }
    if (env.SHIM_STRICT_NETWORK_CHECKS != null &&
        env.SHIM_STRICT_NETWORK_CHECKS !== "") {
        merged.strictNetworkChecks = isRcEnabled(env.SHIM_STRICT_NETWORK_CHECKS, false);
    }
    if (env.SHIM_AI_MIN_RATING) {
        const n = Number.parseInt(env.SHIM_AI_MIN_RATING, 10);
        if (Number.isFinite(n))
            merged.aiReview.minRating = n;
    }
    if (env.SHIM_CHECK_ORDER) {
        merged.checkOrder = env.SHIM_CHECK_ORDER.split(",")
            .map((p) => p.trim())
            .filter(Boolean);
    }
    return ShimConfigSchema.parse(merged);
}
//# sourceMappingURL=merge-env.js.map