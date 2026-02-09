/**
 * Parses last run-checks output into per-check segments for the Logs tab.
 * Markers must match the echo strings in scripts/run-checks.sh (and fallback branch).
 */
/** Line (or substring) that starts a check's output in the combined log. First match wins per check. */
export const CHECK_LOG_MARKERS: Record<string, string[]> = {
  prettier: ["Prettier..."],
  lint: ["Lint..."],
  typecheck: ["TypeScript check..."],
  projectRules: ["Projektregeln..."],
  checkMockData: ["Check mock data..."],
  testRun: ["Test run..."],
  viteBuild: ["Vite build..."],
  npmAudit: ["npm audit...", "Running frontend security (npm audit)"],
  snyk: ["Snyk...", "Running Snyk (dependency scan)"],
  denoFmt: ["Deno fmt..."],
  denoLint: ["Deno lint..."],
  denoAudit: ["Deno audit...", "Running backend security (deno audit)"],
  aiReview: ["AI Review...", "Running Codex AI review"],
  explanationCheck: ["Full Explanation check...", "Running Full Explanation check"],
  i18nCheck: ["i18n check...", "Skipping i18n check"],
  updateReadme: ["Update README...", "Skipping Update README"],
  sast: ["Semgrep..."],
  gitleaks: ["Gitleaks..."],
  licenseChecker: ["license-checker..."],
};

export interface LastRunLog {
  full: string;
  segments: Record<string, string>;
  timestamp: string | null;
}

/**
 * Splits combined stdout+stderr into segments by check. Each segment runs from
 * the first line matching that check's marker until the next line that matches any marker.
 */
export function parseLastRunLog(stdout: string, stderr: string): Omit<LastRunLog, "timestamp"> {
  const full = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n\n");
  const lines = full.split("\n");
  const segments: Record<string, string> = {};
  const checkIds = Object.keys(CHECK_LOG_MARKERS);

  const matchesCheck = (line: string): string | null => {
    const t = line.trim();
    for (const id of checkIds) {
      const markers = CHECK_LOG_MARKERS[id];
      if (markers?.some((m) => t.includes(m))) return id;
    }
    return null;
  };

  let currentCheckId: string | null = null;
  let currentLines: string[] = [];

  const flush = (nextId: string | null) => {
    if (currentCheckId && currentLines.length) {
      const text = currentLines.join("\n").trim();
      if (text) segments[currentCheckId] = text;
    }
    currentCheckId = nextId;
    currentLines = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hit = matchesCheck(line);
    if (hit) {
      flush(hit);
      currentCheckId = hit;
      currentLines.push(line);
    } else if (currentCheckId) {
      currentLines.push(line);
    }
  }
  flush(null);

  return { full, segments };
}
