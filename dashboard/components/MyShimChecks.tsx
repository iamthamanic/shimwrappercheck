/**
 * My Shim – My Checks: Titel + Zeitstempel, Suchfeld, Karten mit Tags (frontend/backend) und Info-/Settings-Icon.
 * Drop-Zone: Check von Check Library hierher ziehen = aktivieren.
 * Location: /components/MyShimChecks.tsx
 */
"use client";

import { useState, useEffect } from "react";
import type { SettingsData } from "@/lib/presets";
import { CHECK_DEFINITIONS, CHECK_LIBRARY_LABEL } from "@/lib/checks";
import type { CheckDef } from "@/lib/checks";
import CheckCard, { type ToolStatus } from "./CheckCard";

function formatTimestamp(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${day}.${month}.${year} - ${h}:${min}:${sec}`;
}

export default function MyShimChecks({
  settings,
  onSave,
  lastUpdated,
}: {
  settings: SettingsData | null;
  onSave: (s: SettingsData) => void;
  lastUpdated: Date | null;
}) {
  const [search, setSearch] = useState("");
  const [dropHighlight, setDropHighlight] = useState(false);
  const [toolStatusMap, setToolStatusMap] = useState<Record<string, ToolStatus>>({});

  useEffect(() => {
    fetch("/api/check-tools")
      .then((r) => r.json())
      .then((data) => setToolStatusMap(data.tools ?? {}))
      .catch(() => setToolStatusMap({}));
  }, []);

  const order = settings?.checkOrder ?? [];
  const list = order
    .map((id) => CHECK_DEFINITIONS.find((c) => c.id === id))
    .filter(Boolean) as CheckDef[];
  const filtered = search.trim()
    ? list.filter((c) => c.label.toLowerCase().includes(search.trim().toLowerCase()))
    : list;

  const handleRemoveFromMyShim = (id: string) => {
    if (!settings) return;
    const order = (settings.checkOrder ?? []).filter((x) => x !== id);
    const nextToggles = { ...settings.checkToggles } as Record<string, boolean>;
    nextToggles[id] = false;
    onSave({ ...settings, checkOrder: order, checkToggles: nextToggles });
  };

  const handleActivateById = (id: string) => {
    if (!settings) return;
    const order = settings.checkOrder ?? [];
    if (order.includes(id)) return;
    const nextToggles = { ...settings.checkToggles } as Record<string, boolean>;
    nextToggles[id] = true;
    onSave({ ...settings, checkOrder: [...order, id], checkToggles: nextToggles });
  };

  const handleSettingsChange = (checkId: string, partial: Record<string, unknown>) => {
    if (!settings) return;
    onSave({
      ...settings,
      checkSettings: {
        ...settings.checkSettings,
        [checkId]: { ...(settings.checkSettings as Record<string, Record<string, unknown>>)?.[checkId], ...partial },
      },
    });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setDropHighlight(true);
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropHighlight(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropHighlight(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDropHighlight(false);
    const id = e.dataTransfer.getData("checkId") || e.dataTransfer.getData("text/plain");
    if (id) handleActivateById(id);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium text-white">My Checks</h3>
        <span className="text-xs text-green-500 shrink-0">aktualisiert {lastUpdated ? formatTimestamp(lastUpdated) : "–"}</span>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder="Suchen..."
          className="input w-full input-sm bg-[#0f0f0f] border border-white/80 text-white pr-8 rounded placeholder-neutral-500"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <svg
          className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-white/80 pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <ul
        className={`space-y-2 list-none p-0 m-0 min-h-[140px] rounded-lg border-2 border-dashed transition-all duration-200 ${
          dropHighlight
            ? "border-green-400 bg-green-500/20 shadow-[inset_0_0_0_2px_rgba(34,197,94,0.3)]"
            : "border-white/40 bg-white/5"
        }`}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dropHighlight && (
          <li className="list-none py-3 text-center pointer-events-none">
            <span className="inline-block px-3 py-1.5 rounded bg-green-500/30 text-green-200 text-sm font-medium">
              Hier ablegen – Check aktivieren
            </span>
          </li>
        )}
        {filtered.length === 0 && !dropHighlight ? (
          <li className="list-none py-6 text-center text-neutral-500 text-sm px-2">
            {`Noch keine My Checks. Aus der ${CHECK_LIBRARY_LABEL} hierher ziehen.`}
          </li>
        ) : (
          filtered.map((def) => (
          <li
            key={def.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("checkId", def.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            className="cursor-grab active:cursor-grabbing list-none"
          >
            <CheckCard
              def={def}
              orderIndex={(order.indexOf(def.id) + 1) || undefined}
              enabled={true}
              onToggle={() => {}}
              checkSettings={(settings?.checkSettings as Record<string, Record<string, unknown>>)?.[def.id]}
              onSettingsChange={(partial) => handleSettingsChange(def.id, partial)}
              dragHandle={<span className="text-neutral-500 select-none">⋮⋮</span>}
              leftTags={[...def.tags, def.role]}
              statusTag="active"
              inlineStyle
              hideEnabledToggle
              toolStatus={toolStatusMap[def.id]}
              headerExtra={
                <button
                  type="button"
                  className="btn btn-ghost btn-xs text-neutral-400 hover:text-red-400 shrink-0"
                  onClick={() => handleRemoveFromMyShim(def.id)}
                  title={`Aus My Shim entfernen (zurück in ${CHECK_LIBRARY_LABEL})`}
                >
                  Entfernen
                </button>
              }
            />
          </li>
          ))
        )}
      </ul>
      <p className="text-xs text-neutral-500 mt-1.5 px-0.5">
        Checks aus der {CHECK_LIBRARY_LABEL} in die Fläche oben ziehen, um sie zu aktivieren.
      </p>
    </div>
  );
}
