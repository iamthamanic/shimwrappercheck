import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getLegacyConfig,
  listChecksWithState,
  setLegacyConfig,
  toggleLegacyCheck,
  readLastErrorEntry,
  getAgentsMdContent,
} from "../src/project-api/structured-cli.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

describe("structured-cli project API (core)", () => {
  it("getLegacyConfig reads repo rc", () => {
    const result = getLegacyConfig(repoRoot);
    expect(result.path).toContain(".shimwrappercheckrc");
    expect(typeof result.config).toBe("object");
  });

  it("listChecksWithState returns catalog entries", () => {
    const result = listChecksWithState(repoRoot);
    expect(result.source).toBe("check-catalog");
    expect(result.checks.some((c) => c.id === "lint")).toBe(true);
  });

  it("setLegacyConfig and toggleLegacyCheck patch rc in temp dir", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swc-rc-"));
    fs.writeFileSync(
      path.join(tmp, ".shimwrappercheckrc"),
      "# test\nSHIM_RUN_LINT=1\n",
      "utf8",
    );

    const toggled = toggleLegacyCheck("SHIM_RUN_LINT", false, tmp);
    expect(toggled.enabled).toBe(false);
    expect(toggled.config.SHIM_RUN_LINT).toBe("0");

    const patched = setLegacyConfig({ CHECK_MODE: "snippet" }, tmp);
    expect(patched.config.CHECK_MODE).toBe("snippet");
  });

  it("readLastErrorEntry returns null when missing", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swc-err-"));
    expect(readLastErrorEntry(tmp)).toBeNull();
  });

  it("getAgentsMdContent finds repo AGENTS.md", () => {
    const result = getAgentsMdContent(repoRoot);
    expect(result.found).toBe(true);
    expect(result.content).toContain("shimwrappercheck");
  });
});
