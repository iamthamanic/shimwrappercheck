/**
 * Rechte Spalte: "Check Library" – alle integrierten Checks.
 * Drag: von hier nach links = aktivieren (active). Drop hier = deaktivieren (inactive).
 * Uses @dnd-kit: useDraggable per card, useDroppable for library area.
 * Location: /components/AvailableChecks.tsx
 */
"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { SettingsData, CheckToggles } from "@/lib/presets";
import { CHECK_DEFINITIONS } from "@/lib/checks";
import type { CheckDef } from "@/lib/checks";
import CheckCard, { type ToolStatus } from "./CheckCard";
import { useRunChecksLog } from "./RunChecksLogContext";
import { CHECK_LIBRARY_DROPPABLE_ID, type CheckDragData } from "./ShimDndProvider";

type FilterState = { frontend: boolean; backend: boolean; enforce: boolean; hooks: boolean };

function matchesFilters(def: CheckDef, f: FilterState): boolean {
  const anyTag = f.frontend || f.backend;
  const anyRole = f.enforce || f.hooks;
  const tagMatch =
    !anyTag || (f.frontend && def.tags.includes("frontend")) || (f.backend && def.tags.includes("backend"));
  const roleMatch = !anyRole || (f.enforce && def.role === "enforce") || (f.hooks && def.role === "hook");
  return tagMatch && roleMatch;
}

