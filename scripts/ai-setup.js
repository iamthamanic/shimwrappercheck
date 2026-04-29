#!/usr/bin/env node
/**
 * ai-setup.js — Interactive setup for custom AI providers.
 *
 * Supports three modes:
 *   ollama-local  → http://localhost:11434/api, no key, native Ollama API
 *   ollama-cloud  → https://ollama.com/api, API key, native Ollama API
 *   custom        → any OpenAI-compatible endpoint (OpenRouter, self-hosted, etc.)
 *
 * Usage: node scripts/ai-setup.js
 *        npx shimwrappercheck ai-setup
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { loadGlobalEnv } = require("./ai-env-loader");
const { listModels } = require("./ai-llm-models");

const GLOBAL_ENV_PATH = path.join(
  require("os").homedir(),
  ".shimwrappercheck",
  ".env",
);

function ask(question, defaultValue = "") {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const prompt = defaultValue
    ? `${question} [${defaultValue}]: `
    : `${question}: `;
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askSecret(question) {
  if (!process.stdin.isTTY) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question(`${question}: `, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(`${question}: `);
    stdin.resume();
    stdin.setRawMode(true);
    let answer = "";
    stdin.on("data", (char) => {
      const str = char.toString();
      if (str === "\n" || str === "\r" || str === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdout.write("\n");
        resolve(answer);
        return;
      }
      if (str === "\b" || str === "\x7F") {
        if (answer.length > 0) {
          answer = answer.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }
      if (str === "\u0003") process.exit(1);
      answer += str;
      stdout.write("*");
    });
  });
}

function loadExistingEnv() {
  const env = {};
  if (!fs.existsSync(GLOBAL_ENV_PATH)) return env;
  const content = fs.readFileSync(GLOBAL_ENV_PATH, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

function saveEnv(env) {
  const dir = path.dirname(GLOBAL_ENV_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const lines = Object.entries(env).map(
    ([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`,
  );
  lines.push("");
  fs.writeFileSync(GLOBAL_ENV_PATH, lines.join("\n"), { mode: 0o600 });
}

/** Popular Ollama Cloud models shown as presets during setup. */
const OLLAMA_CLOUD_PRESETS = [
  { tag: "glm-5.1:cloud", label: "GLM-5.1 (Z.AI — best coding/agentic)" },
  {
    tag: "kimi-k2.6:cloud",
    label: "Kimi K2.6 (Moonshot — multimodal, 256K context)",
  },
  { tag: "gpt-oss:120b-cloud", label: "GPT-OSS 120B" },
  {
    tag: "deepseek-v3.1:671b-cloud",
    label: "DeepSeek V3.1 671B",
  },
  { tag: "qwen3-coder:480b-cloud", label: "Qwen3 Coder 480B" },
];

