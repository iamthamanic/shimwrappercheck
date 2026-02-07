/**
 * Rechte Spalte: "Check Library" – alle integrierten Checks.
 * Drag: von hier nach links = aktivieren (active). Drop hier = deaktivieren (inactive).
 * Location: /components/AvailableChecks.tsx
 */
"use client";

import { useState, useEffect } from "react";
import type { SettingsData, CheckToggles } from "@/lib/presets";
import { CHECK_DEFINITIONS, CHECK_LIBRARY_LABEL } from "@/lib/checks";
import type { CheckDef } from "@/lib/checks";
import CheckCard, { type ToolStatus } from "./CheckCard";

function isInMyShim(settings: SettingsData | null, id: string): boolean {
  return (settings?.checkOrder ?? []).includes(id);
}

type FilterState = { frontend: boolean; backend: boolean; enforce: boolean; hooks: boolean };

function matchesFilters(def: CheckDef, f: FilterState): boolean {
  const anyTag = f.frontend || f.backend;
  const anyRole = f.enforce || f.hooks;
  const tagMatch = !anyTag || (f.frontend && def.tags.includes("frontend")) || (f.backend && def.tags.includes("backend"));
  const roleMatch = !anyRole || (f.enforce && def.role === "enforce") || (f.hooks && def.role === "hook");
  return tagMatch && roleMatch;
}

export default function AvailableChecks({
  settings,
  onActivate,
  onDeactivate,
  onSave,
}: {
  settings: SettingsData | null;
  onActivate: (next: SettingsData) => void;
  onDeactivate: (next: SettingsData) => void;
  onSave?: (next: SettingsData) => void;
}) {
  const [search, setSearch] = useState("");
  const [dropHighlight, setDropHighlight] = useState(false);
  const [filter, setFilter] = useState<FilterState>({ frontend: false, backend: false, enforce: false, hooks: false });
  const [toolStatusMap, setToolStatusMap] = useState<Record<string, ToolStatus>>({});

  useEffect(() => {
    fetch("/api/check-tools")
      .then((r) => r.json())
      .then((data) => setToolStatusMap(data.tools ?? {}))
      .catch(() => setToolStatusMap({}));
  }, []);

  const order = settings?.checkOrder ?? [];
  const libraryChecks = CHECK_DEFINITIONS.filter((c) => !order.includes(c.id));
  const byFilter = libraryChecks.filter((c) => matchesFilters(c, filter));
  const filtered = search.trim()
    ? byFilter.filter((c) => c.label.toLowerCase().includes(search.trim().toLowerCase()))
    : byFilter;

  const setFilterKey = (key: keyof FilterState, value: boolean) =>
    setFilter((prev) => ({ ...prev, [key]: value }));

  const activate = (def: CheckDef) => {
    if (!settings) return;
    if (order.includes(def.id)) return;
    const nextToggles: CheckToggles = { ...settings.checkToggles } as CheckToggles;
    (nextToggles as Record<string, boolean>)[def.id] = true;
    onActivate({ ...settings, checkOrder: [...order, def.id], checkToggles: nextToggles });
  };

  const handleDeactivateById = (id: string) => {
    if (!settings) return;
    const nextOrder = (settings.checkOrder ?? []).filter((x) => x !== id);
    const nextToggles = { ...settings.checkToggles } as Record<string, boolean>;
    nextToggles[id] = false;
    onDeactivate({ ...settings, checkOrder: nextOrder, checkToggles: nextToggles });
  };

  const handleSettingsChange = (checkId: string, partial: Record<string, unknown>) => {
    if (!settings || !onSave) return;
    onSave({
      ...settings,
      checkSettings: {
        ...settings.checkSettings,
        [checkId]: { ...(settings.checkSettings as Record<string, Record<string, unknown>>)?.[checkId], ...partial },
      },
    });
  };

  const handleToggle = (id: string, value: boolean) => {
    if (!settings) return;
    if (value) {
      const def = CHECK_DEFINITIONS.find((c) => c.id === id);
      if (def) activate(def);
    } else {
      handleDeactivateById(id);
    }
  };

  const onDragStart = (e: React.DragEvent, def: CheckDef) => {
    e.dataTransfer.setData("text/plain", def.id);
    e.dataTransfer.setData("checkId", def.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropHighlight(true);
  };

  const onDragLeave = () => setDropHighlight(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropHighlight(false);
    const id = e.dataTransfer.getData("checkId");
    if (id) {
      if (isInMyShim(settings, id)) {
        handleDeactivateById(id);
      } else {
        const def = CHECK_DEFINITIONS.find((c) => c.id === id);
        if (def) activate(def);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-white">{CHECK_LIBRARY_LABEL}</h1>
        <div className="relative">
          <input
            type="text"
            placeholder="Suchen..."
            className="input input-sm w-56 bg-[#0f0f0f] border border-white/80 text-white pr-8 rounded placeholder-neutral-500"
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
      </div>
      <div className="flex flex-wrap gap-4 items-center">
        <label className="label cursor-pointer gap-2 p-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm border-white/60"
            checked={filter.frontend}
            onChange={(e) => setFilterKey("frontend", e.target.checked)}
          />
          <span className="text-sm text-white">Frontend</span>
        </label>
        <label className="label cursor-pointer gap-2 p-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm border-white/60"
            checked={filter.backend}
            onChange={(e) => setFilterKey("backend", e.target.checked)}
          />
          <span className="text-sm text-white">Backend</span>
        </label>
        <label className="label cursor-pointer gap-2 p-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm border-white/60"
            checked={filter.enforce}
            onChange={(e) => setFilterKey("enforce", e.target.checked)}
          />
          <span className="text-sm text-white">Enforce</span>
        </label>
        <label className="label cursor-pointer gap-2 p-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm border-white/60"
            checked={filter.hooks}
            onChange={(e) => setFilterKey("hooks", e.target.checked)}
          />
          <span className="text-sm text-white">Hooks</span>
        </label>
      </div>
      <div
        className={`border rounded-lg min-h-[320px] p-4 transition-colors ${
          dropHighlight ? "border-red-500 bg-red-500/10 border-2" : "border-white/80 bg-[#0f0f0f]"
        }`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {filtered.length === 0 ? (
          <p className="text-neutral-500 text-sm py-4">Keine Treffer.</p>
        ) : (
          <ul className="space-y-2 list-none p-0 m-0">
            {filtered.map((def) => (
              <li
                key={def.id}
                draggable
                onDragStart={(e) => onDragStart(e, def)}
                className="cursor-grab active:cursor-grabbing list-none"
              >
                <CheckCard
                  def={def}
                  enabled={false}
                  onToggle={(v) => handleToggle(def.id, v)}
                  checkSettings={(settings?.checkSettings as Record<string, Record<string, unknown>>)?.[def.id]}
                  onSettingsChange={(partial) => handleSettingsChange(def.id, partial)}
                  leftTags={[...def.tags, def.role]}
                  statusTag="inactive"
                  hideEnabledToggle
                  inlineStyle
                  toolStatus={toolStatusMap[def.id]}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
