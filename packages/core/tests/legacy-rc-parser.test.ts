import { describe, expect, it } from "vitest";
import {
  isRcEnabled,
  legacyRcToConfig,
  parseLegacyRcContent,
  parseRcValue,
  serializeRcValue,
} from "../src/config/legacy-rc-parser.js";

describe("parseRcValue", () => {
  it("strips double quotes", () => {
    expect(parseRcValue('"hello"')).toBe("hello");
  });

  it("leaves unquoted values", () => {
    expect(parseRcValue("full")).toBe("full");
  });
});

describe("parseLegacyRcContent", () => {
  it("ignores comments and blank lines", () => {
    const parsed = parseLegacyRcContent(`
# comment
CHECK_MODE=commit

SHIM_RUN_PRETTIER=0
`);
    expect(parsed.CHECK_MODE).toBe("commit");
    expect(parsed.SHIM_RUN_PRETTIER).toBe("0");
  });
});

describe("isRcEnabled", () => {
  it("treats 0/false/off as disabled", () => {
    expect(isRcEnabled("0", true)).toBe(false);
    expect(isRcEnabled("off", true)).toBe(false);
  });
});

describe("legacyRcToConfig roundtrip keys", () => {
  it("maps CHECK_MODE and check toggles", () => {
    const config = legacyRcToConfig({
      CHECK_MODE: "snippet",
      SHIM_RUN_PRETTIER: "0",
      SHIM_AI_REVIEW_BLOCKING: "1",
    });
    expect(config.checkMode).toBe("snippet");
    expect(config.checks.prettier).toBe(false);
    expect(config.aiReview.blocking).toBe(true);
  });
});

describe("serializeRcValue", () => {
  it("quotes non-numeric strings", () => {
    expect(serializeRcValue("commit")).toBe('"commit"');
    expect(serializeRcValue("1")).toBe("1");
  });
});
