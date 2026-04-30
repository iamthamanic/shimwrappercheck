#!/usr/bin/env node
/**
 * Full Explanation check — Node.js implementation for custom LLM providers.
 * Mirrors ai-explanation-check.sh: reads whole changed files, sends them to the LLM,
 * and expects a JSON score/deductions/verdict evaluating docstrings and inline comments.
 *
 * Why a new file: the bash script calls Codex CLI exclusively. This module speaks
 * generic HTTP via ai-llm-engine.js so Ollama Cloud and OpenRouter can be used.
 *
 * Usage: node scripts/ai-explanation-check.js
 */

const fs = require("fs");
require("./ai-env-loader"); // load ~/.shimwrappercheck/.env before anything else
const path = require("path");
const { sendReview } = require("./ai-llm-engine");
const { buildExplanationPrompt } = require("./ai-review-prompts");
const {
  toIntOrDefault,
  getBranch,
  collectChangedPaths,
  isExplanationEligiblePath,
  readWorktreeFile,
  readCommitFile,
  evaluateReviewResponse,
  validateCustomConfig,
} = require("./ai-review-utils");

const ROOT_DIR = process.env.SHIM_PROJECT_ROOT || process.cwd();
const CHECK_MODE = process.env.CHECK_MODE || "commit";
const BASE_URL = process.env.SHIM_AI_CUSTOM_BASE_URL || "";
const API_KEY = process.env.SHIM_AI_CUSTOM_API_KEY || "";
const MODEL = process.env.SHIM_AI_CUSTOM_MODEL || "";
const FORMAT = process.env.SHIM_AI_CUSTOM_FORMAT || "openai";
const TIMEOUT_SEC = toIntOrDefault(process.env.SHIM_AI_TIMEOUT_SEC, 180);
const LIMIT_BYTES = toIntOrDefault(process.env.SHIM_AI_DIFF_LIMIT_BYTES, 51200);
const MIN_RATING = toIntOrDefault(process.env.SHIM_EXPLANATION_MIN_RATING, 90);
const REVIEWS_DIR = path.resolve(
  ROOT_DIR,
  process.env.SHIM_AI_REVIEW_DIR || ".shimwrapper/reviews",
);
const BRANCH = getBranch(ROOT_DIR);

/**
 * validateConfig: thin wrapper around shared validateCustomConfig.
 * Why: keeps the review script focused on review logic, not env-variable guard duplication.
 */
function validateConfig() {
  validateCustomConfig("Full Explanation check (custom provider)");
}

/**
 * buildFileBlock: assembles one whole-file block for the prompt.
 * Why: the Full Explanation standard mandates evaluating complete files, not diffs.
 * @param {string} relPath
 * @param {string} content
 * @returns {string}
 */
function buildFileBlock(relPath, content) {
  return `\n===== FILE: ${relPath} =====\n${content}\n`;
}

/**
 * collectFullFilePrompt: reads changed files, limits total bytes, and assembles the prompt.
 * Why: mirroring the bash script logic keeps the review scope identical across Codex and custom modes.
 * @returns {{prompt:string,appended:number}}
 */
function collectFullFilePrompt() {
  const paths = collectChangedPaths(ROOT_DIR, CHECK_MODE);
  const eligible = paths.filter(isExplanationEligiblePath);
  if (eligible.length === 0) {
    console.error(
      `Skipping Full Explanation check: no eligible changed files for CHECK_MODE=${CHECK_MODE}.`,
    );
    return { prompt: "", appended: 0 };
  }
  let total = 0;
  const blocks = [];
  let appended = 0;
  for (const p of eligible) {
    const content =
      CHECK_MODE === "commit"
        ? readCommitFile(ROOT_DIR, p)
        : readWorktreeFile(ROOT_DIR, p);
    if (content == null) continue;
    const block = Buffer.byteLength(buildFileBlock(p, content), "utf8");
    // Keep adding files until we hit the byte limit; always accept at least one so the prompt is never empty.
    if (appended > 0 && total + block > LIMIT_BYTES) continue;
    blocks.push(buildFileBlock(p, content));
    total += block;
    appended++;
  }
  if (blocks.length === 0) {
    console.error(
      "Skipping Full Explanation check: changed files resolved to no readable content.",
    );
    return { prompt: "", appended: 0 };
  }
  return {
    prompt: buildExplanationPrompt(MIN_RATING) + "\n" + blocks.join(""),
    appended,
  };
}

(async () => {
  validateConfig();
  const { prompt, appended: _appended } = collectFullFilePrompt();
  if (!prompt) {
    process.exit(0);
  }

  console.error("Running Full Explanation check (custom provider)...");
  let text = "";
  let tokens;
  try {
    const res = await sendReview({
      baseUrl: BASE_URL,
      apiKey: API_KEY,
      model: MODEL,
      systemPrompt: buildExplanationPrompt(MIN_RATING),
      userPrompt: prompt,
      format: FORMAT,
      timeoutSec: TIMEOUT_SEC,
    });
    text = res.text;
    tokens = res.usage;
  } catch (err) {
    console.error(
      `Full Explanation check error: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  const { score, verdict, deductions, pass } = evaluateReviewResponse(
    text,
    MIN_RATING,
  );

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const reviewFile = path.join(REVIEWS_DIR, `explanation-check-${ts}.md`);

  // Write a report compatible with the bash-script format.
  fs.mkdirSync(REVIEWS_DIR, { recursive: true });
  const lines = [
    `# Full Explanation Check — ${new Date().toISOString()}`,
    "",
    `- **Branch:** ${BRANCH}`,
    `- **Mode:** ${CHECK_MODE}`,
    `- **Verdict:** ${pass ? "PASS" : "FAIL"} (${verdict})`,
    `- **Score:** ${score}%`,
    `- **Tokens:** ${tokens?.inputTokens ?? "?"} input, ${tokens?.outputTokens ?? "?"} output`,
    "",
    "## Deductions",
    "",
  ];
  if (deductions.length > 0) {
    for (const d of deductions) {
      lines.push(
        `- **${d.point || "?"}**: -${d.minus ?? d.points ?? 0} — ${d.reason || ""}`,
      );
    }
  } else {
    lines.push("(none)");
  }
  lines.push(
    "",
    "## Raw response",
    "",
    "```",
    text || "(no response text)",
    "```",
    "",
  );
  fs.writeFileSync(reviewFile, lines.join("\n"), "utf8");

  console.error(`Report saved: ${reviewFile}`);
  console.error(`Full Explanation check: ${pass ? "PASS" : "FAIL"}`);
  console.error(`Score: ${score}%`);
  console.error(`Verdict: ${verdict}`);
  if (!pass) {
    console.error(
      "\u2192 Fix: add missing docstrings and inline comments, then re-run until it passes. See AGENTS.md.",
    );
  }
  process.exit(pass ? 0 : 1);
})();
