/**
 * Locale layout: validates locale, loads messages, provides client-side locale
 * switch (no reload). NextIntlClientProvider is inside ClientLocaleProvider.
 * Location: app/[locale]/layout.tsx
 */
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import ClientLocaleProvider from "@/components/ClientLocaleProvider";
import DevConsoleHint from "@/components/DevConsoleHint";
import Header from "@/components/Header";
import LayoutContent from "@/components/LayoutContent";
import SetDocumentLang from "@/components/SetDocumentLang";
import { SettingsSavedProvider } from "@/components/SettingsSavedContext";
import { SettingsDirtyProvider } from "@/components/SettingsDirtyContext";
import { RunChecksLogProvider } from "@/components/RunChecksLogContext";
import ShimDndWithNotify from "@/components/ShimDndWithNotify";
import messagesDe from "@/messages/de.json";
import messagesEn from "@/messages/en.json";

const messagesByLocale: Record<string, Record<string, unknown>> = {
  // Statische Locale->Messages-Tabelle zentral definieren; ohne waeren spaetere Lookups verteilt und fehleranfaelliger.
  de: messagesDe as Record<string, unknown>, // Deutsche Messages fest zuordnen; ohne fehlt fuer `de` eine direkte Datenquelle.
  en: messagesEn as Record<string, unknown>, // Englische Messages fest zuordnen; ohne kann das Layout fuer `en` keine Texte laden.
};

/**
 * getMessages: Liefert das Message-Objekt fuer ein Locale oder faellt auf das Default-Locale zurueck.
 * Zweck: Layout und Metadata brauchen immer ein valides Message-Objekt. Ohne Fallback koennte Rendering mit undefined scheitern.
 * Eingabe: `locale` als String. Ausgabe: Message-Record fuer dieses oder das Default-Locale.
 */
function getMessages(locale: string): Record<string, unknown> {
  return messagesByLocale[locale] ?? messagesByLocale[routing.defaultLocale] ?? {}; // Immer ein Objekt liefern; ohne drohen Zugriffe auf undefined.
}

type Props = {
  // Props-Form des Locale-Layouts definieren; ohne bleibt der Vertrag fuer Kinder und Route-Parameter verstreut.
  // Eingabeform des Layouts explizit dokumentieren; ohne bleibt unklar, welche Route-Daten Next.js liefert.
  children: React.ReactNode; // Gerenderten Seiteninhalt typisieren; ohne fehlt die Vertragsbeschreibung fuer den Layout-Slot.
  params: Promise<{ locale: string }>; // Asynchronen Locale-Parameter typisieren; ohne ist die spaetere `await params`-Nutzung weniger klar.
};

/**
 * generateMetadata: Erzeugt Seitentitel und Beschreibung passend zum angefragten Locale.
 * Zweck: Dashboard-Metadaten internationalisiert ausliefern. Ohne diese Funktion waeren Titel/Beschreibung immer statisch.
 * Eingabe: `params` mit versprochenem Locale. Ausgabe: Metadata-Objekt fuer Next.js.
 */
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  // Metadata-Generator fuer die Locale-Route bereitstellen; ohne kann Next.js keinen lokalisierten Head bauen.
  // Metadata-Generator fuer locale-abhaengigen Head registrieren; ohne bleibt der Seitenkopf statisch.
  try {
    // Metadata-Erzeugung gegen fehlerhafte Params oder Message-Zugriffe absichern; ohne bricht der Head-Aufbau ungefangen ab.
    // Metadatenaufbau vor Laufzeitfehlern schuetzen; ohne kann ein kaputter Locale-Parameter den Head-Aufbau abbrechen.
    const resolved = params != null ? await params : null; // Promise aufloesen; ohne kann das Locale nicht validiert werden.
    const locale = // Effektives Locale fuer die Metadaten bestimmen; ohne koennen Titel und Beschreibung auf einer ungueltigen Sprache basieren.
      resolved?.locale && hasLocale(routing.locales, resolved.locale) ? resolved.locale : routing.defaultLocale; // Ungueltige Locales auf Default zuruecksetzen.
    const messages = getMessages(locale) as { common?: { dashboardTitle?: string; dashboardDescription?: string } }; // Gemeinsame Texte typisieren; ohne sind Titel/Beschreibung im Zugriff unklar.
    return {
      // Metadata-Objekt gesammelt an Next.js zurueckgeben; ohne kann der Head nicht aus diesen Werten aufgebaut werden.
      title: messages?.common?.dashboardTitle ?? "shimwrappercheck Dashboard", // Lokalisierten Titel bevorzugen; ohne fehlt i18n im Browser-Tab.
      description: messages?.common?.dashboardDescription ?? "Config & AGENTS.md for shimwrappercheck", // Lokalisierte Beschreibung bevorzugen; ohne bleibt die Meta-Description trotz gueltigem Locale auf einem starren Fallback stehen.
    };
  } catch {
    // Fehlerpfad fuer kaputte Param-/Message-Aufloesung; ohne wuerde der Metadata-Aufbau ungefangen abbrechen.
    // Metadata-Fehler bewusst mit statischen Defaults abfangen; ohne kann schon der Head-Aufbau am Locale-Lookup scheitern.
    // Wenn dieser Fallback fehlt, bekommt die Seite im Fehlerpfad ggf. gar keine sauberen Metadaten mehr.
    return {
      // Statische Ersatz-Metadaten liefern; ohne bleibt der Head im Fehlerfall leer oder inkonsistent.
      title: "shimwrappercheck Dashboard", // Statischen Titel als Sicherheitsnetz liefern; ohne kann Metadata bei Fehlern leer bleiben.
      description: "Config & AGENTS.md for shimwrappercheck", // Statische Beschreibung als Fallback liefern; ohne fehlt im Fehlerfall sinnvolle Seitenerklaerung.
    };
  }
}

