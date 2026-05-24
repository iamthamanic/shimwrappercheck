import type { ShimConfig } from "./schema.js";
export type SaveConfigOptions = {
  projectRoot?: string;
  rcPath?: string;
  headerLine?: string;
};
/** Read first comment line from existing RC for stable rewrites. */
export declare function readRcHeaderLine(rcPath: string): string;
/** Write canonical config back to .shimwrappercheckrc (legacy format). */
export declare function saveConfig(
  config: ShimConfig,
  options?: SaveConfigOptions,
): {
  path: string;
};
/** Patch individual RC keys without dropping other settings. */
export declare function patchLegacyRc(
  values: Record<string, string>,
  options?: SaveConfigOptions,
): {
  path: string;
  config: ShimConfig;
};
//# sourceMappingURL=save-config.d.ts.map
