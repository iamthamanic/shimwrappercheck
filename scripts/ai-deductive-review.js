/**
 * AI Deductive Review: sends code diff to OpenAI/Anthropic, expects JSON
 * { score, deductions, verdict }. Threshold 95%; REJECT or score < 95 → fail.
 * API keys from .env (OPENAI_API_KEY, ANTHROPIC_API_KEY).
 */
const path = require('path');
const { execSync } = require('child_process');

const LIMIT_BYTES = 51200;
const THRESHOLD = 95;

function getDiff(projectRoot) {
  const cwd = projectRoot;
  let out = '';
  try {
    out = execSync('git diff --no-color', { cwd, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  } catch (e) {
    // ignore
  }
  try {
    out += execSync('git diff --cached --no-color', { cwd, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
  } catch (e) {
    // ignore
  }
  if (!out || !out.trim()) {
    try {
      execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { cwd, stdio: 'ignore' });
      out = execSync('git diff --no-color @{u}...HEAD', { cwd, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
    } catch (e1) {
      try {
        out = execSync('git diff --no-color HEAD~1...HEAD', { cwd, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
      } catch (e2) {
        // ignore
      }
    }
  }
  if (!out || !out.trim()) return null;
  if (Buffer.byteLength(out, 'utf8') <= LIMIT_BYTES * 2) return out;
  const start = out.slice(0, LIMIT_BYTES);
  const end = out.slice(-LIMIT_BYTES);
  return start + '\n... [truncated] ...\n' + end;
}

const SYSTEM_PROMPT = `You are a code reviewer. You MUST respond with ONLY a single valid JSON object, no other text.
Format: { "score": number, "deductions": [ { "reason": string, "points": number } ], "verdict": "ACCEPT" | "REJECT" }
- Start at 100 points. Apply deductions from the checklist below.
- Deductions (apply each that applies): SOLID violation (SRP, OCP, LSP, ISP, DIP) -15 points each; N+1 query or O(n²) complexity -20; missing input validation or security issue -25; unclear naming or side effects -10.
- verdict: "ACCEPT" only if score >= 95; otherwise "REJECT".
Output nothing but the JSON object.`;

function buildUserPrompt(diff) {
  return `Review this code diff and output the JSON object only.\n\n--- DIFF ---\n${diff}\n--- END DIFF ---`;
}

async function callOpenAI(diff) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(diff) },
      ],
      max_tokens: 1024,
      temperature: 0.2,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  return text;
}

async function callAnthropic(diff) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(diff) }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content?.[0]?.text?.trim();
  return text;
}

function parseJson(text) {
  const stripped = text.replace(/^[\s\S]*?(\{[\s\S]*\})[\s\S]*$/m, '$1');
  return JSON.parse(stripped);
}

async function runAsync(projectRoot) {
  const diff = getDiff(projectRoot);
  if (!diff) return { ok: true };

  let text = null;
  if (process.env.OPENAI_API_KEY && !process.env.SHIM_AI_USE_ANTHROPIC_ONLY) {
    try {
      text = await callOpenAI(diff);
    } catch (e) {
      if (process.env.ANTHROPIC_API_KEY) text = await callAnthropic(diff);
      else throw e;
    }
  }
  if (!text && process.env.ANTHROPIC_API_KEY) text = await callAnthropic(diff);
  if (!text && process.env.OPENAI_API_KEY) text = await callOpenAI(diff);
  if (!text) return { ok: true };

  let json;
  try {
    json = parseJson(text);
  } catch (e) {
    return { ok: false, message: 'AI returned invalid JSON', suggestion: 'Retry or check API.', deductions: [] };
  }
  const score = Number(json.score);
  const verdict = (json.verdict || '').toUpperCase();
  const deductions = Array.isArray(json.deductions) ? json.deductions : [];
  if (verdict === 'REJECT' || score < THRESHOLD) {
    return {
      ok: false,
      message: `AI review score ${score}% (min ${THRESHOLD}%)`,
      suggestion: deductions.length ? deductions.map((d) => d.reason).join('; ') : 'Address deductions to reach 95%.',
      deductions,
    };
  }
  return { ok: true };
}

module.exports = { runAsync, getDiff, callOpenAI, callAnthropic };
