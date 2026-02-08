/**
 * Locale layout: validates locale, loads messages, provides NextIntlClientProvider.
 * Location: app/[locale]/layout.tsx
 */
import { NextIntlClientProvider } from "next-intl";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import DevConsoleHint from "@/components/DevConsoleHint";
import Header from "@/components/Header";
import LayoutContent from "@/components/LayoutContent";
import SetDocumentLang from "@/components/SetDocumentLang";
import { SettingsSavedProvider } from "@/components/SettingsSavedContext";
import ShimDndWithNotify from "@/components/ShimDndWithNotify";
import messagesDe from "@/messages/de.json";
import messagesEn from "@/messages/en.json";

const messagesByLocale: Record<string, Record<string, unknown>> = {
  de: messagesDe as Record<string, unknown>,
  en: messagesEn as Record<string, unknown>,
};

function getMessages(locale: string): Record<string, unknown> {
  return messagesByLocale[locale] ?? messagesByLocale[routing.defaultLocale] ?? {};
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  try {
    const resolved = params != null ? await params : null;
    const locale =
      resolved?.locale && hasLocale(routing.locales, resolved.locale) ? resolved.locale : routing.defaultLocale;
    const messages = getMessages(locale) as { common?: { dashboardTitle?: string; dashboardDescription?: string } };
    return {
      title: messages?.common?.dashboardTitle ?? "shimwrappercheck Dashboard",
      description: messages?.common?.dashboardDescription ?? "Config & AGENTS.md for shimwrappercheck",
    };
  } catch {
    return {
      title: "shimwrappercheck Dashboard",
      description: "Config & AGENTS.md for shimwrappercheck",
    };
  }
}

export default async function LocaleLayout({ children, params }: Props) {
  let locale: string = routing.defaultLocale;
  try {
    const resolved = params != null ? await params : null;
    const requested = resolved?.locale;
    if (requested && hasLocale(routing.locales, requested)) {
      locale = requested;
    }
  } catch (e) {
    console.error("LocaleLayout params failed:", e);
    notFound();
  }
  const messages = getMessages(locale) ?? {};
  // Rounded to full minute so server/client serialization matches (avoids hydration mismatch / "1 Issue")
  const now = new Date(Math.floor(Date.now() / 60_000) * 60_000);

  return (
    <NextIntlClientProvider messages={messages} locale={locale} timeZone="Europe/Berlin" now={now}>
      <DevConsoleHint />
      <SetDocumentLang />
      <Header />
      <div className="flex flex-1 min-h-0 flex-col w-full min-h-[50vh] bg-[#0f0f0f]">
        <SettingsSavedProvider>
          <ShimDndWithNotify>
            <LayoutContent>{children}</LayoutContent>
          </ShimDndWithNotify>
        </SettingsSavedProvider>
      </div>
    </NextIntlClientProvider>
  );
}
