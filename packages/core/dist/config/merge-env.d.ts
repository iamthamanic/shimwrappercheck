import type { ShimConfig } from "./schema.js";
/**
 * Deterministic merge: base config < RC-derived < process.env overrides.
 * CHECK_MODE from env wins when set (pre-push behavior).
 */
export declare function mergeConfig(
  base: ShimConfig,
  env?: NodeJS.ProcessEnv,
): ShimConfig;
//# sourceMappingURL=merge-env.d.ts.map
