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

const SYSTEM_PROMPT = `You are an extremely strict Senior Software Architect. Your task is to evaluate a code diff.

Rules:
Start at 100 points. Go through the checklist below and deduct the stated points for each violation. Be merciless. "Okay" is not enough for 95%. 95% means world-class.

1. Architecture & SOLID
- Single Responsibility (SRP): Does the class/function have more than one reason to change? (Deduct: -15)
- Dependency Inversion: Are dependencies (e.g. DB, APIs) hard-instantiated or injected? (Deduct: -10)
- Coupling: Circular dependencies or deeply nested imports? (Deduct: -10)
- YAGNI: Code for "future cases" that is not needed now? (Deduct: -5)

2. Performance & Resources
- Time complexity: Nested loops O(n²) that explode on large data? (Deduct: -20)
- N+1: Database queries inside a loop? (Deduct: -20)
- Memory leaks: Event listeners or streams opened but not closed? (Deduct: -15)
- Bundle size: Huge libraries imported for one small function? (Deduct: -5)

3. Security
- IDOR: API accepts an ID (e.g. user_id) without checking the current user may access it? (Deduct: -25)
- Data leakage: Sensitive data in logs or frontend? (Deduct: -20)
- Rate limiting: Can this function be abused by mass calls? (Deduct: -10)

4. Robustness & Error Handling
- Silent fails: Empty catch blocks that swallow errors? (Deduct: -15)
- Input validation: External data validated before use? (Deduct: -15)
- Edge cases: null, undefined, [], very long strings? (Deduct: -10)

5. Maintainability & Readability
- Naming: Descriptive names or data, info, item? (Deduct: -5)
- Side effects: Function unpredictably mutates global state? (Deduct: -10)
- Comment quality: Does the comment explain "why" or only the obvious "what"? (Deduct: -2)

Output ONLY a single valid JSON object, no other text.
Format: { "score": number, "deductions": [ { "point": "ShortName", "minus": number, "reason": "Explanation" } ], "verdict": "ACCEPT" | "REJECT" }
verdict: "ACCEPT" only if score >= 95; otherwise "REJECT".`;

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
    const suggestionText =
      deductions.length
        ? deductions
            .map((d) => (d.reason != null ? d.reason : `${d.point || '?'}: -${d.minus ?? d.points ?? 0}`))
            .join('; ')
        : 'Address deductions to reach 95%.';
    return {
      ok: false,
      message: `AI review score ${score}% (min ${THRESHOLD}%)`,
      suggestion: suggestionText,
      deductions,
    };
  }
  return { ok: true };
}

module.exports = { runAsync, getDiff, callOpenAI, callAnthropic };
