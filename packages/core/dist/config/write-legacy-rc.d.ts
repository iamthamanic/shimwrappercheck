import { type ShimConfig } from "./schema.js";
import { serializeRcValue } from "./legacy-rc-parser.js";
export { serializeRcValue };
/** Convert canonical config back to legacy RC key/value pairs. */
export declare function configToLegacyRc(
  config: ShimConfig,
): Record<string, string>;
/** Serialize RC values to file lines (stable key order). */
export declare function formatLegacyRcFile(
  values: Record<string, string>,
  headerLine?: string,
): string;
//# sourceMappingURL=write-legacy-rc.d.ts.map
