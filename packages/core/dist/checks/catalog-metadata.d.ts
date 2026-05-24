/**
 * Browser-safe check catalog metadata (ids, labels, env keys).
 * Dashboard and MCP import this subpath — no Node-only deps.
 */
export type CheckCatalogEntry = {
  id: string;
  label: string;
  envKey: string;
  defaultEnabled: boolean;
  category: "frontend" | "backend" | "security" | "ai" | "other";
};
/** Canonical metadata shared with dashboard Check Library ids. */
export declare const CHECK_CATALOG_METADATA: CheckCatalogEntry[];
export { DEFAULT_CHECK_ORDER } from "../config/schema.js";
//# sourceMappingURL=catalog-metadata.d.ts.map
