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
  type CheckToggles,
  type CheckSettings,
  type SupabaseCommandId,
  type GitCommandId,
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
    if (args.includes("--no-frontend")) {
      checkToggles.lint = false;
      checkToggles.prettier = false;
      checkToggles.typecheck = false;
      checkToggles.checkMockData = false;
      checkToggles.testRun = false;
      checkToggles.projectRules = false;
      checkToggles.npmAudit = false;
      checkToggles.viteBuild = false;
      checkToggles.snyk = false;
      checkToggles.updateReadme = false;
    }
    if (args.includes("--no-backend")) {
      checkToggles.denoFmt = false;
      checkToggles.denoLint = false;
      checkToggles.denoAudit = false;
    }
    if (args.includes("--no-ai-review")) checkToggles.aiReview = false;
    if (args.includes("--no-explanation-check")) checkToggles.explanationCheck = false;
    if (args.includes("--no-i18n-check")) checkToggles.i18nCheck = false;
    if (args.includes("--no-sast")) checkToggles.sast = false;
    if (args.includes("--no-gitleaks")) checkToggles.gitleaks = false;
    if (args.includes("--no-license-checker")) checkToggles.licenseChecker = false;
    if (args.includes("--no-architecture")) checkToggles.architecture = false;
    if (args.includes("--no-complexity")) checkToggles.complexity = false;
    if (args.includes("--no-mutation")) checkToggles.mutation = false;
    if (args.includes("--no-e2e")) checkToggles.e2e = false;
  }
  const readEnv = (key: string): boolean | undefined => {
    const m = rawRc.match(new RegExp(`${key}=(\\d+)`));
    return m ? m[1] === "1" : undefined;
  };
  if (readEnv("SHIM_RUN_LINT") !== undefined) checkToggles.lint = readEnv("SHIM_RUN_LINT")!;
  if (readEnv("SHIM_RUN_PRETTIER") !== undefined) checkToggles.prettier = readEnv("SHIM_RUN_PRETTIER")!;
  if (readEnv("SHIM_RUN_TYPECHECK") !== undefined) checkToggles.typecheck = readEnv("SHIM_RUN_TYPECHECK")!;
  if (readEnv("SHIM_RUN_CHECK_MOCK_DATA") !== undefined)
    checkToggles.checkMockData = readEnv("SHIM_RUN_CHECK_MOCK_DATA")!;
  if (readEnv("SHIM_RUN_TEST_RUN") !== undefined) checkToggles.testRun = readEnv("SHIM_RUN_TEST_RUN")!;
  if (readEnv("SHIM_RUN_PROJECT_RULES") !== undefined) checkToggles.projectRules = readEnv("SHIM_RUN_PROJECT_RULES")!;
  if (readEnv("SHIM_RUN_NPM_AUDIT") !== undefined) checkToggles.npmAudit = readEnv("SHIM_RUN_NPM_AUDIT")!;
  if (readEnv("SHIM_RUN_VITE_BUILD") !== undefined) checkToggles.viteBuild = readEnv("SHIM_RUN_VITE_BUILD")!;
  if (readEnv("SHIM_RUN_SNYK") !== undefined) checkToggles.snyk = readEnv("SHIM_RUN_SNYK")!;
  if (readEnv("SHIM_RUN_DENO_FMT") !== undefined) checkToggles.denoFmt = readEnv("SHIM_RUN_DENO_FMT")!;
  if (readEnv("SHIM_RUN_DENO_LINT") !== undefined) checkToggles.denoLint = readEnv("SHIM_RUN_DENO_LINT")!;
  if (readEnv("SHIM_RUN_DENO_AUDIT") !== undefined) checkToggles.denoAudit = readEnv("SHIM_RUN_DENO_AUDIT")!;
  if (readEnv("SHIM_RUN_EXPLANATION_CHECK") !== undefined)
    checkToggles.explanationCheck = readEnv("SHIM_RUN_EXPLANATION_CHECK")!;
  if (readEnv("SHIM_RUN_I18N_CHECK") !== undefined) checkToggles.i18nCheck = readEnv("SHIM_RUN_I18N_CHECK")!;
  if (readEnv("SHIM_RUN_UPDATE_README") !== undefined) checkToggles.updateReadme = readEnv("SHIM_RUN_UPDATE_README")!;
  if (readEnv("SHIM_RUN_SAST") !== undefined) checkToggles.sast = readEnv("SHIM_RUN_SAST")!;
  if (readEnv("SHIM_RUN_GITLEAKS") !== undefined) checkToggles.gitleaks = readEnv("SHIM_RUN_GITLEAKS")!;
  if (readEnv("SHIM_RUN_LICENSE_CHECKER") !== undefined)
    checkToggles.licenseChecker = readEnv("SHIM_RUN_LICENSE_CHECKER")!;
  if (readEnv("SHIM_RUN_ARCHITECTURE") !== undefined) checkToggles.architecture = readEnv("SHIM_RUN_ARCHITECTURE")!;
  if (readEnv("SHIM_RUN_COMPLEXITY") !== undefined) checkToggles.complexity = readEnv("SHIM_RUN_COMPLEXITY")!;
  if (readEnv("SHIM_RUN_MUTATION") !== undefined) checkToggles.mutation = readEnv("SHIM_RUN_MUTATION")!;

  const checkModeMatch = rawRc.match(/CHECK_MODE="?(diff|full)"?/);
  const checkMode = checkModeMatch ? checkModeMatch[1] : undefined;

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
    supabase: {
      enforce: supabaseEnforce as SupabaseCommandId[],
      hook: supabaseHook as SupabaseCommandId[],
    },
    git: { enforce: gitEnforceList as GitCommandId[] },
  };
  const result: Partial<SettingsData> = {
    presets: [preset],
    activePresetId: DEFAULT_VIBE_CODE_PRESET.id,
    checkToggles,
  };
  if (checkMode) {
    const existing = (result.checkSettings ?? {}) as CheckSettings;
    result.checkSettings = { ...existing, aiReview: { ...existing.aiReview, checkMode: checkMode as "diff" | "full" } };
  }
  return result;
}

