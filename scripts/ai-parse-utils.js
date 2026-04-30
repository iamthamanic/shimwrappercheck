#!/usr/bin/env node
/**
 * ai-parse-utils.js — parsing and validation helpers for review scripts.
 * Single Responsibility: extract structured JSON from LLM text, coerce types, validate config.
 */

/**
 * toIntOrDefault: parses a string as integer, falling back to a default.
 * @param {string|undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function toIntOrDefault(value, fallback) {
  const n = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * limitDiff: truncates the middle of a diff if it exceeds twice the byte limit.
 * @param {string} diff
 * @param {number} limitBytes
 * @returns {string}
 */
function limitDiff(diff, limitBytes) {
  const buf = Buffer.from(diff, "utf8");
  if (buf.length <= limitBytes * 2) return diff;
  const half = Math.floor(limitBytes / 2);
  return (
    buf.subarray(0, half).toString("utf8") +
    `\n... [truncated ${buf.length - limitBytes} bytes] ...\n` +
    buf.subarray(buf.length - half).toString("utf8")
  );
}

/**
 * parseReviewJson: robustly extracts a JSON object from raw LLM text.
 * @param {string} text
 * @returns {{score:number,deductions:Array<any>,verdict:string}|null}
 */
function parseReviewJson(text) {
  if (!text) return null;
  const cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*$/gm, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const json = JSON.parse(match[0]);
    const score = Number(json.score ?? 0);
    const verdict = String(json.verdict || "REJECT").toUpperCase();
    const deductions = Array.isArray(json.deductions) ? json.deductions : [];
    return {
      score,
      verdict: verdict === "ACCEPT" ? "ACCEPT" : "REJECT",
      deductions,
    };
  } catch {
    return null;
  }
}

/**
 * validateCustomConfig: ensures required custom-provider env vars are set.
 * API key is optional for local Ollama (localhost:11434).
 * @param {string} label
 */
function validateCustomConfig(label) {
  const baseUrl = process.env.SHIM_AI_CUSTOM_BASE_URL || "";
  const apiKey = process.env.SHIM_AI_CUSTOM_API_KEY || "";
  const model = process.env.SHIM_AI_CUSTOM_MODEL || "";
  const isLocal =
    (process.env.SHIM_AI_OLLAMA_MODE || "").toLowerCase() === "local" ||
    baseUrl.includes("localhost") ||
    baseUrl.includes("127.0.0.1");
  const missing = [];
  if (!baseUrl) missing.push("SHIM_AI_CUSTOM_BASE_URL");
  if (!isLocal && !apiKey) missing.push("SHIM_AI_CUSTOM_API_KEY");
  if (!model) missing.push("SHIM_AI_CUSTOM_MODEL");
  if (missing.length) {
    console.error(`${label}: missing env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
}

/**
 * evaluateReviewResponse: extracts score/verdict/deductions from raw LLM text and computes pass/fail.
 * Why: both review scripts apply the same acceptance logic; centralising prevents drift.
 * @param {string} text
 * @param {number} minRating
 * @returns {{score:number,verdict:string,deductions:Array<any>,pass:number}}
 */
function evaluateReviewResponse(text, minRating) {
  const parsed = parseReviewJson(text);
  const score = parsed?.score ?? 0;
  const verdict = parsed?.verdict ?? "REJECT";
  const deductions = parsed?.deductions ?? [];
  const pass = verdict === "ACCEPT" && score >= minRating ? 1 : 0;
  return { score, verdict, deductions, pass };
}

module.exports = {
  toIntOrDefault,
  limitDiff,
  parseReviewJson,
  evaluateReviewResponse,
  validateCustomConfig,
};
