import { describe, expect, it } from "vitest";
import { CHECK_REGISTRY } from "../src/checks/registry.js";
import {
  buildRunChecksArgv,
  parseRunChecksFlags,
  resolveCheckOrder,
} from "../src/checks/run-check.js";
import { getCheckDescription } from "../src/catalog/check-descriptions.js";
import { loadConfig } from "../src/config/load-config.js";

describe("fallow check", () => {
  it("is registered in CHECK_REGISTRY", () => {
    const def = CHECK_REGISTRY.find((c) => c.id === "fallow");
    expect(def).toBeDefined();
    expect(def!.envKey).toBe("SHIM_RUN_FALLOW");
    expect(def!.defaultEnabled).toBe(false);
  });

  it("has dashboard description metadata", () => {
    const desc = getCheckDescription("fallow");
    expect(desc).toBeDefined();
    expect(desc!.summary).toMatch(/ungenutzten Code|Duplikate/i);
    expect(desc!.info).toMatch(/npx fallow/i);
  });

  it("parses --no-fallow flag", () => {
    const flags = parseRunChecksFlags(["--no-fallow"]);
    expect(flags.noFallow).toBe(true);
  });

  it("buildRunChecksArgv includes --no-fallow", () => {
    const argv = buildRunChecksArgv({ noFallow: true });
    expect(argv).toContain("--no-fallow");
  });

  it("resolveCheckOrder skips fallow when --no-fallow", () => {
    const { config } = loadConfig({ env: { SHIM_RUN_FALLOW: "1" } });
    config.checks.fallow = true;
    const order = resolveCheckOrder(config, {
      frontend: true,
      backend: true,
      noAiReview: true,
      noExplanationCheck: true,
      noI18nCheck: true,
      noSast: true,
      noGitleaks: true,
      noFallow: true,
      noRuff: true,
      noShellcheck: true,
      refactor: false,
      until95: false,
    });
    expect(order).not.toContain("fallow");
  });
});
