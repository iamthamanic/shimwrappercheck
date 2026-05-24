import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CHECK_CATALOG_METADATA } from "../src/checks/catalog-metadata.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("run-checks.sh core engine (light e2e)", () => {
  it("invokes core CLI and exits 0 when all checks disabled via env", () => {
    const script = path.join(repoRoot, "scripts/run-checks.sh");
    const disableEnv: Record<string, string> = {
      SHIM_ENGINE: "core",
      SHIM_PROJECT_ROOT: repoRoot,
      SKIP_AI_REVIEW: "1",
      SKIP_EXPLANATION_CHECK: "1",
    };
    for (const entry of CHECK_CATALOG_METADATA) {
      disableEnv[entry.envKey] = "0";
    }

    const result = spawnSync("bash", [script], {
      cwd: repoRoot,
      env: { ...process.env, ...disableEnv },
      encoding: "utf8",
      timeout: 120_000,
    });

    expect(result.status).toBe(0);
    expect(String(result.stdout)).toContain("core engine");
  });
});
