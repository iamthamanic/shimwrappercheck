/**
 * Settings page: Tabs "Templates" (Presets, Befehle, Checks) und "Information" (Port, Version, Status, Aktionen).
 * Location: app/settings/page.tsx
 */
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { SettingsData, Preset, ProviderId } from "@/lib/presets";
import { DEFAULT_VIBE_CODE_PRESET, SUPABASE_COMMAND_IDS } from "@/lib/presets";
import StatusCard from "@/components/StatusCard";
import TriggerCommandos from "@/components/TriggerCommandos";
import MyShimChecks from "@/components/MyShimChecks";
import AvailableChecks from "@/components/AvailableChecks";
import { useRunChecksLog } from "@/components/RunChecksLogContext";
import { CHECK_DEFINITIONS } from "@/lib/checks";

type SettingsTab = "templates" | "information" | "reviews";

type Status = {
  projectRoot?: string;
  config?: boolean;
  presetsFile?: boolean;
  agentsMd?: boolean;
  runChecksScript?: boolean;
  shimRunner?: boolean;
  prePushHusky?: boolean;
  prePushGit?: boolean;
  supabase?: boolean;
  lastError?: { check?: string; message?: string; suggestion?: string; timestamp?: string } | null;
};

/**
 * SettingsPage: Verwaltet Presets, Trigger-Commandos, Checks, Reviews und Statusinformationen der Dashboard-Einstellungen.
 * Zweck: Nutzer sollen die komplette Shim-Konfiguration, Check-Auswahl und Hilfsinformationen an einer Stelle bearbeiten koennen.
 * Problem: Ohne diese Seite gaebe es keine zentrale UI fuer Presets, Review-Einstellungen, Status und das Starten von Checks.
 * Eingabe: keine direkten Props. Ausgabe: React-Knoten fuer die gesamte Settings-Ansicht.
 */
