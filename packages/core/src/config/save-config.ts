import fs from "node:fs";
import type { ShimConfig } from "./schema.js";
import { legacyRcToConfig } from "./legacy-rc-parser.js";
import { loadConfig, getProjectPaths } from "./load-config.js";
import { mergeConfig } from "./merge-env.js";
import { configToLegacyRc, formatLegacyRcFile } from "./write-legacy-rc.js";

export type SaveConfigOptions = {
  projectRoot?: string;
  rcPath?: string;
  headerLine?: string;
};

/** Read first comment line from existing RC for stable rewrites. */
export function readRcHeaderLine(rcPath: string): string {
  if (!fs.existsSync(rcPath)) {
    return "# shimwrappercheck config (managed by shimwrappercheck CLI)";
  }
  const lines = fs.readFileSync(rcPath, "utf8").split(/\r?\n/);
  const header = lines.find((line) => line.trim().startsWith("#"));
  return (
    header ?? "# shimwrappercheck config (managed by shimwrappercheck CLI)"
  );
}

/** Write canonical config back to .shimwrappercheckrc (legacy format). */
export function saveConfig(
  config: ShimConfig,
  options: SaveConfigOptions = {},
): { path: string } {
  const { rcPath } = getProjectPaths(options.projectRoot);
  const resolvedRcPath = options.rcPath ?? rcPath;
  const legacy = configToLegacyRc(config);
  const header = options.headerLine ?? readRcHeaderLine(resolvedRcPath);
  const content = formatLegacyRcFile(legacy, header);
  fs.writeFileSync(resolvedRcPath, content, "utf8");
  return { path: resolvedRcPath };
}

/** Patch individual RC keys without dropping other settings. */
export function patchLegacyRc(
  values: Record<string, string>,
  options: SaveConfigOptions = {},
): { path: string; config: ShimConfig } {
  const loaded = loadConfig(options);
  const mergedLegacy = { ...loaded.legacy, ...values };
  const next = mergeConfig(
    legacyRcToConfig(mergedLegacy, { projectRoot: loaded.config.projectRoot }),
    options.projectRoot
      ? { SHIM_PROJECT_ROOT: options.projectRoot }
      : process.env,
  );
  saveConfig(next, options);
  return { path: loaded.path, config: next };
}