function DraggableLibraryCard({
  def,
  dragHandleTitle,
  checkSettings,
  onSettingsChange,
  onToggle,
  toolStatus,
  logSegment,
}: {
  def: CheckDef;
  dragHandleTitle: string;
  checkSettings?: Record<string, unknown>;
  onSettingsChange: (partial: Record<string, unknown>) => void;
  onToggle: (v: boolean) => void;
  toolStatus?: ToolStatus;
  logSegment?: string;
}) {
  const dragData: CheckDragData = {
    orderIndex: null,
    leftTags: [...def.tags, def.role],
    statusTag: "inactive",
  };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: def.id,
    data: dragData,
  });
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`list-none ${isDragging ? "opacity-0 pointer-events-none" : ""}`}
      data-check-card
    >
      <CheckCard
        def={def}
        enabled={false}
        onToggle={onToggle}
        checkSettings={checkSettings}
        onSettingsChange={onSettingsChange}
        dragHandle={
          <span
            {...listeners}
            {...attributes}
            className="w-6 h-full min-h-6 flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none text-neutral-400 hover:text-white"
            title={dragHandleTitle}
          >
            ⋮⋮
          </span>
        }
        leftTags={[...def.tags, def.role]}
        statusTag="inactive"
        hideEnabledToggle
        inlineStyle
        toolStatus={toolStatus}
        logSegment={logSegment}
      />
    </li>
  );
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
  const t = useTranslations("common");
  const tCheckLib = useTranslations("checkLibrary");
  const { segments: runChecksSegments } = useRunChecksLog();
  const [search, setSearch] = useState("");
  const [filterAll, setFilterAll] = useState(true);
  const [filter, setFilter] = useState<FilterState>({ frontend: false, backend: false, enforce: false, hooks: false });
  const [toolStatusMap, setToolStatusMap] = useState<Record<string, ToolStatus>>({});

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: CHECK_LIBRARY_DROPPABLE_ID });
  const dropHighlight = isOver;

  useEffect(() => {
    fetch("/api/check-tools")
      .then((r) => r.json())
      .then((data) => setToolStatusMap(data.tools ?? {}))
      .catch(() => setToolStatusMap({}));
  }, []);

  const order = settings?.checkOrder ?? [];
  const libraryChecks = CHECK_DEFINITIONS.filter((c) => !order.includes(c.id));
  const byFilter = filterAll ? libraryChecks : libraryChecks.filter((c) => matchesFilters(c, filter));
  const filtered = search.trim()
    ? byFilter.filter((c) => c.label.toLowerCase().includes(search.trim().toLowerCase()))
    : byFilter;

  const setFilterKey = (key: keyof FilterState, value: boolean) => {
    setFilterAll(false);
    setFilter((prev) => ({ ...prev, [key]: value }));
  };
  const setAll = () => setFilterAll(true);

  const activate = (def: CheckDef) => {
    if (!settings) return;
    if (order.includes(def.id)) return;
    const nextToggles: CheckToggles = { ...settings.checkToggles } as CheckToggles;
    (nextToggles as unknown as Record<string, boolean>)[def.id] = true;
    onActivate({ ...settings, checkOrder: [...order, def.id], checkToggles: nextToggles });
  };

  const handleDeactivateById = (id: string) => {
    if (!settings) return;
    const nextOrder = (settings.checkOrder ?? []).filter((x) => x !== id);
    const nextToggles = { ...settings.checkToggles } as Record<string, boolean>;
    nextToggles[id] = false;
    onDeactivate({ ...settings, checkOrder: nextOrder, checkToggles: nextToggles as unknown as CheckToggles });
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

  return (
    <div
      ref={setDropRef}
      className={`relative flex flex-col flex-1 min-h-0 rounded-xl transition-all duration-150 ${
        dropHighlight ? "ring-4 ring-red-500 ring-dashed bg-red-500/15" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-4 flex-wrap shrink-0">
        <h1 className="text-2xl font-bold text-white">{tCheckLib("title")}</h1>
        <div className="relative">
          <input
            type="text"
            placeholder={t("search")}
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
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-center shrink-0 py-3">
        <label className="label cursor-pointer gap-2 p-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm border-white/60"
            checked={filterAll}
            onChange={(e) => e.target.checked && setAll()}
          />
          <span className="text-sm text-white font-medium">{t("all")}</span>
        </label>
        <label className="label cursor-pointer gap-2 p-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm border-white/60"
            checked={!filterAll && filter.frontend}
            onChange={(e) => setFilterKey("frontend", e.target.checked)}
            disabled={filterAll}
          />
          <span className="text-sm text-white">{t("frontend")}</span>
        </label>
        <label className="label cursor-pointer gap-2 p-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm border-white/60"
            checked={!filterAll && filter.backend}
            onChange={(e) => setFilterKey("backend", e.target.checked)}
            disabled={filterAll}
          />
          <span className="text-sm text-white">{t("backend")}</span>
        </label>
        <label className="label cursor-pointer gap-2 p-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm border-white/60"
            checked={!filterAll && filter.enforce}
            onChange={(e) => setFilterKey("enforce", e.target.checked)}
            disabled={filterAll}
          />
          <span className="text-sm text-white">{t("enforce")}</span>
        </label>
        <label className="label cursor-pointer gap-2 p-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm border-white/60"
            checked={!filterAll && filter.hooks}
            onChange={(e) => setFilterKey("hooks", e.target.checked)}
            disabled={filterAll}
          />
          <span className="text-sm text-white">{t("hooks")}</span>
        </label>
      </div>
      <div
        className={`border rounded-lg flex-1 min-h-[280px] flex flex-col p-4 transition-all duration-150 overflow-hidden ${
          dropHighlight ? "border-red-500 border-2 border-dashed bg-red-500/20" : "border-white/80 bg-[#0f0f0f]"
        }`}
      >
        {dropHighlight && <p className="text-red-300 text-sm font-medium mb-2 shrink-0">↓ {t("dropHereDeactivate")}</p>}
        {filtered.length === 0 ? (
          <p className="text-neutral-500 text-sm py-4">{t("noResults")}</p>
        ) : (
          <ul className="space-y-2 list-none p-0 m-0 flex-1 min-h-0 overflow-y-auto">
            {filtered.map((def) => (
              <DraggableLibraryCard
                key={def.id}
                def={def}
                dragHandleTitle={t("dragToActivate")}
                checkSettings={(settings?.checkSettings as Record<string, Record<string, unknown>>)?.[def.id]}
                onSettingsChange={(partial) => handleSettingsChange(def.id, partial)}
                onToggle={(v) => handleToggle(def.id, v)}
                toolStatus={toolStatusMap[def.id]}
                logSegment={runChecksSegments[def.id]}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
