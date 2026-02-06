/**
 * Config page: edit .shimwrappercheckrc (raw text).
 * Location: app/config/page.tsx
 */
"use client";

import { useEffect, useState } from "react";
export default function ConfigPage() {
  const [raw, setRaw] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        setRaw(data.raw ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const save = () => {
    setSaving(true);
    setMessage(null);
    fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw }),
    })
      .then((r) => r.json())
      .then((data) => {
        setSaving(false);
        if (data.error) setMessage({ type: "error", text: data.error });
        else setMessage({ type: "success", text: "Config gespeichert." });
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Config (.shimwrappercheckrc)</h1>
      <p className="text-base-content/80">
        Shell-Variablen und Kommentare. Wird beim nächsten Aufruf des Shims verwendet.
      </p>
      <textarea
        className="textarea textarea-bordered w-full font-mono text-sm min-h-[320px]"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder="# shimwrappercheck config\nSHIM_ENFORCE_COMMANDS=\"functions,db,migration\"\n..."
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
