/**
 * List of checks: "simple" = search + name-only cards; default = full cards with drag and Info/Settings tabs.
 * Location: /components/CheckCardList.tsx
 */
"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import type { SettingsData } from "@/lib/presets";
import { CHECK_DEFINITIONS } from "@/lib/checks";
import CheckCard, { type ToolStatus } from "./CheckCard";

export default function CheckCardList({
  settings,
  onSave,
  variant = "full",
}: {
  settings: SettingsData | null;
  onSave: (s: SettingsData) => void;
  variant?: "simple" | "full";
}) {
  const order = useMemo(() => settings?.checkOrder ?? [], [settings?.checkOrder]);
  const [search, setSearch] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [toolStatusMap, setToolStatusMap] = useState<Record<string, ToolStatus>>({});

  useEffect(() => {
    fetch("/api/check-tools")
      .then((r) => r.json())
      .then((data) => setToolStatusMap(data.tools ?? {}))
      .catch(() => setToolStatusMap({}));
  }, []);

  const toggles = settings?.checkToggles ?? {};
  const ordered = order
    .map((id) => CHECK_DEFINITIONS.find((c) => c.id === id))
    .filter(Boolean) as typeof CHECK_DEFINITIONS;
  const rest = CHECK_DEFINITIONS.filter((c) => !order.includes(c.id));
  const list = [...ordered, ...rest];
  const filtered =
    variant === "simple" && search.trim()
      ? list.filter((c) => c.label.toLowerCase().includes(search.trim().toLowerCase()))
      : list;

  const moveOrder = useCallback(
    (fromId: string, toIndex: number) => {
      const idx = order.indexOf(fromId);
      if (idx === -1 || idx === toIndex) return;
      const next = [...order];
      next.splice(idx, 1);
      next.splice(toIndex, 0, fromId);
      onSave({ ...settings!, checkOrder: next });
    },
    [order, settings, onSave]
  );

  const handleToggle = (id: string, value: boolean) => {
    if (!settings) return;
    onSave({
      ...settings,
      checkToggles: { ...settings.checkToggles, [id]: value },
    });
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

  const t = useTranslations("common");
  const tChecks = useTranslations("checks");

  if (variant === "simple") {
    return (
      <div className="space-y-3">
        <div className="relative shrink-0">
          <input
            type="text"
            placeholder={t("search")}
            className="input w-full input-sm bg-neutral-800 border border-neutral-500 text-white pl-8 rounded-md placeholder-neutral-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <svg
            className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none"
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
        <ul className="space-y-2 list-none p-0 m-0">
          {filtered.map((def) => {
            let label: string;
            try {
              label = tChecks(`${def.id}.label`);
            } catch {
              label = def.label;
            }
            return (
              <li
                key={def.id}
                className="border border-neutral-500 rounded-md bg-neutral-800 px-3 py-2.5 text-sm text-white"
              >
                {label}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {list.map((def, index) => (
        <li
          key={def.id}
          className={dropIndex === index ? "ring-1 ring-primary rounded-lg" : ""}
          draggable
          onDragStart={() => setDragId(def.id)}
          onDragEnd={() => {
            setDragId(null);
            setDropIndex(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDropIndex(index);
          }}
          onDragLeave={() => setDropIndex(null)}
          onDrop={(e) => {
            e.preventDefault();
            if (dragId) moveOrder(dragId, index);
            setDragId(null);
            setDropIndex(null);
          }}
        >
          <CheckCard
            def={def}
            enabled={(toggles as Record<string, boolean>)[def.id] ?? true}
            onToggle={(v) => handleToggle(def.id, v)}
            checkSettings={(settings?.checkSettings as Record<string, Record<string, unknown>>)?.[def.id]}
            onSettingsChange={(partial) => handleSettingsChange(def.id, partial)}
            dragHandle={
              <span className="cursor-grab text-neutral-500 select-none" title={t("dragToReorder")}>
                ⋮⋮
              </span>
            }
            toolStatus={toolStatusMap[def.id]}
          />
        </li>
      ))}
    </ul>
  );
}
