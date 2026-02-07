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
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setSettings(data))
      .catch(() => setSettings(null));
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
    <div className="space-y-8 text-white">
      <AvailableChecks settings={settings} onActivate={handleActivate} onDeactivate={handleDeactivate} onSave={saveSettings} />
    </div>
  );
}
