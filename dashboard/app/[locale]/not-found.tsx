/**
 * 404 page for [locale]: uses translations and locale-aware links.
 * Location: app/[locale]/not-found.tsx
 */
"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("notFound");
  const tCommon = useTranslations("common");
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-6 text-white">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-white/70">{t("description")}</p>
      <div className="flex gap-4">
        <Link href="/" className="btn btn-primary btn-sm">
          {tCommon("myshim")}
        </Link>
        <Link href="/settings" className="btn btn-outline btn-sm border-white/50 text-white">
          {tCommon("settings")}
        </Link>
      </div>
    </div>
  );
}