export async function GET() {
  try {
    let presetsPath: string;
    let rcPath: string;
    try {
      presetsPath = getPresetsPath();
      rcPath = getRcPath();
    } catch (pathErr) {
      console.error("settings GET getPresetsPath/getRcPath:", pathErr);
      return NextResponse.json({ ...DEFAULT_SETTINGS, error: "Project root not available" }, { status: 200 });
    }

    const settings: SettingsData = { ...DEFAULT_SETTINGS };

    if (fs.existsSync(presetsPath)) {
      try {
        const raw = fs.readFileSync(presetsPath, "utf8");
        const parsed = JSON.parse(raw) as SettingsData;
        if (parsed.presets?.length) settings.presets = parsed.presets;
        if (parsed.activePresetId) settings.activePresetId = parsed.activePresetId;
        if (parsed.checkToggles) {
          const raw = { ...DEFAULT_SETTINGS.checkToggles, ...parsed.checkToggles } as CheckToggles & {
            frontend?: boolean;
            backend?: boolean;
          };
          const migrated: CheckToggles = { ...raw };
          if ("frontend" in raw && typeof raw.frontend === "boolean") {
            migrated.lint =
              migrated.prettier =
              migrated.typecheck =
              migrated.checkMockData =
              migrated.testRun =
              migrated.projectRules =
              migrated.npmAudit =
              migrated.viteBuild =
              migrated.snyk =
              migrated.updateReadme =
                raw.frontend;
            delete (migrated as unknown as Record<string, unknown>).frontend;
          }
          if ("backend" in raw && typeof raw.backend === "boolean") {
            migrated.denoFmt = migrated.denoLint = migrated.denoAudit = raw.backend;
            delete (migrated as unknown as Record<string, unknown>).backend;
          }
          settings.checkToggles = migrated;
        }
        if (parsed.checkSettings) {
          const cs = parsed.checkSettings as Record<string, unknown> & {
            frontend?: { auditLevel?: string };
            npmAudit?: { auditLevel?: string };
          };
          settings.checkSettings = { ...parsed.checkSettings };
          if (cs?.frontend?.auditLevel && !settings.checkSettings?.npmAudit?.auditLevel) {
            settings.checkSettings = {
              ...settings.checkSettings,
              npmAudit: { ...settings.checkSettings?.npmAudit, auditLevel: cs.frontend.auditLevel },
            };
          }
        }
        if (Array.isArray(parsed.checkOrder)) settings.checkOrder = parsed.checkOrder;
      } catch {
        // use defaults
      }
    }

    if (fs.existsSync(rcPath) && !fs.existsSync(presetsPath)) {
      try {
        const rawRc = fs.readFileSync(rcPath, "utf8");
        const fromRc = parseRcToSettings(rawRc);
        if (fromRc.checkToggles) settings.checkToggles = fromRc.checkToggles;
        if (fromRc.presets?.length) settings.presets = fromRc.presets;
        if (fromRc.activePresetId) settings.activePresetId = fromRc.activePresetId;
      } catch {
        // use defaults
      }
    }

    let presetsLastUpdated: string | null = null;
    try {
      const statPath = fs.existsSync(presetsPath) ? presetsPath : rcPath;
      if (fs.existsSync(statPath)) {
        const stat = fs.statSync(statPath);
        presetsLastUpdated = stat.mtime.toISOString();
      }
    } catch {
      // ignore
    }

    return NextResponse.json({ ...settings, presetsLastUpdated });
  } catch (err) {
    console.error("settings get error:", err);
    return NextResponse.json(
      { ...DEFAULT_SETTINGS, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 200 }
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
      checkSettings: body.checkSettings ?? undefined,
      checkOrder: Array.isArray(body.checkOrder) ? body.checkOrder : undefined,
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
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
