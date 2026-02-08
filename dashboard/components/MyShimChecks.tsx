/**
 * My Shim – My Checks: Titel + Zeitstempel, Suchfeld, Karten mit Tags (frontend/backend) und Info-/Settings-Icon.
 * Drop-Zone: Check von Check Library hierher ziehen = aktivieren. Reorder per @dnd-kit/sortable.
 * Location: /components/MyShimChecks.tsx
 */
"use client";

import React, { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useDroppable, useDndContext } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { SettingsData, CheckToggles } from "@/lib/presets";
import { CHECK_DEFINITIONS } from "@/lib/checks";
import type { CheckDef, CheckRole, CheckTag } from "@/lib/checks";
import CheckCard, { type ToolStatus } from "./CheckCard";
import { MY_SHIM_DROPPABLE_ID, MY_SHIM_BETWEEN_PREFIX, type CheckDragData } from "./ShimDndProvider";

function formatTimestamp(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${day}.${month}.${year} - ${h}:${min}:${sec}`;
}

/** Droppable slot between two cards. Minimal height when not dragging so spacing matches Check Library (space-y-2). */
function DropSlot({
  index,
  insertLabel,
  showDropZones,
}: {
  index: number;
  insertLabel: string;
  showDropZones: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${MY_SHIM_BETWEEN_PREFIX}${index}` });
  const isMinimal = !showDropZones;
  return (
    <li
      ref={setNodeRef}
      className={`list-none flex items-center justify-center ${isMinimal ? "min-h-0 py-0" : "min-h-[28px] py-0.5"}`}
      aria-label={insertLabel}
    >
      {!showDropZones ? (
        <div className="w-full h-0 min-h-0 overflow-hidden" aria-hidden />
      ) : isOver ? (
        <div className="w-full min-h-[28px] rounded border-2 border-dashed border-green-500 bg-green-500/25 flex items-center justify-center text-green-300 text-xs font-medium">
          {insertLabel}
        </div>
      ) : (
        <div className="w-full min-h-[12px] rounded border border-dashed border-white/20 bg-white/5 flex items-center justify-center opacity-60">
          <span className="text-[10px] text-white/40">{insertLabel}</span>
        </div>
      )}
    </li>
  );
}

function SortableMyCheckCard({
  def,
  orderIndex,
  settings,
  onSettingsChange,
  onRemove,
  toolStatus,
  dragLabel,
  removeTitle,
  removeLabel,
  highlightOrderBadge,
}: {
  def: CheckDef;
  orderIndex: number;
  settings: SettingsData | null;
  onSettingsChange: (checkId: string, partial: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
  toolStatus?: ToolStatus;
  dragLabel: string;
  removeTitle: string;
  removeLabel: string;
  highlightOrderBadge?: boolean;
}) {
  const order = settings?.checkOrder ?? [];
  const dragData: CheckDragData = {
    orderIndex: order.indexOf(def.id) + 1 || undefined,
    leftTags: [...def.tags, def.role],
    statusTag: "active",
  };
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: def.id,
    data: dragData,
  });
  const style = { transform: CSS.Translate.toString(transform), transition };

  return (
    <li ref={setNodeRef} style={style} className={`list-none ${isDragging ? "opacity-0 pointer-events-none" : ""}`}>
      <CheckCard
        def={def}
        orderIndex={orderIndex}
        orderBadgeHighlight={highlightOrderBadge}
        enabled={true}
        onToggle={() => {}}
        checkSettings={(settings?.checkSettings as Record<string, Record<string, unknown>>)?.[def.id]}
        onSettingsChange={(partial) => onSettingsChange(def.id, partial)}
        dragHandle={
          <span
            {...listeners}
            {...attributes}
            className="w-6 h-full min-h-6 flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none text-neutral-400 hover:text-white"
            title={dragLabel}
          >
            ⋮⋮
          </span>
        }
        leftTags={[...def.tags, def.role]}
        statusTag="active"
        inlineStyle
        hideEnabledToggle
        toolStatus={toolStatus}
        headerExtra={
          <button
            type="button"
            className="btn btn-ghost btn-xs text-neutral-400 hover:text-red-400 shrink-0"
            onClick={() => onRemove(def.id)}
            title={removeTitle}
          >
            {removeLabel}
          </button>
        }
      />
    </li>
  );
}

