import type { ShimConfig } from "./schema.js";
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
export declare function getProjectPaths(projectRootInput?: string): {
  projectRoot: string;
  rcPath: string;
};
/** Load .shimwrappercheckrc and merge with environment. */
export declare function loadConfig(options?: LoadConfigOptions): LoadedConfig;
//# sourceMappingURL=load-config.d.ts.map
