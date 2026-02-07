/**
 * GET/POST /api/settings – structured presets + check toggles.
 * Reads/writes .shimwrappercheck-presets.json and syncs .shimwrappercheckrc.
 */
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getProjectRoot } from "@/lib/projectRoot";
import {
  type SettingsData,
  type Preset,
  DEFAULT_SETTINGS,
  DEFAULT_VIBE_CODE_PRESET,
  DEFAULT_CHECK_TOGGLES,
  buildRcContent,
  SUPABASE_COMMAND_IDS,
  GIT_COMMAND_IDS,
} from "@/lib/presets";

const PRESETS_FILE = ".shimwrappercheck-presets.json";
const RC_FILE = ".shimwrappercheckrc";

function getPresetsPath(): string {
  return path.join(getProjectRoot(), PRESETS_FILE);
}
function getRcPath(): string {
  return path.join(getProjectRoot(), RC_FILE);
}

function parseRcToSettings(rawRc: string): Partial<SettingsData> {
  const checkToggles = { ...DEFAULT_CHECK_TOGGLES };
  const argsMatch = rawRc.match(/SHIM_CHECKS_ARGS="([^"]*)"/);
  if (argsMatch) {
    const args = argsMatch[1];
    if (args.includes("--no-frontend")) checkToggles.frontend = false;
    if (args.includes("--no-backend")) checkToggles.backend = false;
    if (args.includes("--no-ai-review")) checkToggles.aiReview = false;
    if (args.includes("--no-sast")) checkToggles.sast = false;
    if (args.includes("--no-architecture")) checkToggles.architecture = false;
    if (args.includes("--no-complexity")) checkToggles.complexity = false;
    if (args.includes("--no-mutation")) checkToggles.mutation = false;
    if (args.includes("--no-e2e")) checkToggles.e2e = false;
  }
  const enforceMatch = rawRc.match(/SHIM_ENFORCE_COMMANDS="([^"]*)"/);
  const hookMatch = rawRc.match(/SHIM_HOOK_COMMANDS="([^"]*)"/);
  const gitMatch = rawRc.match(/SHIM_GIT_ENFORCE_COMMANDS="([^"]*)"/);
  const enforce = enforceMatch ? enforceMatch[1].split(",").map((s) => s.trim()) : [];
  const hook = hookMatch ? hookMatch[1].split(",").map((s) => s.trim()) : [];
  const gitEnforce = gitMatch ? gitMatch[1].split(",").map((s) => s.trim()) : [];
  const supabaseEnforce = enforce.filter((c) => (SUPABASE_COMMAND_IDS as readonly string[]).includes(c));
  const supabaseHook = hook.filter((c) => (SUPABASE_COMMAND_IDS as readonly string[]).includes(c));
  const gitEnforceList = gitEnforce.filter((c) => (GIT_COMMAND_IDS as readonly string[]).includes(c));
  const preset: Preset = {
    ...DEFAULT_VIBE_CODE_PRESET,
    supabase: { enforce: supabaseEnforce as any, hook: supabaseHook as any },
    git: { enforce: gitEnforceList as any },
  };
  return {
    presets: [preset],
    activePresetId: DEFAULT_VIBE_CODE_PRESET.id,
    checkToggles,
  };
}

export async function GET() {
  try {
    const root = getProjectRoot();
    const presetsPath = getPresetsPath();
    const rcPath = getRcPath();

    let settings: SettingsData = { ...DEFAULT_SETTINGS };

    if (fs.existsSync(presetsPath)) {
      try {
        const raw = fs.readFileSync(presetsPath, "utf8");
        const parsed = JSON.parse(raw) as SettingsData;
        if (parsed.presets?.length) settings.presets = parsed.presets;
        if (parsed.activePresetId) settings.activePresetId = parsed.activePresetId;
        if (parsed.checkToggles) settings.checkToggles = { ...DEFAULT_SETTINGS.checkToggles, ...parsed.checkToggles };
      } catch {
        // use defaults
      }
    }

    if (fs.existsSync(rcPath) && !fs.existsSync(presetsPath)) {
      const rawRc = fs.readFileSync(rcPath, "utf8");
      const fromRc = parseRcToSettings(rawRc);
      if (fromRc.checkToggles) settings.checkToggles = fromRc.checkToggles;
      if (fromRc.presets?.length) settings.presets = fromRc.presets;
      if (fromRc.activePresetId) settings.activePresetId = fromRc.activePresetId;
    }

    return NextResponse.json(settings);
  } catch (err) {
    console.error("settings get error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SettingsData;
    if (!body || !Array.isArray(body.presets)) {
      return NextResponse.json({ error: "presets array required" }, { status: 400 });
    }

    const settings: SettingsData = {
      presets: body.presets,
      activePresetId: body.activePresetId ?? DEFAULT_SETTINGS.activePresetId,
      checkToggles: { ...DEFAULT_SETTINGS.checkToggles, ...body.checkToggles },
    };

    const root = getProjectRoot();
    const presetsPath = getPresetsPath();
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });

    fs.writeFileSync(presetsPath, JSON.stringify(settings, null, 2), "utf8");
    const rcContent = buildRcContent(settings);
    fs.writeFileSync(getRcPath(), rcContent, "utf8");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("settings post error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
