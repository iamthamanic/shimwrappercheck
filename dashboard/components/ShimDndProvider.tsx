/**
 * Provides DndContext for Check Library ↔ My Shim drag and drop and sortable My Checks.
 * Uses DragOverlay so the dragged card follows the cursor and stays on top. Uses pointerWithin
 * so drop targets are detected correctly when dragging across sidebar/main.
 * Location: /components/ShimDndProvider.tsx
 */
"use client";

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { SettingsData, CheckToggles } from "@/lib/presets";
import { CHECK_DEFINITIONS } from "@/lib/checks";
import type { CheckDef } from "@/lib/checks";

export const MY_SHIM_DROPPABLE_ID = "my-shim-droppable";
export const CHECK_LIBRARY_DROPPABLE_ID = "check-library-droppable";
export const MY_SHIM_BETWEEN_PREFIX = "my-shim-between-";

/** Drag payload set by MyShimChecks / AvailableChecks so overlay can render full card. */
export type CheckDragData = {
  orderIndex?: number | null;
  leftTags?: string[];
  statusTag?: "active" | "inactive";
};

/**
 * Full card clone for drag overlay: same as CheckCard with details folded.
 * Shows: name, frontend/backend/enforce/hook badges, Active/Inactive, Details, Info | Settings row.
 * Badge reflects drop target: Active when over My Checks, Inactive when over Check Library.
 */
function DragOverlayCard({
  def,
  overId,
  dragData,
}: {
  def: CheckDef;
  overId: string | null;
  dragData: CheckDragData | null;
}) {
  const t = useTranslations("common");
  const tChecks = useTranslations("checks");
  const checkLabel = (() => {
    try {
      return tChecks(`${def.id}.label`);
    } catch {
      return def.label;
    }
  })();
  const isOverLibrary = overId === CHECK_LIBRARY_DROPPABLE_ID;
  const isOverMyShim = overId === MY_SHIM_DROPPABLE_ID || (overId != null && overId.startsWith(MY_SHIM_BETWEEN_PREFIX));
  const showInactive = isOverLibrary;
  const showActive = isOverMyShim;
  const statusLabel = showInactive
    ? t("inactive")
    : showActive
      ? t("active")
      : dragData?.statusTag === "active"
        ? t("active")
        : t("inactive");
  const statusClass = showInactive
    ? "bg-red-600/80 text-white"
    : showActive || dragData?.statusTag === "active"
      ? "bg-green-600/80 text-white"
      : "bg-red-600/80 text-white";
  const leftTags = dragData?.leftTags ?? [...def.tags, def.role];
  const orderIndex = dragData?.orderIndex ?? null;

  return (
    <div
      className="border rounded-lg border-white/80 bg-[#0f0f0f] shadow-2xl pointer-events-none relative w-[360px] min-h-[88px]"
      data-check-card
    >
      {/* Header: order, handle, badge (always visible), name, tags, Details, expand */}
      <div className="flex items-center gap-2 py-2 pr-3 border-b border-white/20 flex-wrap pl-0">
        {orderIndex != null && orderIndex > 0 && (
          <span
            className="flex items-center justify-center w-6 h-6 rounded bg-white/20 text-white text-xs font-semibold shrink-0 ml-2"
            title={`${t("runOrder")}: ${orderIndex}`}
          >
            {orderIndex}
          </span>
        )}
        <div className="shrink-0 flex items-stretch border-r border-white/20 self-stretch rounded-l-lg bg-white/5 pl-1.5 pr-1.5 min-h-[2.25rem]">
          <span className="w-6 h-full min-h-6 flex items-center justify-center select-none text-neutral-400">⋮⋮</span>
        </div>
        {/* Badge immediately after handle so it's always visible (name/tags can wrap) */}
        <span className={`text-[9px] leading-tight px-1.5 py-0.5 rounded shrink-0 ${statusClass}`}>{statusLabel}</span>
        <span className="font-medium text-sm pl-1 text-white break-words min-w-0">{checkLabel}</span>
        {leftTags?.length ? (
          <span className="flex gap-0.5 shrink-0 flex-wrap">
            {leftTags.map((tag) => (
              <span
                key={tag}
                className="text-[9px] leading-tight px-1 py-0.5 rounded border border-white/40 bg-white/5 capitalize text-white"
              >
                {tag}
              </span>
            ))}
          </span>
        ) : null}
        <button
          type="button"
          className="btn btn-ghost btn-sm shrink-0 text-white/70 gap-1 cursor-default"
          tabIndex={-1}
          aria-hidden
        >
          <span className="text-xs">{t("details")}</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square shrink-0 text-white/70 cursor-default"
          tabIndex={-1}
          aria-hidden
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      </div>
      {/* Info | Settings tab row (folded state) */}
      <div className="flex gap-0 border-b border-white/20">
        <span className="flex-1 py-2 px-3 text-xs font-medium text-white/70 bg-white/5">{t("info")}</span>
        <span className="flex-1 py-2 px-3 text-xs font-medium text-white/70 bg-white/5">{t("settingsLabel")}</span>
      </div>
    </div>
  );
}

