/**
 * Left sidebar "My Shim": My Trigger Commandos + My Checks (Referenz-Layout mit Zeitstempel, Tabs, Karten).
 * Location: /components/SidebarMyShim.tsx
 */
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { SettingsData, CheckToggles } from "@/lib/presets";
import { IconSettings, IconCheck, IconCross } from "@/components/Icons";
import TriggerCommandos from "@/components/TriggerCommandos";
import MyShimChecks from "@/components/MyShimChecks";
import { useSettingsSavedRef } from "@/components/SettingsSavedContext";

export type EnforceHooksTab = "enforce" | "hooks";

/**
 * SidebarMyShim: Rendert die linke My-Shim-Sidebar mit Shim-Mode, Trigger-Commandos und aktiven Checks.
 * Zweck: Nutzer sollen den aktuell aktiven Preset-Zustand sehen und direkt aus der Sidebar speichern, filtern und umsortieren koennen.
 * Problem: Ohne diese Komponente gibt es keine zentrale Uebersicht fuer aktive Shim-Einstellungen im Dashboard.
 * Eingabe: keine direkten Props. Ausgabe: React-Knoten fuer die komplette Sidebar.
 */
export default function SidebarMyShim() {
  const tSidebar = useTranslations("sidebar");
  const tCommon = useTranslations("common");
  const savedRef = useSettingsSavedRef();
  const [settings, setSettings] = useState<SettingsData | null>(null); // Geladene Settings im Sidebar-State halten; ohne kann die UI weder rendern noch lokale Saves spiegeln.
  const [triggerCommandosLastUpdated, setTriggerCommandosLastUpdated] = useState<Date | null>(null); // Zeitstempel fuer Trigger-Commandos merken; ohne fehlt sichtbares Freshness-Feedback.
  const [myChecksLastUpdated, setMyChecksLastUpdated] = useState<Date | null>(null); // Zeitstempel fuer My-Checks merken; ohne kann die Sidebar Aenderungen nicht zeitlich kennzeichnen.
  const [roleTab, setRoleTab] = useState<EnforceHooksTab>("enforce"); // Aktiven Rollen-Tab halten; ohne lassen sich Enforce- und Hook-Ansicht nicht umschalten.
  const [tagFilter, setTagFilter] = useState<"all" | "frontend" | "backend">("all"); // Aktiven Tag-Filter halten; ohne kann die Check-Liste nicht nach Frontend/Backend gefiltert werden.
  const sidebarRef = useRef<HTMLDivElement>(null); // DOM-Ref fuer native Dragover/Drop-Events behalten; ohne koennen wir den Sidebar-Drop nicht direkt verdrahten.
  const settingsRef = useRef<SettingsData | null>(settings); // Aktuellsten Settings-Stand fuer Event-Handler ausserhalb des Render-Zyklus bereithalten; ohne arbeiten Drop-Handler leichter mit stale State.
  settingsRef.current = settings; // Ref bei jedem Render synchron halten; ohne sieht der Drop-Handler evtl. einen veralteten Settings-Snapshot.

  /**
   * load: Laedt die Sidebar-Settings vom Backend und optional einen Anschluss-Callback nach erfolgreichem Abschluss.
   * Zweck: Sidebar soll immer den serverseitigen Zustand spiegeln und nach Saves/Events gezielt neu laden koennen.
   * Problem: Ohne diese zentrale Ladefunktion waeren Event-Reaktionen und Initial-Load dupliziert und inkonsistent.
   * Eingabe: optional `onFulfilled`. Ausgabe: kein Promise-Rueckgabewert, sondern asynchroner State-Update-Flow.
   */
  const load = useCallback((onFulfilled?: () => void) => {
    const ac = new AbortController(); // Eigenen AbortController anlegen; ohne laesst sich ein haengender Settings-Request nicht abbrechen.
    const timeoutId = setTimeout(() => ac.abort(), 8000); // Request-Hard-Timeout setzen; ohne kann die Sidebar bei Netzwerkhaengern zu lange im unklaren Zustand bleiben.
    fetch("/api/settings", { signal: ac.signal }) // Aktuellen Settings-Stand vom Backend holen; ohne arbeitet die Sidebar auf moeglich veralteten Daten.
      .then((r) => r.json()) // JSON-Nutzlast aus der API-Antwort lesen; ohne kann der State nicht aktualisiert werden.
      .then((data) => {
        if (data && Array.isArray(data.presets) && data.checkToggles && typeof data.activePresetId === "string") {
          setSettings(data as SettingsData); // Nur valide Settings in den Sidebar-State uebernehmen; ohne kann kaputte API-Struktur spaeter die UI sprengen.
          if (data.presetsLastUpdated) {
            const t = new Date(data.presetsLastUpdated); // Serverzeitpunkt in ein Date-Objekt umwandeln; ohne laesst sich der Zeitstempel nicht vernuenftig anzeigen.
            if (!isNaN(t.getTime())) {
              setTriggerCommandosLastUpdated(t); // Trigger-Commandos-Zeitstempel synchronisieren; ohne bleibt dort altes Freshness-Feedback stehen.
              setMyChecksLastUpdated(t); // My-Checks-Zeitstempel ebenfalls angleichen; ohne weichen die beiden Sidebar-Bloecke zeitlich auseinander.
            }
          }
        } else {
          setSettings(null); // Ungueltige Payload aktiv als "keine Settings" markieren; ohne bleibt evtl. alter State sichtbar.
        }
        onFulfilled?.(); // Optionalen Anschluss-Callback erst nach verarbeitetem Load ausfuehren; ohne koennen Folgeschritte vor dem State-Update laufen.
      })
      .catch(() => setSettings(null)) // Fehlerfall explizit auf leeren State setzen; ohne haelt die Sidebar einen moeglicherweise falschen Altzustand.
      .finally(() => clearTimeout(timeoutId)); // Timeout immer aufraeumen; ohne sammelt jeder Load einen haengenden Timer an.
  }, []);

  /**
   * useEffect(settings-updated): Laedt initial und reagiert auf globale Settings-Updates.
   * Zweck: Sidebar soll sowohl beim Mount als auch nach externen Saves automatisch nachziehen.
   * Problem: Ohne diesen Effekt bleibt die Sidebar nach initialem Render oder Fremd-Save stale.
   * Eingabe: keine direkten Eingaben; nutzt `load`. Ausgabe: Cleanup fuer den Event-Listener.
   */
  useEffect(() => {
    load(); // Initialen Sidebar-Load sofort anstossen; ohne bleibt die Sidebar bis zum ersten Event leer.
    const handler = () => load(); // Event-Handler klein kapseln; ohne kann derselbe Listener nicht sauber registriert und entfernt werden.
    window.addEventListener("settings-updated", handler); // Globale Settings-Aenderungen abonnieren; ohne aktualisiert sich die Sidebar nach externen Saves nicht.
    return () => window.removeEventListener("settings-updated", handler); // Listener beim Unmount entfernen; ohne bleiben doppelte Handler und Memory-Leaks zurueck.
  }, [load]);

  /**
   * useEffect(trigger-commandos-saved): Aktualisiert den Zeitstempel, wenn Trigger-Commandos gespeichert wurden.
   * Zweck: Sidebar soll unmittelbar zeigen, dass ein Save stattgefunden hat.
   * Problem: Ohne diesen Listener bleibt der Trigger-Commandos-Bereich trotz Save optisch unveraendert.
   * Eingabe: keine direkten Eingaben. Ausgabe: Cleanup fuer den Listener.
   */
  useEffect(() => {
    const onTriggerCommandosSaved = () => setTriggerCommandosLastUpdated(new Date()); // Frischen Zeitstempel bei Save-Ereignis setzen; ohne fehlt unmittelbares Feedback.
    window.addEventListener("trigger-commandos-saved", onTriggerCommandosSaved); // Globales Save-Event abonnieren; ohne erreicht die Sidebar der Save nicht.
    return () => window.removeEventListener("trigger-commandos-saved", onTriggerCommandosSaved); // Listener wieder abbauen; ohne bleiben verwaiste Event-Reaktionen bestehen.
  }, []);

  /**
   * useEffect(my-checks-saved): Aktualisiert Zeitstempel und aktiviert bei neuen Checks gezielt die frisch hinzugefuegte Karte.
   * Zweck: Nach Check-Saves soll die Sidebar synchron bleiben und neue Checks koennen visuell fokussiert werden.
   * Problem: Ohne diesen Listener fuehlt sich Add/Reorder in der Sidebar unsynchron und unklar an.
   * Eingabe: keine direkten Eingaben; liest Event-Detail und `load`. Ausgabe: Cleanup fuer den Listener.
   */
  useEffect(() => {
    const onMyChecksSaved = (e: Event) => {
      const addedCheckId = (e as CustomEvent<{ addedCheckId?: string }>).detail?.addedCheckId ?? null; // Optional die neu hinzugefuegte Check-ID auslesen; ohne kann spaeter kein gezieltes Aktivieren erfolgen.
      setMyChecksLastUpdated(new Date()); // Bereich sofort als frisch gespeichert markieren; ohne bleibt der alte Zeitstempel sichtbar.
      if (addedCheckId) {
        load(() => {
          if (typeof window !== "undefined") {
            requestAnimationFrame(() => {
              window.dispatchEvent(new CustomEvent("check-activated", { detail: { checkId: addedCheckId } })); // Aktivierungs-Event erst nach dem Reload schicken; ohne kann die Zielkarte im DOM noch fehlen.
            });
          }
        });
      }
    };
    window.addEventListener("my-checks-saved", onMyChecksSaved);
    return () => window.removeEventListener("my-checks-saved", onMyChecksSaved);
  }, [load]);

  /**
   * useEffect(savedRef): Exponiert die Sidebar-Reload-Funktion fuer andere Komponenten ueber den Saved-Context.
   * Zweck: Externe Save-Aktionen koennen die Sidebar gezielt nachladen.
   * Problem: Ohne diesen Ref-Hook muss jede save-ausloesende Komponente die Sidebar direkt kennen.
   * Eingabe: keine direkten Eingaben; nutzt `savedRef` und `load`. Ausgabe: Cleanup, das die Ref wieder leert.
   */
  useEffect(() => {
    savedRef.current = () => load(); // Reload-Funktion in den Context-Ref schreiben; ohne koennen externe Saves die Sidebar nicht nachladen.
    return () => {
      savedRef.current = null; // Ref beim Unmount leeren; ohne zeigt der Context auf eine tote Komponente.
    };
  }, [savedRef, load]);

  /**
   * saveSettingsForTriggerCommandos: Persistiert Settings-Aenderungen aus dem Trigger-Commandos-Bereich.
   * Zweck: Trigger-Commandos sollen sofort lokal sichtbar sein und anschliessend serverseitig gespeichert werden.
   * Problem: Ohne diesen Save-Pfad bleiben Trigger-Commando-Aenderungen entweder nur lokal oder gehen ganz verloren.
   * Eingabe: `next` als kompletter naechster Settings-Stand. Ausgabe: kein Rueckgabewert, sondern asynchroner Persist-Flow.
   */
  const saveSettingsForTriggerCommandos = useCallback((next: SettingsData) => {
    setSettings(next); // Optimistischen lokalen State sofort uebernehmen; ohne fuehlt sich der Save traege und inkonsistent an.
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("settings-updated")); // Globales Reload-Event feuern; ohne bleiben andere Settings-Konsumenten stale.
          window.dispatchEvent(new CustomEvent("trigger-commandos-saved")); // Eigenes Save-Event fuer Zeitstempel und UI-Reaktionen senden; ohne fehlt Trigger-Feedback.
        }
      })
      .catch((err) => {
        console.warn(
          "SidebarMyShim: save trigger commandos failed",
          err instanceof Error ? err.message : "Unknown error"
        );
      });
  }, []);

  /**
   * saveSettingsForMyChecks: Persistiert Aenderungen aus dem My-Checks-Bereich.
   * Zweck: Aktivierte, deaktivierte oder umsortierte Checks sollen dauerhaft gespeichert und global synchronisiert werden.
   * Problem: Ohne diesen Save-Pfad bleiben Check-Aenderungen auf die lokale Sidebar beschraenkt.
   * Eingabe: `next` als kompletter naechster Settings-Stand. Ausgabe: kein Rueckgabewert.
   */
  const saveSettingsForMyChecks = useCallback((next: SettingsData) => {
    setSettings(next); // Lokalen Sidebar-State sofort auf den neuen Stand ziehen; ohne wirkt der Save bis zur Serverantwort verzögert.
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then(() => {
        setMyChecksLastUpdated(new Date()); // Frischen Save-Zeitstempel setzen; ohne bleibt die My-Checks-Sektion optisch alt.
        if (typeof window !== "undefined") window.dispatchEvent(new Event("settings-updated")); // Globales Reload-Signal senden; ohne bleiben andere Settings-Ansichten stale.
      })
      .catch((err) => {
        console.warn(
          "SidebarMyShim: save settings for My Checks failed",
          err instanceof Error ? err.message : "Unknown error"
        );
      });
  }, []);

  /**
   * saveSettingsForShimMode: Speichert das Ein- oder Ausschalten des Shim-Mode.
   * Zweck: Die Checks/No-checks-Umschaltung soll serverseitig persistent sein.
   * Problem: Ohne diese Funktion wuerde die Toggle-Leiste nur die lokale UI veraendern.
   * Eingabe: `next` als kompletter naechster Settings-Stand. Ausgabe: kein Rueckgabewert.
   */
  const saveSettingsForShimMode = useCallback((next: SettingsData) => {
    setSettings(next); // Toggle-Zustand optimistisch lokal uebernehmen; ohne springt die UI erst nach der POST-Antwort um.
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then(() => {
        if (typeof window !== "undefined") window.dispatchEvent(new Event("settings-updated")); // Andere Settings-Konsumenten informieren; ohne sehen sie den geaenderten Shim-Mode nicht.
      })
      .catch((err) => {
        console.warn("SidebarMyShim: save shim mode failed", err instanceof Error ? err.message : "Unknown error");
      });
  }, []);

  const activePreset = settings?.presets?.find((p) => p.id === settings.activePresetId); // Aktives Preset fuer Badge und Titelbereich bestimmen; ohne weiss die Sidebar nicht, welches Preset laeuft.
  const shimEnabled = settings?.shimEnabled !== false; // Defaultmaessig aktiv interpretieren, ausser explizit false; ohne kippt das Toggle bei fehlendem Wert unnoetig auf aus.

  /**
   * useEffect(native sidebar drop): Ermoeglicht native Drop-Operationen auf die Sidebar ausserhalb der dnd-kit-Zwischenslots.
   * Zweck: Checks sollen auch ueber den gesamten Sidebar-Container aktiviert werden koennen.
   * Problem: Ohne diesen nativen Fallback funktioniert Droppen ausserhalb konkreter Slot-Ziele nicht robust.
   * Eingabe: keine direkten Eingaben; nutzt `sidebarRef`, `settingsRef` und `saveSettingsForMyChecks`. Ausgabe: Cleanup fuer native DOM-Listener.
   */
  useEffect(() => {
    const el = sidebarRef.current; // Aktuelles Sidebar-Element aus der Ref holen; ohne koennen keine nativen Listener registriert werden.
    if (!el) return; // Ohne DOM-Element keinen Listener setzen; ohne wuerde der Effekt auf null crashen.
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault(); // Default-Drop-Verhalten unterbinden; ohne akzeptiert der Browser den Drop hier nicht sauber.
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; // Move-Effekt signalisieren; ohne fehlt dem Nutzer visuelles Drag-Feedback.
      // do not stopPropagation so MyShimChecks drop slots can receive dragOver and show indicator
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault(); // Browser-Default auch beim Drop blockieren; ohne kann der Browser fremde Daten anders verarbeiten.
      e.stopPropagation(); // Event lokal halten; ohne koennen uebergeordnete Drop-Ziele denselben Drop doppelt verarbeiten.
      if ((e.target as Node) && (e.target as Element).closest?.("[data-my-checks-list]")) return; // Drops in der eigentlichen Liste den feineren Slot-Handlern ueberlassen; ohne kollidiert der Sidebar-Fallback mit der Listenlogik.
      const dt = e.dataTransfer; // Drag-Payload aus dem nativen Event lesen; ohne kommen wir nicht an die gezogene Check-ID.
      if (!dt) return; // Ohne DataTransfer gibt es keinen verwertbaren Drop-Inhalt; ohne waeren weitere Zugriffe unsicher.
      const id = dt.getData("text/plain") || dt.getData("checkId"); // Check-ID aus bekannten Payload-Feldern holen; ohne scheitern unterschiedliche Drag-Quellen.
      const checkId = (id || "").trim(); // Payload defensiv trimmen; ohne fuehren Leerzeichen zu falschen IDs.
      if (!checkId) return; // Leere IDs nicht weiterverarbeiten; ohne koennte ein leerer Drop den State unnoetig anfassen.
      const apply = (base: SettingsData) => {
        const order = base.checkOrder ?? []; // Bestehende Check-Reihenfolge normalisieren; ohne muss jeder Zugriff null/undefined absichern.
        if (order.includes(checkId)) return; // Bereits aktive Checks nicht doppelt einfuegen; ohne entstehen Dubletten in der Reihenfolge.
        const nextToggles = { ...base.checkToggles } as Record<string, boolean>; // Toggle-Kopie statt Mutation erzeugen; ohne wird der alte State direkt veraendert.
        nextToggles[checkId] = true; // Gedroppten Check aktiv markieren; ohne taucht er zwar in der Order auf, bleibt logisch aber aus.
        saveSettingsForMyChecks({
          ...base,
          checkOrder: [...order, checkId], // Check am Listenende anfuegen; ohne landet der Drop nicht sichtbar in My Checks.
          checkToggles: nextToggles as unknown as CheckToggles, // Neue Toggle-Struktur mitgeben; ohne geht die Aktivierung beim Persistieren verloren.
        });
      };
      const base = settingsRef.current; // Aktuellsten Settings-Snapshot aus der Ref lesen; ohne arbeitet der Drop mit stale Render-Daten.
      if (base?.presets?.length) {
        apply(base); // Lokalen Snapshot direkt nutzen, wenn er brauchbar ist; ohne wird jeder Drop unnoetig langsam.
      } else {
        fetch("/api/settings") // Fallback: frischen Serverstand holen, wenn lokal noch keine Settings vorliegen; ohne scheitert fruehes Droppen nach dem Mount.
          .then((r) => r.json()) // Fallback-Antwort als JSON lesen; ohne kann `apply` keinen serverseitigen Stand erhalten.
          .then((data) => {
            if (data?.presets?.length) apply(data); // Nur valide Fallback-Settings uebernehmen; ohne koennte kaputte Payload gespeichert werden.
          })
          .catch((err) => {
            console.warn(
              "SidebarMyShim: fetch settings for drop fallback failed",
              err instanceof Error ? err.message : "Unknown error"
            );
          });
      }
    };
    el.addEventListener("dragover", handleDragOver, false); // Dragover-Listener auf das Sidebar-Element setzen; ohne ist der native Drop nicht aktiv.
    el.addEventListener("drop", handleDrop, false); // Drop-Listener registrieren; ohne geht der eigentliche Sidebar-Drop verloren.
    return () => {
      el.removeEventListener("dragover", handleDragOver); // Dragover-Listener wieder entfernen; ohne bleiben Listener nach Unmount haengen.
      el.removeEventListener("drop", handleDrop); // Drop-Listener ebenfalls abbauen; ohne drohen doppelte Reaktionen bei Remounts.
    };
  }, [saveSettingsForMyChecks]);

  /**
   * enableShimChecksMode: Schaltet den Shim-Mode auf "Checks aktiv", wenn Settings geladen sind.
   * Zweck: Die linke Toggle-Haelfte soll ohne anonyme JSX-Callback-Funktion den Aktiv-Modus speichern koennen.
   * Problem: Ohne Helper steckt die Save-Logik unkommentiert direkt im JSX und wird vom Explanation-Check abgewertet.
   * Eingabe: keine. Ausgabe: kein Rueckgabewert.
   */
  const enableShimChecksMode = () => {
    if (!shimEnabled && settings) saveSettingsForShimMode({ ...settings, shimEnabled: true }); // Nur von "aus" auf "an" speichern; ohne entstehen unnoetige POSTs beim erneuten Klick auf aktiv.
  };

  /**
   * enableShimNoChecksMode: Schaltet den Shim-Mode auf "keine Checks", wenn Settings geladen sind.
   * Zweck: Die rechte Toggle-Haelfte soll den Deaktivierungszustand ohne anonyme JSX-Funktion speichern.
   * Problem: Ohne Helper bleibt die komplette Toggle-Logik inline im JSX verborgen.
   * Eingabe: keine. Ausgabe: kein Rueckgabewert.
   */
  const enableShimNoChecksMode = () => {
    if (shimEnabled && settings) saveSettingsForShimMode({ ...settings, shimEnabled: false }); // Nur von "an" auf "aus" speichern; ohne senden wir redundante No-op-Requests.
  };

  /**
   * showEnforceTab: Aktiviert den Enforce-Tab der Sidebar.
   * Zweck: Rollenumschaltung explizit benennen und aus dem JSX herausziehen.
   * Problem: Ohne Helper bleibt ein anonymer State-Setter im Markup, der schlechter dokumentierbar ist.
   * Eingabe: keine. Ausgabe: kein Rueckgabewert.
   */
  const showEnforceTab = () => {
    setRoleTab("enforce"); // Rollenfilter auf Enforce setzen; ohne bleibt die linke Tab-Schaltflaeche ohne Wirkung.
  };

  /**
   * showHooksTab: Aktiviert den Hooks-Tab der Sidebar.
   * Zweck: Zweite Rollenumschaltung explizit benennen und dokumentieren.
   * Problem: Ohne Helper waere auch dieser Klickpfad nur ein anonymer JSX-Handler.
   * Eingabe: keine. Ausgabe: kein Rueckgabewert.
   */
  const showHooksTab = () => {
    setRoleTab("hooks"); // Rollenfilter auf Hooks setzen; ohne bleibt die rechte Tab-Schaltflaeche ohne Wirkung.
  };

  /**
   * buildTagFilterOptions: Baut die drei Tag-Filter-Schaltflaechen ohne anonymen map-Callback.
   * Zweck: Filter-Buttons stabil und kommentierbar rendern.
   * Problem: Ohne Helper sind Rendering, Klassenlogik und Klick-Handler als Inline-Map im JSX schwer erklaerbar.
   * Eingabe: keine direkten Parameter; liest `tagFilter`, `tCommon` und `setTagFilter`. Ausgabe: Array aus React-Knoten.
   */
  const buildTagFilterOptions = (): React.ReactNode[] => {
    const nodes: React.ReactNode[] = []; // Ergebnisliste fuer die Tag-Buttons vorbelegen; ohne kann der Helper keine Knoten sammeln.
    for (const tag of ["all", "frontend", "backend"] as const) {
      const handleSelectTag = () => {
        setTagFilter(tag); // Gewaehlten Tag-Filter in den State schreiben; ohne reagiert die Filterleiste nicht auf Klicks.
      };
      nodes.push(
        <button
          key={tag}
          type="button"
          className={`px-2 py-0.5 text-[10px] font-medium rounded ${
            tagFilter === tag ? "bg-white/20 text-white" : "text-white/60 hover:bg-white/10"
          }`} // Aktiven Tag optisch hervorheben; ohne sieht der Nutzer nicht, welcher Filter gerade greift.
          onClick={handleSelectTag} // Tag-Auswahl ueber benannten Handler verdrahten; ohne bleibt wieder ein anonymer Klickpfad im JSX.
        >
          {tag === "all" ? tCommon("all") : tCommon(tag)}{" "}
          {/* Passendes Label pro Tag rendern; ohne waeren die Buttons nicht lesbar. */}
        </button>
      );
    }
    return nodes; // Vollstaendige Button-Liste ans JSX zurueckgeben; ohne kann die Filterleiste nichts rendern.
  };

  const tagFilterButtons = buildTagFilterOptions(); // Tag-Filter-Knoten vor dem JSX berechnen; ohne bleibt die Filter-Mapping-Logik im Markup.

  return (
    <div ref={sidebarRef} className="p-4 space-y-6 flex flex-col min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 shrink-0 min-w-0">
        <h2 className="text-lg font-semibold text-white shrink-0">{tSidebar("myActiveShim")}</h2>
        <div className="flex items-center gap-1 min-w-0">
          {activePreset?.name != null && activePreset.name !== "" && (
            <span
              className="text-xs font-medium bg-violet-600 text-white rounded px-2 py-0.5 truncate min-w-0"
              title={activePreset.name}
            >
              {activePreset.name}
            </span>
          )}
          <Link
            href="/settings"
            className="btn btn-ghost btn-xs btn-square text-white/80 hover:text-white hover:bg-white/10 shrink-0"
            aria-label={tCommon("presetsAndSettings")}
            title={tCommon("presetsAndSettings")}
          >
            <IconSettings />
          </Link>
        </div>
      </div>
      {/* Toggle under My Active Shim: Checks (left) | No checks (right) – writes SHIM_ENABLED to .shimwrappercheckrc */}
      <div className="flex flex-col gap-1.5 shrink-0">
        <div className="flex gap-0 rounded border border-white/30 overflow-hidden shrink-0 w-fit">
          <button
            type="button"
            className={`flex items-center gap-1 py-1 px-2 text-xs font-medium ${shimEnabled ? "bg-green-600 text-white" : "text-white/70 hover:bg-white/5"} ${!settings ? "opacity-70 cursor-not-allowed" : ""}`}
            disabled={!settings}
            onClick={enableShimChecksMode}
          >
            <IconCheck className="w-3.5 h-3.5 shrink-0" />
            {tSidebar("shimModeChecks")}
          </button>
          <button
            type="button"
            className={`flex items-center gap-1 py-1 px-2 text-xs font-medium ${!shimEnabled ? "bg-red-950/80 text-red-300 border border-red-800/60" : "text-white/70 hover:bg-white/5"} ${!settings ? "opacity-70 cursor-not-allowed" : ""}`}
            disabled={!settings}
            onClick={enableShimNoChecksMode}
          >
            <IconCross className="w-3.5 h-3.5 shrink-0" />
            {tSidebar("shimModeNoChecks")}
          </button>
        </div>
        {!shimEnabled && (
          <p className="text-[11px] text-white/60" role="status">
            {tSidebar("shimNoChecksNotice")}
          </p>
        )}
      </div>
      {/* Tabs: Enforce | Hooks – filtert Trigger Commandos + My Checks nach Rolle */}
      <div className="flex gap-0 rounded border border-white/30 overflow-hidden shrink-0">
        <button
          type="button"
          className={`flex-1 py-1.5 px-2 text-xs font-medium ${roleTab === "enforce" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
          onClick={showEnforceTab}
        >
          {tCommon("enforce")}
        </button>
        <button
          type="button"
          className={`flex-1 py-1.5 px-2 text-xs font-medium ${roleTab === "hooks" ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/5"}`}
          onClick={showHooksTab}
        >
          {tCommon("hooks")}
        </button>
      </div>
      {/* Optional: Tag-Filter für My Checks (Alle | Frontend | Backend) */}
      <div className="flex gap-1 flex-wrap shrink-0">{tagFilterButtons}</div>
      <section className="shrink-0">
        <TriggerCommandos
          settings={settings}
          onSave={saveSettingsForTriggerCommandos}
          lastUpdated={triggerCommandosLastUpdated}
          tab={roleTab}
          hideTabs
        />
      </section>
      <section
        className={`flex flex-col min-h-0 flex-1 transition-opacity ${!shimEnabled ? "opacity-40 pointer-events-none" : ""}`}
      >
        <div className="min-h-[200px] overflow-y-auto">
          <MyShimChecks
            key={`my-checks-${roleTab}`}
            settings={settings}
            onSave={saveSettingsForMyChecks}
            lastUpdated={myChecksLastUpdated}
            roleFilter={roleTab === "hooks" ? "hook" : "enforce"}
            tagFilter={tagFilter === "all" ? null : tagFilter}
          />
        </div>
      </section>
    </div>
  );
}
