import { describe, expect, it } from "vitest";
import {
  aggregateCheckResults,
  formatInfraErrors,
} from "../src/checks/aggregate-results.js";
import type { CheckResult } from "../src/checks/types.js";
import { runChecksFromMcpOptions } from "../src/project-api/mcp-run-checks.js";
import { loadConfig } from "../src/config/load-config.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function result(
  id: string,
  status: CheckResult["status"],
  blocking = true,
): CheckResult {
  return { id, status, blocking, message: `${id} ${status}` };
}

describe("infra_error aggregation", () => {
  it("collects infraErrorIds separately from failedIds", () => {
    const agg = aggregateCheckResults([
      result("lint", "passed"),
      result("typecheck", "infra_error"),
      result("npmAudit", "warning", false),
      result("testRun", "failed"),
    ]);
    expect(agg.infraErrorIds).toEqual(["typecheck"]);
    expect(agg.warningIds).toEqual(["npmAudit"]);
    expect(agg.failedIds).toEqual(["typecheck", "testRun"]);
    expect(agg.summary.infra_error).toBe(1);
    expect(agg.summary.warning).toBe(1);
    expect(agg.ok).toBe(false);
    expect(agg.exitCode).toBe(1);
  });

  it("formatInfraErrors lists blocking infra checks", () => {
    const results = [result("sast", "infra_error")];
    const text = formatInfraErrors(results, ["sast"]);
    expect(text).toContain("Infrastructure errors");
    expect(text).toContain("[infra_error] sast:");
  });
});

describe("MCP run_checks infra_error shape", () => {
  it("returns infraErrorIds, summary, and per-check status", async () => {
    const { config } = loadConfig({ projectRoot: repoRoot });
    const disabled = {
      ...config,
      checks: Object.fromEntries(
        Object.keys(config.checks).map((id) => [id, false]),
      ),
    };
    const out = await runChecksFromMcpOptions({
      projectRoot: repoRoot,
      packageRoot: repoRoot,
      config: disabled,
      noAiReview: true,
      noExplanationCheck: true,
    });
    expect(out.engine).toBe("core");
    expect(Array.isArray(out.infraErrorIds)).toBe(true);
    expect(Array.isArray(out.warningIds)).toBe(true);
    expect(out.summary).toMatchObject({
      passed: 0,
      failed: 0,
      skipped: 0,
      warning: 0,
      infra_error: 0,
      total: 0,
    });
    expect(out.results.every((r) => r.status && r.id)).toBe(true);
  });
});
