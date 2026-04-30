#!/usr/bin/env node
/**
 * AI Code Review — chunked full-mode runner.
 */
require("./ai-env-loader"); // load ~/.shimwrappercheck/.env before anything else
const path = require("path");
const { sendReview } = require("./ai-llm-request");
const { buildReviewPrompt } = require("./ai-review-prompts");
const {
  limitDiff,
  parseReviewJson,
  writeMarkdownReport,
  writeFailedJson,
  writeMachineReport,
  getDiff,
} = require("./ai-review-utils");

/**
 * runReviewChunk: reviews a single directory chunk.
 * @param {Object} cfg
 * @param {string} cfg.rootDir
 * @param {string} cfg.baseUrl
 * @param {string} cfg.apiKey
 * @param {string} cfg.model
 * @param {string} cfg.format
 * @param {number} cfg.chunkTimeout
 * @param {number} cfg.chunkLimitBytes
 * @param {number} cfg.minRating
 * @param {string} cfg.chunkDir
 */
async function runReviewChunk(cfg, chunkDir) {
  const diff = getDiff(cfg.rootDir, "full", chunkDir);
  if (!diff.trim()) {
    return {
      pass: 1,
      score: 100,
      verdict: "ACCEPT",
      deductions: [],
      rawText: "(no diff)",
      note: `(skip: no changes in ${chunkDir})`,
    };
  }
  const limited = limitDiff(diff, cfg.chunkLimitBytes);
  const note =
    Buffer.byteLength(diff, "utf8") > cfg.chunkLimitBytes
      ? `(chunk truncated from ${Buffer.byteLength(diff, "utf8")} bytes to ${cfg.chunkLimitBytes})`
      : "";
  const systemPrompt = buildReviewPrompt(cfg.minRating);
  try {
    const { text, usage } = await sendReview({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      systemPrompt,
      userPrompt: limited,
      format: cfg.format,
      timeoutSec: cfg.chunkTimeout,
    });
    const parsed = parseReviewJson(text);
    if (!parsed) {
      return {
        pass: 0,
        score: 0,
        verdict: "REJECT",
        deductions: [],
        rawText: text,
        note: note || "(invalid JSON)",
      };
    }
    const pass =
      parsed.verdict === "ACCEPT" && parsed.score >= cfg.minRating ? 1 : 0;
    return {
      pass,
      score: parsed.score,
      verdict: parsed.verdict,
      deductions: parsed.deductions,
      rawText: text,
      note: note || undefined,
      tokens: usage,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      pass: 0,
      score: 0,
      verdict: "REJECT",
      deductions: [],
      rawText: msg,
      note: `(error: ${msg})`,
    };
  }
}

/**
 * runFullReview: reviews the whole codebase in chunks per directory.
 * @param {Object} cfg
 * @returns {Promise<number>} exit code
 */
async function runFullReview(cfg) {
  const chunks = ["src", "supabase", "scripts", "dashboard"].filter((d) =>
    require("fs").existsSync(path.join(cfg.rootDir, d)), // nosemgrep: path-join-resolve-traversal
  );
  if (chunks.length === 0) {
    console.error(
      "Skipping AI review (CHECK_MODE=full): no chunk directories available.",
    );
    writeMachineReport(cfg.reportFile || null, {
      kind: "ai-review",
      mode: "full",
      status: "skipped",
      reason: "no chunk directories",
    });
    return 0;
  }
  const ts = new Date().toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const reviewFile = path.join(
    cfg.reviewsDir, // nosemgrep: path-join-resolve-traversal
    `review-full-${cfg.reviewDate.replace(/\./g, "-")}-${ts.replace(/:/g, "-")}.md`,
  );
  let overallPass = 1;
  const reportChunks = [];

  for (const chunkDir of chunks) {
    console.error(`AI review: chunk ${chunkDir}...`);
    const result = await runReviewChunk(cfg, chunkDir);
    if (!result.pass) overallPass = 0;
    writeMarkdownReport({
      reviewFile,
      mode: "full",
      branch: cfg.branch,
      pass: result.pass,
      verdict: result.verdict,
      score: result.score,
      minRating: cfg.minRating,
      tokens: result.tokens,
      deductions: result.deductions,
      rawText: result.rawText,
      chunkDir,
      chunkNote: result.note,
    });
    reportChunks.push({
      chunk: chunkDir,
      pass: !!result.pass,
      score: result.score,
      verdict: result.verdict,
      note: result.note || null,
    });
  }

  const summary = [
    `# AI Code Review - Date ${cfg.reviewDate}  Time ${cfg.reviewTime}`,
    "",
    `- **Mode:** full (chunked)`,
    `- **Branch:** ${cfg.branch}`,
    `- **Verdict:** ${overallPass ? "PASS" : "FAIL"} (all chunks must be ACCEPT and score >= ${cfg.minRating})`,
    "",
    "---",
    "",
  ].join("\n");
  const content = require("fs").readFileSync(reviewFile, "utf8");
  require("fs").writeFileSync(reviewFile, summary + content, "utf8");

  writeMachineReport(cfg.reportFile || null, {
    kind: "ai-review",
    mode: "full",
    status: overallPass ? "pass" : "fail",
    pass: !!overallPass,
    minRating: cfg.minRating,
    reviewFile,
    chunks: reportChunks,
  });

  console.error(`Review saved: ${reviewFile}`);
  console.error(`AI review: ${overallPass ? "PASS" : "FAIL"}`);
  if (!overallPass)
    writeFailedJson({
      reviewFailedJson: cfg.reviewFailedJson,
      verdict: "REJECT",
      score: 0,
      reviewFile,
    });
  return overallPass ? 0 : 1;
}

module.exports = { runFullReview };
