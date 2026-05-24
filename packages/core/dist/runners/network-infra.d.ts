/**
 * Network/TLS infra detection (mirrors scripts/run-checks.sh).
 * When SHIM_STRICT_NETWORK_CHECKS=1, transient failures must surface as infra_error (never silent pass).
 */
/** True when combined stdout/stderr looks like a network or TLS infrastructure failure. */
export declare function isTransientNetworkError(output: string): boolean;
export type InfraPolicyOptions = {
  /** From config.strictNetworkChecks / SHIM_STRICT_NETWORK_CHECKS */
  strictNetworkChecks: boolean;
  /** Optional checks may skip when tool is missing; required checks treat missing tool as infra_error */
  optionalCheck: boolean;
};
export type InfraPolicyResult = {
  status: "infra_error" | "failed" | "warning" | "skipped";
  blocking: boolean;
  message: string;
};
/**
 * Resolve infra vs soft-skip vs warning for command failures.
 * infra_error is never treated as pass; strict mode fails hard on network issues.
 */
export declare function applyInfraPolicy(
  classified: {
    status: string;
    message: string;
    infra: boolean;
  },
  combinedOutput: string,
  options: InfraPolicyOptions,
): InfraPolicyResult;
//# sourceMappingURL=network-infra.d.ts.map
