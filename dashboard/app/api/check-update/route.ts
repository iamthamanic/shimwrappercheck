/**
 * GET /api/check-update – Prüft, ob eine neuere npm-Version verfügbar ist.
 *
 * Rückgabe:
 * {
 *   current: string,    // lokale Version aus package.json
 *   latest: string|null, // npm-Version (null bei Netzwerkfehler)
 *   outdated: boolean,
 *   message: string
 * }
 */
import { NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

/**
 * currentVersion: Liest die Version aus dem lokalen package.json.
 * Warum: Agenten/Dashboard wissen sonst nicht, welche Version installiert ist.
 */
function currentVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      return pkg.version || "0.0.0";
    }
  } catch {
    // Fallback bei Fehlern
  }
  return "0.0.0";
}

/**
 * isOutdated: Vergleicht zwei semver-Strings numerisch (Major.Minor.Patch).
 * Semver-Dependency sparen wir uns – simples Split-Verfahren reicht.
 */
function isOutdated(current: string, latest: string): boolean {
  if (!current || !latest) return false;
  const ca = current.split(".").map((n) => parseInt(n, 10) || 0);
  const lb = latest.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(ca.length, lb.length); i++) {
    const av = ca[i] || 0;
    const bv = lb[i] || 0;
    if (bv > av) return true;
    if (av > bv) return false;
  }
  return false;
}

export async function GET() {
  const current = currentVersion();
  let latest: string | null = null;

  try {
    const { stdout } = await execFileAsync(
      "npm",
      ["view", "shimwrappercheck", "version", "--registry", "https://registry.npmjs.org/"],
      { timeout: 8000, encoding: "utf8" }
    );
    latest = stdout.trim() || null;
  } catch {
    latest = null;
  }

  const outdated = isOutdated(current, latest ?? "");

  let message = "shimwrappercheck is up to date.";
  if (latest === null) {
    message = "Could not check for updates (npm unavailable or offline).";
  } else if (outdated) {
    message = `Update available: ${current} -> ${latest}.`;
  }

  return NextResponse.json({ current, latest, outdated, message });
}
