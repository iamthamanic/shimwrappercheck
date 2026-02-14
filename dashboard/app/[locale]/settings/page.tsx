/**
 * Settings page: Tabs "Templates" (Presets, Befehle, Checks) und "Information" (Port, Version, Status, Aktionen).
 * Location: app/settings/page.tsx
 */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { SettingsData, Preset, ProviderId } from "@/lib/presets";
import { DEFAULT_VIBE_CODE_PRESET, SUPABASE_COMMAND_IDS } from "@/lib/presets";
import StatusCard from "@/components/StatusCard";
import TriggerCommandos from "@/components/TriggerCommandos";
import MyShimChecks from "@/components/MyShimChecks";
import AvailableChecks from "@/components/AvailableChecks";
import { useRunChecksLog } from "@/components/RunChecksLogContext";
import { CHECK_DEFINITIONS } from "@/lib/checks";

type SettingsTab = "templates" | "information" | "reviews";

type Status = {
  projectRoot?: string;
  config?: boolean;
  presetsFile?: boolean;
  agentsMd?: boolean;
  runChecksScript?: boolean;
  shimRunner?: boolean;
  prePushHusky?: boolean;
  prePushGit?: boolean;
  supabase?: boolean;
  lastError?: { check?: string; message?: string; suggestion?: string; timestamp?: string } | null;
};

