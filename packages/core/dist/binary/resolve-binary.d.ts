export type ResolvedBinary = {
  path: string;
  source: "env" | "path" | "fallback";
};
export type ResolveBinaryOptions = {
  /** Env vars tried in order (e.g. SHIM_GIT_REAL_BIN, GIT_REAL_BIN). */
  envKeys?: string[];
  /** Command name for `command -v` lookup. */
  commandName: string;
  /** Paths that indicate shim recursion (node_modules, package root). */
  blockedPathSubstrings?: string[];
  /** Known system fallback paths. */
  fallbacks?: string[];
  env?: NodeJS.ProcessEnv;
};
/**
 * Resolve a real binary path, avoiding shim recursion.
 * Ported from scripts/git-checked.sh resolve_real_git.
 */
export declare function resolveBinary(
  options: ResolveBinaryOptions,
): ResolvedBinary | null;
/** Resolve git binary (convenience wrapper). */
export declare function resolveGitBinary(
  wrapperDir: string,
  env?: NodeJS.ProcessEnv,
): ResolvedBinary | null;
//# sourceMappingURL=resolve-binary.d.ts.map
