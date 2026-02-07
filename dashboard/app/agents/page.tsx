/**
 * AGENTS.md editor: edit agent instructions (used by Cursor/Codex agents).
 * Location: app/agents/page.tsx
 */
"use client";

import { useEffect, useState } from "react";

export default function AgentsPage() {
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
          setMessage({ type: "success", text: "AGENTS.md gespeichert." });
          setExists(true);
        }
      })
      .catch(() => {
        setSaving(false);
        setMessage({ type: "error", text: "Speichern fehlgeschlagen." });
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
      <h1 className="text-3xl font-bold">AGENTS.md</h1>
      <p className="text-neutral-300">
        Agent-Anweisungen für Cursor/Codex. Wird von Agents gelesen; hier bearbeitbar. Änderungen gelten sofort.
      </p>
      {!exists && (
        <div className="alert bg-neutral-800 border-neutral-600 text-neutral-300">
          <span>AGENTS.md existiert noch nicht. Beim Speichern wird sie im Projekt-Root angelegt.</span>
        </div>
      )}
      <textarea
        className="textarea w-full font-mono text-sm min-h-[400px] bg-neutral-800 border-neutral-600 text-white"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="# Agent instructions..."
        spellCheck={false}
      />
      <div className="flex gap-4 items-center">
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? "Speichern…" : "Speichern"}
        </button>
        {message && (
          <span className={message.type === "success" ? "text-success" : "text-error"}>
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
