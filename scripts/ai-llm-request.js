#!/usr/bin/env node
/**
 * ai-llm-request.js — HTTP request layer for custom LLM endpoints.
 * Single Responsibility: build LLM request bodies, execute fetch with retry/timeout,
 * and parse responses for OpenAI-compatible and Ollama-native formats.
 */

/**
 * delay: waits for the given number of milliseconds.
 * Why: exponential backoff between retries needs a non-blocking wait.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * buildHeaders: constructs the Authorization header for the HTTP request.
 * Why: every API call needs the same Auth pattern (Bearer token).
 * @param {string} apiKey
 * @returns {Record<string,string>}
 */
function buildHeaders(apiKey) {
  const headers = { "Content-Type": "application/json" };
  // Bearer token is the OpenAI-compatible standard; Ollama native also accepts it.
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  return headers;
}

/**
 * isRetryableError: decides whether a failed request deserves a retry.
 * Why: 503/429/500 and network errors are often transient; 4xx client errors are not.
 * @param {unknown} err
 * @returns {boolean}
 */
function isRetryableError(err) {
  if (!err || typeof err !== "object") return false;
  const e = /** @type {{status?:number,code?:string}} */ (err);
  // HTTP status codes that indicate temporary unavailability.
  if (
    e.status === 429 ||
    e.status === 500 ||
    e.status === 502 ||
    e.status === 503 ||
    e.status === 504
  )
    return true;
  // Network-level errors from fetch or node.
  const retryCodes = [
    "ECONNRESET",
    "ETIMEDOUT",
    "ENOTFOUND",
    "ECONNREFUSED",
    "EAI_AGAIN",
  ];
  if (e.code && retryCodes.includes(String(e.code))) return true;
  return false;
}

/**
 * fetchWithRetry: executes fetch with AbortController timeout and exponential backoff.
 * Why: LLM cloud endpoints occasionally return 503 or time out; retries reduce false negatives.
 * @param {string} url
 * @param {RequestInit} init
 * @param {number} timeoutSec
 * @param {number} [maxRetries]
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, init, timeoutSec, maxRetries = 3) {
  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutSec * 1000);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      // If the server accepted the request but returned an error status,
      // we still throw so the caller can decide on retry logic.
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        const err = /** @type {any} */ (
          new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`)
        );
        err.status = res.status;
        throw err;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt === maxRetries) break;
      if (!isRetryableError(err)) break;
      // Exponential backoff: 1s, 2s, 4s.
      const backoff = 1000 * 2 ** attempt;
      console.error(
        `Retry ${attempt + 1}/${maxRetries} after ${backoff}ms (${String(/** @type {Error} */ (err).message)})`,
      );
      await delay(backoff);
    }
  }
  throw lastErr;
}

/**
 * buildOpenAIBody: constructs the JSON body for an OpenAI-compatible chat request.
 * Why: OpenAI-compatible endpoints (Ollama Cloud, OpenRouter, Groq) share this schema.
 * @param {string} model
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {number} maxTokens
 * @param {number} temperature
 * @returns {Record<string,unknown>}
 */
function buildOpenAIBody(
  model,
  systemPrompt,
  userPrompt,
  maxTokens = 1024,
  temperature = 0.2,
) {
  return {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  };
}

/**
 * buildOllamaBody: constructs the JSON body for a native Ollama /api/chat request.
 * Why: native Ollama uses a slightly different schema (stream bool, options object).
 * @param {string} model
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {number} maxTokens
 * @param {number} temperature
 * @returns {Record<string,unknown>}
 */
function buildOllamaBody(
  model,
  systemPrompt,
  userPrompt,
  maxTokens = 1024,
  temperature = 0.2,
) {
  return {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    stream: false,
    options: {
      num_predict: maxTokens,
      temperature,
    },
  };
}

/**
 * parseOpenAIResponse: extracts assistant text and token usage from an OpenAI-compatible response.
 * @param {any} json
 * @returns {{text:string,usage?:{inputTokens:number,outputTokens:number}}}
 */
function parseOpenAIResponse(json) {
  const text = String(json.choices?.[0]?.message?.content ?? "").trim();
  const usage = json.usage
    ? {
        inputTokens: Number(
          json.usage.prompt_tokens ?? json.usage.input_tokens ?? 0,
        ),
        outputTokens: Number(
          json.usage.completion_tokens ?? json.usage.output_tokens ?? 0,
        ),
      }
    : undefined;
  return { text, usage };
}

/**
 * parseOllamaResponse: extracts assistant text and token counts from a native Ollama response.
 * @param {any} json
 * @returns {{text:string,usage?:{inputTokens:number,outputTokens:number}}}
 */
function parseOllamaResponse(json) {
  const text = String(json.message?.content ?? "").trim();
  const usage =
    json.prompt_eval_count !== undefined || json.eval_count !== undefined
      ? {
          inputTokens: Number(json.prompt_eval_count ?? 0),
          outputTokens: Number(json.eval_count ?? 0),
        }
      : undefined;
  return { text, usage };
}

/**
 * sendReview: sends a code-diff prompt to the LLM endpoint and returns the raw text.
 * Single entry point consumed by review scripts.
 * @param {Object} params
 * @returns {Promise<{text:string,usage?:{inputTokens:number,outputTokens:number}}>}
 */
async function sendReview({
  baseUrl,
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  format = "openai",
  timeoutSec = 180,
  maxRetries = 3,
}) {
  if (!baseUrl) throw new Error("sendReview requires baseUrl");
  if (!model) throw new Error("sendReview requires model");

  const cleanBase = baseUrl.replace(/\/$/, "");
  const isOllama = format === "ollama";
  const url = isOllama
    ? `${cleanBase}/api/chat`
    : `${cleanBase}/chat/completions`;
  const body = isOllama
    ? buildOllamaBody(model, systemPrompt, userPrompt)
    : buildOpenAIBody(model, systemPrompt, userPrompt);

  const res = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify(body),
    },
    timeoutSec,
    maxRetries,
  );
  const json = /** @type {any} */ (await res.json());
  return isOllama ? parseOllamaResponse(json) : parseOpenAIResponse(json);
}

module.exports = { sendReview };
