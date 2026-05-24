import { describe, expect, it } from "vitest";
import {
  CHECK_REGISTRY,
  getCheckDefinition,
  getDefaultRunOrder,
  listCheckCatalog,
} from "../src/checks/registry.js";

describe("CHECK_REGISTRY", () => {
  it("has unique ids", () => {
    const ids = CHECK_REGISTRY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("getCheckDefinition returns prettier", () => {
    expect(getCheckDefinition("prettier")?.label).toBe("Prettier");
  });

  it("getDefaultRunOrder only includes registered checks", () => {
    const registered = new Set(CHECK_REGISTRY.map((c) => c.id));
    for (const id of getDefaultRunOrder()) {
      expect(registered.has(id)).toBe(true);
    }
  });

  it("listCheckCatalog matches registry length", () => {
    expect(listCheckCatalog().length).toBe(CHECK_REGISTRY.length);
  });

  it("includes Phase 2 checks", () => {
    const ids = CHECK_REGISTRY.map((c) => c.id);
    expect(ids).toContain("updateReadme");
    expect(ids).toContain("ruff");
    expect(ids).toContain("sast");
    expect(ids).toContain("e2e");
  });
});
