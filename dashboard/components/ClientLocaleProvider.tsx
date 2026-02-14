/**
 * Wraps NextIntlClientProvider with client-side locale state so switching DE/EN
 * only updates messages and URL (replaceState), no full navigation/reload.
 * Location: dashboard/components/ClientLocaleProvider.tsx
 */
"use client";

import React, { useState, useCallback, useEffect } from "react";
import { NextIntlClientProvider } from "next-intl";

const LOCALE_COOKIE = "NEXT_LOCALE";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

type Locale = "de" | "en";

export const LocaleContext = React.createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "de", setLocale: () => {} });

export default function ClientLocaleProvider({
  initialLocale,
  messagesByLocale,
  timeZone,
  now,
  children,
}: {
  initialLocale: Locale;
  messagesByLocale: Record<string, Record<string, unknown>>;
  timeZone: string;
  now: Date;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  // Sync state when initialLocale changes (e.g. user navigated to /en/... by hand)
  useEffect(() => {
    if (initialLocale === "de" || initialLocale === "en") {
      setLocaleState(initialLocale);
    }
  }, [initialLocale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      if (typeof window !== "undefined") {
        const fullPath = window.location.pathname || "/";
        const withoutLocale = fullPath.replace(/^\/(de|en)(\/|$)/, "$2") || "/";
        const path = `/${newLocale}${withoutLocale === "/" ? "" : withoutLocale}`;
        window.history.replaceState(null, "", path);
        document.cookie = `${LOCALE_COOKIE}=${newLocale}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
      }
    } catch {
      /* ignore */
    }
  }, []);

  const messages = messagesByLocale[locale] ?? messagesByLocale.de ?? {};
  const value = React.useMemo(() => ({ locale, setLocale }), [locale, setLocale]);

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider messages={messages} locale={locale} timeZone={timeZone} now={now}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
