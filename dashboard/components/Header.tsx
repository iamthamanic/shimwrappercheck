/**
 * Header: "shimwrappercheck" zentriert; rechts Schalter [myshim | Settings].
 * myshim = Ansicht My Shim + Check Library, Settings = Templates & Information.
 * Location: /components/Header.tsx
 */
"use client";

import { useContext } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { IconSettings } from "@/components/Icons";
import { LocaleContext } from "@/components/ClientLocaleProvider";

/**
 * Header: Rendert die obere Dashboard-Leiste mit App-Titel, Locale-Umschalter und Navigation.
 * Zweck: Nutzer sollen jederzeit zwischen Hauptansicht und Settings wechseln und die Sprache umstellen koennen.
 * Problem: Ohne Header fehlen globale Orientierung, Navigation und der sichtbare Locale-Switch im Dashboard.
 * Eingabe: keine direkten Props. Ausgabe: React-Knoten fuer die Kopfzeile.
 */
export default function Header() {
  const t = useTranslations("common"); // Gemeinsame Header-Texte laden; ohne bleiben App-Name und Navigationslabels unlokalisiert.
  const tHeader = useTranslations("header"); // Header-spezifische Texte separat laden; ohne fehlt z. B. die a11y-Beschriftung fuer Settings.
  const pathname = usePathname(); // Aktuellen Pfad lesen; ohne kann die Navigation den aktiven Tab nicht hervorheben.
  const isSettings = pathname === "/settings"; // Settings-Ansicht fuer den Toggle-Zustand erkennen; ohne bleibt die rechte Navigation optisch unscharf.

  return (
    <header className="h-14 border-b border-white/20 flex items-center justify-between px-6 bg-[#0f0f0f] shrink-0">
      {" "}
      {/* Gesamtcontainer der Kopfzeile rendern; ohne fehlen Positionierung und Styling des Headers komplett. */}
      {/* Kopfzeile als feste obere Leiste rendern; ohne fehlt dem Dashboard der globale Rahmen. */}
      <div className="w-24 flex items-center gap-2" aria-hidden>
        {" "}
        {/* Linke Breitenreserve fuer den Sprachschalter halten; ohne verschiebt sich die mittige Titelachse. */}
        {/* Linke Spalte fuer den Locale-Switch reservieren; ohne springt das Zentrieren des Titels. */}
        <LocaleSwitcher />
        {/* Sprachumschalter sichtbar in der Header-Leiste rendern; ohne kann der Nutzer die Sprache nicht direkt wechseln. */}
      </div>
      <div className="flex-1 flex justify-center pointer-events-none">
        {" "}
        {/* Mittelflaeche fuer den zentrierten Titel reservieren; ohne kollidiert der Titel leichter mit den Seitensektionen. */}
        {/* Mittlere Spalte fuer den Titel zentrieren; ohne driftet der App-Name bei unterschiedlicher Seitenbreite. */}
        <span className="text-xl font-semibold text-white">{t("appName")}</span>
        {/* Lokalisieren App-Namen ausgeben; ohne fehlt die zentrale Identitaet der Seite. */}
      </div>
      <div className="flex items-center gap-0 rounded overflow-hidden border border-white/80">
        {" "}
        {/* Rechte Navigation als optisch zusammenhaengende Segmentgruppe halten; ohne sehen die Links nicht wie ein Umschalter aus. */}
        {/* Rechte Navigationsgruppe als zusammenhaengenden Toggle rendern; ohne wirken die Header-Links lose verteilt. */}
        <Link
          href="/" // Linkziel zur Hauptansicht setzen; ohne fuehrt der linke Segmentbutton nirgends hin.
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            !isSettings ? "bg-white text-black" : "text-white hover:bg-white/10"
          }`} // Aktive Hauptansicht optisch hervorheben; ohne fehlt klares Feedback, welche Seite offen ist.
        >
          {t("myshim")} {/* Linklabel fuer die Hauptansicht rendern; ohne ist der Navigationseintrag nicht lesbar. */}
        </Link>
        <Link
          href="/settings" // Linkziel zur Settings-Seite setzen; ohne ist der rechte Segmentbutton funktionslos.
          className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
            isSettings ? "bg-white text-black" : "text-white hover:bg-white/10"
          }`} // Settings-Link samt aktivem/inaktivem Zustand stylen; ohne fehlt die visuelle Toggle-Logik.
          aria-label={tHeader("settingsAria")} // Screenreader-Beschriftung fuer den Settings-Link liefern; ohne ist die Bedeutung des Icon-/Textmixes schlechter zugreifbar.
        >
          <IconSettings />
          {/* Settings-Icon als visuelle Hilfe vor dem Label zeigen; ohne ist der Eintrag weniger schnell erfassbar. */}
          {t("settings")} {/* Lokalisierte Settings-Beschriftung rendern; ohne bleibt der rechte Nav-Eintrag unklar. */}
        </Link>
      </div>
    </header>
  );
}

