/**
 * Top navigation for shimwrappercheck dashboard.
 * Location: /components/Nav.tsx
 */
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function Nav() {
  const t = useTranslations("common");
  const tNav = useTranslations("nav");
  return (
    <div className="navbar bg-base-100 shadow-lg">
      <div className="flex-1">
        <Link href="/" className="btn btn-ghost text-xl">
          {t("appName")}
        </Link>
      </div>
      <div className="flex-none gap-2">
        <Link href="/" className="btn btn-ghost btn-sm">
          {tNav("dashboard")}
        </Link>
        <Link href="/settings" className="btn btn-ghost btn-sm">
          {tNav("settings")}
        </Link>
        <Link href="/config" className="btn btn-ghost btn-sm">
          {tNav("config")}
        </Link>
        <Link href="/agents" className="btn btn-ghost btn-sm">
          {tNav("agentsMd")}
        </Link>
      </div>
    </div>
  );
}
