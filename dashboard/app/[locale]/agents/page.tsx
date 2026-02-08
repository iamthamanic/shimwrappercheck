/**
 * AGENTS.md editor: edit agent instructions (used by Cursor/Codex agents).
 * Location: app/agents/page.tsx
 */
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

export default function AgentsPage() {
  const t = useTranslations("common");
  const tAgents = useTranslations("agents");
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    fetch("/api/agents-md")
      .then((r) => r.json())
      .then((data) => {
        setRaw(data.raw ?? "");
        setExists(data.exists ?? false);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = () => {
    setSaving(true);
    setMessage(null);
    fetch("/api/agents-md", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSaving(false);
        if (data.error) setMessage({ type: "error", text: data.error });
        else {
          setMessage({ type: "success", text: tAgents("saved") });
          setExists(true);
        }
      })
      .catch(() => {
        setSaving(false);
        setMessage({ type: "error", text: t("saveFailed") });
      });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white">
      <h1 className="text-3xl font-bold">{tAgents("title")}</h1>
      <p className="text-neutral-300">{tAgents("description")}</p>
      {!exists && (
        <div className="alert bg-neutral-800 border-neutral-600 text-neutral-300">
          <span>{tAgents("notExists")}</span>
        </div>
      )}
      <textarea
        className="textarea w-full font-mono text-sm min-h-[400px] bg-neutral-800 border-neutral-600 text-white"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={tAgents("placeholder")}
        spellCheck={false}
      />
      <div className="flex gap-4 items-center">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? t("saving") : t("save")}
        </button>
        {message && <span className={message.type === "success" ? "text-success" : "text-error"}>{message.text}</span>}
      </div>
    </div>
  );
}
