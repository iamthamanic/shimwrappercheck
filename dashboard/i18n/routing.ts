/**
 * next-intl routing: locales and default.
 * Location: i18n/routing.ts
 */
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["de", "en"],
  defaultLocale: "de",
  localePrefix: "always",
});
