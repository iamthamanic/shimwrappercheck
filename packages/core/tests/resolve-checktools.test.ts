import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  resolveChecktoolsBinDir,
  resolveChecktoolsBinary,
  CHECKTOOLS_BINARIES,
} from "../src/binary/resolve-checktools.js";

describe("resolveChecktoolsBinary", () => {
  it("returns executable from .shimwrapper/checktools when present", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swc-checktools-"));
    const binDir = path.join(
      tmp,
      ".shimwrapper",
      "checktools",
      "node_modules",
      ".bin",
    );
    fs.mkdirSync(binDir, { recursive: true });
    const prettierPath = path.join(binDir, "prettier");
    fs.writeFileSync(prettierPath, "#!/bin/sh\necho ok\n", { mode: 0o755 });

    expect(resolveChecktoolsBinDir(tmp)).toBe(binDir);
    expect(resolveChecktoolsBinary(tmp, "prettier")).toBe(prettierPath);
    expect(resolveChecktoolsBinary(tmp, "missing")).toBeNull();
  });

  it("returns null when checktools dir is absent", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "swc-no-tools-"));
    expect(resolveChecktoolsBinDir(tmp)).toBeNull();
  });

  it("documents expected checktools binary names", () => {
    expect(CHECKTOOLS_BINARIES).toContain("tsc");
    expect(CHECKTOOLS_BINARIES).toContain("vitest");
  });
});
