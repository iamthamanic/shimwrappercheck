/**
 * Safe resolution of reviewOutputPath under a project root. Prevents path traversal and symlink escape.
 * Used by POST /api/run-checks when writing review reports; validateReviewOutputPathSegment for settings POST.
 */
import path from "path";
import fs from "fs";

/** Allowlist: only these chars in each path segment (no "..", no leading slash). */
const SAFE_SEGMENT_REGEX = /^[a-zA-Z0-9_.-]+$/;

/**
 * Validates that a reviewOutputPath string is a safe relative path (for storage in settings).
 * Uses normalize + segment allowlist so platform and canonical behavior are predictable.
 */
export function validateReviewOutputPathSegment(value: string): boolean {
  const raw = (value || "").trim();
  if (!raw) return false;
  if (raw.startsWith("/") || raw.includes("..")) return false;
  const normalized = path.normalize(raw);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return false;
  const segments = normalized.split(path.sep).filter(Boolean);
  return segments.every((s) => SAFE_SEGMENT_REGEX.test(s));
}

/**
 * Validates reviewOutputPath and returns a resolved dir under root, or null if invalid (path traversal / symlink escape).
 * Uses canonical (realpath) resolution and segment-safe boundary check so paths like /project-evil do not pass.
 */
export function safeReviewOutputDir(root: string, reviewOutputPath: string): string | null {
  const raw = (reviewOutputPath || "reports").trim();
  if (raw.startsWith("/") || raw.includes("..")) return null;
  const normalized = path.normalize(raw);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) return null;
  const resolved = path.resolve(root, normalized);
  let rootReal: string;
  try {
    rootReal = fs.realpathSync(root);
  } catch {
    return null;
  }
  const rel = path.relative(rootReal, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  const rootPrefix = rootReal.endsWith(path.sep) ? rootReal : rootReal + path.sep;
  const underRoot = (p: string) => p === rootReal || p.startsWith(rootPrefix);
  try {
    if (fs.existsSync(resolved)) {
      const canonical = fs.realpathSync(resolved);
      if (!underRoot(canonical)) return null;
      return canonical;
    }
    const parent = path.dirname(resolved);
    if (!fs.existsSync(parent)) return null;
    const parentReal = fs.realpathSync(parent);
    if (!underRoot(parentReal)) return null;
    const base = path.basename(resolved);
    if (!base || base === ".." || base.includes(path.sep)) return null;
  } catch {
    return null;
  }
  return resolved;
}
