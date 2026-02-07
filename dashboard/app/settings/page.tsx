/**
 * Settings page: Tabs "Templates" (Presets, Befehle, Checks) und "Information" (Port, Version, Status, Aktionen).
 * Location: app/settings/page.tsx
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { SettingsData, Preset, ProviderId } from "@/lib/presets";
import { DEFAULT_VIBE_CODE_PRESET, DEFAULT_CHECK_TOGGLES, SUPABASE_COMMAND_IDS } from "@/lib/presets";
import StatusCard from "@/components/StatusCard";
import TriggerCommandos from "@/components/TriggerCommandos";
import MyShimChecks from "@/components/MyShimChecks";

type SettingsTab = "templates" | "information";

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
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ stdout: string; stderr: string; code: number } | null>(null);
  const [templatesLastUpdated, setTemplatesLastUpdated] = useState<Date | null>(null);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("");
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const load = useCallback(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

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

  const runChecks = () => {
    setRunning(true);
    setRunResult(null);
    fetch("/api/run-checks", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        setRunResult({ stdout: data.stdout ?? "", stderr: data.stderr ?? "", code: data.code ?? 1 });
        setRunning(false);
      })
      .catch(() => {
        setRunResult({ stdout: "", stderr: "Request failed", code: 1 });
        setRunning(false);
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
          setMessage({ type: "success", text: "Einstellungen gespeichert." });
          setTemplatesLastUpdated(new Date());
        }
      })
      .catch(() => {
        setSaving(false);
        setMessage({ type: "error", text: "Speichern fehlgeschlagen." });
      });
  };

  const saveSettingsFromTemplates = (next: SettingsData) => {
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
          setMessage({ type: "success", text: "Gespeichert." });
          setTemplatesLastUpdated(new Date());
        }
      })
      .catch(() => setMessage({ type: "error", text: "Speichern fehlgeschlagen." }));
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
        git: provider === "git" ? { enforce: ["push"] } : p.git,
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
          setMessage({ type: "success", text: "Preset umbenannt." });
          setTemplatesLastUpdated(new Date());
        }
      })
      .catch(() => setMessage({ type: "error", text: "Speichern fehlgeschlagen." }));
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

  if (loading || !settings) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <div className="flex gap-0 border border-white/80 rounded overflow-hidden w-fit">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${tab === "templates" ? "bg-white text-black" : "bg-transparent text-white hover:bg-white/10"}`}
          onClick={() => setTab("templates")}
        >
          Templates
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${tab === "information" ? "bg-white text-black" : "bg-transparent text-white hover:bg-white/10"}`}
          onClick={() => setTab("information")}
        >
          Information
        </button>
      </div>

      {tab === "information" && (
        <div className="space-y-6 max-w-xl">
          <h2 className="text-xl font-semibold">Information</h2>
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <h3 className="card-title text-white text-base">Grafische UI – Port</h3>
              <p className="text-sm text-neutral-400">
                Auf welchem Port die UI starten soll oder ob automatisch ein freier Port gewählt wird.
              </p>
              <div className="space-y-3 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="portMode"
                    className="radio radio-sm"
                    checked={uiConfig?.portAuto ?? true}
                    onChange={() => setUiConfig((c) => (c ? { ...c, portAuto: true } : { portAuto: true, port: 3000 }))}
                  />
                  <span>Automatisch einen freien Port wählen</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="portMode"
                    className="radio radio-sm"
                    checked={uiConfig && !uiConfig.portAuto}
                    onChange={() => setUiConfig((c) => (c ? { ...c, portAuto: false } : { portAuto: false, port: 3000 }))}
                  />
                  <span>Fester Port:</span>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    className="input input-sm input-bordered w-24 bg-neutral-800 border-neutral-600 text-white"
                    value={uiConfig?.port ?? 3000}
                    onChange={(e) =>
                      setUiConfig((c) => (c ? { ...c, port: Math.max(1, Math.min(65535, parseInt(e.target.value, 10) || 3000)) } : { portAuto: false, port: 3000 }))
                    }
                    disabled={uiConfig?.portAuto ?? true}
                  />
                </label>
              </div>
              <button type="button" className="btn btn-sm btn-primary mt-2" onClick={saveUiConfig} disabled={uiConfigSaving}>
                {uiConfigSaving ? "Speichern…" : "Port-Einstellung speichern"}
              </button>
            </div>
          </div>
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <h3 className="card-title text-white text-base">shimwrappercheck</h3>
              <dl className="text-sm space-y-1 mt-2">
                <div className="flex gap-2">
                  <dt className="text-neutral-400">Version:</dt>
                  <dd>{info?.version ?? "–"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-neutral-400">Zuletzt aktualisiert:</dt>
                  <dd>{info?.lastUpdated ?? "–"}</dd>
                </div>
              </dl>
            </div>
          </div>

          <h2 className="text-xl font-semibold mt-8">Status</h2>
          {statusLoading || !status ? (
            <p className="text-neutral-400">Laden…</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatusCard label=".shimwrappercheckrc" ok={!!status.config} />
                <StatusCard label="Presets (.shimwrappercheck-presets.json)" ok={!!status.presetsFile} detail="Presets & Check-Toggles (Einstellungen)" />
                <StatusCard label="AGENTS.md" ok={!!status.agentsMd} detail="Agent-Anweisungen (über GUI bearbeitbar)" />
                <StatusCard label="scripts/run-checks.sh" ok={!!status.runChecksScript} />
                <StatusCard label="Shim Runner" ok={!!status.shimRunner} detail="Node orchestrator (npx shimwrappercheck run)" />
                <StatusCard label="Husky pre-push" ok={!!status.prePushHusky} />
                <StatusCard label="Git pre-push Hook" ok={!!status.prePushGit} />
                <StatusCard label="Supabase" ok={!!status.supabase} />
              </div>
              {status?.projectRoot && (
                <p className="mt-2 text-sm text-neutral-400">Projekt-Root: {status.projectRoot}</p>
              )}
              {status?.lastError && (
                <div className="mt-4 alert alert-warning shadow-lg">
                  <div>
                    <h3 className="font-bold">Letzter Check-Fehler (.shim/last_error.json)</h3>
                    <p className="text-sm">{status.lastError.check}: {status.lastError.message}</p>
                    {status.lastError.suggestion && <p className="text-sm opacity-90">Vorschlag: {status.lastError.suggestion}</p>}
                  </div>
                </div>
              )}
            </>
          )}

          <h2 className="text-xl font-semibold mt-8">Aktionen</h2>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              className="btn btn-primary bg-primary text-primary-content"
              onClick={runChecks}
              disabled={running || (status && !status.runChecksScript && !status.shimRunner)}
            >
              {running ? "Läuft…" : "Nur Checks ausführen"}
            </button>
            <Link href="/config" className="btn btn-outline border-neutral-600 text-neutral-300">
              Config (Raw)
            </Link>
            <Link href="/agents" className="btn btn-outline border-neutral-600 text-neutral-300">
              AGENTS.md bearbeiten
            </Link>
          </div>

          {runResult && (
            <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
              <div className="card-body">
                <h3 className="card-title text-white">
                  Letzte Check-Ausgabe {runResult.code === 0 ? "(OK)" : "(Fehler)"}
                </h3>
                <pre className="bg-neutral-900 p-4 rounded-lg text-sm overflow-auto max-h-64 whitespace-pre-wrap text-neutral-300">
                  {runResult.stdout || "(keine Ausgabe)"}
                  {runResult.stderr ? `\n${runResult.stderr}` : ""}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "templates" && (
    <div className="space-y-8">
      <p className="text-neutral-300">
        Preset wählen und Checks ein-/ausschalten. Trigger-Befehle (Supabase/Git) legst du in My Shim fest. Speichern schreibt .shimwrappercheckrc.
      </p>

      {/* Preset selector */}
      <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
        <div className="card-body">
          <h2 className="card-title text-white">Preset</h2>
          <div className="flex flex-wrap gap-2 items-center">
            {settings.presets.map((p) => (
              <div key={p.id} className="flex items-center gap-1">
                <button
                  type="button"
                  className={`btn btn-sm ${p.id === settings.activePresetId ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => setActivePresetId(p.id)}
                >
                  {p.name}
                </button>
                {p.id !== DEFAULT_VIBE_CODE_PRESET.id && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-circle"
                    onClick={() => deletePreset(p.id)}
                    title="Preset löschen"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <div className={`dropdown dropdown-end ${presetMenuOpen ? "dropdown-open" : ""}`}>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-square"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); setPresetMenuOpen((o) => !o); }}
                title="Optionen für aktives Preset"
                aria-label="Preset-Optionen"
              >
                ⋮
              </button>
              <ul
                className="dropdown-content menu p-2 shadow-lg bg-neutral-800 border border-neutral-600 rounded-box w-52 z-50 mt-1"
                tabIndex={0}
              >
                <li>
                  <button type="button" onClick={openExportDialog}>
                    Export
                  </button>
                </li>
                <li>
                  <button type="button" onClick={openRenameDialog}>
                    Umbenennen
                  </button>
                </li>
              </ul>
            </div>
            {!showNewPreset ? (
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowNewPreset(true)}>
                + Neues Preset
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  className="input input-bordered input-sm w-40"
                  placeholder="Name"
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                />
                <button type="button" className="btn btn-primary btn-sm" onClick={addCustomPreset}>
                  Anlegen
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNewPreset(false)}>
                  Abbrechen
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
            <h3 className="font-bold text-white">Preset exportieren</h3>
            <p className="text-sm text-neutral-400 py-2">Dateiname (wird als .json heruntergeladen):</p>
            <input
              type="text"
              className="input input-bordered w-full bg-neutral-900 border-neutral-600 text-white"
              value={exportFileName}
              onChange={(e) => setExportFileName(e.target.value)}
              placeholder="mein-preset.json"
            />
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => { setExportDialogOpen(false); setExportFileName(""); }}>
                Abbrechen
              </button>
              <button type="button" className="btn btn-primary" onClick={doExport} disabled={!exportFileName.trim()}>
                Exportieren
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop" onClick={() => { setExportDialogOpen(false); setExportFileName(""); }}>
            <button type="button">schließen</button>
          </form>
        </dialog>
      )}

      {/* Rename dialog */}
      {renameDialogOpen && (
        <dialog open className="modal modal-open">
          <div className="modal-box bg-neutral-800 border border-neutral-600">
            <h3 className="font-bold text-white">Preset umbenennen</h3>
            <p className="text-sm text-neutral-400 py-2">Neuer Name (wird auch in My Shim angezeigt):</p>
            <input
              type="text"
              className="input input-bordered w-full bg-neutral-900 border-neutral-600 text-white"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={activePreset.name}
            />
            <div className="modal-action">
              <button type="button" className="btn btn-ghost" onClick={() => { setRenameDialogOpen(false); setRenameValue(""); }}>
                Abbrechen
              </button>
              <button type="button" className="btn btn-primary" onClick={renamePreset} disabled={!renameValue.trim()}>
                Umbenennen
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop" onClick={() => { setRenameDialogOpen(false); setRenameValue(""); }}>
            <button type="button">schließen</button>
          </form>
        </dialog>
      )}

      {/* Active preset: providers (for custom) + command toggles */}
      <div className="space-y-6">
        {activePreset.id !== DEFAULT_VIBE_CODE_PRESET.id && (
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-white">Provider in diesem Preset</h2>
              <p className="text-sm text-neutral-400">Provider hinzufügen (z. B. GitHub, Supabase).</p>
              <div className="flex gap-2 flex-wrap">
                {(["supabase", "git"] as const).map((prov) => (
                  <div key={prov} className="flex items-center gap-1">
                    {activePreset.providers.includes(prov) ? (
                      <>
                        <span className="badge badge-primary">{prov === "git" ? "GitHub" : "Supabase"}</span>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => removeProviderFromPreset(prov)}
                        >
                          entfernen
                        </button>
                      </>
                    ) : (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => addProviderToPreset(prov)}>
                        + {prov === "git" ? "GitHub" : "Supabase"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* My Shim 1:1 – Trigger Commandos & My Checks (wie in der Sidebar) */}
      {settings && (
        <div className="space-y-6">
          <TriggerCommandos
            settings={settings}
            onSave={saveSettingsFromTemplates}
            lastUpdated={templatesLastUpdated}
          />
          <MyShimChecks
            settings={settings}
            onSave={saveSettingsFromTemplates}
            lastUpdated={templatesLastUpdated}
          />
        </div>
      )}

      <div className="flex gap-4 items-center">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Speichern…" : "Speichern"}
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
