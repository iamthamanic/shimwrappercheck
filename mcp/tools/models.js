/**
 * list_models / set_model — AI provider model selection.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { loadCoreModule } = require("../core-bridge.js");

async function loadGlobalAiEnv() {
  const globalEnvPath = path.join(
    os.homedir(),
    ".shimwrappercheck",
    ".env",
  );
  if (!fs.existsSync(globalEnvPath)) return;
  const envContent = fs.readFileSync(globalEnvPath, "utf8");
  for (const line of envContent.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

async function listModels(projectRoot) {
  await loadGlobalAiEnv();
  const core = await loadCoreModule();
  if (!core) {
    return { error: "Core engine not built." };
  }

  const { legacy: rc } = core.loadConfig({ projectRoot, env: process.env });
  const baseUrl = process.env.SHIM_AI_CUSTOM_BASE_URL;
  const apiKey = process.env.SHIM_AI_CUSTOM_API_KEY || "";
  const format = (rc.SHIM_AI_CUSTOM_FORMAT || "openai").toLowerCase();
  const isLocal =
    (process.env.SHIM_AI_OLLAMA_MODE || "").toLowerCase() === "local" ||
    (baseUrl || "").includes("localhost") ||
    (baseUrl || "").includes("127.0.0.1");

  if (!baseUrl) {
    return {
      error: "SHIM_AI_CUSTOM_BASE_URL not configured. Run ai-setup first.",
    };
  }
  if (!isLocal && !apiKey) {
    return {
      error: "SHIM_AI_CUSTOM_API_KEY not configured. Run ai-setup first.",
    };
  }

  try {
    const cleanBase = baseUrl.replace(/\/$/, "");
    const url =
      format === "ollama" ? `${cleanBase}/api/tags` : `${cleanBase}/models`;
    const authHeader = apiKey ? `-H "Authorization: Bearer ${apiKey}"` : "";
    const res = require("child_process").execSync(
      `curl -s ${authHeader} "${url}"`.trim(),
      { timeout: 15000, encoding: "utf8" },
    );
    const json = JSON.parse(res);
    const models =
      format === "ollama"
        ? (Array.isArray(json.models) ? json.models : [])
            .map((m) => ({
              id: String(m.name || ""),
              name: String(m.name || ""),
            }))
            .filter((m) => m.id)
        : (Array.isArray(json.data) ? json.data : [])
            .map((m) => ({
              id: String(m.id || ""),
              name: String(m.id || ""),
            }))
            .filter((m) => m.id);
    return {
      models,
      currentModel: rc.SHIM_AI_CUSTOM_MODEL || "",
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function setModel(projectRoot, model) {
  const trimmed = model?.trim();
  if (!trimmed) return { error: "model is required" };
  const core = await loadCoreModule();
  if (!core) return { error: "Core engine not built." };
  core.patchLegacyRc({ SHIM_AI_CUSTOM_MODEL: trimmed }, { projectRoot });
  return { ok: true, model: trimmed };
}

module.exports = { listModels, setModel };