/**
 * When the pointer is over My Checks, resolve to the between-slot whose center is closest to
 * the pointer Y so the drop placeholder appears exactly between two cards. Otherwise use pointerWithin.
 */
const collisionDetection: CollisionDetection = (args) => {
  const { droppableRects, droppableContainers, pointerCoordinates } = args;
  const containerRect = pointerCoordinates && droppableRects.get(MY_SHIM_DROPPABLE_ID);
  const isInsideMyChecks =
    pointerCoordinates &&
    containerRect &&
    pointerCoordinates.x >= containerRect.left &&
    pointerCoordinates.x <= containerRect.left + containerRect.width &&
    pointerCoordinates.y >= containerRect.top &&
    pointerCoordinates.y <= containerRect.top + containerRect.height;
  if (isInsideMyChecks) {
    const betweenSlots: { id: string; centerY: number }[] = [];
    droppableRects.forEach((rect, id) => {
      const idStr = String(id);
      if (idStr.startsWith(MY_SHIM_BETWEEN_PREFIX) && rect) {
        betweenSlots.push({ id: idStr, centerY: rect.top + rect.height / 2 });
      }
    });
    if (betweenSlots.length > 0) {
      let best = betweenSlots[0];
      let bestDist = Math.abs(pointerCoordinates.y - best.centerY);
      for (let i = 1; i < betweenSlots.length; i++) {
        const d = Math.abs(pointerCoordinates.y - betweenSlots[i].centerY);
        if (d < bestDist) {
          best = betweenSlots[i];
          bestDist = d;
        }
      }
      const container = droppableContainers.find((c) => String(c.id) === best.id);
      if (container) {
        return [
          {
            id: best.id,
            data: { droppableContainer: container, value: bestDist },
          },
        ];
      }
    }
    const myShimContainer = droppableContainers.find((c) => String(c.id) === MY_SHIM_DROPPABLE_ID);
    if (myShimContainer) {
      return [{ id: MY_SHIM_DROPPABLE_ID, data: { droppableContainer: myShimContainer, value: 0 } }];
    }
  }
  const collisions = pointerWithin(args);
  const between = collisions.filter((c) => String(c.id).startsWith(MY_SHIM_BETWEEN_PREFIX));
  const rest = collisions.filter((c) => !String(c.id).startsWith(MY_SHIM_BETWEEN_PREFIX));
  return between.length > 0 ? between : rest;
};

async function getSettings(): Promise<SettingsData | null> {
  try {
    const r = await fetch("/api/settings");
    const data = await r.json();
    return data?.presets?.length ? data : null;
  } catch {
    return null;
  }
}

