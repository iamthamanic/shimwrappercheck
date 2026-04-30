#!/usr/bin/env node
/**
 * ai-report-utils.js — Markdown and JSON report writing for review scripts.
 * Single Responsibility: formatting and persisting review results.
 */
const fs = require("fs");

/**
 * jsonEscape: escapes a string for safe JSON embedding.
 * @param {string} str
 * @returns {string}
 */
function jsonEscape(str) {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

/**
 * writeMarkdownReport: writes a human-readable Markdown review report.
 * @param {Object} params
 * @param {string} params.reviewFile
 * @param {string} params.mode
 * @param {string} params.branch
 * @param {number} params.pass
 * @param {string} params.verdict
 * @param {number} params.score
 * @param {number} params.minRating
 * @param {{inputTokens?:number,outputTokens?:number}} [params.tokens]
 * @param {Array<any>} [params.deductions]
 * @param {string} [params.rawText]
 * @param {string} [params.diffSource]
 * @param {string} [params.chunkNote]
 * @param {string} [params.chunkDir]
 */
function writeMarkdownReport({
  reviewFile,
  mode,
  branch,
  pass,
  verdict,
  score,
  minRating,
  tokens,
  deductions = [],
  rawText = "",
  diffSource = "auto",
  chunkNote = "",
  chunkDir = "",
}) {
  const header = chunkDir ? `## Chunk: ${chunkDir}\n` : "# AI Code Review\n";
  const lines = [
    header,
    `- **Mode:** ${mode}${chunkDir ? " (chunked)" : ""}`,
    `- **Branch:** ${branch}`,
    `- **Status:** ${pass ? "PASS" : "FAIL"} (${verdict})`,
    `- **Score:** ${score}%`,
    `- **Min score for PASS:** ${minRating}%`,
    chunkNote ? `- **Note:** ${chunkNote}` : "",
    tokens
      ? `- **Tokens:** ${tokens.inputTokens ?? "?"} input, ${tokens.outputTokens ?? "?"} output`
      : "",
    diffSource ? `- **Diff source:** ${diffSource}` : "",
    "",
    "## Checklist",
    "- Architektur & SOLID",
    "- Performance & Ressourcen",
    "- Sicherheit",
    "- Robustheit & Error Handling",
    "- Wartbarkeit & Lesbarkeit",
    "",
  ];
  if (deductions.length > 0) {
    lines.push("## Findings", "");
    for (const d of deductions) {
      lines.push(
        `- [FAIL] **${d.point || "?"}**: -${d.minus ?? d.points ?? 0} — ${d.reason || ""}`,
      );
    }
  } else {
    lines.push("## No findings", "", "- No deductions in this scope.");
  }
  lines.push(
    "",
    "## Raw response",
    "",
    "```",
    rawText || "(no response text)",
    "```",
    "",
  );
  fs.mkdirSync(require("path").dirname(reviewFile), { recursive: true });
  fs.writeFileSync(reviewFile, lines.filter(Boolean).join("\n"), "utf8");
}

/**
 * writeFailedJson: writes the machine-readable hand-off file on REJECT.
 * @param {Object} params
 * @param {string} params.reviewFailedJson
 * @param {string} params.verdict
 * @param {number} params.score
 * @param {string} params.reviewFile
 */
function writeFailedJson({ reviewFailedJson, verdict, score, reviewFile }) {
  fs.mkdirSync(require("path").dirname(reviewFailedJson), { recursive: true });
  const payload = {
    verdict,
    score,
    review_file: reviewFile,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(
    reviewFailedJson,
    JSON.stringify(payload, null, 2) + "\n",
    "utf8",
  );
}

/**
 * writeMachineReport: writes an optional JSON summary for orchestrators (e.g. refactor loop).
 * @param {string|null} reportFile
 * @param {Record<string,unknown>} payload
 */
function writeMachineReport(reportFile, payload) {
  if (!reportFile) return;
  fs.mkdirSync(require("path").dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(payload) + "\n", "utf8");
}

module.exports = {
  jsonEscape,
  writeMarkdownReport,
  writeFailedJson,
  writeMachineReport,
};
