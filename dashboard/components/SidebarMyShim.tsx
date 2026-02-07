/**
 * Left sidebar "My Shim": My Trigger Commandos + My Checks (Referenz-Layout mit Zeitstempel, Tabs, Karten).
 * Location: /components/SidebarMyShim.tsx
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SettingsData } from "@/lib/presets";
import TriggerCommandos from "@/components/TriggerCommandos";
import MyShimChecks from "@/components/MyShimChecks";

export default function SidebarMyShim() {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const load = () => {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((data) => setSettings(data))
        .catch(() => setSettings(null));
    };
    load();
    const handler = () => load();
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, []);

  const saveSettings = (next: SettingsData) => {
    setSettings(next);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then(() => {
        setLastUpdated(new Date());
        if (typeof window !== "undefined") window.dispatchEvent(new Event("settings-updated"));
      })
      .catch(() => {});
  };

  const activePreset = settings?.presets?.find((p) => p.id === settings.activePresetId);

  return (
    <div className="p-4 space-y-6 flex flex-col min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 shrink-0 min-w-0">
        <h2 className="text-lg font-semibold text-white shrink-0">My Shim</h2>
        <div className="flex items-center gap-1 min-w-0">
          {activePreset?.name != null && activePreset.name !== "" && (
            <span className="text-xs font-medium bg-violet-600 text-white rounded px-2 py-0.5 truncate min-w-0" title={activePreset.name}>
              {activePreset.name}
            </span>
          )}
          <Link
            href="/settings"
            className="btn btn-ghost btn-xs btn-square text-white/80 hover:text-white hover:bg-white/10 shrink-0"
            aria-label="Templates & Einstellungen"
            title="Templates & Einstellungen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 2.31.826 1.37 1.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 2.31-1.37 1.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-2.31-.826-1.37-1.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-2.31 1.37-1.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>
      <section className="shrink-0">
        <TriggerCommandos settings={settings} onSave={saveSettings} lastUpdated={lastUpdated} />
      </section>
      <section className="flex flex-col min-h-0 flex-1">
        <div className="min-h-[200px] overflow-y-auto">
          <MyShimChecks settings={settings} onSave={saveSettings} lastUpdated={lastUpdated} />
        </div>
      </section>
    </div>
  );
}
