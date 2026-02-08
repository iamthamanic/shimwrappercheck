/**
 * Single check card with Info and Settings tabs; optional drag handle.
 * Tool-Status (Scan + Copy-Paste) wird in der Info-Box angezeigt, wenn toolStatus übergeben wird.
 * Location: /components/CheckCard.tsx
 */
"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import confetti from "canvas-confetti";
import type { CheckDef } from "@/lib/checks";

export type ToolStatus = { installed: boolean; label?: string; command?: string };

function CopyButton({ text }: { text: string }) {
  const t = useTranslations("common");
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button type="button" className="btn btn-ghost btn-xs text-xs" onClick={copy} title={t("copy")}>
      {copied ? t("copied") : t("copy")}
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
  orderBadgeHighlight,
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
  /** Kurz die neue Position nach Verschieben hervorheben */
  orderBadgeHighlight?: boolean;
  /** Tool-Status aus /api/check-tools – Anzeige + Copy-Paste in der Box */
  toolStatus?: ToolStatus;
}) {
  const t = useTranslations("common");
  const tChecks = useTranslations("checks");
  const [tab, setTab] = useState<"info" | "settings">("info");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const activeBadgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (statusTag !== "active") return;
    const onActivated = (e: Event) => {
      const detail = (e as CustomEvent<{ checkId: string }>).detail;
      if (detail?.checkId !== def.id) return;
      const el = activeBadgeRef.current;
      if (el && typeof window !== "undefined") {
        const rect = el.getBoundingClientRect();
        const x = (rect.left + rect.width / 2) / window.innerWidth;
        const y = (rect.top + rect.height / 2) / window.innerHeight;
        confetti({
          particleCount: 40,
          spread: 360,
          angle: 90,
          startVelocity: 6,
          scalar: 0.35,
          origin: { x, y },
          colors: ["#22c55e", "#16a34a", "#15803d", "#4ade80", "#86efac"],
          ticks: 60,
        });
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 600);
      }
    };
    window.addEventListener("check-activated", onActivated);
    return () => window.removeEventListener("check-activated", onActivated);
  }, [def.id, statusTag]);
  const hasEnabledToggle = !hideEnabledToggle && def.settings.some((s) => s.key === "enabled");
  const getSettingLabel = (s: { key: string; label: string }) =>
    s.key === "enabled"
      ? t("active")
      : (() => {
          try {
            return tChecks(`${def.id}.${s.key}`);
          } catch {
            return s.label;
          }
        })();
  const checkLabel = (() => {
    try {
      return tChecks(`${def.id}.label`);
    } catch {
      return def.label;
    }
  })();
  const checkSummary = (() => {
    try {
      return tChecks(`${def.id}.summary`);
    } catch {
      return def.summary;
    }
  })();
  const checkInfo = (() => {
    try {
      return tChecks(`${def.id}.info`);
    } catch {
      return def.info;
    }
  })();

  if (compact) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-white">{checkLabel}</h4>
        {def.settings.map((s) => {
          if (s.type === "boolean" && s.key === "enabled") return null;
          const val = checkSettings?.[s.key] ?? s.default;
          return (
            <div key={s.key}>
              <label className="text-xs text-neutral-400">{getSettingLabel(s)}</label>
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
    <div
      className={`border rounded-lg overflow-hidden transition-all duration-300 ${
        celebrate ? "border-green-500 ring-2 ring-green-500/50" : borderClass
      }`}
      data-check-card
    >
      <div
        className={`flex items-center gap-2 py-2 pr-3 border-b flex-wrap ${borderBottomClass} ${dragHandle != null ? "pl-0" : "pl-3"}`}
      >
        {orderIndex != null && (
          <span
            className={`flex items-center justify-center w-6 h-6 rounded text-white text-xs font-semibold shrink-0 transition-colors duration-300 ${
              orderBadgeHighlight ? "ring-2 ring-green-400 bg-green-500/90" : "bg-white/20"
            } ${dragHandle != null ? "ml-2" : ""}`}
            title={`${t("runOrder")}: ${orderIndex}`}
          >
            {orderIndex}
          </span>
        )}
        {dragHandle != null ? (
          <div className="shrink-0 flex items-stretch border-r border-white/20 self-stretch rounded-l-lg bg-white/5 pl-1.5 pr-1.5 min-h-[2.25rem]">
            {dragHandle}
          </div>
        ) : null}
        <span className={`font-medium text-sm truncate ${dragHandle != null ? "pl-1" : ""}`}>{checkLabel}</span>
        {leftTags?.length ? (
          <span className="flex gap-0.5 shrink-0">
            {leftTags.map((tag) => (
              <span
                key={tag}
                className="text-[9px] leading-tight px-1 py-0.5 rounded border border-white/40 bg-white/5 capitalize"
              >
                {tag}
              </span>
            ))}
          </span>
        ) : null}
        {statusTag ? (
          <span
            ref={statusTag === "active" ? activeBadgeRef : undefined}
            className={`text-[9px] leading-tight px-1 py-0.5 rounded shrink-0 transition-transform duration-300 ${
              statusTag === "active" ? "bg-green-600/80 text-white" : "bg-red-600/80 text-white"
            } ${celebrate ? "scale-125" : ""}`}
          >
            {statusTag === "active" ? t("active") : t("inactive")}
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
            <span className="text-xs">{t("active")}</span>
          </label>
        )}
        <button
          type="button"
          className="btn btn-ghost btn-sm shrink-0 text-white/70 hover:text-white hover:bg-white/10 gap-1"
          onClick={() => setDetailsOpen((o) => !o)}
          title={detailsOpen ? t("collapseDetails") : t("expandDetails")}
          aria-expanded={detailsOpen}
          aria-label={detailsOpen ? t("collapseDetails") : t("expandDetails")}
        >
          <span className="text-xs">{t("details")}</span>
          <svg
            className={`w-4 h-4 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-square shrink-0 text-white/70 hover:text-white hover:bg-white/10"
          onClick={() => setModalOpen(true)}
          title={t("showLarger")}
          aria-label={t("showLarger")}
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
        {headerExtra}
      </div>
      {detailsOpen && (
        <>
          <div className={`flex gap-0 border-b ${borderBottomClass}`}>
            <button
              type="button"
              className={`flex-1 py-2 px-3 text-xs font-medium ${tab === "info" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"} ${inlineStyle ? "" : ""}`}
              onClick={() => setTab("info")}
            >
              {t("info")}
            </button>
            <button
              type="button"
              className={`flex-1 py-2 px-3 text-xs font-medium ${tab === "settings" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
              onClick={() => setTab("settings")}
            >
              {t("settingsLabel")}
            </button>
          </div>
          <div className={`p-3 text-sm min-h-[4rem] ${inlineStyle ? "text-neutral-300" : "text-neutral-300"}`}>
            {tab === "info" && (
              <>
                <p className="font-medium text-white mb-2">{checkSummary}</p>
                <p className="whitespace-pre-wrap text-neutral-400 text-xs">{checkInfo}</p>
                {toolStatus && (
                  <div className="mt-3 pt-2 border-t border-white/10 text-xs">
                    <span className="text-neutral-400">{t("toolLabel")}: </span>
                    {toolStatus.installed ? (
                      <span className="text-green-500">✓ {toolStatus.label ?? t("toolPresent")}</span>
                    ) : (
                      <>
                        <span className="text-amber-500">✗ {toolStatus.label ?? t("toolNotFound")}</span>
                        {toolStatus.command && (
                          <span className="ml-2 inline-flex items-center gap-1 flex-wrap">
                            <code className="bg-black/30 px-1.5 py-0.5 rounded text-[11px] break-all">
                              {toolStatus.command}
                            </code>
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
                      <label className="text-xs text-neutral-400">{getSettingLabel(s)}</label>
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
                          onChange={(e) =>
                            onSettingsChange?.({ [s.key]: e.target.value ? Number(e.target.value) : s.default })
                          }
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
        </>
      )}

      {modalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[2147483647] flex items-center justify-center p-4"
            aria-modal
            role="dialog"
            aria-labelledby="check-modal-title"
          >
            <div className="fixed inset-0 bg-black/60" onClick={() => setModalOpen(false)} aria-hidden />
            <div className="modal-box max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-neutral-800 border border-neutral-600 relative z-[2147483647] shadow-2xl">
              <div className="flex items-center justify-between gap-2 border-b border-neutral-600 pb-3 mb-3">
                <h3 id="check-modal-title" className="text-lg font-semibold text-white">
                  {checkLabel}
                </h3>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-circle text-white/70 hover:text-white"
                  onClick={() => setModalOpen(false)}
                  aria-label={t("close")}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex gap-0 border-b border-neutral-600 mb-3">
                <button
                  type="button"
                  className={`flex-1 py-2 px-3 text-sm font-medium ${tab === "info" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
                  onClick={() => setTab("info")}
                >
                  {t("info")}
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2 px-3 text-sm font-medium ${tab === "settings" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
                  onClick={() => setTab("settings")}
                >
                  {t("settingsLabel")}
                </button>
              </div>
              <div className="overflow-y-auto flex-1 text-base pr-2">
                {tab === "info" && (
                  <>
                    <p className="font-medium text-white text-lg mb-3">{checkSummary}</p>
                    <p className="whitespace-pre-wrap text-neutral-300 mb-4">{checkInfo}</p>
                    {toolStatus && (
                      <div className="pt-3 border-t border-white/10 text-sm">
                        <span className="text-neutral-400">{t("toolLabel")}: </span>
                        {toolStatus.installed ? (
                          <span className="text-green-500">✓ {toolStatus.label ?? t("toolPresent")}</span>
                        ) : (
                          <>
                            <span className="text-amber-500">✗ {toolStatus.label ?? t("toolNotFound")}</span>
                            {toolStatus.command && (
                              <span className="ml-2 inline-flex items-center gap-1 flex-wrap">
                                <code className="bg-black/30 px-1.5 py-0.5 rounded text-sm break-all">
                                  {toolStatus.command}
                                </code>
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
                  <div className="space-y-4">
                    {def.settings.map((s) => {
                      if (s.type === "boolean" && s.key === "enabled") return null;
                      const val = checkSettings?.[s.key] ?? s.default;
                      return (
                        <div key={s.key}>
                          <label className="text-sm text-neutral-300 block mb-1">{getSettingLabel(s)}</label>
                          {s.type === "boolean" && (
                            <input
                              type="checkbox"
                              className="toggle toggle-sm"
                              checked={val as boolean}
                              onChange={(e) => onSettingsChange?.({ [s.key]: e.target.checked })}
                            />
                          )}
                          {s.type === "number" && (
                            <input
                              type="number"
                              className="input input-bordered bg-neutral-900 border-neutral-600 text-white w-full"
                              value={val != null ? String(val) : ""}
                              onChange={(e) =>
                                onSettingsChange?.({ [s.key]: e.target.value ? Number(e.target.value) : s.default })
                              }
                            />
                          )}
                          {s.type === "string" && (
                            <input
                              type="text"
                              className="input input-bordered bg-neutral-900 border-neutral-600 text-white w-full"
                              value={val != null ? String(val) : ""}
                              onChange={(e) => onSettingsChange?.({ [s.key]: e.target.value })}
                            />
                          )}
                          {s.type === "select" && (
                            <select
                              className="select select-bordered bg-neutral-900 border-neutral-600 text-white w-full"
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
              <div className="modal-action mt-4 pt-3 border-t border-neutral-600">
                <button type="button" className="btn btn-primary" onClick={() => setModalOpen(false)}>
                  {t("close")}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
