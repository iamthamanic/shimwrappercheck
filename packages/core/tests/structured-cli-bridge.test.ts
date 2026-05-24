import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("structured-cli via core bridge", () => {
  it("config get --json returns rc path", () => {
    const script = path.join(repoRoot, "scripts/structured-cli.js");
    const result = spawnSync(
      process.execPath,
      [script, "config", "get", "--json"],
      {
        cwd: repoRoot,
        env: { ...process.env, SHIM_PROJECT_ROOT: repoRoot },
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.path).toContain(".shimwrappercheckrc");
    expect(typeof payload.config).toBe("object");
  });

  it("checks list --json uses catalog", () => {
    const script = path.join(repoRoot, "scripts/structured-cli.js");
    const result = spawnSync(
      process.execPath,
      [script, "checks", "list", "--json"],
      {
        cwd: repoRoot,
        env: { ...process.env, SHIM_PROJECT_ROOT: repoRoot },
        encoding: "utf8",
      },
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout);
    expect(payload.source).toBe("check-catalog");
    expect(payload.checks.length).toBeGreaterThan(20);
  });
});
