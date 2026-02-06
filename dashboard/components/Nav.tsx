/**
 * Top navigation for shimwrappercheck dashboard.
 * Location: /components/Nav.tsx
 */
"use client";

import Link from "next/link";

export default function Nav() {
  return (
    <div className="navbar bg-base-100 shadow-lg">
      <div className="flex-1">
        <Link href="/" className="btn btn-ghost text-xl">
          shimwrappercheck
        </Link>
      </div>
      <div className="flex-none gap-2">
        <Link href="/" className="btn btn-ghost btn-sm">
          Dashboard
        </Link>
        <Link href="/settings" className="btn btn-ghost btn-sm">
          Einstellungen
        </Link>
        <Link href="/config" className="btn btn-ghost btn-sm">
          Config
        </Link>
        <Link href="/agents" className="btn btn-ghost btn-sm">
          AGENTS.md
        </Link>
      </div>
    </div>
  );
}
