/** Known checktools binary names (Variante B). */
export declare const CHECKTOOLS_BINARIES: readonly [
  "prettier",
  "eslint",
  "tsc",
  "vite",
  "vitest",
];
export type ChecktoolsBinary = (typeof CHECKTOOLS_BINARIES)[number];
/** Directory containing project-local check tool binaries (Variante B). */
export declare function resolveChecktoolsBinDir(
  projectRoot: string,
): string | null;
/** Resolve a tool from .shimwrapper/checktools when installed. */
export declare function resolveChecktoolsBinary(
  projectRoot: string,
  toolName: string,
): string | null;
/** Resolve eslint complexity plugin path under checktools when present. */
export declare function resolveChecktoolsComplexityPlugin(
  projectRoot: string,
): string | null;
//# sourceMappingURL=resolve-checktools.d.ts.map
