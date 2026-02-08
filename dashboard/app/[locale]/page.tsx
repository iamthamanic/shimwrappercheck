/**
 * Dashboard home: Check Library.
 * Status und Aktionen sind unter Einstellungen → Information.
 * Location: app/page.tsx
 */
"use client";

import { useEffect, useState } from "react";
import type { SettingsData } from "@/lib/presets";
import AvailableChecks from "@/components/AvailableChecks";

export default function DashboardPage() {
  const [settings, setSettings] = useState<SettingsData | null>(null);

  const loadData = () => {
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 8000);
    fetch("/api/settings", { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.presets) && data.checkToggles && typeof data.activePresetId === "string") {
          setSettings(data as SettingsData);
        } else {
          setSettings(null);
        }
      })
      .catch(() => setSettings(null))
      .finally(() => clearTimeout(timeoutId));
  };

  useEffect(() => {
    loadData();
    const handler = () => loadData();
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, []);

  const saveSettings = (next: SettingsData) => {
    setSettings(next);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }).then(() => {
      if (typeof window !== "undefined") window.dispatchEvent(new Event("settings-updated"));
    });
  };

  const handleActivate = saveSettings;
  const handleDeactivate = saveSettings;

  return (
    <div className="flex flex-col flex-1 min-h-0 text-white">
      <AvailableChecks
        settings={settings}
        onActivate={handleActivate}
        onDeactivate={handleDeactivate}
        onSave={saveSettings}
      />
    </div>
  );
}