function applyDragEnd(settings: SettingsData, activeId: string, overId: string): SettingsData | null {
  const order = settings.checkOrder ?? [];
  const isInOrder = (id: string) => order.includes(id);

  // Drop on library = deactivate (remove from My Shim)
  if (overId === CHECK_LIBRARY_DROPPABLE_ID) {
    if (!isInOrder(activeId)) return null;
    const nextOrder = order.filter((x) => x !== activeId);
    const nextToggles = { ...settings.checkToggles } as Record<string, boolean>;
    nextToggles[activeId] = false;
    return { ...settings, checkOrder: nextOrder, checkToggles: nextToggles as unknown as CheckToggles };
  }

  // Drop on "between" slot in My Checks
  const betweenMatch = overId.startsWith(MY_SHIM_BETWEEN_PREFIX) ? overId.slice(MY_SHIM_BETWEEN_PREFIX.length) : null;
  const insertIndexFromBetween = betweenMatch != null ? parseInt(betweenMatch, 10) : -1;
  const isBetweenSlot = insertIndexFromBetween >= 0 && insertIndexFromBetween <= order.length;

  // Drop on My Shim area, on a sortable item, or on a between-slot
  if (overId === MY_SHIM_DROPPABLE_ID || isInOrder(overId) || isBetweenSlot) {
    const toggles = { ...settings.checkToggles } as Record<string, boolean>;
    toggles[activeId] = true;

    if (!isInOrder(activeId)) {
      // Add from library: insert at index from between-slot, or at end, or before overId
      let insertIndex: number;
      if (isBetweenSlot) insertIndex = insertIndexFromBetween;
      else if (overId === MY_SHIM_DROPPABLE_ID) insertIndex = order.length;
      else insertIndex = order.indexOf(overId);
      const safeIndex = insertIndex < 0 ? order.length : Math.min(insertIndex, order.length);
      const nextOrder = [...order.slice(0, safeIndex), activeId, ...order.slice(safeIndex)];
      return { ...settings, checkOrder: nextOrder, checkToggles: toggles as unknown as CheckToggles };
    }

    // Reorder within My Shim
    const fromIdx = order.indexOf(activeId);
    let toIdx: number;
    if (isBetweenSlot) toIdx = insertIndexFromBetween > fromIdx ? insertIndexFromBetween - 1 : insertIndexFromBetween;
    else if (overId === MY_SHIM_DROPPABLE_ID) toIdx = order.length - 1;
    else toIdx = order.indexOf(overId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return null;
    const nextOrder = arrayMove(order, fromIdx, toIdx);
    return { ...settings, checkOrder: nextOrder };
  }

  return null;
}

type ShimDndProviderProps = { children: React.ReactNode; onSettingsSaved?: () => void };
export default function ShimDndProvider({ children, onSettingsSaved }: ShimDndProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [activeDragData, setActiveDragData] = useState<CheckDragData | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
    setOverId(null);
    const data = event.active.data.current as CheckDragData | undefined;
    setActiveDragData(data ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeIdStr = String(active.id);
    const overIdStr = over && over.id != null ? String(over.id) : null;
    setActiveId(null);
    setOverId(null);
    setActiveDragData(null);
    if (!overIdStr) return;
    const settings = await getSettings();
    if (!settings) return;
    const next = applyDragEnd(settings, activeIdStr, overIdStr);
    if (!next) return;
    const wasAddToMyChecks =
      !(settings.checkOrder ?? []).includes(activeIdStr) && (next.checkOrder ?? []).includes(activeIdStr);
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (r.ok && typeof window !== "undefined") {
        window.dispatchEvent(new Event("settings-updated"));
        const isCheckCardDrag = CHECK_DEFINITIONS.some((c) => c.id === activeIdStr);
        const orderChanged = JSON.stringify(settings.checkOrder ?? []) !== JSON.stringify(next.checkOrder ?? []);
        const togglesChanged = JSON.stringify(settings.checkToggles ?? {}) !== JSON.stringify(next.checkToggles ?? {});
        if (isCheckCardDrag && (orderChanged || togglesChanged)) {
          window.dispatchEvent(
            new CustomEvent("my-checks-saved", {
              detail: wasAddToMyChecks ? { addedCheckId: activeIdStr } : {},
            })
          );
          onSettingsSaved?.();
        }
        const orderBefore = settings.checkOrder ?? [];
        const wasReorder =
          orderChanged && orderBefore.includes(activeIdStr) && (next.checkOrder ?? []).includes(activeIdStr);
        if (wasReorder && typeof window !== "undefined") {
          const newIndex = (next.checkOrder ?? []).indexOf(activeIdStr);
          window.dispatchEvent(new CustomEvent("my-checks-reordered", { detail: { movedId: activeIdStr, newIndex } }));
        }
        if (wasAddToMyChecks && typeof window !== "undefined") {
          const newIndex = (next.checkOrder ?? []).indexOf(activeIdStr);
          window.dispatchEvent(new CustomEvent("my-checks-reordered", { detail: { movedId: activeIdStr, newIndex } }));
        }
        const wasReturnToLibrary =
          overIdStr === CHECK_LIBRARY_DROPPABLE_ID &&
          (settings.checkOrder ?? []).includes(activeIdStr) &&
          !(next.checkOrder ?? []).includes(activeIdStr);
        if (wasReturnToLibrary && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("check-returned-to-library"));
        }
      }
    } catch {
      // ignore
    }
  };

  const activeDef = activeId ? CHECK_DEFINITIONS.find((c) => c.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 2147483647 }} aria-hidden>
            <DragOverlay dropAnimation={null}>
              {activeDef ? <DragOverlayCard def={activeDef} overId={overId} dragData={activeDragData} /> : null}
            </DragOverlay>
          </div>,
          document.body
        )}
    </DndContext>
  );
}
