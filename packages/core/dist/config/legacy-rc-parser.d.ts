import type { ShimConfig } from "./schema.js";
/** Parse a shell-style rc value into plain text. */
export declare function parseRcValue(rawValue: string): string;
/** Read .shimwrappercheckrc-like content into a key/value map. */
export declare function parseLegacyRcContent(
  content: string,
): Record<string, string>;
/** Normalize boolean-ish rc values (matches scripts/lib/rc-utils.js). */
export declare function isRcEnabled(
  value: string | undefined,
  defaultEnabled: boolean,
): boolean;
/** Map legacy SHIM_* keys to canonical ShimConfig v1. */
export declare function legacyRcToConfig(
  rc: Record<string, string>,
  options?: {
    projectRoot?: string;
  },
): ShimConfig;
/** Convert text to a quoted/escaped shell value (matches scripts/lib/rc-utils.js). */
export declare function serializeRcValue(value: string): string;
//# sourceMappingURL=legacy-rc-parser.d.ts.map
