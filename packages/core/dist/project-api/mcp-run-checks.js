import { loadConfig } from "../config/load-config.js";
import { formatInfraErrors } from "../checks/aggregate-results.js";
import { buildRunChecksArgv, parseRunChecksFlags, runAllChecks, } from "../checks/run-check.js";
import { runChecksWithRefactorLoop } from "../refactor/until-95-loop.js";
/**
 * MCP `run_checks` core path — structured results without shelling to run-checks.sh.
 */
export async function runChecksFromMcpOptions(opts) {
    const env = {
        ...process.env,
        ...opts.env,
        SHIM_PROJECT_ROOT: opts.projectRoot,
    };
    if (opts.checkMode)
        env.CHECK_MODE = opts.checkMode;
    const argv = buildRunChecksArgv({
        frontend: opts.frontend,
        backend: opts.backend,
        noAiReview: opts.noAiReview,
        noExplanationCheck: opts.noExplanationCheck,
        noI18nCheck: opts.noI18nCheck,
        noSast: opts.noSast,
        noGitleaks: opts.noGitleaks,
        noRuff: opts.noRuff,
        noShellcheck: opts.noShellcheck,
        refactor: opts.refactor,
        until95: opts.until95,
    });
    const loaded = loadConfig({ projectRoot: opts.projectRoot, env });
    const config = opts.config ?? loaded.config;
    const flags = parseRunChecksFlags(argv);
    const useLoop = Boolean(opts.refactor || opts.until95);
    const aggregate = useLoop
        ? await runChecksWithRefactorLoop({
            projectRoot: opts.projectRoot,
            packageRoot: opts.packageRoot,
            config,
            flags,
            env,
            writeReport: true,
            timeoutSec: opts.timeoutSec,
            until95: opts.until95,
        })
        : {
            ...(await runAllChecks({
                projectRoot: opts.projectRoot,
                packageRoot: opts.packageRoot,
                config,
                flags,
                env,
                writeReport: true,
                timeoutSec: opts.timeoutSec,
            })),
            iterations: 1,
        };
    const stdout = aggregate.results
        .map((r) => `[${r.status}] ${r.id}: ${r.message}`)
        .join("\n");
    const stderrParts = [];
    const infraBlock = formatInfraErrors(aggregate.results, aggregate.infraErrorIds);
    if (infraBlock)
        stderrParts.push(infraBlock);
    if (aggregate.failedIds.length) {
        stderrParts.push(`Failed checks: ${aggregate.failedIds.join(", ")}`);
    }
    return {
        engine: "core",
        exitCode: aggregate.exitCode,
        stdout: stdout.slice(0, 50_000),
        stderr: stderrParts.join("\n\n").slice(0, 50_000),
        passed: aggregate.ok,
        failedIds: aggregate.failedIds,
        infraErrorIds: aggregate.infraErrorIds,
        warningIds: aggregate.warningIds,
        summary: aggregate.summary,
        results: aggregate.results,
        iterations: aggregate.iterations,
    };
}
//# sourceMappingURL=mcp-run-checks.js.map