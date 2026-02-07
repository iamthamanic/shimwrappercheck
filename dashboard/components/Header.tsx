/**
 * Header: "shimwrappercheck" zentriert; rechts Schalter [myshim | Settings].
 * myshim = Ansicht My Shim + Check Library, Settings = Templates & Information.
 * Location: /components/Header.tsx
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isSettings = pathname === "/settings";

  return (
    <header className="h-14 border-b border-white/20 flex items-center justify-between px-6 bg-[#0f0f0f] shrink-0">
      <div className="w-24" aria-hidden />
      <div className="flex-1 flex justify-center pointer-events-none">
        <span className="text-xl font-semibold text-white">shimwrappercheck</span>
      </div>
      <div className="flex items-center gap-0 rounded overflow-hidden border border-white/80">
        <Link
          href="/"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            !isSettings ? "bg-white text-black" : "text-white hover:bg-white/10"
          }`}
        >
          myshim
        </Link>
        <Link
          href="/settings"
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
            isSettings ? "bg-white text-black" : "text-white hover:bg-white/10"
          }`}
          aria-label="Einstellungen"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 2.31.826 1.37 1.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 2.31-1.37 1.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-2.31-.826-1.37-1.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-2.31 1.37-1.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </Link>
      </div>
    </header>
  );
}
