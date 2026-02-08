/**
 * My Trigger Commandos: Tabs Enforce | Hooks oben, darunter Titel + ein Tag-Input (Chips) je Tab.
 * Location: /components/TriggerCommandos.tsx
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import type { SettingsData, Preset } from "@/lib/presets";
import type { SupabaseCommandId, GitCommandId } from "@/lib/presets";
import { GIT_COMMAND_IDS, SUPABASE_COMMAND_IDS } from "@/lib/presets";

function supabaseIdsToLabels(ids: string[]): string[] {
  const out: string[] = [];
  for (const c of ids) {
    if (c === "functions") out.push("supabase functions deploy");
    else if (c === "db") out.push("supabase db push");
    else if (c === "migration") out.push("supabase migration");
    else if (c === "push") out.push("supabase push");
    else out.push(`supabase ${c}`);
  }
  return out;
}

function getTriggerLabelsEnforce(preset: Preset | undefined): string[] {
  if (!preset) return [];
  const out: string[] = [];
  if (preset.supabase?.enforce?.length) out.push(...supabaseIdsToLabels(preset.supabase.enforce));
  if (preset.git?.enforce?.length) {
    for (const c of preset.git.enforce) out.push(`git ${c}`);
  }
  return out;
}

function getTriggerLabelsHooks(preset: Preset | undefined): string[] {
  if (!preset?.supabase?.hook?.length) return [];
  return supabaseIdsToLabels(preset.supabase.hook);
}

function parseTriggerLabel(label: string): { type: "supabase" | "git"; id: string } | null {
  const t = label.trim().toLowerCase();
  if (t.startsWith("git ")) {
    const id = t.slice(4).trim();
    if ((GIT_COMMAND_IDS as readonly string[]).includes(id)) return { type: "git", id };
    return { type: "git", id };
  }
  if (t.startsWith("supabase ")) {
    const rest = t.slice(9).trim();
    if (rest.startsWith("functions")) return { type: "supabase", id: "functions" };
    if (rest.startsWith("db")) return { type: "supabase", id: "db" };
    if (rest.startsWith("migration")) return { type: "supabase", id: "migration" };
    if (rest.startsWith("push")) return { type: "supabase", id: "push" };
  }
  return null;
}

function labelsToPresetEnforce(labels: string[]): { supabase: string[]; git: string[] } {
  const supabase: string[] = [];
  const git: string[] = [];
  for (const label of labels) {
    const parsed = parseTriggerLabel(label);
    if (!parsed) continue;
    if (
      parsed.type === "supabase" &&
      (SUPABASE_COMMAND_IDS as readonly string[]).includes(parsed.id) &&
      !supabase.includes(parsed.id)
    )
      supabase.push(parsed.id);
    if (parsed.type === "git" && (GIT_COMMAND_IDS as readonly string[]).includes(parsed.id) && !git.includes(parsed.id))
      git.push(parsed.id);
  }
  return { supabase, git };
}

function labelsToPresetHooks(labels: string[]): string[] {
  const supabase: string[] = [];
  for (const label of labels) {
    const parsed = parseTriggerLabel(label);
    if (!parsed || parsed.type !== "supabase") continue;
    if ((SUPABASE_COMMAND_IDS as readonly string[]).includes(parsed.id) && !supabase.includes(parsed.id))
      supabase.push(parsed.id);
  }
  return supabase;
}

function formatTimestamp(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const sec = String(d.getSeconds()).padStart(2, "0");
  return `${day}.${month}.${year} - ${h}:${min}:${sec}`;
}

type TabId = "enforce" | "hooks";

export default function TriggerCommandos({
  settings,
  onSave,
  lastUpdated,
  tab: tabProp,
  onTabChange,
  hideTabs = false,
}: {
  settings: SettingsData | null;
  onSave: (s: SettingsData) => void;
  lastUpdated: Date | null;
  tab?: TabId;
  onTabChange?: (tab: TabId) => void;
  /** Wenn true, Tab-Buttons nicht rendern (z. B. Sidebar rendert sie selbst). */
  hideTabs?: boolean;
}) {
  const t = useTranslations("common");
  const tTrigger = useTranslations("triggerCommandos");
  const preset = settings?.presets?.find((p) => p.id === settings.activePresetId);
  const [tabInternal, setTabInternal] = useState<TabId>("enforce");
  const tab = tabProp ?? tabInternal;
  const setTab = useCallback(
    (next: TabId) => {
      setTabInternal(next);
      onTabChange?.(next);
    },
    [onTabChange]
  );
  useEffect(() => {
    if (tabProp != null) setTabInternal(tabProp);
  }, [tabProp]);
  const [tagsEnforce, setTagsEnforce] = useState<string[]>(() => getTriggerLabelsEnforce(preset));
  const [tagsHooks, setTagsHooks] = useState<string[]>(() => getTriggerLabelsHooks(preset));
  const [inputValue, setInputValue] = useState("");
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTagsEnforce(getTriggerLabelsEnforce(preset));
    setTagsHooks(getTriggerLabelsHooks(preset));
  }, [preset]);

  const tags = tab === "enforce" ? tagsEnforce : tagsHooks;
  const setTags = tab === "enforce" ? setTagsEnforce : setTagsHooks;
  const displayValue = [...tags, inputValue].filter(Boolean).join(", ");

  const isInvalidTag = useCallback(
    (label: string) => {
      const parsed = parseTriggerLabel(label.trim());
      if (!parsed) return true;
      if (tab === "hooks" && parsed.type !== "supabase") return true;
      if (parsed.type === "supabase" && !(SUPABASE_COMMAND_IDS as readonly string[]).includes(parsed.id)) return true;
      if (parsed.type === "git" && !(GIT_COMMAND_IDS as readonly string[]).includes(parsed.id)) return true;
      return false;
    },
    [tab]
  );

  useEffect(() => {
    if (!search.trim() || !inputRef.current) return;
    const raw = displayValue.toLowerCase();
    const term = search.trim().toLowerCase();
    if (!raw.includes(term)) return;
    inputRef.current.focus();
    const inputStart = tags.length ? tags.join(", ").length + 2 : 0;
    if (raw.indexOf(term) >= inputStart - 1 && inputValue.toLowerCase().includes(term)) {
      const start = inputValue.toLowerCase().indexOf(term);
      inputRef.current.setSelectionRange(start, start + term.length);
    }
  }, [search, displayValue, tags, inputValue]);

  const saveEnforce = useCallback(
    (tagList: string[]) => {
      if (!settings) return;
      const { supabase: supabaseIds, git: gitIds } = labelsToPresetEnforce(tagList);
      const next = { ...settings };
      const p = next.presets.find((x) => x.id === next.activePresetId);
      if (!p) return;
      if (p.supabase) p.supabase.enforce = supabaseIds as SupabaseCommandId[];
      if (p.git) p.git.enforce = gitIds as GitCommandId[];
      onSave(next);
    },
    [settings, onSave]
  );

  const saveHooks = useCallback(
    (tagList: string[]) => {
      if (!settings) return;
      const hookIds = labelsToPresetHooks(tagList);
      const next = { ...settings };
      const p = next.presets.find((x) => x.id === next.activePresetId);
      if (!p?.supabase) return;
      p.supabase.hook = hookIds as SupabaseCommandId[];
      onSave(next);
    },
    [settings, onSave]
  );

  const removeTag = (index: number) => {
    const next = tags.filter((_, i) => i !== index);
    setTags(next);
    if (tab === "enforce") saveEnforce(next);
    else saveHooks(next);
  };

  const editTag = (label: string, index: number) => {
    const next = tags.filter((_, i) => i !== index);
    setTags(next);
    setInputValue(label);
    if (tab === "enforce") saveEnforce(next);
    else saveHooks(next);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const addCurrentAsTag = () => {
    const v = inputValue.trim();
    if (!v) return;
    const next = [...tags, v];
    setTags(next);
    setInputValue("");
    if (tab === "enforce") saveEnforce(next);
    else saveHooks(next);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const parts = pasted
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length) {
      const next = [...tags, ...parts];
      setTags(next);
      setInputValue("");
      if (tab === "enforce") saveEnforce(next);
      else saveHooks(next);
    }
  };

  const invalidTags = tags.filter((l) => isInvalidTag(l));
  const matchCount = search.trim()
    ? (displayValue.toLowerCase().match(
        new RegExp(
          search
            .trim()
            .toLowerCase()
            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g"
        )
      )?.length ?? 0)
    : 0;

  return (
    <div className="space-y-2">
      {!hideTabs && (
        <div className="flex gap-0 rounded border border-white/30 overflow-hidden">
          <button
            type="button"
            className={`flex-1 py-1.5 px-2 text-xs font-medium ${tab === "enforce" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
            onClick={() => setTab("enforce")}
          >
            {t("enforce")}
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 px-2 text-xs font-medium ${tab === "hooks" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
            onClick={() => setTab("hooks")}
          >
            {t("hooks")}
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-medium text-white shrink-0">{tTrigger("title")}</h3>
        <span className="text-xs text-green-500 shrink-0">
          {t("updated")} {lastUpdated ? formatTimestamp(lastUpdated) : "–"}
        </span>
      </div>
      <div className="flex gap-2 items-center">
        <input
          type="text"
          placeholder={t("searchFulltext")}
          className="input input-sm flex-1 min-w-0 bg-[#0f0f0f] border border-white/80 text-white placeholder-neutral-500 rounded text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label={t("searchTriggerCommandos")}
        />
        {search.trim() && (
          <span className="text-xs text-neutral-400 shrink-0">
            {matchCount} {t("matches")}
          </span>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addCurrentAsTag();
        }}
        className="min-h-[72px] max-h-[180px] overflow-y-auto w-full bg-[#0f0f0f] border border-white/80 text-white text-sm rounded p-2 flex flex-wrap gap-1.5 items-center"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((label, index) => {
          const invalid = isInvalidTag(label);
          return (
            <span
              key={`${index}-${label}`}
              className={`inline-flex items-center gap-1 rounded pl-2 pr-1 py-0.5 text-xs font-medium cursor-pointer select-none ${
                invalid
                  ? "bg-red-500/20 border border-red-400/60 text-red-200"
                  : "bg-white/15 border border-white/30 text-white"
              }`}
              title={
                invalid
                  ? tab === "hooks"
                    ? t("hooksOnlySupabase") + " " + t("hooksHint")
                    : t("unknownCommands") + " " + t("enforceHint")
                  : t("clickToEdit")
              }
              onClick={(e) => {
                e.stopPropagation();
                editTag(label, index);
              }}
            >
              {label}
              <button
                type="button"
                className="rounded hover:bg-white/20 p-0.5 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(index);
                }}
                aria-label={t("remove")}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          type="text"
          placeholder={
            tags.length
              ? t("commandEnterPlaceholder")
              : tab === "enforce"
                ? t("commandExampleEnforce")
                : t("commandExampleHooks")
          }
          className="flex-1 min-w-[120px] bg-transparent border-0 outline-none text-white placeholder-neutral-500 text-sm py-1"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={addCurrentAsTag}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCurrentAsTag();
            }
            if (e.key === "Backspace" && !inputValue && tags.length) {
              e.preventDefault();
              const next = tags.slice(0, -1);
              setTags(next);
              if (tab === "enforce") saveEnforce(next);
              else saveHooks(next);
            }
          }}
          onPaste={handlePaste}
          aria-label={t("commandNewTag")}
        />
      </form>
      {invalidTags.length > 0 && (
        <div className="rounded bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs px-3 py-2">
          <span className="font-medium">{t("unknownCommands")}:</span> {invalidTags.join(", ")}.{" "}
          {tab === "hooks" ? t("hooksHint") : t("enforceHint")}
        </div>
      )}
    </div>
  );
}
