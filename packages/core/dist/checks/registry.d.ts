import type { CheckDefinition } from "./types.js";
/** Canonical check registry (Phase 2 — parity with scripts/lib/check-catalog.js). */
export declare const CHECK_REGISTRY: CheckDefinition[];
/** Lookup a check definition by id. */
export declare function getCheckDefinition(
  id: string,
): CheckDefinition | undefined;
/** Ordered list of registered check ids (defaults + registry intersection). */
export declare function getDefaultRunOrder(): string[];
/** Catalog metadata for CLI/dashboard/MCP parity. */
export declare function listCheckCatalog(): Array<{
  id: string;
  label: string;
  envKey: string;
  defaultEnabled: boolean;
  category: string;
}>;
//# sourceMappingURL=registry.d.ts.map