/**
 * LocaleLayout: Root-Layout pro Locale. Zweck: Locale validieren, Messages laden, Provider-Kette (inkl. SettingsDirtyProvider) bereitstellen.
 * Problem: Ohne SettingsDirtyProvider hätte die Sidebar keine Dirty-Ref für den Poll-Skip. Eingabe: children, params. Ausgabe: React-Knoten.
 */
export default async function LocaleLayout({ children, params }: Props) {
  // Root-Layout der Locale-Route exportieren; ohne rendert Next.js diese Provider-Kette nicht.
  let locale: string = routing.defaultLocale; // Default-Locale sofort setzen; ohne startet das Layout vor der Validierung in einem undefinierten Zustand.
  try {
    // Parameter-Aufloesung und Locale-Validierung absichern; ohne faellt schon Routing-Eingabe unkontrolliert durch.
    const resolved = params != null ? await params : null; // Route-Parameter aufloesen; ohne keine Locale-Validierung moeglich.
    const requested = resolved?.locale; // Angefragtes Locale separat lesen; ohne waere spaeter unklar, welcher rohe URL-Wert eigentlich validiert wurde.
    if (requested && hasLocale(routing.locales, requested)) {
      // Nur gueltige bekannte Locales akzeptieren; ohne rutschen falsche URL-Werte in den Provider.
      locale = requested; // Nur bekannte Locales uebernehmen; ohne kann das Layout in einen ungueltigen Zustand laufen.
    }
  } catch (e) {
    // Fehler bei Parameter-Aufloesung oder Locale-Validierung explizit abfangen; ohne koennte das gesamte Layout schon vor dem Rendern ungefangen abbrechen.
    console.error("LocaleLayout params/messages failed:", e); // Fehler sichtbar loggen; ohne ist spaeter kaum nachvollziehbar, warum das Locale auf Default fiel.
    locale = routing.defaultLocale; // Bei Fehler sicher auf Default zurueckfallen; ohne waere das Locale undefiniert.
  }
  // Rounded to full minute so server/client serialization matches (avoids hydration mismatch / "1 Issue")
  const now = new Date(Math.floor(Date.now() / 60_000) * 60_000); // Zeit auf volle Minute runden; ohne koennen Server und Client unterschiedliche `now`-Werte serialisieren und eine Hydration-Warnung erzeugen.
  const safeLocale = locale === "en" ? "en" : "de"; // Locale auf die real unterstuetzten Werte begrenzen; ohne koennte ein unerwarteter String in Provider und Message-Lookups landen.

  try {
    // Eigentlichen Layout-Render gegen Laufzeitfehler abschirmen; ohne endet ein Fehler nur in einer kaputten Route.
    return (
      // Erfolgsfall des Layout-Renders zurueckgeben; ohne erscheint trotz gueltiger Daten keine Seite.
      // Locale- und Message-Kontext fuer alle Kindkomponenten bereitstellen; ohne funktionieren useTranslations und Locale-Switches nicht konsistent.
      <ClientLocaleProvider // Obersten Locale-/Messages-Provider aufspannen; ohne verlieren alle Kinder den i18n-Kontext.
        initialLocale={safeLocale} // Valides Start-Locale an alle Kindkomponenten geben; ohne koennen Texte sofort im falschen Locale erscheinen.
        messagesByLocale={messagesByLocale} // Vollstaendigen Message-Katalog einspeisen; ohne funktionieren `useTranslations`-Aufrufe nicht.
        timeZone="Europe/Berlin" // Einheitliche Zeitzone fuer relative/formatierte Zeiten setzen; ohne drohen Server-/Client-Abweichungen.
        now={now} // Gerundeten Referenzzeitpunkt weiterreichen; ohne kann die Hydration durch unterschiedliche Zeitwerte kippen.
      >
        {/* Dev-Hinweis nur im Browser anzeigen; ohne fehlt der schnelle Hinweis auf lokale Entwicklungsdetails. */}
        <DevConsoleHint />
        {/* Dev-Hinweis wirklich rendern; ohne fehlen die vorgesehenen lokalen Entwicklungsinfos vollstaendig. */}
        {/* Lang-Attribut am Dokument synchronisieren; ohne kann Browser-/A11y-Sprache vom aktuellen Locale abweichen. */}
        <SetDocumentLang />
        {/* Dokumentensprache aktiv synchronisieren; ohne koennen Browser- und Screenreader-Sprache am falschen Locale haengen bleiben. */}
        {/* Globale Kopfzeile fuer Navigation und Aktionen; ohne fehlt der ueberspannende Dashboard-Rahmen. */}
        <Header /> {/* Kopfzeile einhaengen; ohne fehlen Navigation, Branding und zentrale Dashboard-Aktionen. */}
        {/* Hauptflaeche kapseln; ohne gibt es keinen gemeinsamen Layout-Container fuer Sidebar und Content. */}
        <div className="flex flex-1 min-h-0 flex-col w-full min-h-[50vh] bg-[#0f0f0f]">
          {/* Dunklen Hauptcontainer mit Mindesthoehe rendern; ohne fehlt ein stabiler Layout-Rahmen. */}
          {/* Save-Status im Context halten; ohne koennen untergeordnete Komponenten erfolgreiche Saves nicht global spiegeln. */}
          <SettingsSavedProvider>
            {/* Save-Kontext aktivieren; ohne koennen erfolgreiche Saves nicht global propagiert werden und andere Bereiche bleiben stale. */}
            {/* SettingsDirtyProvider stellt dirtyRef bereit; Settings-Seite setzt sie, Sidebar liest sie für Poll-Skip. */}
            <SettingsDirtyProvider>
              {/* Dirty-Ref fuer Poll-Skip und Settings-Sync bereitstellen; ohne koennen Poll-Reloads ungespeicherte Settings ueberfahren. */}
              {/* Run-Checks-Logs im Context halten; ohne verlieren verschiedene Panels den gemeinsamen Live-Log-Zustand. */}
              <RunChecksLogProvider>
                {/* Gemeinsamen Run-Checks-Logzustand aufspannen; ohne sehen Unterbereiche unterschiedliche oder veraltete Check-Logs. */}
                {/* Drag-and-drop Aenderungen mit Save-Benachrichtigung verknuepfen; ohne bleiben Check-Reorders ohne globales Feedback. */}
                <ShimDndWithNotify>
                  {/* DnD-Wrapper mit Save-Benachrichtigung aktivieren; ohne bleiben Check-Verschiebungen lokal und andere UI-Teile erfahren nichts davon. */}
                  {/* Seiteninhalt in das gemeinsame Dashboard-Layout rendern; ohne wuerde die Route keinen sichtbaren Hauptinhalt ausgeben. */}
                  <LayoutContent>{children}</LayoutContent>
                  {/* Konkreten Routeninhalt in den Dashboard-Rahmen einsetzen; ohne bleibt nur die Shell sichtbar und die eigentliche Seite fehlt. */}
                </ShimDndWithNotify>
              </RunChecksLogProvider>
            </SettingsDirtyProvider>
          </SettingsSavedProvider>
        </div>
      </ClientLocaleProvider>
    );
  } catch (e) {
    // Fehlerpfad fuer Renderprobleme des gesamten Layout-Baums; ohne endet ein Laufzeitfehler in einer kaputten Route.
    console.error("LocaleLayout render failed:", e); // Renderfehler explizit loggen; ohne bleibt ein Produktionsfehler im Layout deutlich schlechter diagnostizierbar.
    const fallbackTitle = locale === "de" ? "Dashboard fehlt" : "Dashboard missing"; // Lokalisierte Fallback-Ueberschrift waehlen; ohne wirkt der Error-Screen sprachlich inkonsistent und bricht den i18n-Eindruck.
    const fallbackGeneric = locale === "de" ? "Unbekannter Fehler" : "Unknown error"; // Lokalisierte Generik fuer non-Error-Werte liefern; ohne sieht der Nutzer im Fehlerfall rohe oder leere Ersatztexte.
    return (
      // Minimalen Fallback-Screen fuer den Fehlerfall zurueckgeben; ohne bleibt nur ein harter Renderabbruch.
      // Minimalen Error-Screen rendern; ohne endet ein Renderfehler nur in einer leeren oder kaputten Seite.
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] text-white p-4">
        {/* Fallback-Screen vollflaechig zentrieren; ohne wirkt ein Renderfehler wie ein kaputtes Layoutfragment. */}
        {/* Titel des Fallback-Screens anzeigen; ohne fehlt die sofort sichtbare Fehlererklaerung. */}
        <h1 className="text-xl font-semibold mb-2">{fallbackTitle}</h1>
        {/* Sichtbare Fehler-Ueberschrift ausgeben; ohne muss der Nutzer selbst erraten, dass das Layout komplett fehlgeschlagen ist. */}
        {/* Fehlertext oder generische Meldung ausgeben; ohne hat der Nutzer keinen Hinweis, warum das Layout nicht geladen wurde. */}
        <p className="text-neutral-400 text-sm">{e instanceof Error ? e.message : fallbackGeneric}</p>
        {/* Konkrete oder generische Fehlerursache anzeigen; ohne fehlt jede direkte Rueckmeldung zum Ausfallgrund. */}
      </div>
    );
  }
}
