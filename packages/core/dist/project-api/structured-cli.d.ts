import { loadConfig, getProjectPaths } from "../config/load-config.js";
import { CONFIG_KEY_ORDER } from "../config/schema.js";
import type { LastErrorEntry } from "../reports/write-report.js";
/** Re-export for structured CLI / MCP parity. */
export { CONFIG_KEY_ORDER, getProjectPaths, loadConfig };
/** Read .shimwrappercheckrc as legacy string map (structured CLI format). */
export declare function getLegacyConfig(projectRoot?: string): {
  path: string;
  config: Record<string, string>;
};
/** Patch RC keys without dropping other settings. */
export declare function setLegacyConfig(
  values: Record<string, string>,
  projectRoot?: string,
): {
  success: boolean;
  path: string;
  updatedKeys: string[];
  config: Record<string, string>;
};
/** Toggle one SHIM_RUN_* flag by env key. */
export declare function toggleLegacyCheck(
  envKey: string,
  enabled: boolean,
  projectRoot?: string,
): {
  success: boolean;
  path: string;
  envKey: string;
  enabled: boolean;
  message: string;
  config: Record<string, string>;
};
/** List checks with enabled state from RC (catalog-backed). */
export declare function listChecksWithState(projectRoot?: string): {
  source: string;
  checks: Array<{
    id: string;
    label: string;
    envKey: string;
    enabled: boolean;
    defaultEnabled: boolean;
  }>;
};
/** Read .shim/last_error.json. */
export declare function readLastErrorEntry(
  projectRoot?: string,
): LastErrorEntry | null;
/** Resolve review output directory from presets or default. */
export declare function resolveReviewDirectory(projectRoot?: string): string;
/** Find newest markdown review report. */
export declare function findLatestReviewReport(projectRoot?: string): {
  found: boolean;
  directory: string;
  path?: string;
  name?: string;
  content?: string;
};
/** Read AGENTS.md from project root. */
export declare function getAgentsMdContent(projectRoot?: string): {
  found: boolean;
  path?: string;
  content?: string;
  message?: string;
};
//# sourceMappingURL=structured-cli.d.ts.map
