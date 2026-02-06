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
    <div className="card bg-base-100 shadow-md">
      <div className="card-body p-4">
        <h3 className="card-title text-sm">{label}</h3>
        <p className={ok ? "text-success" : "text-warning"}>
          {ok ? "✓ Vorhanden" : "— Nicht gefunden"}
        </p>
        {detail && <p className="text-xs opacity-80">{detail}</p>}
      </div>
    </div>
  );
}
