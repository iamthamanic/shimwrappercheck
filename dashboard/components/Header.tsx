/**
 * Header: "shimwrappercheck" zentriert; rechts Schalter [myshim | Settings].
 * myshim = Ansicht My Shim + Check Library, Settings = Templates & Information.
 * Location: /components/Header.tsx
 */
"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { IconSettings } from "@/components/Icons";

export default function Header() {
  const t = useTranslations("common");
  const tHeader = useTranslations("header");
  const pathname = usePathname();
  const isSettings = pathname === "/settings";

  return (
    <header className="h-14 border-b border-white/20 flex items-center justify-between px-6 bg-[#0f0f0f] shrink-0">
      <div className="w-24 flex items-center gap-2" aria-hidden>
        <LocaleSwitcher />
      </div>
      <div className="flex-1 flex justify-center pointer-events-none">
        <span className="text-xl font-semibold text-white">{t("appName")}</span>
      </div>
      <div className="flex items-center gap-0 rounded overflow-hidden border border-white/80">
        <Link
          href="/"
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            !isSettings ? "bg-white text-black" : "text-white hover:bg-white/10"
          }`}
        >
          {t("myshim")}
        </Link>
        <Link
          href="/settings"
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
            isSettings ? "bg-white text-black" : "text-white hover:bg-white/10"
          }`}
          aria-label={tHeader("settingsAria")}
        >
          <IconSettings />
          {t("settings")}
        </Link>
      </div>
    </header>
  );
}

function LocaleSwitcher() {
  const pathname = usePathname();
  const locale = useLocale();
  const activeClass = "px-2 py-1 bg-white text-black font-medium";
  const inactiveClass = "px-2 py-1 bg-white/10 hover:bg-white/20 text-white";
  return (
    <div className="flex rounded overflow-hidden border border-white/50 text-xs">
      <Link href={pathname} locale="de" className={locale === "de" ? activeClass : inactiveClass}>
        DE
      </Link>
      <Link href={pathname} locale="en" className={locale === "en" ? activeClass : inactiveClass}>
        EN
      </Link>
    </div>
  );
}
