import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

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
export function resolveBinary(
  options: ResolveBinaryOptions,
): ResolvedBinary | null {
  const env = options.env ?? process.env;
  const blocked = options.blockedPathSubstrings ?? ["node_modules"];

  for (const key of options.envKeys ?? []) {
    const fromEnv = env[key]?.trim();
    if (fromEnv && isUsableBinary(fromEnv, blocked)) {
      return { path: fromEnv, source: "env" };
    }
  }

  const fromPath = whichCommand(options.commandName);
  if (fromPath && isUsableBinary(fromPath, blocked)) {
    return { path: fromPath, source: "path" };
  }

  for (const candidate of options.fallbacks ?? []) {
    if (fs.existsSync(candidate) && isExecutable(candidate)) {
      return { path: candidate, source: "fallback" };
    }
  }

  return null;
}

/** Resolve git binary (convenience wrapper). */
export function resolveGitBinary(
  wrapperDir: string,
  env: NodeJS.ProcessEnv = process.env,
): ResolvedBinary | null {
  return resolveBinary({
    envKeys: ["SHIM_GIT_REAL_BIN", "GIT_REAL_BIN"],
    commandName: "git",
    blockedPathSubstrings: ["node_modules", wrapperDir],
    fallbacks: ["/usr/bin/git", "/usr/local/bin/git", "/opt/homebrew/bin/git"],
    env,
  });
}

function whichCommand(name: string): string | null {
  try {
    const out = execSync(`command -v ${name}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: "/bin/bash",
    });
    const trimmed = out.trim();
    return trimmed || null;
  } catch {
    return null;
  }
}

function isUsableBinary(
  filePath: string,
  blockedSubstrings: string[],
): boolean {
  if (!isExecutable(filePath)) return false;
  const normalized = path.resolve(filePath);
  for (const blocked of blockedSubstrings) {
    if (normalized.includes(blocked)) return false;
  }
  return true;
}

function isExecutable(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
