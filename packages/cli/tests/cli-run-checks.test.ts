import { describe, expect, it } from "vitest";
import { parseRunChecksFlags } from "@shimwrappercheck/core";
import { resolvePackageRoot } from "../src/run-checks.js";

describe("parseRunChecksFlags", () => {
  it("defaults to frontend and backend when no flags", () => {
    const flags = parseRunChecksFlags([]);
    expect(flags.frontend).toBe(true);
    expect(flags.backend).toBe(true);
  });

  it("honors --no-frontend", () => {
    const flags = parseRunChecksFlags(["--no-frontend", "--backend"]);
    expect(flags.frontend).toBe(false);
    expect(flags.backend).toBe(true);
  });

  it("honors --no-i18n-check and --no-sast", () => {
    const flags = parseRunChecksFlags(["--no-i18n-check", "--no-sast"]);
    expect(flags.noI18nCheck).toBe(true);
    expect(flags.noSast).toBe(true);
  });
});

describe("resolvePackageRoot", () => {
  it("points at repo root", () => {
    const root = resolvePackageRoot();
    expect(root).toMatch(/shimwrappercheck$/);
  });
});
