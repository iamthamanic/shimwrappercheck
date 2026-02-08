/**
 * next-intl request config: load messages by locale.
 * Location: i18n/request.ts
 */
import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = routing.defaultLocale;
  let messages: Record<string, unknown> = {};
  try {
    const requested = await requestLocale;
    if (requested && typeof requested === "string" && hasLocale(routing.locales, requested)) {
      locale = requested;
    }
  } catch {
    // use defaultLocale
  }
  try {
    const mod = await import(`../messages/${locale}.json`);
    messages = (mod?.default ?? {}) as Record<string, unknown>;
  } catch {
    try {
      const fallback = await import(`../messages/${routing.defaultLocale}.json`);
      messages = (fallback?.default ?? {}) as Record<string, unknown>;
    } catch {
      messages = {};
    }
  }
  return {
    locale,
    messages,
    timeZone: "Europe/Berlin",
    now: new Date(Math.floor(Date.now() / 60_000) * 60_000),
  };
});
