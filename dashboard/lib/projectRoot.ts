/**
 * Resolves the project root (shimwrappercheck repo root) for reading/writing
 * .shimwrappercheckrc and AGENTS.md. When running from dashboard/, parent is repo root.
 * Override with SHIM_PROJECT_ROOT for Vercel or custom setups.
 */
import path from "path";
import fs from "fs";

export function getProjectRoot(): string {
  const envRoot = process.env.SHIM_PROJECT_ROOT;
  if (envRoot && fs.existsSync(envRoot)) return path.resolve(envRoot);

  const cwd = process.cwd();
  const name = path.basename(cwd);
  if (name === "dashboard") return path.resolve(cwd, "..");

  const parent = path.resolve(cwd, "..");
  const hasRc = fs.existsSync(path.join(cwd, ".shimwrappercheckrc"));
  const hasAgents = fs.existsSync(path.join(cwd, "AGENTS.md"));
  if (hasRc || hasAgents) return cwd;
  if (fs.existsSync(path.join(parent, ".shimwrappercheckrc")) || fs.existsSync(path.join(parent, "AGENTS.md")))
    return parent;

  return cwd;
}
