import { describe, expect, it } from "vitest";
import { resolveBinary } from "../src/binary/resolve-binary.js";

describe("resolveBinary", () => {
  it("prefers env override when executable", () => {
    const resolved = resolveBinary({
      envKeys: ["SHIM_GIT_REAL_BIN"],
      commandName: "git-nonexistent-shim-test",
      env: { SHIM_GIT_REAL_BIN: process.execPath },
      blockedPathSubstrings: ["node_modules"],
      fallbacks: [],
    });
    expect(resolved?.path).toBe(process.execPath);
    expect(resolved?.source).toBe("env");
  });

  it("rejects node_modules paths (recursion guard)", () => {
    const resolved = resolveBinary({
      envKeys: ["SHIM_GIT_REAL_BIN"],
      commandName: "git-nonexistent-shim-test",
      env: { SHIM_GIT_REAL_BIN: "/proj/node_modules/.bin/git" },
      blockedPathSubstrings: ["node_modules"],
      fallbacks: [],
    });
    expect(resolved).toBeNull();
  });
});
