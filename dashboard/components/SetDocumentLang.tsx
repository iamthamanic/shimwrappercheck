/**
 * Sets document.documentElement.lang from current locale (for accessibility).
 * Location: /components/SetDocumentLang.tsx
 */
"use client";

import { useLocale } from "next-intl";
import { useEffect } from "react";

export default function SetDocumentLang() {
  const locale = useLocale();
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);
  return null;
}
