/**
 * Dashboard home: status, quick actions (run checks), links to Config and AGENTS.md.
 * Location: app/page.tsx
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import StatusCard from "@/components/StatusCard";

type Status = {
  projectRoot?: string;
  config?: boolean;
  presetsFile?: boolean;
  agentsMd?: boolean;
  runChecksScript?: boolean;
  shimRunner?: boolean;
  prePushHusky?: boolean;
  prePushGit?: boolean;
  supabase?: boolean;
  lastError?: { check?: string; message?: string; suggestion?: string; timestamp?: string } | null;
};

export default function DashboardPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [runResult, setRunResult] = useState<{ stdout: string; stderr: string; code: number } | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const runChecks = () => {
    setRunning(true);
    setRunResult(null);
    fetch("/api/run-checks", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        setRunResult({ stdout: data.stdout ?? "", stderr: data.stderr ?? "", code: data.code ?? 1 });
        setRunning(false);
      })
      .catch(() => {
        setRunResult({ stdout: "", stderr: "Request failed", code: 1 });
        setRunning(false);
      });
  };

  if (loading || !status) {
    return (
      <div className="flex justify-center py-12">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="text-base-content/80">
        Status und Aktionen für shimwrappercheck. AGENTS.md und Config können hier bearbeitet werden (auch für Agents).
      </p>

      <div>
        <h2 className="text-xl font-semibold mb-4">Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatusCard label=".shimwrappercheckrc" ok={!!status.config} />
          <StatusCard label="Presets (.shimwrappercheck-presets.json)" ok={!!status.presetsFile} detail="Presets & Check-Toggles (Einstellungen)" />
          <StatusCard label="AGENTS.md" ok={!!status.agentsMd} detail="Agent-Anweisungen (über GUI bearbeitbar)" />
          <StatusCard label="scripts/run-checks.sh" ok={!!status.runChecksScript} />
          <StatusCard label="Shim Runner" ok={!!status.shimRunner} detail="Node orchestrator (npx shimwrappercheck run)" />
          <StatusCard label="Husky pre-push" ok={!!status.prePushHusky} />
          <StatusCard label="Git pre-push Hook" ok={!!status.prePushGit} />
          <StatusCard label="Supabase" ok={!!status.supabase} />
        </div>
        {status.projectRoot && (
          <p className="mt-2 text-sm text-base-content/70">Projekt-Root: {status.projectRoot}</p>
        )}
        {status.lastError && (
          <div className="mt-4 alert alert-warning shadow-lg">
            <div>
              <h3 className="font-bold">Letzter Check-Fehler (.shim/last_error.json)</h3>
              <p className="text-sm">{status.lastError.check}: {status.lastError.message}</p>
              {status.lastError.suggestion && <p className="text-sm opacity-90">Vorschlag: {status.lastError.suggestion}</p>}
            </div>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Aktionen</h2>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            className="btn btn-primary"
            onClick={runChecks}
            disabled={running || (!status.runChecksScript && !status.shimRunner)}
          >
            {running ? "Läuft…" : "Nur Checks ausführen"}
          </button>
          <Link href="/settings" className="btn btn-outline">
            Einstellungen (Presets & Checks)
          </Link>
          <Link href="/config" className="btn btn-outline">
            Config (Raw)
          </Link>
          <Link href="/agents" className="btn btn-outline">
            AGENTS.md bearbeiten
          </Link>
        </div>
      </div>

      {runResult && (
        <div className="card bg-base-100 shadow-md">
          <div className="card-body">
            <h3 className="card-title">
              Letzte Check-Ausgabe {runResult.code === 0 ? "(OK)" : "(Fehler)"}
            </h3>
            <pre className="bg-base-200 p-4 rounded-lg text-sm overflow-auto max-h-64 whitespace-pre-wrap">
              {runResult.stdout || "(keine Ausgabe)"}
              {runResult.stderr ? `\n${runResult.stderr}` : ""}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
