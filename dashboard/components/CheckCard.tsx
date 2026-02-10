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
import { generateScriptFromRules, parseRulesFromScript, type ProjectRuleForm } from "@/lib/projectRulesScript";

export type ToolStatus = { installed: boolean; label?: string; command?: string; repo?: string };

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
  logSegment,
  isRunningCheck,
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
  /** Last run log segment for this check (from GET /api/run-checks/log). Shown in Logs tab. */
  logSegment?: string;
  /** When true, show a spinner top-right (this check is currently running). */
  isRunningCheck?: boolean;
}) {
  const t = useTranslations("common");
  const tChecks = useTranslations("checks");
  const isProjectRules = def.id === "projectRules";
  const [tab, setTab] = useState<"info" | "settings" | "logs">("info");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const activeBadgeRef = useRef<HTMLSpanElement>(null);
  const projectRulesFetchedRef = useRef(false);
  const [projectRulesRaw, setProjectRulesRaw] = useState("");
  const [projectRulesLoading, setProjectRulesLoading] = useState(false);
  const [projectRulesSaving, setProjectRulesSaving] = useState(false);
  const [projectRulesMessage, setProjectRulesMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [projectRulesSubTab, setProjectRulesSubTab] = useState<"form" | "script">("form");
  const [projectRulesFormRules, setProjectRulesFormRules] = useState<ProjectRuleForm[]>([]);

  useEffect(() => {
    if (modalOpen) setTab("info");
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) projectRulesFetchedRef.current = false;
  }, [modalOpen]);
  useEffect(() => {
    if (!detailsOpen) projectRulesFetchedRef.current = false;
  }, [detailsOpen]);

  const saveProjectRules = () => {
    setProjectRulesSaving(true);
    setProjectRulesMessage(null);
    fetch("/api/project-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw: projectRulesRaw }),
    })
      .then((r) => r.json())
      .then((data) => {
        setProjectRulesSaving(false);
        if (data.error) setProjectRulesMessage({ type: "error", text: data.error });
        else setProjectRulesMessage({ type: "success", text: t("projectRulesSaved") });
      })
      .catch(() => {
        setProjectRulesSaving(false);
        setProjectRulesMessage({ type: "error", text: t("saveFailed") });
      });
  };

  const saveProjectRulesFromForm = () => {
    const raw = generateScriptFromRules(projectRulesFormRules);
    setProjectRulesRaw(raw);
    setProjectRulesSaving(true);
    setProjectRulesMessage(null);
    fetch("/api/project-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    })
      .then((r) => r.json())
      .then((data) => {
        setProjectRulesSaving(false);
        if (data.error) setProjectRulesMessage({ type: "error", text: data.error });
        else setProjectRulesMessage({ type: "success", text: t("projectRulesSaved") });
      })
      .catch(() => {
        setProjectRulesSaving(false);
        setProjectRulesMessage({ type: "error", text: t("saveFailed") });
      });
  };

  const addProjectRule = (type: "forbidden_pattern" | "max_lines") => {
    const id = `rule-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    if (type === "forbidden_pattern") setProjectRulesFormRules((prev) => [...prev, { id, type, pattern: "" }]);
    else setProjectRulesFormRules((prev) => [...prev, { id, type, maxLines: 300 }]);
  };

  const updateProjectRule = (id: string, patch: Partial<ProjectRuleForm>) => {
    setProjectRulesFormRules((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (patch.type === "forbidden_pattern")
          return {
            id: r.id,
            type: "forbidden_pattern" as const,
            pattern: "pattern" in patch ? (patch.pattern ?? "") : r.type === "forbidden_pattern" ? r.pattern : "",
          };
        if (patch.type === "max_lines")
          return {
            id: r.id,
            type: "max_lines" as const,
            maxLines: "maxLines" in patch ? (patch.maxLines ?? 300) : r.type === "max_lines" ? r.maxLines : 300,
          };
        if (r.type === "forbidden_pattern" && "pattern" in patch) return { ...r, pattern: patch.pattern ?? r.pattern };
        if (r.type === "max_lines" && "maxLines" in patch) return { ...r, maxLines: patch.maxLines ?? r.maxLines };
        return r;
      })
    );
  };

  const removeProjectRule = (id: string) => {
    setProjectRulesFormRules((prev) => prev.filter((r) => r.id !== id));
  };

  useEffect(() => {
    if (isProjectRules && (tab === "settings" || modalOpen) && !projectRulesFetchedRef.current) {
      projectRulesFetchedRef.current = true;
      setProjectRulesLoading(true);
      setProjectRulesMessage(null);
      const ac = new AbortController();
      const timeoutId = setTimeout(() => ac.abort(), 12_000);
      fetch("/api/project-rules", { signal: ac.signal })
        .then((r) => {
          if (!r.ok) throw new Error(r.statusText || "Request failed");
          return r.json();
        })
        .then((data) => {
          clearTimeout(timeoutId);
          const raw = data?.raw ?? "";
          setProjectRulesRaw(raw);
          const parsed = parseRulesFromScript(raw);
          if (parsed && parsed.length >= 0) setProjectRulesFormRules(parsed);
          setProjectRulesLoading(false);
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          setProjectRulesLoading(false);
          projectRulesFetchedRef.current = false;
          if (err?.name !== "AbortError") setProjectRulesMessage({ type: "error", text: t("saveFailed") });
        });
    }
  }, [isProjectRules, tab, modalOpen, t]);

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
  /** Translated label for select options (e.g. aiReview.checkMode mix/snippet/full). */
  const getSelectOptionLabel = (s: { key: string }, o: { value: string; label: string }): string => {
    if (def.id === "aiReview" && s.key === "checkMode") {
      if (o.value === "mix") return tChecks("aiReview.checkModeOptionMix");
      if (o.value === "snippet") return tChecks("aiReview.checkModeOptionSnippet");
      if (o.value === "diff") return tChecks("aiReview.checkModeOptionSnippet");
      if (o.value === "full") return tChecks("aiReview.checkModeOptionFull");
    }
    return o.label;
  };
  /** Tooltip for a setting (checks.{def.id}.{s.key}Tooltip). Returns null if no translation. */
  const getSettingTooltip = (s: { key: string }): string | null => {
    try {
      const key = `${def.id}.${s.key}Tooltip`;
      const v = (tChecks as (k: string) => string)(key);
      return typeof v === "string" && v.length > 0 && v !== key ? v : null;
    } catch {
      return null;
    }
  };
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
              <div className="flex items-center gap-1 flex-wrap">
                <label className="text-xs text-neutral-400">{getSettingLabel(s)}</label>
                {getSettingTooltip(s) && (
                  <span className="tooltip tooltip-right" data-tip={getSettingTooltip(s)}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-xs btn-circle text-white/50 hover:text-white/80"
                      aria-label={t("info")}
                    >
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M12 16v-4M12 8h.01" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
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
                      {getSelectOptionLabel(s, o)}
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
      className={`relative border rounded-lg overflow-hidden transition-all duration-300 ${
        celebrate ? "border-green-500 ring-2 ring-green-500/50" : borderClass
      }`}
      data-check-card
    >
      {isRunningCheck && (
        <span
          className="absolute top-2 right-2 z-10 flex items-center justify-center w-6 h-6 text-green-400"
          aria-hidden
        >
          <span className="loading loading-spinner loading-sm" />
        </span>
      )}
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
            <button
              type="button"
              className={`flex-1 py-2 px-3 text-xs font-medium ${tab === "logs" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
              onClick={() => setTab("logs")}
            >
              {t("logs")}
            </button>
          </div>
          <div className={`p-3 text-sm min-h-[4rem] ${inlineStyle ? "text-neutral-300" : "text-neutral-300"}`}>
            {tab === "info" && (
              <>
                <p className="font-medium text-white mb-2">{checkSummary}</p>
                <p className="whitespace-pre-wrap text-neutral-400 text-xs">{checkInfo}</p>
                {toolStatus && (
                  <div className="mt-3 pt-2 border-t border-white/10 text-xs flex flex-wrap items-center gap-1.5">
                    <span className="text-neutral-400">{t("toolLabel")}: </span>
                    {toolStatus.installed ? (
                      <span className="text-green-500">✓ {toolStatus.label ?? t("toolPresent")}</span>
                    ) : (
                      <>
                        <span className="text-amber-500">✗ {toolStatus.label ?? t("toolNotFound")}</span>
                        {toolStatus.command && (
                          <span className="inline-flex items-center gap-1 flex-wrap">
                            <code className="bg-black/30 px-1.5 py-0.5 rounded text-[11px] break-all">
                              {toolStatus.command}
                            </code>
                            <CopyButton text={toolStatus.command} />
                          </span>
                        )}
                      </>
                    )}
                    {toolStatus.repo && (
                      <a
                        href={toolStatus.repo}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-xs btn-ghost text-violet-400 hover:text-violet-300 border border-violet-500/50 hover:border-violet-400"
                        title="GitHub"
                      >
                        GitHub
                      </a>
                    )}
                  </div>
                )}
              </>
            )}
            {tab === "settings" && (
              <div className="space-y-2">
                {isProjectRules ? (
                  <>
                    <div className="flex gap-0 border-b border-white/10 mb-2">
                      <button
                        type="button"
                        className={`flex-1 py-1.5 px-2 text-xs font-medium ${projectRulesSubTab === "form" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
                        onClick={() => setProjectRulesSubTab("form")}
                      >
                        {t("projectRulesForm")}
                      </button>
                      <button
                        type="button"
                        className={`flex-1 py-1.5 px-2 text-xs font-medium ${projectRulesSubTab === "script" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
                        onClick={() => setProjectRulesSubTab("script")}
                      >
                        {t("projectRulesScript")}
                      </button>
                    </div>
                    {projectRulesSubTab === "form" && (
                      <div className="space-y-2 min-h-[8rem]">
                        {projectRulesFormRules.length === 0 && (
                          <p className="text-neutral-400 text-xs mb-2">{t("projectRulesFormEmptyHint")}</p>
                        )}
                        {projectRulesFormRules.map((rule) => (
                          <div
                            key={rule.id}
                            className="flex flex-wrap items-end gap-2 p-2 rounded bg-neutral-900/50 border border-neutral-600"
                          >
                            <select
                              className="select select-sm bg-neutral-800 border-neutral-600 text-white text-xs w-36"
                              value={rule.type}
                              onChange={(e) => {
                                const t = e.target.value as "forbidden_pattern" | "max_lines";
                                if (t === "forbidden_pattern") updateProjectRule(rule.id, { type: t, pattern: "" });
                                else updateProjectRule(rule.id, { type: t, maxLines: 300 });
                              }}
                            >
                              <option value="forbidden_pattern">{t("projectRulesRuleTypeForbiddenPattern")}</option>
                              <option value="max_lines">{t("projectRulesRuleTypeMaxLines")}</option>
                            </select>
                            {rule.type === "forbidden_pattern" && (
                              <input
                                type="text"
                                className="input input-sm bg-neutral-800 border-neutral-600 text-white text-xs flex-1 min-w-0"
                                placeholder={t("projectRulesPatternPlaceholder")}
                                value={rule.pattern}
                                onChange={(e) => updateProjectRule(rule.id, { pattern: e.target.value })}
                              />
                            )}
                            {rule.type === "max_lines" && (
                              <input
                                type="number"
                                min={1}
                                className="input input-sm bg-neutral-800 border-neutral-600 text-white text-xs w-20"
                                placeholder={t("projectRulesMaxLinesPlaceholder")}
                                value={rule.maxLines}
                                onChange={(e) =>
                                  updateProjectRule(rule.id, {
                                    maxLines: Math.max(1, parseInt(e.target.value, 10) || 300),
                                  })
                                }
                              />
                            )}
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs text-error"
                              onClick={() => removeProjectRule(rule.id)}
                              aria-label={t("remove")}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-2 items-center">
                          <button
                            type="button"
                            className="btn btn-outline btn-xs"
                            onClick={() => addProjectRule("forbidden_pattern")}
                          >
                            + {t("projectRulesAddRule")}
                          </button>
                          {projectRulesFormRules.length > 0 && (
                            <button
                              type="button"
                              className="btn btn-primary btn-xs"
                              disabled={projectRulesSaving}
                              onClick={saveProjectRulesFromForm}
                            >
                              {projectRulesSaving ? t("saving") : t("save")}
                            </button>
                          )}
                        </div>
                        {projectRulesMessage && projectRulesSubTab === "form" && (
                          <p
                            className={`text-xs ${projectRulesMessage.type === "success" ? "text-success" : "text-error"}`}
                          >
                            {projectRulesMessage.text}
                          </p>
                        )}
                      </div>
                    )}
                    {projectRulesSubTab === "script" && (
                      <>
                        {projectRulesLoading ? (
                          <div className="min-h-[120px] flex items-center gap-2 text-neutral-500 text-xs">
                            <span className="loading loading-spinner loading-sm" />
                            <span>{t("loading")}</span>
                          </div>
                        ) : (
                          <>
                            <textarea
                              className="textarea textarea-sm w-full font-mono text-xs min-h-[120px] bg-neutral-900 border-neutral-600 text-white resize-y"
                              value={projectRulesRaw}
                              onChange={(e) => {
                                setProjectRulesRaw(e.target.value);
                                setProjectRulesMessage(null);
                              }}
                              placeholder={t("projectRulesScriptPlaceholder")}
                              spellCheck={false}
                            />
                            {projectRulesMessage && (
                              <p
                                className={`text-xs mt-1 ${projectRulesMessage.type === "success" ? "text-success" : "text-error"}`}
                              >
                                {projectRulesMessage.text}
                              </p>
                            )}
                            <button
                              type="button"
                              className="btn btn-primary btn-xs mt-2"
                              disabled={projectRulesSaving}
                              onClick={saveProjectRules}
                            >
                              {projectRulesSaving ? t("saving") : t("save")}
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {def.settings
                      .filter((s) => !(s.type === "boolean" && s.key === "enabled"))
                      .map((s) => {
                        const val = checkSettings?.[s.key] ?? s.default;
                        return (
                          <div key={s.key}>
                            <div className="flex items-center gap-1 flex-wrap">
                              <label className="text-xs text-neutral-400">{getSettingLabel(s)}</label>
                              {getSettingTooltip(s) && (
                                <span className="tooltip tooltip-right" data-tip={getSettingTooltip(s)}>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-xs btn-circle text-white/50 hover:text-white/80"
                                    aria-label={t("info")}
                                  >
                                    <svg
                                      className="w-3.5 h-3.5"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth={2}
                                    >
                                      <circle cx="12" cy="12" r="10" />
                                      <path d="M12 16v-4M12 8h.01" />
                                    </svg>
                                  </button>
                                </span>
                              )}
                            </div>
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
                                    {getSelectOptionLabel(s, o)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })}
                    {def.settings.filter((s) => !(s.type === "boolean" && s.key === "enabled")).length === 0 && (
                      <p className="text-neutral-500 text-xs">{t("settingsNoExtra")}</p>
                    )}
                  </>
                )}
              </div>
            )}
            {tab === "logs" && (
              <div className="space-y-2">
                {logSegment ? (
                  <pre className="text-xs text-neutral-300 whitespace-pre-wrap break-words bg-black/30 rounded p-2 max-h-[12rem] overflow-y-auto font-mono">
                    {logSegment}
                  </pre>
                ) : (
                  <p className="text-neutral-500 text-xs">{t("noLogYet")}</p>
                )}
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
            <div
              className={`modal-box overflow-hidden flex flex-col bg-neutral-800 border border-neutral-600 relative z-[2147483647] shadow-2xl ${isProjectRules ? "max-w-4xl max-h-[95vh]" : "max-w-2xl max-h-[90vh]"}`}
            >
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
                <button
                  type="button"
                  className={`flex-1 py-2 px-3 text-sm font-medium ${tab === "logs" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
                  onClick={() => setTab("logs")}
                >
                  {t("logs")}
                </button>
              </div>
              <div className="overflow-y-auto flex-1 text-base pr-2">
                {tab === "info" && (
                  <>
                    <p className="font-medium text-white text-lg mb-3">{checkSummary}</p>
                    <p className="whitespace-pre-wrap text-neutral-300 mb-4">{checkInfo}</p>
                    {toolStatus && (
                      <div className="pt-3 border-t border-white/10 text-sm flex flex-wrap items-center gap-2">
                        <span className="text-neutral-400">{t("toolLabel")}: </span>
                        {toolStatus.installed ? (
                          <span className="text-green-500">✓ {toolStatus.label ?? t("toolPresent")}</span>
                        ) : (
                          <>
                            <span className="text-amber-500">✗ {toolStatus.label ?? t("toolNotFound")}</span>
                            {toolStatus.command && (
                              <span className="inline-flex items-center gap-1 flex-wrap">
                                <code className="bg-black/30 px-1.5 py-0.5 rounded text-sm break-all">
                                  {toolStatus.command}
                                </code>
                                <CopyButton text={toolStatus.command} />
                              </span>
                            )}
                          </>
                        )}
                        {toolStatus.repo && (
                          <a
                            href={toolStatus.repo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-ghost text-violet-400 hover:text-violet-300 border border-violet-500/50 hover:border-violet-400"
                            title="GitHub"
                          >
                            GitHub
                          </a>
                        )}
                      </div>
                    )}
                  </>
                )}
                {tab === "settings" && (
                  <div className="space-y-4">
                    {isProjectRules ? (
                      <div className="flex flex-col min-h-0 flex-1">
                        <div className="flex gap-0 border-b border-neutral-600 mb-3">
                          <button
                            type="button"
                            className={`flex-1 py-2 px-3 text-sm font-medium ${projectRulesSubTab === "form" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
                            onClick={() => setProjectRulesSubTab("form")}
                          >
                            {t("projectRulesForm")}
                          </button>
                          <button
                            type="button"
                            className={`flex-1 py-2 px-3 text-sm font-medium ${projectRulesSubTab === "script" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
                            onClick={() => setProjectRulesSubTab("script")}
                          >
                            {t("projectRulesScript")}
                          </button>
                        </div>
                        {projectRulesSubTab === "form" && (
                          <div className="space-y-4">
                            {projectRulesFormRules.length === 0 && (
                              <p className="text-neutral-400 text-sm mb-2">{t("projectRulesFormEmptyHint")}</p>
                            )}
                            {projectRulesFormRules.map((rule) => (
                              <div
                                key={rule.id}
                                className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-neutral-900/50 border border-neutral-600"
                              >
                                <div className="flex flex-col gap-1">
                                  <label className="text-xs text-neutral-400">{t("projectRulesRuleTypeLabel")}</label>
                                  <select
                                    className="select select-sm bg-neutral-800 border-neutral-600 text-white"
                                    value={rule.type}
                                    onChange={(e) => {
                                      const typ = e.target.value as "forbidden_pattern" | "max_lines";
                                      if (typ === "forbidden_pattern")
                                        updateProjectRule(rule.id, { type: typ, pattern: "" });
                                      else updateProjectRule(rule.id, { type: typ, maxLines: 300 });
                                    }}
                                  >
                                    <option value="forbidden_pattern">
                                      {t("projectRulesRuleTypeForbiddenPattern")}
                                    </option>
                                    <option value="max_lines">{t("projectRulesRuleTypeMaxLines")}</option>
                                  </select>
                                </div>
                                {rule.type === "forbidden_pattern" && (
                                  <div className="flex-1 min-w-[200px] flex flex-col gap-1">
                                    <label className="text-xs text-neutral-400">{t("projectRulesPatternLabel")}</label>
                                    <input
                                      type="text"
                                      className="input input-sm input-bordered bg-neutral-800 border-neutral-600 text-white w-full"
                                      placeholder={t("projectRulesPatternPlaceholder")}
                                      value={rule.pattern}
                                      onChange={(e) => updateProjectRule(rule.id, { pattern: e.target.value })}
                                    />
                                  </div>
                                )}
                                {rule.type === "max_lines" && (
                                  <div className="flex flex-col gap-1">
                                    <label className="text-xs text-neutral-400">{t("projectRulesMaxLinesLabel")}</label>
                                    <input
                                      type="number"
                                      min={1}
                                      className="input input-sm input-bordered bg-neutral-800 border-neutral-600 text-white w-24"
                                      placeholder={t("projectRulesMaxLinesPlaceholder")}
                                      value={rule.maxLines}
                                      onChange={(e) =>
                                        updateProjectRule(rule.id, {
                                          maxLines: Math.max(1, parseInt(e.target.value, 10) || 300),
                                        })
                                      }
                                    />
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm text-error"
                                  onClick={() => removeProjectRule(rule.id)}
                                  aria-label={t("remove")}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <div className="flex flex-wrap gap-3 items-center">
                              <button
                                type="button"
                                className="btn btn-outline btn-sm"
                                onClick={() => addProjectRule("forbidden_pattern")}
                              >
                                + {t("projectRulesAddRule")}
                              </button>
                              {projectRulesFormRules.length > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={projectRulesSaving}
                                  onClick={saveProjectRulesFromForm}
                                >
                                  {projectRulesSaving ? t("saving") : t("save")}
                                </button>
                              )}
                            </div>
                            {projectRulesMessage && (
                              <p
                                className={`text-sm ${projectRulesMessage.type === "success" ? "text-success" : "text-error"}`}
                              >
                                {projectRulesMessage.text}
                              </p>
                            )}
                          </div>
                        )}
                        {projectRulesSubTab === "script" && (
                          <>
                            {projectRulesLoading ? (
                              <div className="flex items-center gap-2 text-neutral-400">
                                <span className="loading loading-spinner loading-sm" />
                                <span>{t("loading")}</span>
                              </div>
                            ) : (
                              <>
                                <textarea
                                  className="textarea w-full font-mono text-sm min-h-[280px] bg-neutral-900 border-neutral-600 text-white resize-y"
                                  value={projectRulesRaw}
                                  onChange={(e) => {
                                    setProjectRulesRaw(e.target.value);
                                    setProjectRulesMessage(null);
                                  }}
                                  placeholder={t("projectRulesScriptPlaceholder")}
                                  spellCheck={false}
                                />
                                {projectRulesMessage && (
                                  <p
                                    className={`mt-2 text-sm ${projectRulesMessage.type === "success" ? "text-success" : "text-error"}`}
                                  >
                                    {projectRulesMessage.text}
                                  </p>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm mt-3"
                                  disabled={projectRulesSaving}
                                  onClick={saveProjectRules}
                                >
                                  {projectRulesSaving ? t("saving") : t("save")}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        {def.settings
                          .filter((s) => !(s.type === "boolean" && s.key === "enabled"))
                          .map((s) => {
                            const val = checkSettings?.[s.key] ?? s.default;
                            return (
                              <div key={s.key}>
                                <div className="flex items-center gap-1 flex-wrap mb-1">
                                  <label className="text-sm text-neutral-300 block">{getSettingLabel(s)}</label>
                                  {getSettingTooltip(s) && (
                                    <span className="tooltip tooltip-right" data-tip={getSettingTooltip(s)}>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-xs btn-circle text-white/50 hover:text-white/80"
                                        aria-label={t("info")}
                                      >
                                        <svg
                                          className="w-3.5 h-3.5"
                                          viewBox="0 0 24 24"
                                          fill="none"
                                          stroke="currentColor"
                                          strokeWidth={2}
                                        >
                                          <circle cx="12" cy="12" r="10" />
                                          <path d="M12 16v-4M12 8h.01" />
                                        </svg>
                                      </button>
                                    </span>
                                  )}
                                </div>
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
                                      onSettingsChange?.({
                                        [s.key]: e.target.value ? Number(e.target.value) : s.default,
                                      })
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
                                        {getSelectOptionLabel(s, o)}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            );
                          })}
                        {def.settings.filter((s) => !(s.type === "boolean" && s.key === "enabled")).length === 0 && (
                          <p className="text-neutral-500 text-sm">{t("settingsNoExtra")}</p>
                        )}
                      </>
                    )}
                  </div>
                )}
                {tab === "logs" && (
                  <div>
                    {logSegment ? (
                      <pre className="text-sm text-neutral-300 whitespace-pre-wrap break-words bg-black/30 rounded p-3 max-h-[20rem] overflow-y-auto font-mono">
                        {logSegment}
                      </pre>
                    ) : (
                      <p className="text-neutral-500 text-sm">{t("noLogYet")}</p>
                    )}
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
