#!/usr/bin/env node
/**
 * ai-llm-models.js — model listing for custom LLM endpoints.
 * Single Responsibility: query /v1/models (OpenAI-compatible) or /api/tags (Ollama native)
 * and return a uniform list of available models.
 */

// Reuse the HTTP helpers from the request module; no duplication.
const { sendReview } = require("./ai-llm-request");

/**
 * buildHeaders: constructs the Authorization header for the HTTP request.
 * @param {string} apiKey
 * @returns {Record<string,string>}
 */
function buildHeaders(apiKey) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

/**
 * fetchWithTimeout: simple GET with AbortController timeout.
 * Why: model listing is read-only and does not need retry logic.
 * @param {string} url
 * @param {string} apiKey
 * @param {number} timeoutSec
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, apiKey, timeoutSec) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: buildHeaders(apiKey),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * listModelsOpenAI: queries an OpenAI-compatible /v1/models endpoint.
 * @param {string} baseUrl
 * @param {string} apiKey
 * @param {number} timeoutSec
 * @returns {Promise<Array<{id:string,name?:string}>>}
 */
async function listModelsOpenAI(baseUrl, apiKey, timeoutSec) {
  const url = `${baseUrl.replace(/\/$/, "")}/models`;
  const res = await fetchWithTimeout(url, apiKey, timeoutSec);
  const json = /** @type {any} */ (await res.json());
  const data = Array.isArray(json.data) ? json.data : [];
  return data
    .map((/** @type {any} */ m) => ({
      id: String(m.id || ""),
      name: String(m.id || ""),
    }))
    .filter((/** @type {{id:string}} */ m) => m.id);
}

/**
 * listModelsOllama: queries the native Ollama /api/tags endpoint.
 * @param {string} baseUrl
 * @param {string} apiKey
 * @param {number} timeoutSec
 * @returns {Promise<Array<{id:string,name?:string}>>}
 */
async function listModelsOllama(baseUrl, apiKey, timeoutSec) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/tags`;
  const res = await fetchWithTimeout(url, apiKey, timeoutSec);
  const json = /** @type {any} */ (await res.json());
  const models = Array.isArray(json.models) ? json.models : [];
  return models
    .map((/** @type {any} */ m) => ({
      id: String(m.name || ""),
      name: String(m.name || ""),
    }))
    .filter((/** @type {{id:string}} */ m) => m.id);
}

/**
 * listModels: returns the available models from the configured endpoint.
 * @param {{baseUrl:string,apiKey:string,format?:string,timeoutSec?:number}} params
 * @returns {Promise<Array<{id:string,name?:string}>>}
 */
async function listModels({
  baseUrl,
  apiKey,
  format = "openai",
  timeoutSec = 30,
}) {
  if (!baseUrl) throw new Error("listModels requires baseUrl");
  if (format === "ollama") return listModelsOllama(baseUrl, apiKey, timeoutSec);
  return listModelsOpenAI(baseUrl, apiKey, timeoutSec);
}

module.exports = { listModels };
