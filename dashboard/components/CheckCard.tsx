/**
 * Single check card with Info and Settings tabs; optional drag handle.
 * Tool-Status (Scan + Copy-Paste) wird in der Info-Box angezeigt, wenn toolStatus übergeben wird.
 * Location: /components/CheckCard.tsx
 */
"use client";

import { useState } from "react";
import type { CheckDef } from "@/lib/checks";

export type ToolStatus = { installed: boolean; label?: string; command?: string };

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button type="button" className="btn btn-ghost btn-xs text-xs" onClick={copy} title="Kopieren">
      {copied ? "Kopiert!" : "Kopieren"}
    </button>
  );
}

export default function CheckCard({
  def,
  enabled,
  onToggle,
  dragHandle,
  checkSettings,
  onSettingsChange,
  compact,
  leftTags,
  statusTag,
  headerExtra,
  inlineStyle,
  hideEnabledToggle,
  orderIndex,
  toolStatus,
}: {
  def: CheckDef;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  dragHandle?: React.ReactNode;
  checkSettings?: Record<string, unknown>;
  onSettingsChange?: (partial: Record<string, unknown>) => void;
  compact?: boolean;
  /** Kleine Tags (z. B. frontend, backend) */
  leftTags?: string[];
  /** active = grüner Tag, inactive = roter Tag */
  statusTag?: "active" | "inactive";
  /** Zusätzlicher Inhalt rechts im Header (z. B. Aktivieren-Button) */
  headerExtra?: React.ReactNode;
  /** Dark-Border-Style für Sidebar/Available */
  inlineStyle?: boolean;
  /** Wenn true: "Aktiv"-Toggle ausblenden (Status = ob Check in aktiver Liste ist, nicht extra Toggle) */
  hideEnabledToggle?: boolean;
  /** Laufreihenfolge in My Checks (1-based); wird als Nummer-Badge angezeigt */
  orderIndex?: number;
  /** Tool-Status aus /api/check-tools – Anzeige + Copy-Paste in der Box */
  toolStatus?: ToolStatus;
}) {
  const [tab, setTab] = useState<"info" | "settings">("info");
  const hasEnabledToggle = !hideEnabledToggle && def.settings.some((s) => s.key === "enabled");

  if (compact) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-white">{def.label}</h4>
        {def.settings.map((s) => {
          if (s.type === "boolean" && s.key === "enabled") return null;
          const val = checkSettings?.[s.key] ?? s.default;
          return (
            <div key={s.key}>
              <label className="text-xs text-neutral-400">{s.label}</label>
              {s.type === "boolean" && (
                <input
                  type="checkbox"
                  className="toggle toggle-sm ml-2"
                  checked={val as boolean}
                  onChange={(e) => onSettingsChange?.({ [s.key]: e.target.checked })}
                />
              )}
              {s.type === "number" && (
                <input
                  type="number"
                  className="input input-sm w-full mt-1 bg-neutral-900 border border-white/30 text-white"
                  value={val != null ? String(val) : ""}
                  onChange={(e) => onSettingsChange?.({ [s.key]: e.target.value ? Number(e.target.value) : s.default })}
                />
              )}
              {s.type === "string" && (
                <input
                  type="text"
                  className="input input-sm w-full mt-1 bg-neutral-900 border border-white/30 text-white"
                  value={val != null ? String(val) : ""}
                  onChange={(e) => onSettingsChange?.({ [s.key]: e.target.value })}
                />
              )}
              {s.type === "select" && (
                <select
                  className="select select-sm w-full mt-1 bg-neutral-900 border border-white/30 text-white"
                  value={val != null ? String(val) : ""}
                  onChange={(e) => onSettingsChange?.({ [s.key]: e.target.value })}
                >
                  {s.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const borderClass = inlineStyle ? "border-white/80 bg-[#0f0f0f]" : "border-neutral-600 bg-neutral-800/80";
  const borderBottomClass = inlineStyle ? "border-white/20" : "border-neutral-600";

  return (
    <div className={`border rounded-lg overflow-hidden ${borderClass}`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b flex-wrap ${borderBottomClass}`}>
        {orderIndex != null && (
          <span className="flex items-center justify-center w-6 h-6 rounded bg-white/20 text-white text-xs font-semibold shrink-0" title={`Laufreihenfolge: ${orderIndex}`}>
            {orderIndex}
          </span>
        )}
        {dragHandle}
        <span className="font-medium text-sm truncate">{def.label}</span>
        {leftTags?.length ? (
          <span className="flex gap-0.5 shrink-0">
            {leftTags.map((tag) => (
              <span key={tag} className="text-[9px] leading-tight px-1 py-0.5 rounded border border-white/40 bg-white/5 capitalize">
                {tag}
              </span>
            ))}
          </span>
        ) : null}
        {statusTag ? (
          <span
            className={`text-[9px] leading-tight px-1 py-0.5 rounded shrink-0 ${
              statusTag === "active" ? "bg-green-600/80 text-white" : "bg-red-600/80 text-white"
            }`}
          >
            {statusTag}
          </span>
        ) : null}
        {hasEnabledToggle && (
          <label className="flex items-center gap-1 cursor-pointer shrink-0 ml-auto">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={enabled}
              onChange={(e) => onToggle(e.target.checked)}
            />
            <span className="text-xs">Aktiv</span>
          </label>
        )}
        {headerExtra}
      </div>
      <div className={`flex gap-0 border-b ${borderBottomClass}`}>
        <button
          type="button"
          className={`flex-1 py-2 px-3 text-xs font-medium ${tab === "info" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"} ${inlineStyle ? "" : ""}`}
          onClick={() => setTab("info")}
        >
          Info
        </button>
        <button
          type="button"
          className={`flex-1 py-2 px-3 text-xs font-medium ${tab === "settings" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
          onClick={() => setTab("settings")}
        >
          Settings
        </button>
      </div>
      <div className={`p-3 text-sm min-h-[4rem] ${inlineStyle ? "text-neutral-300" : "text-neutral-300"}`}>
        {tab === "info" && (
          <>
            <p className="whitespace-pre-wrap">{def.info}</p>
            {toolStatus && (
              <div className="mt-3 pt-2 border-t border-white/10 text-xs">
                <span className="text-neutral-400">Tool: </span>
                {toolStatus.installed ? (
                  <span className="text-green-500">✓ {toolStatus.label ?? "vorhanden"}</span>
                ) : (
                  <>
                    <span className="text-amber-500">✗ {toolStatus.label ?? "nicht gefunden"}</span>
                    {toolStatus.command && (
                      <span className="ml-2 inline-flex items-center gap-1 flex-wrap">
                        <code className="bg-black/30 px-1.5 py-0.5 rounded text-[11px] break-all">{toolStatus.command}</code>
                        <CopyButton text={toolStatus.command} />
                      </span>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
        {tab === "settings" && (
          <div className="space-y-2">
            {def.settings.map((s) => {
              if (s.type === "boolean" && s.key === "enabled") return null;
              const val = checkSettings?.[s.key] ?? s.default;
              return (
                <div key={s.key}>
                  <label className="text-xs text-neutral-400">{s.label}</label>
                  {s.type === "boolean" && (
                    <input
                      type="checkbox"
                      className="toggle toggle-sm ml-2"
                      checked={val as boolean}
                      onChange={(e) => onSettingsChange?.({ [s.key]: e.target.checked })}
                    />
                  )}
                  {s.type === "number" && (
                    <input
                      type="number"
                      className="input input-sm input-bordered bg-neutral-900 border-neutral-600 text-white w-full mt-1"
                      value={val != null ? String(val) : ""}
                      onChange={(e) => onSettingsChange?.({ [s.key]: e.target.value ? Number(e.target.value) : s.default })}
                    />
                  )}
                  {s.type === "string" && (
                    <input
                      type="text"
                      className="input input-sm input-bordered bg-neutral-900 border-neutral-600 text-white w-full mt-1"
                      value={val != null ? String(val) : ""}
                      onChange={(e) => onSettingsChange?.({ [s.key]: e.target.value })}
                    />
                  )}
                  {s.type === "select" && (
                    <select
                      className="select select-sm select-bordered bg-neutral-900 border-neutral-600 text-white w-full mt-1"
                      value={val != null ? String(val) : ""}
                      onChange={(e) => onSettingsChange?.({ [s.key]: e.target.value })}
                    >
                      {s.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
