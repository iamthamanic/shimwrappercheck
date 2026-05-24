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
export declare function classifyCommandFailure(
  result: CommandRunResult,
  checkLabel: string,
): ClassifiedFailure;
/** Map classified status to whether the overall run should fail. */
export declare function isBlockingStatus(
  status: CheckStatus,
  blocking: boolean,
): boolean;
//# sourceMappingURL=error-classifier.d.ts.map
