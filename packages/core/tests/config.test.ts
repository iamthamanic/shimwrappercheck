import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config/load-config.js";
import {
  configToLegacyRc,
  formatLegacyRcFile,
} from "../src/config/write-legacy-rc.js";
import { legacyRcToConfig } from "../src/config/legacy-rc-parser.js";
import { mergeConfig } from "../src/config/merge-env.js";

const tmpDirs: string[] = [];

function mkTempProject(rcContent: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shim-config-test-"));
  tmpDirs.push(dir);
  fs.writeFileSync(path.join(dir, ".shimwrappercheckrc"), rcContent, "utf8");
  return dir;
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("loadConfig", () => {
  it("loads RC and merges CHECK_MODE from env", () => {
    const root = mkTempProject("CHECK_MODE=full\nSHIM_RUN_LINT=1\n");
    const loaded = loadConfig({
      projectRoot: root,
      env: { CHECK_MODE: "commit", SHIM_PROJECT_ROOT: root },
    });
    expect(loaded.config.checkMode).toBe("commit");
  });
});

describe("legacy roundtrip", () => {
  it("preserves check toggles through configToLegacyRc", () => {
    const config = legacyRcToConfig({
      SHIM_RUN_GITLEAKS: "1",
      CHECK_MODE: "full",
    });
    config.checks.gitleaks = true;
    const legacy = configToLegacyRc(config);
    expect(legacy.SHIM_RUN_GITLEAKS).toBe("1");
    const file = formatLegacyRcFile(legacy);
    expect(file).toContain("SHIM_RUN_GITLEAKS=1");
  });
});

describe("mergeConfig", () => {
  it("applies SHIM_RUN_* env overrides", () => {
    const base = legacyRcToConfig({ SHIM_RUN_PRETTIER: "1" });
    const merged = mergeConfig(base, { SHIM_RUN_PRETTIER: "0" });
    expect(merged.checks.prettier).toBe(false);
  });
});
