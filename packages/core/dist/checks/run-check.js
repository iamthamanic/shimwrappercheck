import { CHECK_REGISTRY, getDefaultRunOrder } from "./registry.js";
import { isBlockingStatus } from "../runners/error-classifier.js";
import { toRunAllChecksResult } from "./aggregate-results.js";
import { writeReport, writeLastError, clearLastError, } from "../reports/write-report.js";
import { resolveCheckMode } from "./definitions/ai-script-runner.js";
const FRONTEND_CHECK_IDS = new Set([
    "updateReadme",
    "prettier",
    "lint",
    "typecheck",
    "projectRules",
    "i18nCheck",
    "checkMockData",
    "viteBuild",
    "testRun",
    "npmAudit",
    "snyk",
]);
const BACKEND_CHECK_IDS = new Set(["denoFmt", "denoLint", "denoAudit"]);
const FLAG_SKIP_MAP = {
    aiReview: "noAiReview",
    explanationCheck: "noExplanationCheck",
    i18nCheck: "noI18nCheck",
    sast: "noSast",
    gitleaks: "noGitleaks",
    ruff: "noRuff",
    shellcheck: "noShellcheck",
};
/** Parse argv flags from run-checks.sh / CLI / MCP. */
export function parseRunChecksFlags(argv) {
    const has = (flag) => argv.includes(flag);
    let frontend = !has("--no-frontend");
    let backend = !has("--no-backend");
    if (has("--frontend"))
        frontend = true;
    if (has("--backend"))
        backend = true;
    if (!has("--frontend") &&
        !has("--backend") &&
        !has("--no-frontend") &&
        !has("--no-backend")) {
        frontend = true;
        backend = true;
    }
    return {
        frontend,
        backend,
        noAiReview: has("--no-ai-review") || process.env.SKIP_AI_REVIEW === "1",
        noExplanationCheck: has("--no-explanation-check") ||
            process.env.SKIP_EXPLANATION_CHECK === "1",
        noI18nCheck: has("--no-i18n-check") || process.env.SKIP_I18N_CHECK === "1",
        noSast: has("--no-sast"),
        noGitleaks: has("--no-gitleaks"),
        noRuff: has("--no-ruff"),
        noShellcheck: has("--no-shellcheck"),
        refactor: has("--refactor") || has("--until-95"),
        until95: has("--until-95"),
    };
}
/** Build argv for core engine from MCP/structured options. */
export function buildRunChecksArgv(opts) {
    const argv = [];
    if (opts.frontend === false)
        argv.push("--no-frontend");
    if (opts.backend === false)
        argv.push("--no-backend");
    if (opts.noAiReview)
        argv.push("--no-ai-review");
    if (opts.noExplanationCheck)
        argv.push("--no-explanation-check");
    if (opts.noI18nCheck)
        argv.push("--no-i18n-check");
    if (opts.noSast)
        argv.push("--no-sast");
    if (opts.noGitleaks)
        argv.push("--no-gitleaks");
    if (opts.noRuff)
        argv.push("--no-ruff");
    if (opts.noShellcheck)
        argv.push("--no-shellcheck");
    if (opts.refactor)
        argv.push("--refactor");
    if (opts.until95)
        argv.push("--until-95");
    return argv;
}
/** Resolve which checks to run based on config and flags. */
export function resolveCheckOrder(config, flags) {
    const baseOrder = config.checkOrder?.length
        ? config.checkOrder
        : getDefaultRunOrder();
    const registeredIds = new Set(CHECK_REGISTRY.map((c) => c.id));
    const enabled = (id) => config.checks[id] !== false;
    return baseOrder.filter((id) => {
        if (!registeredIds.has(id))
            return false;
        if (!enabled(id))
            return false;
        if (FRONTEND_CHECK_IDS.has(id) && !flags.frontend)
            return false;
        if (BACKEND_CHECK_IDS.has(id) && !flags.backend)
            return false;
        const flagKey = FLAG_SKIP_MAP[id];
        if (flagKey && flags[flagKey])
            return false;
        return true;
    });
}
/** Build process env with CHECK_MODE (refactor → full). */
export function buildRunChecksEnv(base, config, flags) {
    const env = { ...base };
    const ctx = {
        projectRoot: base.SHIM_PROJECT_ROOT ?? process.cwd(),
        packageRoot: base.SHIM_PACKAGE_ROOT ?? process.cwd(),
        config,
        env,
        flags,
    };
    env.CHECK_MODE = resolveCheckMode(ctx);
    return env;
}
/** Run all enabled checks sequentially. */
export async function runAllChecks(options) {
    if (options.timeoutSec != null && options.timeoutSec > 0) {
        return runAllChecksWithTimeout(options);
    }
    return runAllChecksInner(options);
}
async function runAllChecksWithTimeout(options) {
    const timeoutMs = options.timeoutSec * 1000;
    let timer;
    const timeoutPromise = new Promise((resolve) => {
        timer = setTimeout(() => {
            resolve(toRunAllChecksResult([
                {
                    id: "runAllChecks",
                    status: "infra_error",
                    blocking: true,
                    message: `Check run timed out after ${options.timeoutSec}s`,
                },
            ]));
        }, timeoutMs);
    });
    const runPromise = runAllChecksInner(options).finally(() => {
        if (timer)
            clearTimeout(timer);
    });
    return Promise.race([runPromise, timeoutPromise]);
}
async function runAllChecksInner(options) {
    const baseEnv = options.env ?? process.env;
    const env = buildRunChecksEnv(baseEnv, options.config, options.flags);
    const ctx = {
        projectRoot: options.projectRoot,
        packageRoot: options.packageRoot,
        config: options.config,
        env,
        flags: options.flags,
    };
    clearLastError(options.projectRoot);
    const order = resolveCheckOrder(options.config, options.flags);
    const results = [];
    const failedIds = [];
    let lastErrorWritten = false;
    for (const id of order) {
        const def = CHECK_REGISTRY.find((c) => c.id === id);
        if (!def)
            continue;
        process.stdout.write(`\n▶ ${def.label} (${def.id})…\n`);
        let result;
        try {
            result = await def.run(ctx);
        }
        catch (err) {
            result = {
                id,
                status: "infra_error",
                blocking: true,
                message: `${def.label}: unexpected error — ${err instanceof Error ? err.message : String(err)}`,
            };
        }
        results.push(result);
        const line = result.status === "passed"
            ? "✓"
            : result.status === "skipped"
                ? "○"
                : result.status === "warning"
                    ? "!"
                    : "✗";
        console.log(`${line} ${result.message}`);
        if (isBlockingStatus(result.status, result.blocking)) {
            failedIds.push(id);
            if (!lastErrorWritten) {
                writeLastError(options.projectRoot, {
                    check: id,
                    message: result.message,
                    rawOutput: String(result.details?.stderr ?? ""),
                });
                lastErrorWritten = true;
            }
            if (!options.config.continueOnError) {
                break;
            }
        }
    }
    const aggregate = toRunAllChecksResult(results);
    if (options.writeReport !== false) {
        writeReport(aggregate, { projectRoot: options.projectRoot });
    }
    if (aggregate.failedIds.length > 0) {
        console.error(`Failed checks: ${aggregate.failedIds.join(", ")}`);
    }
    else {
        clearLastError(options.projectRoot);
    }
    return aggregate;
}
//# sourceMappingURL=run-check.js.map