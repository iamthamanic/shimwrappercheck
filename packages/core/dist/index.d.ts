/**
 * @shimwrappercheck/core — config, check registry, runners.
 * MCP and legacy scripts should migrate to this entry (see runAllChecks).
 */
export * from "./config/schema.js";
export * from "./config/legacy-rc-parser.js";
export * from "./config/write-legacy-rc.js";
export * from "./config/merge-env.js";
export * from "./config/load-config.js";
export * from "./config/save-config.js";
export * from "./checks/types.js";
export * from "./checks/registry.js";
export * from "./checks/catalog-metadata.js";
export * from "./checks/run-check.js";
export * from "./checks/aggregate-results.js";
export * from "./binary/resolve-checktools.js";
export * from "./checks/definitions/ai-script-runner.js";
export * from "./ai-review/run-ai-review.js";
export * from "./ai-review/parse-review-output.js";
export * from "./ai-review/chunk-diff.js";
export * from "./ai-review/provider-resolver.js";
export { runChecksFromMcpOptions } from "./project-api/mcp-run-checks.js";
export * from "./checks/definitions/sast.js";
export * from "./runners/result.js";
export * from "./runners/command-runner.js";
export * from "./runners/error-classifier.js";
export * from "./runners/network-infra.js";
export * from "./binary/resolve-binary.js";
export * from "./reports/write-report.js";
export * from "./refactor/orchestration.js";
export * from "./refactor/until-95-loop.js";
export * from "./project-api/structured-cli.js";
/** Shared entry for MCP server (Phase 2: require built package). */
export { runAllChecks, parseRunChecksFlags, buildRunChecksArgv, resolveCheckOrder, } from "./checks/run-check.js";
//# sourceMappingURL=index.d.ts.map