export default function SettingsPage() {
  const t = useTranslations("common");
  const tSettings = useTranslations("settings");
  const tStatus = useTranslations("statusCard");
  const [tab, setTab] = useState<SettingsTab>("templates");
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newPresetName, setNewPresetName] = useState("");
  const [showNewPreset, setShowNewPreset] = useState(false);
  const [info, setInfo] = useState<{ version: string; lastUpdated: string | null } | null>(null);
  const [uiConfig, setUiConfig] = useState<{ portAuto: boolean; port: number } | null>(null);
  const [uiConfigSaving, setUiConfigSaving] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [runResult, setRunResult] = useState<{ stdout: string; stderr: string; code: number } | null>(null);
  const [triggerCommandosLastUpdated, setTriggerCommandosLastUpdated] = useState<Date | null>(null);
  const [myChecksLastUpdated, setMyChecksLastUpdated] = useState<Date | null>(null);
  const [roleTab, setRoleTabState] = useState<"enforce" | "hooks">("enforce");
  const setRoleTab = useCallback((tab: "enforce" | "hooks") => {
    setRoleTabState(tab);
    try {
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem("shimwrappercheck-roleTab", tab);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      if (typeof sessionStorage === "undefined") return;
      const stored = sessionStorage.getItem("shimwrappercheck-roleTab");
      if (stored === "hooks" || stored === "enforce") setRoleTabState(stored);
    } catch {
      /* ignore */
    }
  }, []);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const { refetch: refetchRunChecksLog, running, setRunning, setCurrentCheckId } = useRunChecksLog();
  const pendingAddedCheckIdRef = useRef<string | null>(null);

  const SETTINGS_FETCH_MS = 12_000;

  const load = useCallback((onFulfilled?: () => void) => {
    setLoading(true);
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), SETTINGS_FETCH_MS);
    fetch("/api/settings", { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data?.error || !Array.isArray(data?.presets)) {
          setSettings(null);
          setMessage(
            data?.error ? { type: "error", text: String(data.error) } : { type: "error", text: tSettings("loadError") }
          );
        } else {
          setSettings(data);
          setMessage(null);
          if (data.presetsLastUpdated) {
            const t = new Date(data.presetsLastUpdated);
            if (!isNaN(t.getTime())) {
              setTriggerCommandosLastUpdated(t);
              setMyChecksLastUpdated(t);
            }
          }
        }
        onFulfilled?.();
      })
      .catch((err) => {
        setSettings(null);
        const isAbort = err?.name === "AbortError";
        setMessage({ type: "error", text: isAbort ? tSettings("timeout") : tSettings("loadFailed") });
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setLoading(false);
      });
  }, [tSettings]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/info")
      .then((r) => r.json())
      .then((data) => setInfo({ version: data.version ?? "–", lastUpdated: data.lastUpdated ?? null }))
      .catch(() => setInfo({ version: "–", lastUpdated: null }));
    fetch("/api/ui-config")
      .then((r) => r.json())
      .then((data) => setUiConfig({ portAuto: data.portAuto !== false, port: data.port ?? 3000 }))
      .catch(() => setUiConfig({ portAuto: true, port: 3000 }));
  }, []);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        setStatusLoading(false);
      })
      .catch(() => setStatusLoading(false));
  }, []);

  useEffect(() => {
    const onMyChecksSaved = (e: Event) => {
      const addedCheckId = (e as CustomEvent<{ addedCheckId?: string }>).detail?.addedCheckId ?? null;
      pendingAddedCheckIdRef.current = addedCheckId;
      setMyChecksLastUpdated(new Date());
      load(() => {
        const id = pendingAddedCheckIdRef.current;
        pendingAddedCheckIdRef.current = null;
        if (id && typeof window !== "undefined") {
          requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent("check-activated", { detail: { checkId: id } }));
          });
        }
      });
    };
    window.addEventListener("my-checks-saved", onMyChecksSaved);
    return () => window.removeEventListener("my-checks-saved", onMyChecksSaved);
  }, [load]);

  const runChecks = () => {
    setRunResult(null);
    setRunning(true);
    setCurrentCheckId(null);
    fetch("/api/run-checks", { method: "POST", headers: { Accept: "text/event-stream" } })
      .then(async (r) => {
        if (!r.body) throw new Error("No body");
        const reader = r.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let doneData: { code?: number; stdout?: string; stderr?: string } = {};
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const block of parts) {
            let blockEvent = "";
            const lines = block.split("\n");
            for (const line of lines) {
              if (line.startsWith("event: ")) blockEvent = line.slice(7).trim();
              else if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6)) as {
                    checkId?: string;
                    code?: number;
                    stdout?: string;
                    stderr?: string;
                  };
                  if (blockEvent === "currentCheck" && data.checkId) setCurrentCheckId(data.checkId);
                  else if (blockEvent === "done") doneData = data;
                } catch {
                  // ignore
                }
              }
            }
          }
        }
        setRunResult({
          stdout: doneData.stdout ?? "",
          stderr: doneData.stderr ?? "",
          code: doneData.code ?? 1,
        });
        setRunning(false);
        setCurrentCheckId(null);
        refetchRunChecksLog();
      })
      .catch(() => {
        setRunResult({ stdout: "", stderr: tSettings("runChecksRequestFailed"), code: 1 });
        setRunning(false);
        setCurrentCheckId(null);
      });
  };

  const save = () => {
    if (!settings) return;
    setSaving(true);
    setMessage(null);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    })
      .then((r) => r.json())
      .then((data) => {
        setSaving(false);
        if (data.error) setMessage({ type: "error", text: data.error });
        else {
          setMessage({ type: "success", text: tSettings("saved") });
          setTriggerCommandosLastUpdated(new Date());
          setMyChecksLastUpdated(new Date());
        }
      })
      .catch(() => {
        setSaving(false);
        setMessage({ type: "error", text: tSettings("saveFailed") });
      });
  };

  const saveSettingsForTriggerCommandos = (next: SettingsData) => {
    setSettings(next);
    setMessage(null);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage({ type: "error", text: data.error });
        else {
          setMessage({ type: "success", text: tSettings("savedShort") });
          setTriggerCommandosLastUpdated(new Date());
        }
      })
      .catch(() => setMessage({ type: "error", text: tSettings("saveFailed") }));
  };

  const saveSettingsForMyChecks = (next: SettingsData) => {
    setSettings(next);
    setMessage(null);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage({ type: "error", text: data.error });
        else {
          setMessage({ type: "success", text: tSettings("savedShort") });
          setMyChecksLastUpdated(new Date());
        }
      })
      .catch(() => setMessage({ type: "error", text: tSettings("saveFailed") }));
  };

  const activePreset = settings?.presets?.find((p) => p.id === settings.activePresetId) ?? DEFAULT_VIBE_CODE_PRESET;

  const setActivePresetId = (id: string) => {
    if (!settings) return;
    setSettings({ ...settings, activePresetId: id });
  };

  const addCustomPreset = () => {
    if (!newPresetName.trim() || !settings) return;
    const id = "preset-" + Date.now();
    const newPreset: Preset = {
      id,
      name: newPresetName.trim(),
      providers: [],
      autoPush: false,
    };
    setSettings({
      ...settings,
      presets: [...settings.presets, newPreset],
      activePresetId: id,
    });
    setNewPresetName("");
    setShowNewPreset(false);
  };

  const addProviderToPreset = (provider: ProviderId) => {
    if (!settings || activePreset.providers.includes(provider)) return;
    const presets = settings.presets.map((p) => {
      if (p.id !== activePreset.id) return p;
      const providers = [...p.providers, provider];
      return {
        ...p,
        providers,
        supabase:
          provider === "supabase"
            ? { enforce: [...SUPABASE_COMMAND_IDS], hook: [...SUPABASE_COMMAND_IDS] }
            : p.supabase,
        git: provider === "git" ? { enforce: ["push" as const] } : p.git,
      };
    });
    setSettings({ ...settings, presets });
  };

  const removeProviderFromPreset = (provider: ProviderId) => {
    if (!settings) return;
    const presets = settings.presets.map((p) =>
      p.id === activePreset.id
        ? {
            ...p,
            providers: p.providers.filter((pr) => pr !== provider),
            supabase: provider === "supabase" ? undefined : p.supabase,
            git: provider === "git" ? undefined : p.git,
          }
        : p
    );
    setSettings({ ...settings, presets });
  };

  const deletePreset = (id: string) => {
    if (!settings || id === DEFAULT_VIBE_CODE_PRESET.id) return;
    const presets = settings.presets.filter((p) => p.id !== id);
    setSettings({
      ...settings,
      presets,
      activePresetId: settings.activePresetId === id ? DEFAULT_VIBE_CODE_PRESET.id : settings.activePresetId,
    });
  };

  const renamePreset = () => {
    if (!settings || !renameValue.trim()) return;
    const presets = settings.presets.map((p) =>
      p.id === settings.activePresetId ? { ...p, name: renameValue.trim() } : p
    );
    const next = { ...settings, presets };
    setSettings(next);
    setRenameDialogOpen(false);
    setRenameValue("");
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage({ type: "error", text: data.error });
        else {
          setMessage({ type: "success", text: tSettings("presetRenamed") });
          setTriggerCommandosLastUpdated(new Date());
          setMyChecksLastUpdated(new Date());
        }
      })
      .catch(() => setMessage({ type: "error", text: tSettings("saveFailed") }));
  };

  const doExport = () => {
    if (!settings || !exportFileName.trim()) return;
    const name = exportFileName.trim().replace(/\.json$/i, "") + ".json";
    const exportObj = {
      preset: activePreset,
      checkToggles: settings.checkToggles,
      checkOrder: settings.checkOrder ?? [],
      checkSettings: settings.checkSettings ?? {},
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    setExportDialogOpen(false);
    setExportFileName("");
  };

  const openExportDialog = () => {
    setPresetMenuOpen(false);
    setExportFileName(activePreset.name + "-preset.json");
    setExportDialogOpen(true);
  };

  const openRenameDialog = () => {
    setPresetMenuOpen(false);
    setRenameValue(activePreset.name);
    setRenameDialogOpen(true);
  };

  const saveUiConfig = () => {
    if (!uiConfig) return;
    setUiConfigSaving(true);
    fetch("/api/ui-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uiConfig),
    })
      .then((r) => r.json())
      .then(() => setUiConfigSaving(false))
      .catch(() => setUiConfigSaving(false));
  };

  const showTabsAndContent = settings !== null;
  const showRetry = !loading && !settings;

  return (
    <div className="relative z-10 min-h-0 space-y-6 text-white">
      <div className="flex gap-0 border border-white/80 rounded overflow-hidden w-fit">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${tab === "templates" ? "bg-white text-black" : "bg-transparent text-white hover:bg-white/10"}`}
          onClick={() => setTab("templates")}
        >
          {t("templates")}
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${tab === "information" ? "bg-white text-black" : "bg-transparent text-white hover:bg-white/10"}`}
          onClick={() => setTab("information")}
        >
          {t("information")}
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${tab === "reviews" ? "bg-white text-black" : "bg-transparent text-white hover:bg-white/10"}`}
          onClick={() => setTab("reviews")}
        >
          {t("reviews")}
        </button>
      </div>

      {loading && !settings && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {showRetry && (
        <div className="space-y-4 p-4">
          <p className="text-error">{message?.text ?? tSettings("loadError")}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={load}>
            {tSettings("retry")}
          </button>
        </div>
      )}

      {showTabsAndContent && tab === "information" && (
        <div className="space-y-6 max-w-xl">
          <h2 className="text-xl font-semibold">{t("information")}</h2>
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <h3 className="card-title text-white text-base">{tSettings("uiPortTitle")}</h3>
              <p className="text-sm text-neutral-400">{tSettings("uiPortDesc")}</p>
              <div className="space-y-3 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="portMode"
                    className="radio radio-sm"
                    checked={uiConfig?.portAuto ?? true}
                    onChange={() => setUiConfig((c) => (c ? { ...c, portAuto: true } : { portAuto: true, port: 3000 }))}
                  />
                  <span>{tSettings("portAuto")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="portMode"
                    className="radio radio-sm"
                    checked={!!(uiConfig && !uiConfig.portAuto)}
                    onChange={() =>
                      setUiConfig((c) => (c ? { ...c, portAuto: false } : { portAuto: false, port: 3000 }))
                    }
                  />
                  <span>{tSettings("portFixed")}</span>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    className="input input-sm input-bordered w-24 bg-neutral-800 border-neutral-600 text-white"
                    value={uiConfig?.port ?? 3000}
                    onChange={(e) =>
                      setUiConfig((c) =>
                        c
                          ? { ...c, port: Math.max(1, Math.min(65535, parseInt(e.target.value, 10) || 3000)) }
                          : { portAuto: false, port: 3000 }
                      )
                    }
                    disabled={uiConfig?.portAuto ?? true}
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary mt-2"
                onClick={saveUiConfig}
                disabled={uiConfigSaving}
              >
                {uiConfigSaving ? t("saving") : tSettings("savePort")}
              </button>
            </div>
          </div>
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <h3 className="card-title text-white text-base">{t("appName")}</h3>
              <dl className="text-sm space-y-1 mt-2">
                <div className="flex gap-2">
                  <dt className="text-neutral-400">{tSettings("version")}</dt>
                  <dd>{info?.version ?? "–"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-neutral-400">{tSettings("lastUpdated")}</dt>
                  <dd>{info?.lastUpdated ?? "–"}</dd>
                </div>
              </dl>
            </div>
          </div>

          <h2 className="text-xl font-semibold mt-8">{tSettings("statusTitle")}</h2>
          {statusLoading || !status ? (
            <p className="text-neutral-400">{t("loading")}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatusCard label={tStatus("configRc")} ok={!!status.config} />
                <StatusCard
                  label={tStatus("presetsFile")}
                  ok={!!status.presetsFile}
                  detail={tStatus("presetsDetail")}
                />
                <StatusCard label={tStatus("agentsMd")} ok={!!status.agentsMd} detail={tStatus("agentsMdDetail")} />
                <StatusCard label={tStatus("runChecksScript")} ok={!!status.runChecksScript} />
                <StatusCard
                  label={tStatus("shimRunner")}
                  ok={!!status.shimRunner}
                  detail={tStatus("shimRunnerDetail")}
                />
                <StatusCard label={tStatus("huskyPrePush")} ok={!!status.prePushHusky} />
                <StatusCard label={tStatus("gitPrePushHook")} ok={!!status.prePushGit} />
                <StatusCard label={tStatus("supabase")} ok={!!status.supabase} />
              </div>
              {status?.projectRoot && (
                <p className="mt-2 text-sm text-neutral-400">
                  {tSettings("projectRoot")} {status.projectRoot}
                </p>
              )}
              {status?.lastError && (
                <div className="mt-4 alert alert-warning shadow-lg">
                  <div>
                    <h3 className="font-bold">{tSettings("lastCheckError")}</h3>
                    <p className="text-sm">
                      {status.lastError.check}: {status.lastError.message}
                    </p>
                    {status.lastError.suggestion && (
                      <p className="text-sm opacity-90">
                        {tSettings("suggestion")} {status.lastError.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <h2 className="text-xl font-semibold mt-8">{tSettings("actionsTitle")}</h2>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              className="btn btn-primary bg-primary text-primary-content"
              onClick={runChecks}
              disabled={running || !!(status && !status.runChecksScript && !status.shimRunner)}
            >
              {running ? tSettings("running") : tSettings("runChecks")}
            </button>
            <Link href="/config" className="btn btn-outline border-neutral-600 text-neutral-300">
              {tSettings("configRaw")}
            </Link>
            <Link href="/agents" className="btn btn-outline border-neutral-600 text-neutral-300">
              {tSettings("editAgentsMd")}
            </Link>
          </div>

          {runResult && (
            <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
              <div className="card-body">
                <h3 className="card-title text-white">
                  {tSettings("lastCheckOutput")} {runResult.code === 0 ? tSettings("ok") : tSettings("error")}
                </h3>
                <pre className="bg-neutral-900 p-4 rounded-lg text-sm overflow-auto max-h-64 whitespace-pre-wrap text-neutral-300">
                  {runResult.stdout || tSettings("noOutput")}
                  {runResult.stderr ? `\n${runResult.stderr}` : ""}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {showTabsAndContent && tab === "reviews" && (
        <div className="space-y-6 max-w-xl">
          <h2 className="text-xl font-semibold">{t("reviews")}</h2>
          <p className="text-sm text-neutral-400">{t("reviewsIntro")}</p>
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <label className="label">
                <span className="label-text text-white">{t("reviewsOutputPath")}</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full bg-neutral-900 border-neutral-600 text-white placeholder-neutral-500"
                placeholder="reports"
                value={settings?.reviewOutputPath ?? "reports"}
                onChange={(e) =>
                  settings && setSettings({ ...settings, reviewOutputPath: e.target.value.trim() || "reports" })
                }
              />
              <p className="text-xs text-neutral-500 mt-1">{t("reviewsOutputPathHint")}</p>
            </div>
          </div>
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <h3 className="card-title text-white text-base">{t("reviewsCheckListTitle")}</h3>
              <p className="text-sm text-neutral-400">{t("reviewsCheckListHint")}</p>
              <ul className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                {CHECK_DEFINITIONS.map((def) => {
                  const cs = (settings?.checkSettings as Record<string, Record<string, unknown>>)?.[def.id];
                  const reviewOn = !!cs?.reviewMode;
                  return (
                    <li key={def.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-neutral-300 truncate">{def.label}</span>
                      <span
                        className={`shrink-0 badge badge-sm ${reviewOn ? "badge-success" : "badge-ghost"}`}
                        title={reviewOn ? t("reviewsReportOn") : t("reviewsReportOff")}
                      >
                        {reviewOn ? t("reviewsReportOn") : t("reviewsReportOff")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showTabsAndContent && tab === "templates" && (
        <div className="space-y-8">
          <p className="text-neutral-300">{tSettings("presetIntro")}</p>
          <p className="text-sm text-neutral-500">{tSettings("presetStorageHint")}</p>

          {/* Preset selector */}
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-white">{tSettings("presetTitle")}</h2>
              <div className="flex flex-wrap gap-2 items-center">
                {(settings.presets ?? []).map((p) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className={`btn btn-sm ${p.id === settings.activePresetId ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setActivePresetId(p.id)}
                    >
                      {p.name}
                    </button>
                    {p.id === settings.activePresetId && (
                      <div className={`dropdown dropdown-end ${presetMenuOpen ? "dropdown-open" : ""}`}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-square"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPresetMenuOpen((o) => !o);
                          }}
                          title={tSettings("presetOptions")}
                          aria-label={tSettings("presetOptionsAria")}
                        >
                          ⋮
                        </button>
                        <ul
                          className="dropdown-content menu p-2 shadow-lg bg-neutral-800 border border-neutral-600 rounded-box w-52 z-50 mt-1"
                          tabIndex={0}
                        >
                          <li>
                            <button type="button" onClick={openExportDialog}>
                              {t("export")}
                            </button>
                          </li>
                          <li>
                            <button type="button" onClick={openRenameDialog}>
                              {t("rename")}
                            </button>
                          </li>
                        </ul>
                      </div>
                    )}
                    {p.id !== DEFAULT_VIBE_CODE_PRESET.id && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-circle"
                        onClick={() => deletePreset(p.id)}
                        title={tSettings("deletePreset")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {!showNewPreset ? (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowNewPreset(true)}>
                    + {tSettings("newPreset")}
                  </button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      className="input input-bordered input-sm w-40"
                      placeholder={t("name")}
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={addCustomPreset}>
                      {tSettings("createPreset")}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNewPreset(false)}>
                      {t("cancel")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Export dialog */}
          {exportDialogOpen && (
            <dialog open className="modal modal-open">
              <div className="modal-box bg-neutral-800 border border-neutral-600">
                <h3 className="font-bold text-white">{tSettings("exportPreset")}</h3>
                <p className="text-sm text-neutral-400 py-2">{tSettings("exportFilenameHint")}</p>
                <input
                  type="text"
                  className="input input-bordered w-full bg-neutral-900 border-neutral-600 text-white"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  placeholder={tSettings("exportPlaceholder")}
                />
                <div className="modal-action">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setExportDialogOpen(false);
                      setExportFileName("");
                    }}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={doExport}
                    disabled={!exportFileName.trim()}
                  >
                    {t("export")}
                  </button>
                </div>
              </div>
              <form
                method="dialog"
                className="modal-backdrop"
                onClick={() => {
                  setExportDialogOpen(false);
                  setExportFileName("");
                }}
              >
                <button type="button">{t("closeLower")}</button>
              </form>
            </dialog>
          )}

          {/* Rename dialog */}
          {renameDialogOpen && (
            <dialog open className="modal modal-open">
              <div className="modal-box bg-neutral-800 border border-neutral-600">
                <h3 className="font-bold text-white">{tSettings("renamePreset")}</h3>
                <p className="text-sm text-neutral-400 py-2">{tSettings("renamePresetHint")}</p>
                <input
                  type="text"
                  className="input input-bordered w-full bg-neutral-900 border-neutral-600 text-white"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder={activePreset.name}
                />
                <div className="modal-action">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setRenameDialogOpen(false);
                      setRenameValue("");
                    }}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={renamePreset}
                    disabled={!renameValue.trim()}
                  >
                    {t("rename")}
                  </button>
                </div>
              </div>
              <form
                method="dialog"
                className="modal-backdrop"
                onClick={() => {
                  setRenameDialogOpen(false);
                  setRenameValue("");
                }}
              >
                <button type="button">{t("closeLower")}</button>
              </form>
            </dialog>
          )}

          {/* Active preset: providers (for custom) + command toggles */}
          <div className="space-y-6">
            {activePreset.id !== DEFAULT_VIBE_CODE_PRESET.id && (
              <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
                <div className="card-body">
                  <h2 className="card-title text-white">{tSettings("providersTitle")}</h2>
                  <p className="text-sm text-neutral-400">{tSettings("providersDesc")}</p>
                  <div className="flex gap-2 flex-wrap">
                    {(["supabase", "git"] as const).map((prov) => (
                      <div key={prov} className="flex items-center gap-1">
                        {activePreset.providers.includes(prov) ? (
                          <>
                            <span className="badge badge-primary">
                              {prov === "git" ? tSettings("github") : tSettings("supabase")}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => removeProviderFromPreset(prov)}
                            >
                              {tSettings("removeProvider")}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => addProviderToPreset(prov)}
                          >
                            + {prov === "git" ? tSettings("github") : tSettings("supabase")}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* My Shim + Check Library: Trigger Commandos & My Checks links, Check Library rechts zum Ziehen */}
          {settings && (
            <div className="flex flex-col gap-6">
              <TriggerCommandos
                settings={settings}
                onSave={saveSettingsForTriggerCommandos}
                lastUpdated={triggerCommandosLastUpdated}
                tab={roleTab}
                onTabChange={setRoleTab}
              />
              <div className="flex flex-col lg:flex-row gap-6 min-h-0">
                <div className="flex-1 min-w-0 space-y-4">
                  <MyShimChecks
                    key={`my-checks-${roleTab}`}
                    settings={settings}
                    onSave={saveSettingsForMyChecks}
                    lastUpdated={myChecksLastUpdated}
                    roleFilter={roleTab === "hooks" ? "hook" : "enforce"}
                  />
                </div>
                <div className="flex-1 min-w-0 lg:max-w-md shrink-0">
                  <AvailableChecks
                    settings={settings}
                    onActivate={saveSettingsForMyChecks}
                    onDeactivate={saveSettingsForMyChecks}
                    onSave={saveSettingsForMyChecks}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4 items-center">
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </button>
            {message && (
              <span className={message.type === "success" ? "text-success" : "text-error"}>{message.text}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
