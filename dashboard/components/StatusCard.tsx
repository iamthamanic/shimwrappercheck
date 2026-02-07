/**
 * Status card for dashboard: shows one check (label + ok/missing).
 * Location: /components/StatusCard.tsx
 */
"use client";

export default function StatusCard({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean;
  detail?: string;
}) {
  return (
    <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
      <div className="card-body p-4">
        <h3 className="card-title text-sm text-white">{label}</h3>
        <p className={ok ? "text-green-400" : "text-amber-400"}>
          {ok ? "✓ Vorhanden" : "— Nicht gefunden"}
        </p>
        {detail && <p className="text-xs text-neutral-400">{detail}</p>}
      </div>
    </div>
  );
}
