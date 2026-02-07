/**
 * Settings page: presets (Vibe Code + custom), Supabase/Git command toggles, check toggles.
 * Location: app/settings/page.tsx
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import type { SettingsData, Preset, ProviderId, SupabaseCommandId, GitCommandId } from "@/lib/presets";
import {
  DEFAULT_VIBE_CODE_PRESET,
  DEFAULT_CHECK_TOGGLES,
  SUPABASE_COMMAND_IDS,
  GIT_COMMAND_IDS,
} from "@/lib/presets";

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newPresetName, setNewPresetName] = useState("");
  const [showNewPreset, setShowNewPreset] = useState(false);

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
        else setMessage({ type: "success", text: "Einstellungen gespeichert." });
      })
      .catch(() => {
        setSaving(false);
        setMessage({ type: "error", text: "Speichern fehlgeschlagen." });
      });
  };

  const activePreset = settings?.presets?.find((p) => p.id === settings.activePresetId) ?? DEFAULT_VIBE_CODE_PRESET;

  const setActivePresetId = (id: string) => {
    if (!settings) return;
    setSettings({ ...settings, activePresetId: id });
  };

  const toggleSupabaseEnforce = (cmd: SupabaseCommandId) => {
    if (!settings || !activePreset.supabase) return;
    const presets = settings.presets.map((p) =>
      p.id === activePreset.id
        ? {
            ...p,
            supabase: {
              ...p.supabase!,
              enforce: p.supabase!.enforce.includes(cmd)
                ? p.supabase!.enforce.filter((c) => c !== cmd)
                : [...p.supabase!.enforce, cmd],
            },
          }
        : p
    );
    setSettings({ ...settings, presets });
  };

  const toggleSupabaseHook = (cmd: SupabaseCommandId) => {
    if (!settings || !activePreset.supabase) return;
    const presets = settings.presets.map((p) =>
      p.id === activePreset.id
        ? {
            ...p,
            supabase: {
              ...p.supabase!,
              hook: p.supabase!.hook.includes(cmd)
                ? p.supabase!.hook.filter((c) => c !== cmd)
                : [...p.supabase!.hook, cmd],
            },
          }
        : p
    );
    setSettings({ ...settings, presets });
  };

  const toggleGitEnforce = (cmd: GitCommandId) => {
    if (!settings || !activePreset.git) return;
    const presets = settings.presets.map((p) =>
      p.id === activePreset.id
        ? {
            ...p,
            git: {
              ...p.git!,
              enforce: p.git!.enforce.includes(cmd)
                ? p.git!.enforce.filter((c) => c !== cmd)
                : [...p.git!.enforce, cmd],
            },
          }
        : p
    );
    setSettings({ ...settings, presets });
  };

  const setAutoPush = (v: boolean) => {
    if (!settings) return;
    const presets = settings.presets.map((p) =>
      p.id === activePreset.id ? { ...p, autoPush: v } : p
    );
    setSettings({ ...settings, presets });
  };

  const setCheckToggles = (key: keyof typeof DEFAULT_CHECK_TOGGLES, value: boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      checkToggles: { ...settings.checkToggles, [key]: value },
    });
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

  if (loading || !settings) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Einstellungen</h1>
      <p className="text-base-content/80">
        Preset wählen, Befehle (Supabase / GitHub) und Checks ein-/ausschalten. Speichern schreibt .shimwrappercheckrc.
      </p>

      {/* Preset selector */}
      <div className="card bg-base-100 shadow-md">
        <div className="card-body">
          <h2 className="card-title">Preset</h2>
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

      {/* Active preset: providers (for custom) + command toggles */}
      <div className="space-y-6">
        {activePreset.id !== DEFAULT_VIBE_CODE_PRESET.id && (
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title">Provider in diesem Preset</h2>
              <p className="text-sm text-base-content/70">Provider hinzufügen (z. B. GitHub, Supabase).</p>
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

        {/* Supabase */}
        {activePreset.providers.includes("supabase") && (
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title">Supabase</h2>
              <p className="text-sm text-base-content/70">Für welche Befehle Checks und Hooks laufen.</p>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Befehl</th>
                      <th>Checks</th>
                      <th>Hooks (nach Deploy)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SUPABASE_COMMAND_IDS.map((cmd) => (
                      <tr key={cmd}>
                        <td>{cmd}</td>
                        <td>
                          <input
                            type="checkbox"
                            className="toggle toggle-sm"
                            checked={activePreset.supabase?.enforce.includes(cmd) ?? false}
                            onChange={() => toggleSupabaseEnforce(cmd)}
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            className="toggle toggle-sm"
                            checked={activePreset.supabase?.hook.includes(cmd) ?? false}
                            onChange={() => toggleSupabaseHook(cmd)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={activePreset.autoPush}
                    onChange={(e) => setAutoPush(e.target.checked)}
                  />
                  <span className="label-text">Nach Erfolg automatisch git push</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Git */}
        {activePreset.providers.includes("git") && (
          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <h2 className="card-title">GitHub (Git)</h2>
              <p className="text-sm text-base-content/70">Für welche Git-Befehle Checks laufen.</p>
              <div className="flex flex-wrap gap-4">
                {GIT_COMMAND_IDS.map((cmd) => (
                  <label key={cmd} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="toggle toggle-sm"
                      checked={activePreset.git?.enforce.includes(cmd) ?? false}
                      onChange={() => toggleGitEnforce(cmd)}
                    />
                    <span>{cmd}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Check toggles */}
      <div className="card bg-base-100 shadow-md">
        <div className="card-body">
          <h2 className="card-title">Checks (Shim Runner / run-checks.sh)</h2>
          <p className="text-sm text-base-content/70">Welche Schritte beim Check-Lauf ausgeführt werden.</p>
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={settings.checkToggles.frontend}
                onChange={(e) => setCheckToggles("frontend", e.target.checked)}
              />
              <span>Frontend (Lint, Build, Test, npm audit)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={settings.checkToggles.backend}
                onChange={(e) => setCheckToggles("backend", e.target.checked)}
              />
              <span>Backend (deno fmt/lint/audit)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={settings.checkToggles.sast}
                onChange={(e) => setCheckToggles("sast", e.target.checked)}
              />
              <span>SAST (semgrep)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={settings.checkToggles.architecture}
                onChange={(e) => setCheckToggles("architecture", e.target.checked)}
              />
              <span>Architektur (dependency-cruiser)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={settings.checkToggles.complexity}
                onChange={(e) => setCheckToggles("complexity", e.target.checked)}
              />
              <span>Komplexität (max 10)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={settings.checkToggles.mutation}
                onChange={(e) => setCheckToggles("mutation", e.target.checked)}
              />
              <span>Mutation (Stryker ≥80%)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={settings.checkToggles.e2e}
                onChange={(e) => setCheckToggles("e2e", e.target.checked)}
              />
              <span>E2E (Playwright)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-sm"
                checked={settings.checkToggles.aiReview}
                onChange={(e) => setCheckToggles("aiReview", e.target.checked)}
              />
              <span>AI Review (Deductive 95%)</span>
            </label>
          </div>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Speichern…" : "Speichern"}
        </button>
        {message && (
          <span className={message.type === "success" ? "text-success" : "text-error"}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
