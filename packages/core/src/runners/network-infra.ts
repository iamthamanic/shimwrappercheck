/**
 * Network/TLS infra detection (mirrors scripts/run-checks.sh).
 * When SHIM_STRICT_NETWORK_CHECKS=1, transient failures must surface as infra_error (never silent pass).
 */

const NETWORK_ERROR_RE =
  /ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|getaddrinfo|network error|unable to get local issuer certificate|CERTIFICATE_VERIFY_FAILED|x509|ca-certs: empty trust anchors|TLS/i;

/** True when combined stdout/stderr looks like a network or TLS infrastructure failure. */
export function isTransientNetworkError(output: string): boolean {
  if (!output?.trim()) return false;
  return NETWORK_ERROR_RE.test(output);
}

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
export function applyInfraPolicy(
  classified: { status: string; message: string; infra: boolean },
  combinedOutput: string,
  options: InfraPolicyOptions,
): InfraPolicyResult {
  if (!classified.infra) {
    return { status: "failed", blocking: true, message: classified.message };
  }

  const isNetwork = isTransientNetworkError(combinedOutput);
  if (isNetwork && !options.strictNetworkChecks) {
    return {
      status: "warning",
      blocking: false,
      message: `${classified.message} (network/TLS; set SHIM_STRICT_NETWORK_CHECKS=1 to fail hard)`,
    };
  }

  if (isNetwork || !options.optionalCheck) {
    return {
      status: "infra_error",
      blocking: true,
      message: classified.message,
    };
  }

  return {
    status: "skipped",
    blocking: false,
    message: `${classified.message} (optional check, tool not available)`,
  };
}
