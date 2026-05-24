import type { CommandRunResult } from "./result.js";
import type { CheckStatus } from "../checks/types.js";

export type ClassifiedFailure = {
  status: CheckStatus;
  message: string;
  infra: boolean;
};

/**
 * Classify command failures: infra errors (missing binary, timeout) vs real check failures.
 * infra_error must never be treated as pass.
 */
export function classifyCommandFailure(
  result: CommandRunResult,
  checkLabel: string,
): ClassifiedFailure {
  if (result.timedOut) {
    return {
      status: "infra_error",
      message: `${checkLabel}: command timed out after ${result.durationMs}ms`,
      infra: true,
    };
  }

  const combined = `${result.stderr}\n${result.stdout}`.toLowerCase();

  if (
    result.exitCode === 127 ||
    combined.includes("command not found") ||
    combined.includes("enoent") ||
    combined.includes("not found")
  ) {
    return {
      status: "infra_error",
      message: `${checkLabel}: required tool not found (${result.command})`,
      infra: true,
    };
  }

  if (
    combined.includes("eacces") ||
    combined.includes("permission denied") ||
    combined.includes("spawn")
  ) {
    return {
      status: "infra_error",
      message: `${checkLabel}: could not execute command (${result.command})`,
      infra: true,
    };
  }

  return {
    status: "failed",
    message: `${checkLabel}: exited with code ${result.exitCode ?? "unknown"}`,
    infra: false,
  };
}

/** Map classified status to whether the overall run should fail. */
export function isBlockingStatus(
  status: CheckStatus,
  blocking: boolean,
): boolean {
  if (status === "infra_error") return true;
  if (status === "failed") return blocking;
  if (status === "warning") return false;
  return false;
}
