import { DEFAULT_CHECK_CATALOG, ShimConfigSchema } from "./schema.js";
/** Parse a shell-style rc value into plain text. */
export function parseRcValue(rawValue) {
    const trimmed = String(rawValue ?? "").trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
/** Read .shimwrappercheckrc-like content into a key/value map. */
export function parseLegacyRcContent(content) {
    const result = {};
    for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#"))
            continue;
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (!match)
            continue;
        result[match[1]] = parseRcValue(match[2]);
    }
    return result;
}
/** Normalize boolean-ish rc values (matches scripts/lib/rc-utils.js). */
export function isRcEnabled(value, defaultEnabled) {
    if (value == null || value === "")
        return defaultEnabled;
    const normalized = String(value).trim().toLowerCase();
    return !["0", "false", "no", "off"].includes(normalized);
}
/** Map legacy SHIM_* keys to canonical ShimConfig v1. */
export function legacyRcToConfig(rc, options) {
    const checks = {};
    for (const entry of DEFAULT_CHECK_CATALOG) {
        checks[entry.id] = isRcEnabled(rc[entry.envKey], entry.defaultEnabled);
    }
    const checkOrderRaw = rc.SHIM_CHECK_ORDER?.trim();
    const checkOrder = checkOrderRaw
        ? checkOrderRaw
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : undefined;
    const checkModeRaw = (rc.CHECK_MODE ?? "full").toLowerCase();
    const checkMode = checkModeRaw === "snippet" ||
        checkModeRaw === "commit" ||
        checkModeRaw === "full"
        ? checkModeRaw
        : "full";
    const draft = {
        version: 1,
        checkMode,
        checkOrder,
        checks,
        enforceCommands: rc.SHIM_ENFORCE_COMMANDS,
        hookCommands: rc.SHIM_HOOK_COMMANDS,
        autoPush: isRcEnabled(rc.SHIM_AUTO_PUSH, false),
        gitEnforceCommands: rc.SHIM_GIT_ENFORCE_COMMANDS,
        gitCheckModeOnPush: rc.SHIM_GIT_CHECK_MODE_ON_PUSH === "snippet" ||
            rc.SHIM_GIT_CHECK_MODE_ON_PUSH === "commit" ||
            rc.SHIM_GIT_CHECK_MODE_ON_PUSH === "full"
            ? rc.SHIM_GIT_CHECK_MODE_ON_PUSH
            : undefined,
        auditLevel: normalizeAuditLevel(rc.SHIM_AUDIT_LEVEL),
        continueOnError: isRcEnabled(rc.SHIM_CONTINUE_ON_ERROR, false),
        strictNetworkChecks: isRcEnabled(rc.SHIM_STRICT_NETWORK_CHECKS, false),
        i18nRequireMessagesDir: isRcEnabled(rc.SHIM_I18N_REQUIRE_MESSAGES_DIR, true),
        aiReview: {
            provider: normalizeAiProvider(rc.SHIM_AI_REVIEW_PROVIDER),
            blocking: isRcEnabled(rc.SHIM_AI_REVIEW_BLOCKING, false),
            minRating: parseIntOrDefault(rc.SHIM_AI_MIN_RATING, 95),
            timeoutSec: parseIntOrUndefined(rc.SHIM_AI_TIMEOUT_SEC),
        },
        explanationCheck: {
            enabled: checks.explanationCheck ?? true,
            minRating: parseIntOrDefault(rc.SHIM_EXPLANATION_MIN_RATING, 95),
        },
        backendPathPatterns: rc.SHIM_BACKEND_PATH_PATTERNS ??
            "supabase/functions,src/supabase/functions",
        projectRoot: options?.projectRoot,
    };
    return ShimConfigSchema.parse(draft);
}
function normalizeAuditLevel(value) {
    const v = (value ?? "moderate").toLowerCase();
    if (v === "low" || v === "high" || v === "critical")
        return v;
    return "moderate";
}
function normalizeAiProvider(value) {
    const v = (value ?? "auto").toLowerCase();
    if (v === "codex" || v === "api" || v === "custom")
        return v;
    if (v === "api-key" || v === "apikey" || v === "openai" || v === "anthropic")
        return "api";
    return "auto";
}
function parseIntOrDefault(value, fallback) {
    if (!value)
        return fallback;
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : fallback;
}
function parseIntOrUndefined(value) {
    if (!value)
        return undefined;
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
}
/** Convert text to a quoted/escaped shell value (matches scripts/lib/rc-utils.js). */
export function serializeRcValue(value) {
    const normalized = String(value ?? "");
    if (/^[0-9]+$/.test(normalized))
        return normalized;
    const escaped = normalized.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${escaped}"`;
}
//# sourceMappingURL=legacy-rc-parser.js.map