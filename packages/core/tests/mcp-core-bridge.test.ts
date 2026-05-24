import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRunChecksArgv,
  listCheckCatalog,
  loadConfig,
  parseRunChecksFlags,
  runAllChecks,
  runChecksFromMcpOptions,
} from "../src/index.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("MCP/core bridge", () => {
  it("core dist exists after build (integration guard)", () => {
    const dist = path.join(repoRoot, "packages/core/dist/index.js");
    expect(fs.existsSync(dist)).toBe(true);
  });

  it("listCheckCatalog exposes all Phase 2 check ids", () => {
    const ids = listCheckCatalog().map((c) => c.id);
    expect(ids).toContain("updateReadme");
    expect(ids).toContain("sast");
    expect(ids).toContain("e2e");
    expect(ids.length).toBeGreaterThanOrEqual(25);
  });

  it("runChecksFromMcpOptions returns engine core and iterations", async () => {
    const { config } = loadConfig({ projectRoot: repoRoot });
    const disabled: typeof config = {
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
    expect(out.iterations).toBe(1);
    expect(out.passed).toBe(true);
    expect(out.results).toEqual([]);
    expect(out.infraErrorIds).toEqual([]);
    expect(out.warningIds).toEqual([]);
    expect(out.summary.total).toBe(0);
  });

  it("runAllChecks returns structured results (dry project root)", async () => {
    const { config } = loadConfig({ projectRoot: repoRoot });
    const flags = parseRunChecksFlags(
      buildRunChecksArgv({ noAiReview: true, noExplanationCheck: true }),
    );
    const result = await runAllChecks({
      projectRoot: repoRoot,
      packageRoot: repoRoot,
      config: {
        ...config,
        checks: Object.fromEntries(
          Object.keys(config.checks).map((id) => [id, false]),
        ),
      },
      flags,
      writeReport: false,
    });
    expect(result.results).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.infraErrorIds).toEqual([]);
    expect(result.summary.total).toBe(0);
  });
});