export default function SettingsPage() {
  const t = useTranslations("common"); // Gemeinsame UI-Texte fuer Buttons, Tabs und Labels laden; ohne bleiben Standardbegriffe unlokalisiert.
  const tSettings = useTranslations("settings"); // Settings-spezifische Texte separat laden; ohne fehlen die Seiten- und Fehlermeldungen.
  const tStatus = useTranslations("statusCard"); // Status-Card-Texte isoliert laden; ohne bleiben die Statuslabels sprachlich inkonsistent.
  const [tab, setTab] = useState<SettingsTab>("templates"); // Aktiven Haupttab merken; ohne kann die Seite nicht zwischen Templates, Information und Reviews umschalten.
  const [settings, setSettings] = useState<SettingsData | null>(null); // Aktuellen Settings-Stand im lokalen State halten; ohne koennen Formular und Checks nicht gerendert oder gespeichert werden.
  const [loading, setLoading] = useState(true); // Ladezustand fuer den initialen Settings-Request halten; ohne fehlt der Seite ein sauberer Loading-/Retry-Pfad.
  const [saving, setSaving] = useState(false); // Globalen Save-Zustand fuer den Haupt-Speichern-Button merken; ohne ist die UI waehrend Speichern nicht rueckmeldungsfaehig.
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null); // Erfolgs-/Fehlermeldung zentral halten; ohne kann die Seite Save- und Load-Rueckmeldungen nicht anzeigen.
  const [newPresetName, setNewPresetName] = useState(""); // Eingabetext fuer neu anzulegende Presets speichern; ohne geht Formulartext bei jedem Render verloren.
  const [showNewPreset, setShowNewPreset] = useState(false); // Sichtbarkeit des New-Preset-Formulars steuern; ohne ist der Create-Flow nicht ein-/ausblendbar.
  const [info, setInfo] = useState<{ version: string; lastUpdated: string | null } | null>(null); // Versions- und Update-Infos aus `/api/info` halten; ohne fehlt der Information-Tab ein zentraler Datenblock.
  const [uiConfig, setUiConfig] = useState<{ portAuto: boolean; port: number } | null>(null); // UI-Port-Konfiguration lokal bearbeitbar halten; ohne kann der Port-Formbereich keine Werte spiegeln.
  const [uiConfigSaving, setUiConfigSaving] = useState(false); // Eigenen Saving-State fuer die UI-Port-Karte halten; ohne kann der Port-Save nicht separat blockiert werden.
  const [status, setStatus] = useState<Status | null>(null); // Backend-/Projektstatus fuer die Statuskarten speichern; ohne bleibt der Information-Tab inhaltslos.
  const [statusLoading, setStatusLoading] = useState(true); // Ladeindikator fuer die Statusabfrage halten; ohne gibt es keinen Unterschied zwischen "laedt noch" und "kein Status".
  const [runResult, setRunResult] = useState<{ stdout: string; stderr: string; code: number } | null>(null); // Letztes Run-Checks-Ergebnis lokal puffern; ohne kann die Seite die finale Ausgabe nicht anzeigen.
  const [triggerCommandosLastUpdated, setTriggerCommandosLastUpdated] = useState<Date | null>(null); // Zeitstempel fuer Trigger-Commandos-Saves anzeigen; ohne fehlt Freshness-Feedback.
  const [myChecksLastUpdated, setMyChecksLastUpdated] = useState<Date | null>(null); // Zeitstempel fuer My-Checks-Saves anzeigen; ohne bleibt auch dieser Bereich zeitlich blind.
  const [roleTab, setRoleTabState] = useState<"enforce" | "hooks">("enforce"); // Inneren Rollenfilter fuer Trigger-Commandos/My Checks halten; ohne kann innerhalb des Template-Tabs nicht gefiltert werden.
  /**
   * setRoleTab: Setzt den Rollenfilter und persistiert ihn in `sessionStorage`.
   * Zweck: Die UI soll sich den zuletzt gewaehlten Rollen-Tab zwischen Seitenwechseln im Browser merken.
   * Problem: Ohne diesen Helper bleibt die Rollenwahl fluechtig und springt bei jedem Reload auf den Default zurueck.
   * Eingabe: `tab` als `"enforce"` oder `"hooks"`. Ausgabe: kein Rueckgabewert.
   */
  const setRoleTab = useCallback((tab: "enforce" | "hooks") => {
    setRoleTabState(tab); // Rollenfilter sofort im React-State umschalten; ohne reagiert die UI nicht auf den Klick.
    try {
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem("shimwrappercheck-roleTab", tab); // Rollenwahl im Browser persistieren; ohne ist die Auswahl nach Reload verloren.
    } catch {
      /* ignore */
      // SessionStorage-Fehler bewusst ignorieren; ohne kann fehlender Storage die gesamte Rollenumschaltung stoeren.
    }
  }, []);
  /**
   * useEffect(restore role tab): Stellt den zuletzt gespeicherten Rollenfilter aus `sessionStorage` wieder her.
   * Zweck: Nutzer sollen nach Reloads denselben Rollen-Tab wiedersehen.
   * Problem: Ohne diesen Restore-Effekt merkt sich die Seite die fruehere Rollenwahl trotz Persistenzversuch nicht.
   * Eingabe: keine direkten Eingaben. Ausgabe: kein Rueckgabewert.
   */
  useEffect(() => {
    try {
      if (typeof sessionStorage === "undefined") return; // Restore nur im Browser mit vorhandenem Storage versuchen; ohne crasht SSR oder restriktive Umgebungen.
      const stored = sessionStorage.getItem("shimwrappercheck-roleTab"); // Vorherigen Rollenwert aus dem Browser lesen; ohne gibt es nichts wiederherzustellen.
      if (stored === "hooks" || stored === "enforce") setRoleTabState(stored); // Nur bekannte Rollenwerte uebernehmen; ohne koennen kaputte Storage-Werte den State verunreinigen.
    } catch {
      /* ignore */
      // SessionStorage-Fehler beim Restore schlucken; ohne kann ein lokaler Browserfehler die ganze Seite stoeren.
    }
  }, []);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false); // Dropdown-Status des aktiven Presets halten; ohne kann das Kontextmenue nicht sauber auf/zu gehen.
  const [exportDialogOpen, setExportDialogOpen] = useState(false); // Export-Dialog sichtbar/unsichtbar machen; ohne fehlt die Export-Modalsteuerung.
  const [exportFileName, setExportFileName] = useState(""); // Gewuenschten Export-Dateinamen zwischenspeichern; ohne geht Texteingabe im Dialog verloren.
  const [renameDialogOpen, setRenameDialogOpen] = useState(false); // Rename-Dialog steuern; ohne kann die Preset-Umbenennung nicht modal abgewickelt werden.
  const [renameValue, setRenameValue] = useState(""); // Eingabewert fuer Preset-Umbenennung halten; ohne ist die Rename-Form nicht kontrolliert.
  const { refetch: refetchRunChecksLog, running, setRunning, setCurrentCheckId } = useRunChecksLog(); // Globalen Run-Checks-Logkontext anbinden; ohne kann die Seite laufende Checks nicht synchron anzeigen.
  const pendingAddedCheckIdRef = useRef<string | null>(null); // Neu hinzugefuegte Check-ID zwischen Save-Event und Reload puffern; ohne ginge das spaetere Aktivierungs-Event verloren.

  const SETTINGS_FETCH_MS = 12_000; // Harte Timeout-Grenze fuer Settings-Ladevorgaenge definieren; ohne kann die Seite bei haengenden Requests zu lange blockieren.

  /**
   * load: Laedt den kompletten Settings-Stand und optional einen Callback nach erfolgreichem Abschluss.
   * Zweck: Die Seite soll initial, nach Saves und nach Events immer denselben zentralen Ladepfad nutzen.
   * Problem: Ohne diese Funktion waeren Initial-Load, Retry und Event-Reaktionen dupliziert und leichter inkonsistent.
   * Eingabe: optional `onFulfilled`. Ausgabe: kein Rueckgabewert, sondern asynchroner State-Update-Flow.
   */
  const load = useCallback(
    (onFulfilled?: () => void) => {
      setLoading(true); // Ladeindikator vor dem Request aktivieren; ohne bleibt die UI waehrend eines Refreshes optisch stale.
      const ac = new AbortController(); // Eigenen AbortController fuer den Settings-Request erzeugen; ohne laesst sich ein haengender Request nicht abbrechen.
      const timeoutId = setTimeout(() => ac.abort(), SETTINGS_FETCH_MS); // Hard-Timeout fuer den Request setzen; ohne kann der Ladepfad bei Netzwerkproblemen endlos haengen.
      fetch("/api/settings", { signal: ac.signal }) // Serverseitigen Settings-Stand abrufen; ohne arbeitet die Seite nur auf lokalem Altzustand.
        .then((r) => r.json()) // JSON-Nutzlast auslesen; ohne kann die Antwort nicht validiert und in State uebernommen werden.
        .then((data) => {
          if (data?.error || !Array.isArray(data?.presets)) {
            setSettings(null); // Offensichtlich ungueltige Antwort als fehlende Settings behandeln; ohne bleibt evtl. alter oder kaputter Zustand sichtbar.
            setMessage(
              data?.error
                ? { type: "error", text: String(data.error) }
                : { type: "error", text: tSettings("loadError") }
            ); // Konkrete API-Fehlermeldung oder generischen Load-Fehler setzen; ohne fehlt dem Nutzer jede Rueckmeldung zum Ladeproblem.
          } else {
            setSettings(data); // Validen Settings-Stand in den lokalen State uebernehmen; ohne koennen Formulare und Listen nicht gerendert werden.
            setMessage(null); // Alte Fehl-/Erfolgsmeldung nach erfolgreichem Reload loeschen; ohne bleibt veraltetes Feedback sichtbar.
            if (data.presetsLastUpdated) {
              const t = new Date(data.presetsLastUpdated); // Serverzeitpunkt in ein Date-Objekt umwandeln; ohne koennen Last-Updated-Anzeigen ihn nicht nutzen.
              if (!isNaN(t.getTime())) {
                setTriggerCommandosLastUpdated(t); // Trigger-Commandos-Zeitstempel mit dem Serverstand synchronisieren; ohne bleibt dort veraltetes Freshness-Feedback.
                setMyChecksLastUpdated(t); // My-Checks-Zeitstempel genauso angleichen; ohne laufen die beiden Bereiche zeitlich auseinander.
              }
            }
          }
          onFulfilled?.(); // Optionalen Anschluss-Callback erst nach verarbeiteten Daten ausfuehren; ohne koennen Folgeaktionen zu frueh laufen.
        })
        .catch((err) => {
          setSettings(null); // Fehlerfall klar auf "keine Settings" setzen; ohne bleibt moeglicherweise ein falscher Altzustand stehen.
          const isAbort = err?.name === "AbortError"; // Timeout-/Abort-Faelle gesondert erkennen; ohne kann die UI keine passendere Meldung ausgeben.
          setMessage({ type: "error", text: isAbort ? tSettings("timeout") : tSettings("loadFailed") }); // Zwischen Timeout und generischem Ladefehler unterscheiden; ohne fehlt genaueres Fehlerfeedback.
        })
        .finally(() => {
          clearTimeout(timeoutId); // Timeout-Timer immer aufraeumen; ohne sammelt jeder Load einen haengenden Timer an.
          setLoading(false); // Ladezustand in jedem Fall wieder beenden; ohne bleibt die Seite nach Fehler oder Erfolg im Spinner-Zustand haengen.
        });
    },
    [tSettings]
  );

  /**
   * useEffect(initial load): Startet den ersten Settings-Load beim Mount der Seite.
   * Zweck: Die Seite soll nach dem ersten Render sofort echte Konfigurationsdaten laden.
   * Problem: Ohne diesen Effekt bleibt die Settings-Seite leer, bis man manuell einen Retry oder Save ausloest.
   * Eingabe: keine direkten Eingaben. Ausgabe: kein Rueckgabewert.
   */
  useEffect(() => {
    load(); // Initialen Settings-Load sofort anstossen; ohne koennen Tabs und Formulare keine Daten anzeigen.
  }, [load]);

  /**
   * useEffect(load info/ui-config): Laedt App-Info und UI-Port-Konfiguration fuer den Information-Tab.
   * Zweck: Version, lastUpdated und UI-Port-Einstellungen sollen getrennt vom grossen Settings-Payload verfuegbar sein.
   * Problem: Ohne diesen Effekt bleibt der Information-Tab inhaltlich leer oder nur mit Defaults gefuellt.
   * Eingabe: keine direkten Eingaben. Ausgabe: kein Rueckgabewert.
   */
  useEffect(() => {
    fetch("/api/info") // App-Metadaten fuer Version/Update-Infos laden; ohne bleibt der Information-Block leer.
      .then((r) => r.json()) // Info-Antwort als JSON lesen; ohne koennen Version und Zeitstempel nicht extrahiert werden.
      .then((data) => setInfo({ version: data.version ?? "–", lastUpdated: data.lastUpdated ?? null })) // Fehlende Werte defensiv auf sichtbare Platzhalter normieren; ohne erscheinen leere oder undefinierte Felder.
      .catch(() => setInfo({ version: "–", lastUpdated: null })); // Fehlerfall ebenfalls auf stabile Platzhalter setzen; ohne bleibt `info` moeglicherweise dauerhaft null.
    fetch("/api/ui-config") // UI-Port-Konfiguration separat laden; ohne kann der Port-Formbereich keine echten Werte anzeigen.
      .then((r) => r.json()) // UI-Config-JSON lesen; ohne sind Port-Auto/Fix-Werte nicht auswertbar.
      .then((data) => setUiConfig({ portAuto: data.portAuto !== false, port: data.port ?? 3000 })) // API-Werte mit defensiven Defaults in den lokalen State uebernehmen; ohne brechen unvollstaendige Payloads das Formular.
      .catch(() => setUiConfig({ portAuto: true, port: 3000 })); // Fehlerfall auf sicheren Auto-Port-Default setzen; ohne bleibt der UI-Config-Bereich leer.
  }, []);

  /**
   * useEffect(load status): Holt den Projektstatus fuer den Information-Tab.
   * Zweck: StatusCards und letzte Fehler sollen nach Seitenaufruf automatisch sichtbar sein.
   * Problem: Ohne diesen Effekt bleibt der Statusbereich permanent im Lade- oder Leerzustand.
   * Eingabe: keine direkten Eingaben. Ausgabe: kein Rueckgabewert.
   */
  useEffect(() => {
    fetch("/api/status") // Status-Endpoint fuer Projekt-/Shim-Zustand anfragen; ohne fehlt den StatusCards jede Datenbasis.
      .then((r) => r.json()) // Status-Antwort als JSON lesen; ohne koennen wir sie nicht in den Status-State uebernehmen.
      .then((data) => {
        setStatus(data); // Erfolgreich geladenen Status in den lokalen State schreiben; ohne bleibt der UI-Block leer.
        setStatusLoading(false); // Status-Ladezustand nach Erfolg beenden; ohne bleibt die Seite im Loading-Fallback haengen.
      })
      .catch(() => setStatusLoading(false)); // Auch bei Fehlern den Ladezustand aufloesen; ohne bleibt der Bereich endlos im Ladezustand.
  }, []);

  /**
   * useEffect(my-checks-saved): Reagiert auf gespeicherte My-Checks und aktiviert neu hinzugefuegte Checks nach dem Reload.
   * Zweck: Nach Add/Reorder-Operationen soll die Settings-Seite sofort synchronisieren und neue Checks sichtbar fokussieren koennen.
   * Problem: Ohne diesen Listener bleibt der My-Checks-Bereich nach Sidebar-/DnD-Saves stale.
   * Eingabe: keine direkten Eingaben; nutzt Event-Detail und `load`. Ausgabe: Cleanup fuer den Listener.
   */
  useEffect(() => {
    const onMyChecksSaved = (e: Event) => {
      const addedCheckId = (e as CustomEvent<{ addedCheckId?: string }>).detail?.addedCheckId ?? null; // Optional neu hinzugefuegte Check-ID aus dem Event extrahieren; ohne ist spaetere Aktivierung nicht gezielt moeglich.
      pendingAddedCheckIdRef.current = addedCheckId; // ID zwischen Event und Reload puffern; ohne geht sie waehrend des asynchronen Reloads verloren.
      setMyChecksLastUpdated(new Date()); // Zeitstempel fuer sichtbares Save-Feedback aktualisieren; ohne bleibt der Bereich optisch alt.
      load(() => {
        const id = pendingAddedCheckIdRef.current; // Gepufferte Check-ID nach dem Reload wieder lesen; ohne wissen wir nicht mehr, welche Karte frisch hinzugekommen ist.
        pendingAddedCheckIdRef.current = null; // Ref direkt leeren; ohne wird dieselbe Aktivierung spaeter versehentlich wiederholt.
        if (id && typeof window !== "undefined") {
          requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent("check-activated", { detail: { checkId: id } })); // Aktivierungs-Event erst nach DOM-Update senden; ohne existiert die Zielkarte evtl. noch nicht.
          });
        }
      });
    };
    window.addEventListener("my-checks-saved", onMyChecksSaved); // Globalen Save-Listener registrieren; ohne erreicht diese Seite Sidebar-/DnD-Saves nicht.
    return () => window.removeEventListener("my-checks-saved", onMyChecksSaved); // Listener beim Unmount abbauen; ohne bleiben verwaiste Doppelreaktionen im Browser.
  }, [load]);

  /**
   * runChecks: Startet den Live-SSE-Lauf fuer `/api/run-checks` und uebernimmt Fortschritt plus Abschlussdaten.
   * Zweck: Nutzer sollen Checks direkt aus der Settings-Seite starten und ihren Fortschritt verfolgen koennen.
   * Problem: Ohne diesen Handler ist der "Run checks"-Button rein dekorativ und liefert keinen Log-/Statusfluss.
   * Eingabe: keine. Ausgabe: kein Rueckgabewert.
   */
  const runChecks = () => {
    setRunResult(null); // Vorheriges Ergebnis vor neuem Lauf loeschen; ohne wird alte Ausgabe mit neuem Run vermischt.
    setRunning(true); // Globalen Running-State setzen; ohne kann die UI den Start eines neuen Laufes nicht signalisieren.
    setCurrentCheckId(null); // Aktuelle Check-ID vor dem Stream resetten; ohne bleibt der vorige Fortschrittsstand sichtbar.
    fetch("/api/run-checks", { method: "POST", headers: { Accept: "text/event-stream" } }) // SSE-Lauf explizit als Stream anfordern; ohne kaeme nur der JSON-Fallback ohne Live-Fortschritt.
      .then(async (r) => {
        if (!r.body) throw new Error("No body"); // Ohne Response-Body ist der Stream unbrauchbar; ohne diese Pruefung liest der Code auf `undefined`.
        const reader = r.body.getReader(); // Stream-Reader fuer den SSE-Body erzeugen; ohne koennen keine Chunks gelesen werden.
        const decoder = new TextDecoder(); // Uint8Array-Chunks wieder in Text umwandeln; ohne laesst sich das SSE-Format nicht parsen.
        let buf = ""; // Unvollstaendige Stream-Teile zwischen Chunks puffern; ohne zerreissen Events ueber Chunkgrenzen.
        let doneData: { code?: number; stdout?: string; stderr?: string } = {}; // Finale done-Daten separat sammeln; ohne fehlt spaeter die Abschlussantwort.
        while (true) {
          const { done, value } = await reader.read(); // Naechsten Stream-Chunk lesen; ohne bewegt sich der Live-Lauf nicht vorwaerts.
          if (done) break; // Streamende erkennen und Schleife verlassen; ohne liest der Code endlos weiter.
          buf += decoder.decode(value, { stream: true }); // Chunk an den Textpuffer anhaengen; ohne gehen Event-Fragmente verloren.
          const parts = buf.split("\n\n"); // SSE-Events ueber Leerzeilen trennen; ohne koennen Event und Daten nicht blockweise ausgewertet werden.
          buf = parts.pop() ?? ""; // Letzten unvollstaendigen Block fuer den naechsten Chunk aufheben; ohne zerfallen Events an der Chunkgrenze.
          for (const block of parts) {
            let blockEvent = ""; // Event-Typ pro SSE-Block zwischenspeichern; ohne lassen sich Datenzeilen keinem Event zuordnen.
            const lines = block.split("\n"); // Block in einzelne SSE-Zeilen aufteilen; ohne koennen `event:` und `data:` nicht separat gelesen werden.
            for (const line of lines) {
              if (line.startsWith("event: "))
                blockEvent = line.slice(7).trim(); // Eventnamen merken; ohne wissen wir bei `data:`-Zeilen nicht, ob es currentCheck oder done ist.
              else if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6)) as {
                    checkId?: string;
                    code?: number;
                    stdout?: string;
                    stderr?: string;
                  }; // Datenzeile aus JSON zur strukturierten SSE-Nutzlast parsen; ohne bleiben Check-ID und done-Daten nur roher Text.
                  if (blockEvent === "currentCheck" && data.checkId)
                    setCurrentCheckId(data.checkId); // Laufenden Check live in den Kontext spiegeln; ohne fehlt die Fortschrittsanzeige.
                  else if (blockEvent === "done") doneData = data; // Abschlussdaten fuer spaeteren Zustand puffern; ohne fehlt stdout/stderr/code nach Streamende.
                } catch {
                  // ignore
                }
              }
            }
          }
        }
        setRunResult({
          stdout: doneData.stdout ?? "", // Stdout defensiv aus den Abschlussdaten uebernehmen; ohne koennen fehlende Felder die UI brechen.
          stderr: doneData.stderr ?? "", // Stderr ebenfalls mit leerem Fallback lesen; ohne fehlt ein stabiler Fehlerkanal.
          code: doneData.code ?? 1, // Exitcode auf Fehlerdefault normieren; ohne erscheint ein unvollstaendiger done-Block faelschlich erfolgreich.
        }); // Komplettes Laufergebnis fuer die Ergebnisbox setzen; ohne bleibt der Nutzer nach Streamende ohne Abschlussdaten.
        setRunning(false); // Running-Flag nach Abschluss loeschen; ohne bleibt der Run-Button dauerhaft gesperrt.
        setCurrentCheckId(null); // Aktuellen Check nach Laufende resetten; ohne bleibt ein alter Check als aktiv stehen.
        refetchRunChecksLog(); // Persistiertes Last-Run-Log nach dem Ende neu laden; ohne sieht der Logs-Tab nicht den frischen Lauf.
      })
      .catch(() => {
        setRunResult({ stdout: "", stderr: tSettings("runChecksRequestFailed"), code: 1 }); // Auch Request-/Streamfehler in ein sichtbares Ergebnis ueberfuehren; ohne verschwindet der Fehler still.
        setRunning(false); // Running-Flag auch im Fehlerfall loeschen; ohne bleibt die UI haengen.
        setCurrentCheckId(null); // Aktuelle Check-ID bei Fehlern ebenfalls resetten; ohne bleibt veralteter Fortschritt sichtbar.
      });
  };

  /**
   * save: Speichert den aktuell bearbeiteten globalen Settings-Stand.
   * Zweck: Nutzer sollen alle lokalen Aenderungen gesammelt persistieren koennen.
   * Problem: Ohne diesen Handler bleibt der Haupt-Save-Button ohne Wirkung und lokale Einstellungen gehen bei Reload verloren.
   * Eingabe: keine. Ausgabe: kein Rueckgabewert.
   */
  const save = () => {
    if (!settings) return; // Ohne Settings gibt es nichts Sinnvolles zu speichern; ohne diese Guard senden wir kaputte Requests.
    setSaving(true); // Globalen Saving-Zustand aktivieren; ohne bekommt der Nutzer kein Feedback waehrend des Speicherns.
    setMessage(null); // Alte Meldung vor neuem Save loeschen; ohne ueberlagert veraltetes Feedback den aktuellen Versuch.
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    }) // Kompletten Settings-Stand an den API-Endpunkt schicken; ohne bleiben die lokalen Aenderungen nur im Browser.
      .then((r) => r.json()) // JSON-Antwort lesen; ohne kann Erfolg oder Fehler des Saves nicht ausgewertet werden.
      .then((data) => {
        setSaving(false); // Saving-State nach Antwort beenden; ohne bleibt der UI-Block im Ladezustand stecken.
        if (data.error)
          setMessage({ type: "error", text: data.error }); // API-Fehler dem Nutzer sichtbar melden; ohne wirkt ein fehlgeschlagener Save wie ein stiller No-op.
        else {
          setMessage({ type: "success", text: tSettings("saved") }); // Erfolgsmeldung fuer den Nutzer setzen; ohne fehlt positive Rueckmeldung nach Persistenz.
          setTriggerCommandosLastUpdated(new Date()); // Trigger-Commandos-Zeitstempel als frisch gespeichert markieren; ohne bleibt dort altes Feedback stehen.
          setMyChecksLastUpdated(new Date()); // My-Checks-Zeitstempel gleichzeitig aktualisieren; ohne wirken die beiden Bereiche zeitlich unsynchron.
        }
      })
      .catch(() => {
        setSaving(false); // Saving-State auch im Fehlerfall aufloesen; ohne bleibt der Button dauerhaft blockiert.
        setMessage({ type: "error", text: tSettings("saveFailed") }); // Generischen Save-Fehler zeigen; ohne hat der Nutzer keinen Hinweis zum Fehlschlag.
      });
  };

  /**
   * saveSettingsForTriggerCommandos: Persistiert Aenderungen aus dem Trigger-Commandos-Bereich sofort.
   * Zweck: Unterkomponenten fuer Trigger-Commandos sollen direkt speichern koennen, ohne auf den globalen Save warten zu muessen.
   * Problem: Ohne diesen spezialisierten Save-Pfad bleiben Trigger-Commando-Aenderungen lokal und unsynchron.
   * Eingabe: `next` als kompletter naechster Settings-Stand. Ausgabe: kein Rueckgabewert.
   */
  const saveSettingsForTriggerCommandos = (next: SettingsData) => {
    setSettings(next); // Optimistischen lokalen Settings-State sofort uebernehmen; ohne reagiert die UI erst nach Serverantwort.
    setMessage(null); // Alte Meldung vor neuem Bereichs-Save loeschen; ohne bleibt veraltetes Feedback sichtbar.
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }) // Trigger-Commandos-Aenderungen als vollen Settings-Stand speichern; ohne werden Teilbereiche nicht serverseitig persistiert.
      .then((r) => r.json()) // JSON-Antwort lesen; ohne fehlt die Rueckmeldung, ob der Save erfolgreich war.
      .then((data) => {
        if (data.error)
          setMessage({ type: "error", text: data.error }); // API-Fehler sofort als Meldung zeigen; ohne scheitert der Save still.
        else {
          setMessage({ type: "success", text: tSettings("savedShort") }); // Kurze Erfolgsmeldung fuer Inline-Saves setzen; ohne fehlt direktes Feedback.
          setTriggerCommandosLastUpdated(new Date()); // Nur den Trigger-Commando-Zeitstempel aktualisieren; ohne bleibt dieser Bereich optisch alt.
        }
      })
      .catch(() => setMessage({ type: "error", text: tSettings("saveFailed") })); // Netzwerk-/Transportfehler ebenfalls sichtbar machen; ohne sieht der Nutzer keinen Grund fuer ausbleibende Persistenz.
  };

  /**
   * saveSettingsForMyChecks: Persistiert Aenderungen aus dem My-Checks-Bereich sofort.
   * Zweck: Check-Aktivierungen, Reihenfolgen und Detailaenderungen sollen ohne globalen Save synchron bleiben.
   * Problem: Ohne diesen Handler koennen My-Checks-Unterkomponenten keine direkten Saves ausloesen.
   * Eingabe: `next` als kompletter naechster Settings-Stand. Ausgabe: kein Rueckgabewert.
   */
  const saveSettingsForMyChecks = (next: SettingsData) => {
    setSettings(next); // Optimistischen State fuer My Checks sofort setzen; ohne fuehlt sich Reorder/Aktivierung traege an.
    setMessage(null); // Alte Meldung loeschen, damit der neue Save-Versuch sauber bewertet wird; ohne stoeren alte Fehlertexte.
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    }) // My-Checks-Aenderungen an denselben Settings-Endpunkt schicken; ohne gehen Bereichsaenderungen verloren.
      .then((r) => r.json()) // JSON-Result lesen; ohne koennen Erfolg und Fehler nicht unterschieden werden.
      .then((data) => {
        if (data.error)
          setMessage({ type: "error", text: data.error }); // API-Fehler an die Meldungsleiste durchreichen; ohne bleibt der Fehlschlag unsichtbar.
        else {
          setMessage({ type: "success", text: tSettings("savedShort") }); // Bereichsbezogene Erfolgsmeldung setzen; ohne fehlt direktes Save-Feedback.
          setMyChecksLastUpdated(new Date()); // My-Checks-Zeitstempel als frisch gespeichert markieren; ohne bleibt der Bereich zeitlich stale.
        }
      })
      .catch(() => setMessage({ type: "error", text: tSettings("saveFailed") })); // Transportfehler in dieselbe Fehlermeldung ueberfuehren; ohne scheint der Save einfach ignoriert.
  };

  const activePreset = settings?.presets?.find((p) => p.id === settings.activePresetId) ?? DEFAULT_VIBE_CODE_PRESET; // Aktives Preset fuer Formbereiche und Dialoge aufloesen; ohne weiss die Seite nicht, welches Preset gerade editiert wird.

  /**
   * setActivePresetId: Schaltet das aktuell bearbeitete Preset lokal um.
   * Zweck: Preset-Wechsel soll sofort die sichtbaren Formbereiche auf das gewaehlte Preset umstellen.
   * Problem: Ohne diesen Handler bleiben die Preset-Buttons ohne Wirkung.
   * Eingabe: `id` des Ziel-Presets. Ausgabe: kein Rueckgabewert.
   */
  const setActivePresetId = (id: string) => {
    if (!settings) return; // Ohne geladenen Settings-Stand gibt es kein aktives Preset zum Umschalten.
    setSettings({ ...settings, activePresetId: id }); // Aktives Preset lokal umstellen; ohne bleibt die Bearbeitungsansicht am alten Preset haengen.
  };

  /**
   * addCustomPreset: Legt lokal ein neues benutzerdefiniertes Preset an und aktiviert es.
   * Zweck: Nutzer sollen neue Preset-Varianten direkt in der Settings-Seite erstellen koennen.
   * Problem: Ohne diesen Handler ist das "Neues Preset"-Formular funktionslos.
   * Eingabe: keine direkten Parameter; liest `newPresetName` und `settings`. Ausgabe: kein Rueckgabewert.
   */
  const addCustomPreset = () => {
    if (!newPresetName.trim() || !settings) return; // Leeren Namen oder fehlende Settings frueh abweisen; ohne entstehen kaputte Presets.
    const id = "preset-" + Date.now(); // Einfache eindeutige Preset-ID aus dem Zeitstempel bauen; ohne kann das neue Preset nicht referenziert werden.
    const newPreset: Preset = {
      id,
      name: newPresetName.trim(),
      providers: [],
      autoPush: false,
    }; // Neues Basis-Preset mit leerer Providerliste vorbereiten; ohne muessten wir das Objekt beim SetState inline rekonstruieren.
    setSettings({
      ...settings,
      presets: [...settings.presets, newPreset],
      activePresetId: id,
    }); // Neues Preset anhaengen und sofort aktivieren; ohne muesste der Nutzer es nach dem Anlegen erst suchen und auswaehlen.
    setNewPresetName(""); // Eingabefeld nach erfolgreicher lokaler Erstellung leeren; ohne bleibt alter Text im Formular stehen.
    setShowNewPreset(false); // Create-Form nach erfolgreicher Erstellung wieder schliessen; ohne bleibt das Eingabefeld offen.
  };

  /**
   * addProviderToPreset: Fuegt dem aktiven Preset einen Provider hinzu und setzt provider-spezifische Defaults.
   * Zweck: Provider wie Supabase oder Git sollen mit passenden Standardbefehlen ins Preset aufgenommen werden.
   * Problem: Ohne diesen Handler koennen Nutzer Presets keine zusaetzlichen Provider zuordnen.
   * Eingabe: `provider`. Ausgabe: kein Rueckgabewert.
   */
  const addProviderToPreset = (provider: ProviderId) => {
    if (!settings || activePreset.providers.includes(provider)) return; // Ohne Settings oder bei bereits vorhandenem Provider keine doppelte Mutation ausfuehren.
    const presets = settings.presets.map((p) => {
      if (p.id !== activePreset.id) return p; // Nur das aktive Preset veraendern; ohne mutieren wir alle Presets gleichzeitig.
      const providers = [...p.providers, provider]; // Providerliste immutabel erweitern; ohne wird das bestehende Presetobjekt direkt veraendert.
      return {
        ...p,
        providers, // Erweitere Providerliste in das aktualisierte Preset uebernehmen; ohne bleibt der neue Provider trotz Klick unsichtbar.
        supabase:
          provider === "supabase"
            ? { enforce: [...SUPABASE_COMMAND_IDS], hook: [...SUPABASE_COMMAND_IDS] }
            : p.supabase, // Bei Supabase passende Standardbefehle vorbelegen; ohne ist der Provider zwar gesetzt, aber funktional leer.
        git: provider === "git" ? { enforce: ["push" as const] } : p.git, // Git-Provider mit sinnvollem Push-Default initialisieren; ohne muss der Nutzer alles manuell nachpflegen.
      }; // Aktualisiertes aktives Preset zurueckgeben; ohne wird die map-Transformation nicht wirksam.
    });
    setSettings({ ...settings, presets }); // Veraenderte Presetliste zurueck in den Settings-State schreiben; ohne bleibt die UI unveraendert.
  };

  /**
   * removeProviderFromPreset: Entfernt einen Provider aus dem aktiven Preset und loescht zugehoerige Provider-Defaults.
   * Zweck: Nutzer sollen Provider wieder sauber aus Presets entfernen koennen.
   * Problem: Ohne diesen Handler bleiben einmal hinzugefuegte Provider dauerhaft im Preset.
   * Eingabe: `provider`. Ausgabe: kein Rueckgabewert.
   */
  const removeProviderFromPreset = (provider: ProviderId) => {
    if (!settings) return; // Ohne Settings gibt es keine Presets zu bereinigen.
    const presets = settings.presets.map(
      (p) =>
        p.id === activePreset.id
          ? {
              ...p,
              providers: p.providers.filter((pr) => pr !== provider), // Provider aus der Liste des aktiven Presets entfernen; ohne bleibt er trotz Remove-Action sichtbar.
              supabase: provider === "supabase" ? undefined : p.supabase, // Supabase-spezifische Zusatzdaten beim Entfernen mit loeschen; ohne bleiben tote Konfigurationsreste zurueck.
              git: provider === "git" ? undefined : p.git, // Git-Zusatzdaten analog entfernen; ohne bleibt verwaiste Providerkonfiguration bestehen.
            }
          : p // Andere Presets unveraendert weiterreichen; ohne wuerden wir fremde Presets unbeabsichtigt anfassen.
    ); // Gesamte neue Presetliste mit einem bereinigten aktiven Preset erzeugen; ohne kann der State nicht immutabel aktualisiert werden.
    setSettings({ ...settings, presets }); // Bereinigte Presetliste in den Settings-State uebernehmen; ohne sieht die UI keine Aenderung.
  };

  /**
   * deletePreset: Entfernt ein benutzerdefiniertes Preset und faellt bei Bedarf auf das Default-Preset zurueck.
   * Zweck: Nutzer sollen nicht mehr benoetigte Presets wieder loeschen koennen.
   * Problem: Ohne diesen Handler wachsen Presetlisten nur an und koennen nicht bereinigt werden.
   * Eingabe: `id` des zu loeschenden Presets. Ausgabe: kein Rueckgabewert.
   */
  const deletePreset = (id: string) => {
    if (!settings || id === DEFAULT_VIBE_CODE_PRESET.id) return; // Default-Preset und fehlende Settings vor versehentlicher Loeschung schuetzen; ohne verschwindet die sichere Basis.
    const presets = settings.presets.filter((p) => p.id !== id); // Ziel-Preset aus der Liste herausfiltern; ohne bleibt es trotz Delete sichtbar.
    setSettings({
      ...settings,
      presets,
      activePresetId: settings.activePresetId === id ? DEFAULT_VIBE_CODE_PRESET.id : settings.activePresetId,
    }); // Beim Loeschen des aktiven Presets auf das Default zurueckfallen; ohne bleibt `activePresetId` auf eine nicht existente ID zeigen.
  };

  const renamePreset = () => {
    if (!settings || !renameValue.trim()) return;
    const presets = settings.presets.map((p) =>
      p.id === settings.activePresetId ? { ...p, name: renameValue.trim() } : p
    );
    const next = { ...settings, presets };
    setSettings(next);
    setRenameDialogOpen(false);
    setRenameValue("");
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setMessage({ type: "error", text: data.error });
        else {
          setMessage({ type: "success", text: tSettings("presetRenamed") });
          setTriggerCommandosLastUpdated(new Date());
          setMyChecksLastUpdated(new Date());
        }
      })
      .catch(() => setMessage({ type: "error", text: tSettings("saveFailed") }));
  };

  const doExport = () => {
    if (!settings || !exportFileName.trim()) return;
    const name = exportFileName.trim().replace(/\.json$/i, "") + ".json";
    const exportObj = {
      preset: activePreset,
      checkToggles: settings.checkToggles,
      checkOrder: settings.checkOrder ?? [],
      checkSettings: settings.checkSettings ?? {},
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
    setExportDialogOpen(false);
    setExportFileName("");
  };

  const openExportDialog = () => {
    setPresetMenuOpen(false);
    setExportFileName(activePreset.name + "-preset.json");
    setExportDialogOpen(true);
  };

  const openRenameDialog = () => {
    setPresetMenuOpen(false);
    setRenameValue(activePreset.name);
    setRenameDialogOpen(true);
  };

  const saveUiConfig = () => {
    if (!uiConfig) return;
    setUiConfigSaving(true);
    fetch("/api/ui-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(uiConfig),
    })
      .then((r) => r.json())
      .then(() => setUiConfigSaving(false))
      .catch(() => setUiConfigSaving(false));
  };

  const showTabsAndContent = settings !== null;
  const showRetry = !loading && !settings;

  return (
    <div className="relative z-10 min-h-0 space-y-6 text-white">
      <div className="flex gap-0 border border-white/80 rounded overflow-hidden w-fit">
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${tab === "templates" ? "bg-white text-black" : "bg-transparent text-white hover:bg-white/10"}`}
          onClick={() => setTab("templates")}
        >
          {t("templates")}
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${tab === "information" ? "bg-white text-black" : "bg-transparent text-white hover:bg-white/10"}`}
          onClick={() => setTab("information")}
        >
          {t("information")}
        </button>
        <button
          type="button"
          className={`px-4 py-2 text-sm font-medium ${tab === "reviews" ? "bg-white text-black" : "bg-transparent text-white hover:bg-white/10"}`}
          onClick={() => setTab("reviews")}
        >
          {t("reviews")}
        </button>
      </div>

      {loading && !settings && (
        <div className="flex justify-center py-12">
          <span className="loading loading-spinner loading-lg" />
        </div>
      )}

      {showRetry && (
        <div className="space-y-4 p-4">
          <p className="text-error">{message?.text ?? tSettings("loadError")}</p>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => load()}>
            {tSettings("retry")}
          </button>
        </div>
      )}

      {showTabsAndContent && tab === "information" && (
        <div className="space-y-6 max-w-xl">
          <h2 className="text-xl font-semibold">{t("information")}</h2>
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <h3 className="card-title text-white text-base">{tSettings("uiPortTitle")}</h3>
              <p className="text-sm text-neutral-400">{tSettings("uiPortDesc")}</p>
              <div className="space-y-3 mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="portMode"
                    className="radio radio-sm"
                    checked={uiConfig?.portAuto ?? true}
                    onChange={() => setUiConfig((c) => (c ? { ...c, portAuto: true } : { portAuto: true, port: 3000 }))}
                  />
                  <span>{tSettings("portAuto")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="portMode"
                    className="radio radio-sm"
                    checked={!!(uiConfig && !uiConfig.portAuto)}
                    onChange={() =>
                      setUiConfig((c) => (c ? { ...c, portAuto: false } : { portAuto: false, port: 3000 }))
                    }
                  />
                  <span>{tSettings("portFixed")}</span>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    className="input input-sm input-bordered w-24 bg-neutral-800 border-neutral-600 text-white"
                    value={uiConfig?.port ?? 3000}
                    onChange={(e) =>
                      setUiConfig((c) =>
                        c
                          ? { ...c, port: Math.max(1, Math.min(65535, parseInt(e.target.value, 10) || 3000)) }
                          : { portAuto: false, port: 3000 }
                      )
                    }
                    disabled={uiConfig?.portAuto ?? true}
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-primary mt-2"
                onClick={saveUiConfig}
                disabled={uiConfigSaving}
              >
                {uiConfigSaving ? t("saving") : tSettings("savePort")}
              </button>
            </div>
          </div>
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <h3 className="card-title text-white text-base">{t("appName")}</h3>
              <dl className="text-sm space-y-1 mt-2">
                <div className="flex gap-2">
                  <dt className="text-neutral-400">{tSettings("version")}</dt>
                  <dd>{info?.version ?? "–"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-neutral-400">{tSettings("lastUpdated")}</dt>
                  <dd>{info?.lastUpdated ?? "–"}</dd>
                </div>
              </dl>
            </div>
          </div>

          <h2 className="text-xl font-semibold mt-8">{tSettings("statusTitle")}</h2>
          {statusLoading || !status ? (
            <p className="text-neutral-400">{t("loading")}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <StatusCard label={tStatus("configRc")} ok={!!status.config} />
                <StatusCard
                  label={tStatus("presetsFile")}
                  ok={!!status.presetsFile}
                  detail={tStatus("presetsDetail")}
                />
                <StatusCard label={tStatus("agentsMd")} ok={!!status.agentsMd} detail={tStatus("agentsMdDetail")} />
                <StatusCard label={tStatus("runChecksScript")} ok={!!status.runChecksScript} />
                <StatusCard
                  label={tStatus("shimRunner")}
                  ok={!!status.shimRunner}
                  detail={tStatus("shimRunnerDetail")}
                />
                <StatusCard label={tStatus("huskyPrePush")} ok={!!status.prePushHusky} />
                <StatusCard label={tStatus("gitPrePushHook")} ok={!!status.prePushGit} />
                <StatusCard label={tStatus("supabase")} ok={!!status.supabase} />
              </div>
              {status?.projectRoot && (
                <p className="mt-2 text-sm text-neutral-400">
                  {tSettings("projectRoot")} {status.projectRoot}
                </p>
              )}
              {status?.lastError && (
                <div className="mt-4 alert alert-warning shadow-lg">
                  <div>
                    <h3 className="font-bold">{tSettings("lastCheckError")}</h3>
                    <p className="text-sm">
                      {status.lastError.check}: {status.lastError.message}
                    </p>
                    {status.lastError.suggestion && (
                      <p className="text-sm opacity-90">
                        {tSettings("suggestion")} {status.lastError.suggestion}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          <h2 className="text-xl font-semibold mt-8">{tSettings("actionsTitle")}</h2>
          <div className="flex flex-wrap gap-4">
            <button
              type="button"
              className="btn btn-primary bg-primary text-primary-content"
              onClick={runChecks}
              disabled={running || !!(status && !status.runChecksScript && !status.shimRunner)}
            >
              {running ? tSettings("running") : tSettings("runChecks")}
            </button>
            <Link href="/config" className="btn btn-outline border-neutral-600 text-neutral-300">
              {tSettings("configRaw")}
            </Link>
            <Link href="/agents" className="btn btn-outline border-neutral-600 text-neutral-300">
              {tSettings("editAgentsMd")}
            </Link>
          </div>

          {runResult && (
            <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
              <div className="card-body">
                <h3 className="card-title text-white">
                  {tSettings("lastCheckOutput")} {runResult.code === 0 ? tSettings("ok") : tSettings("error")}
                </h3>
                <pre className="bg-neutral-900 p-4 rounded-lg text-sm overflow-auto max-h-64 whitespace-pre-wrap text-neutral-300">
                  {runResult.stdout || tSettings("noOutput")}
                  {runResult.stderr ? `\n${runResult.stderr}` : ""}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

      {showTabsAndContent && tab === "reviews" && (
        <div className="space-y-6 max-w-xl">
          <h2 className="text-xl font-semibold">{t("reviews")}</h2>
          <p className="text-sm text-neutral-400">{t("reviewsIntro")}</p>
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <label className="label">
                <span className="label-text text-white">{t("reviewsOutputPath")}</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full bg-neutral-900 border-neutral-600 text-white placeholder-neutral-500"
                placeholder="reports"
                value={settings?.reviewOutputPath ?? "reports"}
                onChange={(e) =>
                  settings && setSettings({ ...settings, reviewOutputPath: e.target.value.trim() || "reports" })
                }
              />
              <p className="text-xs text-neutral-500 mt-1">{t("reviewsOutputPathHint")}</p>
            </div>
          </div>
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <h3 className="card-title text-white text-base">{t("reviewsCheckListTitle")}</h3>
              <p className="text-sm text-neutral-400">{t("reviewsCheckListHint")}</p>
              <ul className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                {CHECK_DEFINITIONS.map((def) => {
                  const cs = (settings?.checkSettings as Record<string, Record<string, unknown>>)?.[def.id];
                  const reviewOn = !!cs?.reviewMode;
                  return (
                    <li key={def.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-neutral-300 truncate">{def.label}</span>
                      <span
                        className={`shrink-0 badge badge-sm ${reviewOn ? "badge-success" : "badge-ghost"}`}
                        title={reviewOn ? t("reviewsReportOn") : t("reviewsReportOff")}
                      >
                        {reviewOn ? t("reviewsReportOn") : t("reviewsReportOff")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {showTabsAndContent && tab === "templates" && (
        <div className="space-y-8">
          <p className="text-neutral-300">{tSettings("presetIntro")}</p>
          <p className="text-sm text-neutral-500">{tSettings("presetStorageHint")}</p>

          {/* Preset selector */}
          <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
            <div className="card-body">
              <h2 className="card-title text-white">{tSettings("presetTitle")}</h2>
              <div className="flex flex-wrap gap-2 items-center">
                {(settings.presets ?? []).map((p) => (
                  <div key={p.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className={`btn btn-sm ${p.id === settings.activePresetId ? "btn-primary" : "btn-ghost"}`}
                      onClick={() => setActivePresetId(p.id)}
                    >
                      {p.name}
                    </button>
                    {p.id === settings.activePresetId && (
                      <div className={`dropdown dropdown-end ${presetMenuOpen ? "dropdown-open" : ""}`}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm btn-square"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPresetMenuOpen((o) => !o);
                          }}
                          title={tSettings("presetOptions")}
                          aria-label={tSettings("presetOptionsAria")}
                        >
                          ⋮
                        </button>
                        <ul
                          className="dropdown-content menu p-2 shadow-lg bg-neutral-800 border border-neutral-600 rounded-box w-52 z-50 mt-1"
                          tabIndex={0}
                        >
                          <li>
                            <button type="button" onClick={openExportDialog}>
                              {t("export")}
                            </button>
                          </li>
                          <li>
                            <button type="button" onClick={openRenameDialog}>
                              {t("rename")}
                            </button>
                          </li>
                        </ul>
                      </div>
                    )}
                    {p.id !== DEFAULT_VIBE_CODE_PRESET.id && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-circle"
                        onClick={() => deletePreset(p.id)}
                        title={tSettings("deletePreset")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {!showNewPreset ? (
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowNewPreset(true)}>
                    + {tSettings("newPreset")}
                  </button>
                ) : (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      className="input input-bordered input-sm w-40"
                      placeholder={t("name")}
                      value={newPresetName}
                      onChange={(e) => setNewPresetName(e.target.value)}
                    />
                    <button type="button" className="btn btn-primary btn-sm" onClick={addCustomPreset}>
                      {tSettings("createPreset")}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowNewPreset(false)}>
                      {t("cancel")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Export dialog */}
          {exportDialogOpen && (
            <dialog open className="modal modal-open">
              <div className="modal-box bg-neutral-800 border border-neutral-600">
                <h3 className="font-bold text-white">{tSettings("exportPreset")}</h3>
                <p className="text-sm text-neutral-400 py-2">{tSettings("exportFilenameHint")}</p>
                <input
                  type="text"
                  className="input input-bordered w-full bg-neutral-900 border-neutral-600 text-white"
                  value={exportFileName}
                  onChange={(e) => setExportFileName(e.target.value)}
                  placeholder={tSettings("exportPlaceholder")}
                />
                <div className="modal-action">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setExportDialogOpen(false);
                      setExportFileName("");
                    }}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={doExport}
                    disabled={!exportFileName.trim()}
                  >
                    {t("export")}
                  </button>
                </div>
              </div>
              <form
                method="dialog"
                className="modal-backdrop"
                onClick={() => {
                  setExportDialogOpen(false);
                  setExportFileName("");
                }}
              >
                <button type="button">{t("closeLower")}</button>
              </form>
            </dialog>
          )}

          {/* Rename dialog */}
          {renameDialogOpen && (
            <dialog open className="modal modal-open">
              <div className="modal-box bg-neutral-800 border border-neutral-600">
                <h3 className="font-bold text-white">{tSettings("renamePreset")}</h3>
                <p className="text-sm text-neutral-400 py-2">{tSettings("renamePresetHint")}</p>
                <input
                  type="text"
                  className="input input-bordered w-full bg-neutral-900 border-neutral-600 text-white"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder={activePreset.name}
                />
                <div className="modal-action">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setRenameDialogOpen(false);
                      setRenameValue("");
                    }}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={renamePreset}
                    disabled={!renameValue.trim()}
                  >
                    {t("rename")}
                  </button>
                </div>
              </div>
              <form
                method="dialog"
                className="modal-backdrop"
                onClick={() => {
                  setRenameDialogOpen(false);
                  setRenameValue("");
                }}
              >
                <button type="button">{t("closeLower")}</button>
              </form>
            </dialog>
          )}

          {/* Active preset: providers (for custom) + command toggles */}
          <div className="space-y-6">
            {activePreset.id !== DEFAULT_VIBE_CODE_PRESET.id && (
              <div className="card bg-neutral-800 border border-neutral-600 shadow-md">
                <div className="card-body">
                  <h2 className="card-title text-white">{tSettings("providersTitle")}</h2>
                  <p className="text-sm text-neutral-400">{tSettings("providersDesc")}</p>
                  <div className="flex gap-2 flex-wrap">
                    {(["supabase", "git"] as const).map((prov) => (
                      <div key={prov} className="flex items-center gap-1">
                        {activePreset.providers.includes(prov) ? (
                          <>
                            <span className="badge badge-primary">
                              {prov === "git" ? tSettings("github") : tSettings("supabase")}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-xs"
                              onClick={() => removeProviderFromPreset(prov)}
                            >
                              {tSettings("removeProvider")}
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => addProviderToPreset(prov)}
                          >
                            + {prov === "git" ? tSettings("github") : tSettings("supabase")}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* My Shim + Check Library: Trigger Commandos & My Checks links, Check Library rechts zum Ziehen */}
          {settings && (
            <div className="flex flex-col gap-6">
              <TriggerCommandos
                settings={settings}
                onSave={saveSettingsForTriggerCommandos}
                lastUpdated={triggerCommandosLastUpdated}
                tab={roleTab}
                onTabChange={setRoleTab}
              />
              <div className="flex flex-col lg:flex-row gap-6 min-h-0">
                <div className="flex-1 min-w-0 space-y-4">
                  <MyShimChecks
                    key={`my-checks-${roleTab}`}
                    settings={settings}
                    onSave={saveSettingsForMyChecks}
                    lastUpdated={myChecksLastUpdated}
                    roleFilter={roleTab === "hooks" ? "hook" : "enforce"}
                  />
                </div>
                <div className="flex-1 min-w-0 lg:max-w-md shrink-0">
                  <AvailableChecks
                    settings={settings}
                    onActivate={saveSettingsForMyChecks}
                    onDeactivate={saveSettingsForMyChecks}
                    onSave={saveSettingsForMyChecks}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-4 items-center">
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? t("saving") : t("save")}
            </button>
            {message && (
              <span className={message.type === "success" ? "text-success" : "text-error"}>{message.text}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
