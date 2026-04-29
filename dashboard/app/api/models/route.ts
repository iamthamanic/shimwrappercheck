/**
 * GET /api/models — list available models from the configured custom AI provider.
 * Reads SHIM_AI_CUSTOM_BASE_URL and SHIM_AI_CUSTOM_API_KEY from the global
 * ~/.shimwrappercheck/.env file (same location as the CLI scripts).
 *
 * POST /api/models — update the selected model in .shimwrappercheckrc.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import os from "os";

/**
 * loadGlobalEnv: reads ~/.shimwrappercheck/.env into process.env.
 * Mirrors scripts/ai-env-loader.js so the dashboard and CLI share the same config source.
 */
function loadGlobalEnv() {
  const envPath = path.join(os.homedir(), ".shimwrappercheck", ".env");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

/**
 * getRcPath: returns the absolute path to .shimwrappercheckrc in the project root.
 */
function getRcPath(): string {
  const root = process.cwd(); // Next.js server runs from the dashboard directory parent
  return path.join(root, ".shimwrappercheckrc");
}

/**
 * readRcVar: reads a single variable value from .shimwrappercheckrc.
 */
function readRcVar(key: string): string | undefined {
  const rcPath = getRcPath();
  if (!fs.existsSync(rcPath)) return undefined;
  const content = fs.readFileSync(rcPath, "utf8");
  const re = new RegExp(`^${key}\\s*=\\s*"?([^"\\n]+)"?`, "m");
  const m = content.match(re);
  return m ? m[1] : undefined;
}

/**
 * writeRcVar: updates or inserts a variable in .shimwrappercheckrc.
 */
function writeRcVar(key: string, value: string) {
  const rcPath = getRcPath();
  let content = fs.existsSync(rcPath) ? fs.readFileSync(rcPath, "utf8") : "";
  const re = new RegExp(`^${key}\\s*=.*$`, "m");
  const line = `${key}="${value}"`;
  if (re.test(content)) {
    content = content.replace(re, line);
  } else {
    content = content.trimEnd() + "\n" + line + "\n";
  }
  fs.writeFileSync(rcPath, content, "utf8");
}

/**
 * listModels: queries the provider endpoint for available models.
 * Supports OpenAI-compatible (/v1/models) and Ollama native (/api/tags) formats.
 */
async function listModels({
  baseUrl,
  apiKey,
  format = "openai",
}: {
  baseUrl: string;
  apiKey: string;
  format?: string;
}) {
  const cleanBase = baseUrl.replace(/\/$/, "");
  const url = format === "ollama" ? `${cleanBase}/api/tags` : `${cleanBase}/models`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  if (format === "ollama") {
    const models = Array.isArray(json.models) ? json.models : [];
    return models.map((m: any) => ({
      id: String(m.name || ""),
      name: String(m.name || ""),
    }));
  }
  const data = Array.isArray(json.data) ? json.data : [];
  return data.map((m: any) => ({
    id: String(m.id || ""),
    name: String(m.id || ""),
  }));
}

/** Hard-coded fallback presets for Ollama Cloud when the API cannot be reached. */
const OLLAMA_CLOUD_PRESETS = [
  { id: "glm-5.1:cloud", name: "glm-5.1:cloud" },
  { id: "kimi-k2.6:cloud", name: "kimi-k2.6:cloud" },
  { id: "gpt-oss:120b-cloud", name: "gpt-oss:120b-cloud" },
  { id: "deepseek-v3.1:671b-cloud", name: "deepseek-v3.1:671b-cloud" },
  { id: "qwen3-coder:480b-cloud", name: "qwen3-coder:480b-cloud" },
];

export async function GET() {
  try {
    loadGlobalEnv();
    const baseUrl = process.env.SHIM_AI_CUSTOM_BASE_URL || "";
    const apiKey = process.env.SHIM_AI_CUSTOM_API_KEY || "";
    const format = readRcVar("SHIM_AI_CUSTOM_FORMAT") || "openai";
    const currentModel = readRcVar("SHIM_AI_CUSTOM_MODEL") || "";

    if (!baseUrl) {
      return NextResponse.json(
        {
          error: "SHIM_AI_CUSTOM_BASE_URL not configured. Run the AI setup first.",
        },
        { status: 400 }
      );
    }

    let models: { id: string; name: string }[] = [];
    try {
      models = await listModels({ baseUrl, apiKey, format });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("GET /api/models listModels error:", msg);
      // Fallback: if Ollama Cloud, return known presets so the UI still shows options.
      if (baseUrl.includes("ollama.com")) {
        models = [...OLLAMA_CLOUD_PRESETS];
      }
    }
    return NextResponse.json({
      models: models.filter((m: { id: string }) => m.id),
      currentModel,
      baseUrl,
      format,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("GET /api/models error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { model?: string };
    const model = body.model?.trim();
    if (!model) {
      return NextResponse.json({ error: "model is required" }, { status: 400 });
    }
    writeRcVar("SHIM_AI_CUSTOM_MODEL", model);
    return NextResponse.json({ ok: true, model });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("POST /api/models error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
