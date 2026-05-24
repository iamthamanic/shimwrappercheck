import fs from "node:fs";
import path from "node:path";

/** Known checktools binary names (Variante B). */
export const CHECKTOOLS_BINARIES = [
  "prettier",
  "eslint",
  "tsc",
  "vite",
  "vitest",
] as const;

export type ChecktoolsBinary = (typeof CHECKTOOLS_BINARIES)[number];

/** Directory containing project-local check tool binaries (Variante B). */
export function resolveChecktoolsBinDir(projectRoot: string): string | null {
  const binDir = path.join(
    projectRoot,
    ".shimwrapper",
    "checktools",
    "node_modules",
    ".bin",
  );
  return fs.existsSync(binDir) ? binDir : null;
}

/** Resolve a tool from .shimwrapper/checktools when installed. */
export function resolveChecktoolsBinary(
  projectRoot: string,
  toolName: string,
): string | null {
  const binDir = resolveChecktoolsBinDir(projectRoot);
  if (!binDir) return null;

  const candidate = path.join(binDir, toolName);
  try {
    fs.accessSync(candidate, fs.constants.X_OK);
    return candidate;
  } catch {
    return null;
  }
}

/** Resolve eslint complexity plugin path under checktools when present. */
export function resolveChecktoolsComplexityPlugin(
  projectRoot: string,
): string | null {
  const pluginRoot = path.join(
    projectRoot,
    ".shimwrapper",
    "checktools",
    "node_modules",
    "eslint-plugin-complexity",
  );
  if (!fs.existsSync(pluginRoot)) return null;
  const entry = path.join(pluginRoot, "index.js");
  return fs.existsSync(entry) ? pluginRoot : null;
}
