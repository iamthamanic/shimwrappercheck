import type {
  CheckResult,
  CheckRunSummary,
  CheckStatus,
  RunAllChecksResult,
} from "./types.js";
import { isBlockingStatus } from "../runners/error-classifier.js";

/** Build status histogram from check results. */
export function summarizeCheckResults(
  results: CheckResult[],
): CheckRunSummary {
  const summary: CheckRunSummary = {
    passed: 0,
    failed: 0,
    skipped: 0,
    warning: 0,
    infra_error: 0,
    total: results.length,
  };
  for (const r of results) {
    summary[r.status] += 1;
  }
  return summary;
}

/** Derive failed/infra/warning id lists and overall pass/fail from structured results. */
export function aggregateCheckResults(results: CheckResult[]): {
  failedIds: string[];
  infraErrorIds: string[];
  warningIds: string[];
  summary: CheckRunSummary;
  ok: boolean;
  exitCode: number;
} {
  const failedIds: string[] = [];
  const infraErrorIds: string[] = [];
  const warningIds: string[] = [];

  for (const r of results) {
    if (r.status === "infra_error") {
      infraErrorIds.push(r.id);
    }
    if (r.status === "warning") {
      warningIds.push(r.id);
    }
    if (isBlockingStatus(r.status, r.blocking)) {
      failedIds.push(r.id);
    }
  }

  const summary = summarizeCheckResults(results);
  const ok = failedIds.length === 0;
  return {
    failedIds,
    infraErrorIds,
    warningIds,
    summary,
    ok,
    exitCode: ok ? 0 : 1,
  };
}

/** Merge aggregate fields into RunAllChecksResult shape. */
export function toRunAllChecksResult(
  results: CheckResult[],
): RunAllChecksResult {
  const agg = aggregateCheckResults(results);
  return {
    ok: agg.ok,
    exitCode: agg.exitCode,
    results,
    failedIds: agg.failedIds,
    infraErrorIds: agg.infraErrorIds,
    warningIds: agg.warningIds,
    summary: agg.summary,
  };
}

/** Human-readable infra error block for stderr. */
export function formatInfraErrors(
  results: CheckResult[],
  infraErrorIds: string[],
): string {
  if (infraErrorIds.length === 0) return "";
  const byId = new Map(results.map((r) => [r.id, r]));
  const lines = infraErrorIds.map((id) => {
    const r = byId.get(id);
    return r ? `[infra_error] ${id}: ${r.message}` : `[infra_error] ${id}`;
  });
  return `Infrastructure errors (blocking):\n${lines.join("\n")}`;
}

/** Type guard for known statuses when parsing external payloads. */
export function isCheckStatus(value: string): value is CheckStatus {
  return (
    value === "passed" ||
    value === "failed" ||
    value === "skipped" ||
    value === "warning" ||
    value === "infra_error"
  );
}
