/**
 * Left sidebar "My Shim": My Trigger Commandos + My Checks (Referenz-Layout mit Zeitstempel, Tabs, Karten).
 * Location: /components/SidebarMyShim.tsx
 */
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { SettingsData, CheckToggles } from "@/lib/presets";
import { IconSettings } from "@/components/Icons";
import TriggerCommandos from "@/components/TriggerCommandos";
import MyShimChecks from "@/components/MyShimChecks";
import { useSettingsSavedRef } from "@/components/SettingsSavedContext";

export type EnforceHooksTab = "enforce" | "hooks";

export default function SidebarMyShim() {
  const tSidebar = useTranslations("sidebar");
  const tCommon = useTranslations("common");
  const savedRef = useSettingsSavedRef();
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [triggerCommandosLastUpdated, setTriggerCommandosLastUpdated] = useState<Date | null>(null);
  const [myChecksLastUpdated, setMyChecksLastUpdated] = useState<Date | null>(null);
  const [roleTab, setRoleTab] = useState<EnforceHooksTab>("enforce");
  const [tagFilter, setTagFilter] = useState<"all" | "frontend" | "backend">("all");
  const sidebarRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<SettingsData | null>(settings);
  settingsRef.current = settings;

  const load = useCallback((onFulfilled?: () => void) => {
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 8000);
    fetch("/api/settings", { signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.presets) && data.checkToggles && typeof data.activePresetId === "string") {
          setSettings(data as SettingsData);
          if (data.presetsLastUpdated) {
            const t = new Date(data.presetsLastUpdated);
            if (!isNaN(t.getTime())) {
              setTriggerCommandosLastUpdated(t);
              setMyChecksLastUpdated(t);
            }
          }
        } else {
          setSettings(null);
        }
        onFulfilled?.();
      })
      .catch(() => setSettings(null))
      .finally(() => clearTimeout(timeoutId));
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("settings-updated", handler);
    return () => window.removeEventListener("settings-updated", handler);
  }, [load]);

  useEffect(() => {
    const onTriggerCommandosSaved = () => setTriggerCommandosLastUpdated(new Date());
    window.addEventListener("trigger-commandos-saved", onTriggerCommandosSaved);
    return () => window.removeEventListener("trigger-commandos-saved", onTriggerCommandosSaved);
  }, []);

  useEffect(() => {
    const onMyChecksSaved = (e: Event) => {
      const addedCheckId = (e as CustomEvent<{ addedCheckId?: string }>).detail?.addedCheckId ?? null;
      setMyChecksLastUpdated(new Date());
      if (addedCheckId) {
        load(() => {
          if (typeof window !== "undefined") {
            requestAnimationFrame(() => {
              window.dispatchEvent(new CustomEvent("check-activated", { detail: { checkId: addedCheckId } }));
            });
          }
        });
      }
    };
    window.addEventListener("my-checks-saved", onMyChecksSaved);
    return () => window.removeEventListener("my-checks-saved", onMyChecksSaved);
  }, [load]);

  useEffect(() => {
    savedRef.current = () => load();
    return () => {
      savedRef.current = null;
    };
  }, [savedRef, load]);

  const saveSettingsForTriggerCommandos = useCallback((next: SettingsData) => {
    setSettings(next);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("settings-updated"));
          window.dispatchEvent(new CustomEvent("trigger-commandos-saved"));
        }
      })
      .catch(() => {});
  }, []);

  const saveSettingsForMyChecks = useCallback((next: SettingsData) => {
    setSettings(next);
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then(() => {
        setMyChecksLastUpdated(new Date());
        if (typeof window !== "undefined") window.dispatchEvent(new Event("settings-updated"));
      })
      .catch(() => {});
  }, []);

  const activePreset = settings?.presets?.find((p) => p.id === settings.activePresetId);

  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      // do not stopPropagation so MyShimChecks drop slots can receive dragOver and show indicator
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if ((e.target as Node) && (e.target as Element).closest?.("[data-my-checks-list]")) return;
      const dt = e.dataTransfer;
      if (!dt) return;
      const id = dt.getData("text/plain") || dt.getData("checkId");
      const checkId = (id || "").trim();
      if (!checkId) return;
      const apply = (base: SettingsData) => {
        const order = base.checkOrder ?? [];
        if (order.includes(checkId)) return;
        const nextToggles = { ...base.checkToggles } as Record<string, boolean>;
        nextToggles[checkId] = true;
        saveSettingsForMyChecks({
          ...base,
          checkOrder: [...order, checkId],
          checkToggles: nextToggles as unknown as CheckToggles,
        });
      };
      const base = settingsRef.current;
      if (base?.presets?.length) {
        apply(base);
      } else {
        fetch("/api/settings")
          .then((r) => r.json())
          .then((data) => {
            if (data?.presets?.length) apply(data);
          })
          .catch(() => {});
      }
    };
    el.addEventListener("dragover", handleDragOver, false);
    el.addEventListener("drop", handleDrop, false);
    return () => {
      el.removeEventListener("dragover", handleDragOver);
      el.removeEventListener("drop", handleDrop);
    };
  }, [saveSettingsForMyChecks]);

  return (
    <div ref={sidebarRef} className="p-4 space-y-6 flex flex-col min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 shrink-0 min-w-0">
        <h2 className="text-lg font-semibold text-white shrink-0">{tSidebar("myActiveShim")}</h2>
        <div className="flex items-center gap-1 min-w-0">
          {activePreset?.name != null && activePreset.name !== "" && (
            <span
              className="text-xs font-medium bg-violet-600 text-white rounded px-2 py-0.5 truncate min-w-0"
              title={activePreset.name}
            >
              {activePreset.name}
            </span>
          )}
          <Link
            href="/settings"
            className="btn btn-ghost btn-xs btn-square text-white/80 hover:text-white hover:bg-white/10 shrink-0"
            aria-label={tCommon("presetsAndSettings")}
            title={tCommon("presetsAndSettings")}
          >
            <IconSettings />
          </Link>
        </div>
      </div>
      {/* Tabs: Enforce | Hooks – filtert Trigger Commandos + My Checks nach Rolle */}
      <div className="flex gap-0 rounded border border-white/30 overflow-hidden shrink-0">
        <button
          type="button"
          className={`flex-1 py-1.5 px-2 text-xs font-medium ${roleTab === "enforce" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
          onClick={() => setRoleTab("enforce")}
        >
          {tCommon("enforce")}
        </button>
        <button
          type="button"
          className={`flex-1 py-1.5 px-2 text-xs font-medium ${roleTab === "hooks" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
          onClick={() => setRoleTab("hooks")}
        >
          {tCommon("hooks")}
        </button>
      </div>
      {/* Optional: Tag-Filter für My Checks (Alle | Frontend | Backend) */}
      <div className="flex gap-1 flex-wrap shrink-0">
        {(["all", "frontend", "backend"] as const).map((tag) => (
          <button
            key={tag}
            type="button"
            className={`px-2 py-0.5 text-[10px] font-medium rounded ${
              tagFilter === tag ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/10"
            }`}
            onClick={() => setTagFilter(tag)}
          >
            {tag === "all" ? tCommon("all") : tCommon(tag)}
          </button>
        ))}
      </div>
      <section className="shrink-0">
        <TriggerCommandos
          settings={settings}
          onSave={saveSettingsForTriggerCommandos}
          lastUpdated={triggerCommandosLastUpdated}
          tab={roleTab}
          hideTabs
        />
      </section>
      <section className="flex flex-col min-h-0 flex-1">
        <div className="min-h-[200px] overflow-y-auto">
          <MyShimChecks
            key={`my-checks-${roleTab}`}
            settings={settings}
            onSave={saveSettingsForMyChecks}
            lastUpdated={myChecksLastUpdated}
            roleFilter={roleTab === "hooks" ? "hook" : "enforce"}
            tagFilter={tagFilter === "all" ? null : tagFilter}
          />
        </div>
      </section>
    </div>
  );
}
