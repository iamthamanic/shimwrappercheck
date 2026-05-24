import fs from "node:fs";
import path from "node:path";
import type { ShimConfig } from "./schema.js";
import { legacyRcToConfig, parseLegacyRcContent } from "./legacy-rc-parser.js";
import { mergeConfig } from "./merge-env.js";

export type LoadConfigOptions = {
  projectRoot?: string;
  rcPath?: string;
  env?: NodeJS.ProcessEnv;
};

export type LoadedConfig = {
  path: string;
  config: ShimConfig;
  legacy: Record<string, string>;
};

/** Resolve project paths (mirrors scripts/lib/project-config-api.js). */
export function getProjectPaths(projectRootInput?: string): {
  projectRoot: string;
  rcPath: string;
} {
  const projectRoot =
    projectRootInput ?? process.env.SHIM_PROJECT_ROOT ?? process.cwd();
  return {
    projectRoot,
    rcPath: path.join(projectRoot, ".shimwrappercheckrc"),
  };
}

/** Load .shimwrappercheckrc and merge with environment. */
export function loadConfig(options: LoadConfigOptions = {}): LoadedConfig {
  const { projectRoot, rcPath } = getProjectPaths(options.projectRoot);
  const env = options.env ?? process.env;
  const resolvedRcPath = options.rcPath ?? rcPath;

  let legacy: Record<string, string> = {};
  if (fs.existsSync(resolvedRcPath)) {
    const content = fs.readFileSync(resolvedRcPath, "utf8");
    legacy = parseLegacyRcContent(content);
  }

  const fromRc = legacyRcToConfig(legacy, { projectRoot });
  const config = mergeConfig(fromRc, env);

  return { path: resolvedRcPath, config, legacy };
}