export default function MyShimChecks({
  settings,
  onSave,
  lastUpdated,
  roleFilter,
  tagFilter,
}: {
  settings: SettingsData | null;
  onSave: (s: SettingsData) => void;
  lastUpdated: Date | null;
  /** When set, only show checks with this role (enforce tab → enforce checks, hooks tab → hook checks). */
  roleFilter?: CheckRole;
  /** Optional: further filter by tag (frontend/backend). */
  tagFilter?: CheckTag | null;
}) {
  const t = useTranslations("common");
  const tMyChecks = useTranslations("myChecks");
  const [search, setSearch] = useState("");
  const [toolStatusMap, setToolStatusMap] = useState<Record<string, ToolStatus>>({});
  const [explode, setExplode] = useState(false);
  const [lastMovedId, setLastMovedId] = useState<string | null>(null);
  const { active, over } = useDndContext();
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: MY_SHIM_DROPPABLE_ID });
  const overId = over?.id != null ? String(over.id) : null;
  const showDropZones =
    active != null &&
    (overId === MY_SHIM_DROPPABLE_ID || (overId != null && overId.startsWith(MY_SHIM_BETWEEN_PREFIX)));

  useEffect(() => {
    const handler = () => {
      setExplode(true);
      const t = setTimeout(() => setExplode(false), 600);
      return () => clearTimeout(t);
    };
    window.addEventListener("check-activated", handler);
    return () => window.removeEventListener("check-activated", handler);
  }, []);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handler = (e: Event) => {
      const { movedId } = (e as CustomEvent<{ movedId: string; newIndex: number }>).detail ?? {};
      if (movedId) {
        if (timeoutId) clearTimeout(timeoutId);
        setLastMovedId(movedId);
        timeoutId = setTimeout(() => {
          setLastMovedId(null);
          timeoutId = null;
        }, 550);
      }
    };
    window.addEventListener("my-checks-reordered", handler);
    return () => {
      window.removeEventListener("my-checks-reordered", handler);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    fetch("/api/check-tools")
      .then((r) => r.json())
      .then((data) => setToolStatusMap(data.tools ?? {}))
      .catch(() => setToolStatusMap({}));
  }, []);

  const order = settings?.checkOrder ?? [];
  const list = order.map((id) => CHECK_DEFINITIONS.find((c) => c.id === id)).filter(Boolean) as CheckDef[];
  const roleToShow: CheckRole = roleFilter === "hook" ? "hook" : "enforce";
  const byRole = list.filter((c) => c.role === roleToShow);
  const byTag = tagFilter ? byRole.filter((c) => c.tags.includes(tagFilter)) : byRole;
  const filtered = search.trim()
    ? byTag.filter((c) => c.label.toLowerCase().includes(search.trim().toLowerCase()))
    : byTag;

  const renderList = () => {
    const nodes: React.ReactNode[] = [
      <DropSlot key="slot-0" index={0} insertLabel={t("insertHere")} showDropZones={showDropZones} />,
    ];
    filtered.forEach((def, i) => {
      const idxInOrder = order.indexOf(def.id);
      nodes.push(
        <React.Fragment key={def.id}>
          <SortableMyCheckCard
            def={def}
            orderIndex={i + 1}
            settings={settings}
            onSettingsChange={handleSettingsChange}
            onRemove={handleRemoveFromMyShim}
            toolStatus={toolStatusMap[def.id]}
            dragLabel={t("dragToActivate")}
            removeTitle={t("removeFromMyShim")}
            removeLabel={t("remove")}
            highlightOrderBadge={def.id === lastMovedId}
          />
          <DropSlot
            index={i === filtered.length - 1 ? order.length : idxInOrder + 1}
            insertLabel={t("insertHere")}
            showDropZones={showDropZones}
          />
        </React.Fragment>
      );
    });
    return nodes;
  };

  const handleRemoveFromMyShim = (id: string) => {
    if (!settings) return;
    const order = (settings.checkOrder ?? []).filter((x) => x !== id);
    const nextToggles = { ...settings.checkToggles } as Record<string, boolean>;
    nextToggles[id] = false;
    onSave({ ...settings, checkOrder: order, checkToggles: nextToggles as unknown as CheckToggles });
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h3 className="text-sm font-medium text-white">{tMyChecks("title")}</h3>
        <span className="text-xs text-green-500 shrink-0">
          {t("updated")} {lastUpdated ? formatTimestamp(lastUpdated) : "–"}
        </span>
      </div>

      <div className="relative">
        <input
          type="text"
          placeholder={t("search")}
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
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <div
        ref={setDropRef}
        data-my-checks-list
        className={`relative rounded-xl min-h-[320px] p-4 transition-all duration-150 ${
          isOver
            ? "ring-4 ring-green-500 ring-dashed border-2 border-green-500 bg-green-500/15"
            : "border border-white/80 rounded-lg bg-[#0f0f0f]"
        }`}
      >
        {isOver && <p className="text-green-300 text-sm font-medium mb-2">↓ {t("dropHereActivate")}</p>}
        {explode && (
          <div className="absolute inset-0 pointer-events-none z-[100] flex items-center justify-center" aria-hidden>
            <div className="w-24 h-24 rounded-full bg-green-400/40 animate-ping scale-150 [animation-duration:600ms]" />
            <div
              className="absolute w-20 h-20 rounded-full bg-green-500/60 animate-[burst_0.4s_ease-out_forwards]"
              style={{ animation: "burst 0.4s ease-out forwards" }}
            />
            <span className="absolute text-sm font-semibold text-green-400 bg-green-500/30 px-3 py-1.5 rounded-full border border-green-400/50">
              {t("active")}
            </span>
          </div>
        )}
        {filtered.length === 0 ? (
          <p className="text-neutral-500 text-sm py-6 text-center px-2">{t("noMyChecksYet")}</p>
        ) : (
          <SortableContext items={filtered.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-1 list-none p-0 m-0">{renderList()}</ul>
          </SortableContext>
        )}
      </div>
      <p className="text-xs text-neutral-500 mt-1.5 px-0.5">{t("dragFromLibrary")}</p>
    </div>
  );
}