async function main() {
  console.log("=== AI Provider Setup for shimwrappercheck ===\n");
  console.log(`Config will be saved to: ${GLOBAL_ENV_PATH}\n`);

  const existing = loadExistingEnv();

  // ── Step 0: Provider-Typ wählen ──────────────────────────────
  const mode = await ask(
    "Provider type (ollama-local / ollama-cloud / custom)",
    existing.SHIM_AI_PROVIDER_TYPE || "ollama-cloud",
  );

  const isOllamaLocal = mode === "ollama-local";
  const isOllamaCloud = mode === "ollama-cloud";
  const isOllama = isOllamaLocal || isOllamaCloud;
  const isCustom = mode === "custom";

  // ── Step 1: Base URL ────────────────────────────────────────
  let baseUrl;
  if (isOllamaLocal) {
    baseUrl = await ask(
      "Local Ollama URL",
      existing.SHIM_AI_CUSTOM_BASE_URL || "http://localhost:11434/api",
    );
  } else if (isOllamaCloud) {
    baseUrl = await ask(
      "Ollama Cloud URL",
      existing.SHIM_AI_CUSTOM_BASE_URL || "https://ollama.com/api",
    );
  } else {
    baseUrl = await ask(
      "Custom endpoint URL (e.g. https://openrouter.ai/api/v1)",
      existing.SHIM_AI_CUSTOM_BASE_URL || "",
    );
  }
  if (!baseUrl) {
    console.error("Error: Base URL is required.");
    process.exit(1);
  }

  // ── Step 2: API Key (nur für Cloud/Custom) ─────────────────────
  let apiKey = "";
  if (!isOllamaLocal) {
    apiKey = existing.SHIM_AI_CUSTOM_API_KEY || "";
    if (apiKey) {
      const change = await ask(
        "API Key already configured. Change it? (yes/no)",
        "no",
      );
      if (change.toLowerCase() === "yes")
        apiKey = await askSecret("New API Key");
    } else {
      apiKey = await askSecret("API Key");
    }
    if (!apiKey) {
      console.error("Error: API Key is required for cloud/custom mode.");
      process.exit(1);
    }
  }

  // ── Step 3: Format (nur für Custom relevant) ─────────────────
  let format = "ollama";
  if (isCustom) {
    const formatInput = await ask(
      "API format (openai / ollama)",
      existing.SHIM_AI_CUSTOM_FORMAT || "openai",
    );
    format = ["openai", "ollama"].includes(formatInput)
      ? formatInput
      : "openai";
  }

  // ── Step 3b: Preset model shortcuts for Ollama Cloud ────────────
  if (isOllamaCloud && !existing.SHIM_AI_CUSTOM_MODEL) {
    console.log("\nPopular Ollama Cloud models:");
    for (let i = 0; i < OLLAMA_CLOUD_PRESETS.length; i++) {
      console.log(
        `  ${i + 1}. ${OLLAMA_CLOUD_PRESETS[i].tag} — ${OLLAMA_CLOUD_PRESETS[i].label}`,
      );
    }
  }

  // ── Step 4: Test Verbindung ───────────────────────────────────
  console.log("\nTesting connection and fetching available models...");
  let models = [];
  try {
    models = await listModels({ baseUrl, apiKey, format, timeoutSec: 15 });
    console.log(`Found ${models.length} models.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Connection test failed: ${msg}`);
    const proceed = await ask("Save config anyway? (yes/no)", "no");
    if (proceed.toLowerCase() !== "yes") {
      console.log("Setup aborted. Config was NOT saved.");
      process.exit(1);
    }
  }

  // ── Step 5: Modell auswählen ──────────────────────────────────
  let model = existing.SHIM_AI_CUSTOM_MODEL || "";
  if (models.length > 0) {
    console.log("\nAvailable models:");
    for (let i = 0; i < models.length; i++) {
      const mark = models[i].id === model ? " (current)" : "";
      console.log(`  ${i + 1}. ${models[i].id}${mark}`);
    }
    const modelInput = await ask(
      "Select model (number or exact name, Enter to keep current)",
      model,
    );
    const idx = Number.parseInt(modelInput, 10) - 1;
    if (Number.isFinite(idx) && idx >= 0 && idx < models.length) {
      model = models[idx].id;
    } else if (modelInput) {
      model = modelInput;
    }
  } else {
    if (isOllamaCloud) {
      // Show presets inline when no models were fetched
      const presetList = OLLAMA_CLOUD_PRESETS.map(
        (p, i) => `${i + 1}. ${p.tag}`,
      ).join(", ");
      model =
        (await ask(`Model tag or preset number (${presetList})`, model)) ||
        model;
      // Accept preset number shorthand
      const presetIdx = Number.parseInt(model, 10) - 1;
      if (
        Number.isFinite(presetIdx) &&
        presetIdx >= 0 &&
        presetIdx < OLLAMA_CLOUD_PRESETS.length
      ) {
        model = OLLAMA_CLOUD_PRESETS[presetIdx].tag;
      }
    } else {
      model = (await ask("Model name", model)) || model;
    }
  }
  if (!model) {
    console.error("Error: Model name is required.");
    process.exit(1);
  }

  // ── Step 6: Save ─────────────────────────────────────────────
  const env = {
    SHIM_AI_REVIEW_PROVIDER: "custom",
    SHIM_AI_CUSTOM_BASE_URL: baseUrl,
    SHIM_AI_CUSTOM_MODEL: model,
    SHIM_AI_CUSTOM_FORMAT: format,
    SHIM_AI_PROVIDER_TYPE: mode,
    ...existing,
  };
  if (!isOllamaLocal) env.SHIM_AI_CUSTOM_API_KEY = apiKey;
  else delete env.SHIM_AI_CUSTOM_API_KEY;

  saveEnv(env);
  console.log(`\nConfig saved to ${GLOBAL_ENV_PATH}`);
  console.log("Permissions: 0600 (owner read/write only)");
  console.log("\nProvider:", mode);
  console.log("Base URL:", baseUrl);
  console.log("Format:", format);
  console.log("Selected model:", model);
  console.log("\nTest your setup:");
  console.log("  CHECK_MODE=snippet node scripts/ai-code-review.js");
}

module.exports = { loadGlobalEnv };

if (require.main === module) {
  main().catch((err) => {
    console.error(
      `Setup failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  });
}
