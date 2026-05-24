import { describe, expect, it } from "vitest";
import { CHECK_REGISTRY } from "../src/checks/registry.js";
import { CHECK_CATALOG_METADATA } from "../src/checks/catalog-metadata.js";
import {
  DEFAULT_CHECK_ORDER,
  DEFAULT_CHECK_CATALOG,
} from "../src/config/schema.js";

describe("check catalog parity", () => {
  const registered = new Set(CHECK_REGISTRY.map((c) => c.id));

  it("registers every DEFAULT_CHECK_CATALOG id", () => {
    for (const entry of DEFAULT_CHECK_CATALOG) {
      expect(
        registered.has(entry.id),
        `missing registry entry: ${entry.id}`,
      ).toBe(true);
    }
  });

  it("DEFAULT_CHECK_ORDER entries are registered", () => {
    for (const id of DEFAULT_CHECK_ORDER) {
      expect(registered.has(id), `order references unknown check: ${id}`).toBe(
        true,
      );
    }
  });

  it("catalog metadata ids match registry", () => {
    for (const entry of CHECK_CATALOG_METADATA) {
      expect(
        registered.has(entry.id),
        `catalog missing registry: ${entry.id}`,
      ).toBe(true);
    }
  });
});
