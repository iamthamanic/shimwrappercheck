/**
 * Rechte Spalte: "Check Library" – alle integrierten Checks.
 * Drag: von hier nach links = aktivieren (active). Drop hier = deaktivieren (inactive).
 * Uses @dnd-kit: useDraggable per card, useDroppable for library area.
 * Location: /components/AvailableChecks.tsx
 */
"use client";

import { useState, useEffect, useRef } from "react";
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
  suggestedReason,
  onDismissSuggestion,
  dismissSuggestionLabel,
  whySuggestedLabel,
  closeLabel,
}: {
  def: CheckDef;
  dragHandleTitle: string;
  checkSettings?: Record<string, unknown>;
  onSettingsChange: (partial: Record<string, unknown>) => void;
  onToggle: (v: boolean) => void;
  toolStatus?: ToolStatus;
  logSegment?: string;
  suggestedReason?: string;
  onDismissSuggestion?: () => void;
  dismissSuggestionLabel?: string;
  whySuggestedLabel?: string;
  closeLabel?: string;
}) {
  const [suggestionModalOpen, setSuggestionModalOpen] = useState(false);
  const tooltipWrapRef = useRef<HTMLDivElement>(null);
  const closeSuggestionModal = () => {
    setSuggestionModalOpen(false);
    onDismissSuggestion?.();
  };
  useEffect(() => {
    if (!suggestionModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSuggestionModal();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (tooltipWrapRef.current && !tooltipWrapRef.current.contains(e.target as Node)) closeSuggestionModal();
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [suggestionModalOpen]);
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
      className={`list-none relative overflow-hidden ${isDragging ? "opacity-0 pointer-events-none" : ""}`}
      data-check-card
    >
      <div className="relative overflow-hidden">
        {suggestedReason && (
          <div ref={tooltipWrapRef} className="absolute top-2 right-2 z-10 flex flex-col items-end gap-0.5">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSuggestionModalOpen((v) => !v);
              }}
              className="w-6 h-6 flex items-center justify-center rounded-full bg-violet-600/95 text-white shadow border border-violet-400/50 hover:bg-violet-500 shrink-0"
              title={whySuggestedLabel}
              aria-label={whySuggestedLabel}
              aria-expanded={suggestionModalOpen}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                <path d="M11 3a1 1 0 10-2 0v1a1 1 0 102 0V3zM15.657 5.757a1 1 0 00-1.414-1.414l-.707.707a1 1 0 001.414 1.414l.707-.707zM18 10a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zM8 16v-1h4v1a2 2 0 11-4 0zM12 14c.015-.34.208-.646.477-.859a4 4 0 10-4.954 0c.27.213.462.519.476.859h4.002z" />
              </svg>
            </button>
            {suggestionModalOpen && (
              <div
                className="absolute right-0 top-8 w-56 max-w-[calc(100vw-2rem)] rounded-md bg-violet-600/95 text-white text-xs shadow-lg border border-violet-400/50 p-2.5 z-20"
                role="tooltip"
                id={`suggestion-tooltip-${def.id}`}
              >
                <p className="text-white/95 leading-snug">{suggestedReason}</p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    closeSuggestionModal();
                  }}
                  className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center rounded hover:bg-violet-500/80 text-white/90 text-sm leading-none"
                  aria-label={closeLabel}
                >
                  ×
                </button>
              </div>
            )}
          </div>
        )}
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
      </div>
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
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [suggestedReasons, setSuggestedReasons] = useState<Record<string, string> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanAbortRef = useRef<AbortController | null>(null);

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: CHECK_LIBRARY_DROPPABLE_ID });
  const dropHighlight = isOver;

  useEffect(() => {
    fetch("/api/check-tools")
      .then((r) => r.json())
      .then((data) => setToolStatusMap(data.tools ?? {}))
      .catch(() => setToolStatusMap({}));
  }, []);

  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      scanAbortRef.current?.abort();
    };
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

  const handleScanCodebase = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanError(null);
    setShowConfetti(false);
    setScanProgress(0);
    progressIntervalRef.current = setInterval(() => {
      setScanProgress((p) => Math.min(p + 5, 90));
    }, 200);

    const abort = new AbortController();
    scanAbortRef.current = abort;
    const timeoutId = setTimeout(() => abort.abort(), 8000);

    fetch("/api/scan-codebase", { signal: abort.signal })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error((data as { error?: string }).error || "Scan failed");
        return data;
      })
      .then((data) => {
        const err = (data as { error?: string }).error;
        if (err) {
          setScanError(err);
          return;
        }
        const recs = (data as { recommendations?: Record<string, string> }).recommendations ?? {};
        setSuggestedReasons(recs);
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 1000);
      })
      .catch((err) => setScanError(err instanceof Error ? err.message : tCheckLib("scanError")))
      .finally(() => {
        scanAbortRef.current = null;
        clearTimeout(timeoutId);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
        setScanProgress(100);
        setTimeout(() => {
          setIsScanning(false);
          setScanProgress(0);
        }, 350);
      });
  };

  const dismissSuggestion = (id: string) => {
    setSuggestedReasons((prev) => {
      if (!prev) return null;
      const next = { ...prev };
      delete next[id];
      return Object.keys(next).length ? next : null;
    });
  };

  useEffect(() => {
    if (!scanError) return;
    const t = setTimeout(() => setScanError(null), 4000);
    return () => clearTimeout(t);
  }, [scanError]);

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
      <div className="shrink-0 py-2 flex justify-end items-center gap-3 flex-wrap">
        {scanError && <span className="text-sm text-red-400">{scanError}</span>}
        <div className="relative inline-block overflow-visible">
          {showConfetti &&
            [...Array(8)].map((_, i) => {
              const deg = (i * 360) / 8;
              const r = 18;
              const x = r * Math.cos((deg * Math.PI) / 180);
              const y = r * Math.sin((deg * Math.PI) / 180);
              return (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full bg-violet-400/70 pointer-events-none"
                  style={
                    {
                      "--tx": `${x}px`,
                      "--ty": `${y}px`,
                      animation: "scan-confetti-out 0.75s ease-out forwards",
                    } as React.CSSProperties
                  }
                />
              );
            })}
          <button
            type="button"
            onClick={handleScanCodebase}
            disabled={isScanning}
            className="btn btn-sm !bg-violet-600 !border-violet-600 text-white hover:!bg-violet-500 hover:!border-violet-500 disabled:!bg-violet-600 disabled:!border-violet-600 disabled:!text-white disabled:opacity-90 flex items-center gap-2"
          >
            {isScanning ? (
              <>
                <span className="inline-block w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin shrink-0" />
                <span className="text-white">
                  {tCheckLib("scanCodebaseScanning")} {scanProgress}%
                </span>
              </>
            ) : (
              tCheckLib("scanCodebase")
            )}
          </button>
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
                suggestedReason={suggestedReasons?.[def.id]}
                onDismissSuggestion={() => dismissSuggestion(def.id)}
                dismissSuggestionLabel={tCheckLib("clickToDismiss")}
                whySuggestedLabel={tCheckLib("whySuggested")}
                closeLabel={tCheckLib("close")}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
