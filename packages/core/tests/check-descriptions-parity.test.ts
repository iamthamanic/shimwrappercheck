import { describe, expect, it } from "vitest";
import { CHECK_REGISTRY } from "../src/checks/registry.js";
import {
  CHECK_DESCRIPTIONS,
  getCheckDescription,
} from "../src/catalog/check-descriptions.js";

describe("check descriptions parity", () => {
  const registryIds = CHECK_REGISTRY.map((c) => c.id);

  it("every registry check has description metadata", () => {
    for (const id of registryIds) {
      const desc = getCheckDescription(id);
      expect(desc, `missing description for registry check: ${id}`).toBeDefined();
      expect(desc!.summary.trim().length).toBeGreaterThan(0);
      expect(desc!.info.trim().length).toBeGreaterThan(0);
      expect(desc!.techStack.trim().length).toBeGreaterThan(0);
      expect(desc!.tags.length).toBeGreaterThan(0);
      expect(["enforce", "hook"]).toContain(desc!.role);
    }
  });

  it("CHECK_DESCRIPTIONS ids are unique", () => {
    const ids = CHECK_DESCRIPTIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes dashboard hook checks healthPing and edgeLogs", () => {
    expect(getCheckDescription("healthPing")).toBeDefined();
    expect(getCheckDescription("edgeLogs")).toBeDefined();
  });
});