/**
 * LocaleSwitcher: Schaltet zwischen deutscher und englischer UI-Sprache um.
 * Zweck: Nutzer sollen die Dashboard-Sprache ohne Seitenwechsel direkt in der Kopfzeile aendern koennen.
 * Problem: Ohne diesen Schalter ist die sprachliche Umschaltung im UI schwer oder gar nicht erreichbar.
 * Eingabe: keine direkten Props; liest `LocaleContext`. Ausgabe: React-Knoten fuer die Sprachbuttons.
 */
function LocaleSwitcher() {
  const { locale, setLocale } = useContext(LocaleContext); // Aktuelle Sprache und Setter aus dem Context lesen; ohne kann der Switch weder Zustand anzeigen noch umschalten.
  const activeClass = "px-2 py-1 bg-white text-black font-medium"; // Gemeinsame Klasse fuer die aktive Sprache definieren; ohne wiederholt sich dieselbe Stilregel mehrfach.
  const inactiveClass = "px-2 py-1 bg-white/10 hover:bg-white/20 text-white"; // Gemeinsame Klasse fuer inaktive Sprachen definieren; ohne duplizieren wir die inaktive Button-Optik.
  /**
   * switchToGerman: Aktiviert die deutsche Sprache im Locale-Context.
   * Zweck: Benannten Handler statt anonymem JSX-Callback bereitstellen.
   * Problem: Ohne Helper bleibt die Sprachumschaltung als schwerer kommentierbarer Inline-Handler im Markup.
   * Eingabe: keine. Ausgabe: kein Rueckgabewert.
   */
  const switchToGerman = () => {
    setLocale("de"); // Locale explizit auf Deutsch setzen; ohne reagiert der DE-Button nicht.
  };
  /**
   * switchToEnglish: Aktiviert die englische Sprache im Locale-Context.
   * Zweck: Zweiten Sprachpfad explizit benennen und dokumentieren.
   * Problem: Ohne Helper bleibt auch dieser Pfad nur ein anonymer JSX-Handler.
   * Eingabe: keine. Ausgabe: kein Rueckgabewert.
   */
  const switchToEnglish = () => {
    setLocale("en"); // Locale explizit auf Englisch setzen; ohne reagiert der EN-Button nicht.
  };
  return (
    // Sprachumschalter-UI an den Header zurueckgeben; ohne bleibt die Locale-Funktion trotz Context unsichtbar.
    <div
      className="flex rounded overflow-hidden border border-white/50 text-xs" // Gemeinsames Styling fuer die Sprachbutton-Gruppe setzen; ohne wirken die Buttons nicht wie ein Schalterpaar.
      role="group" // Buttons als zusammengehoerige Kontrollgruppe auszeichnen; ohne verlieren Screenreader den Gruppenbezug.
      aria-label="Sprache wählen" // Gruppe fuer assistive Technologien benennen; ohne bleibt der Zweck der zwei Buttons undeutlich.
    >
      {/* Zwei Sprachbuttons als zusammengehoerige Gruppe rendern; ohne fehlt Screenreadern die Gruppensemantik. */}
      <button
        type="button" // Klarmachen, dass der Button keine Formular-Submission ausloest; ohne koennte eingebettete Form-Umgebung Nebenwirkungen haben.
        onClick={switchToGerman} // Beim Klick Deutsch als aktive Locale setzen; ohne reagiert der DE-Button nicht auf Nutzerinteraktion.
        className={locale === "de" ? activeClass : inactiveClass} // Aktive Sprache optisch hervorheben; ohne ist der aktuelle Locale-Zustand nicht erkennbar.
        aria-pressed={locale === "de"} // Aktiven Zustand fuer assistive Technologien abbilden; ohne fehlt Rueckmeldung zur ausgewaehlten Sprache.
        aria-label="Deutsch" // Eindeutige Sprachbezeichnung fuer Screenreader liefern; ohne ist `DE` als Abkuerzung weniger klar.
      >
        DE {/* Kurzes sichtbares Label fuer Deutsch rendern; ohne bleibt der Button leer. */}
      </button>
      <button
        type="button" // Auch den EN-Schalter explizit als normalen Button markieren; ohne gelten dieselben Formular-Risiken.
        onClick={switchToEnglish} // Beim Klick Englisch als aktive Locale setzen; ohne reagiert der EN-Button nicht auf Nutzerinteraktion.
        className={locale === "en" ? activeClass : inactiveClass} // Aktiven/inaktiven Zustand fuer Englisch sichtbar machen; ohne fehlt die Rueckmeldung zur Sprachwahl.
        aria-pressed={locale === "en"} // Aktiven Zustand fuer Englisch an Screenreader weitergeben; ohne fehlt die ausgewaehlte Sprachinformation.
        aria-label="English" // Voll ausgeschriebene englische Sprachbezeichnung fuer Barrierefreiheit liefern; ohne bleibt `EN` kuerzelhaft.
      >
        EN {/* Kurzes sichtbares Label fuer Englisch rendern; ohne bleibt auch dieser Button leer. */}
      </button>
    </div>
  );
}
