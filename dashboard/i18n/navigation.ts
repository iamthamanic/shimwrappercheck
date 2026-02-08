/**
 * Locale-aware navigation: Link, useRouter, usePathname.
 * Location: i18n/navigation.ts
 */
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, useRouter, usePathname, redirect } = createNavigation(routing);
