/**
 * Provides DndContext for Check Library ↔ My Shim drag and drop and sortable My Checks.
 * Uses DragOverlay so the dragged card follows the cursor and stays on top. Uses pointerWithin
 * so drop targets are detected correctly when dragging across sidebar/main.
 * Location: /components/ShimDndProvider.tsx
 */
"use client";

import React, { createContext, useContext, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { SettingsData, CheckToggles } from "@/lib/presets";
import { CHECK_DEFINITIONS } from "@/lib/checks";
import type { CheckDef } from "@/lib/checks";

export const MY_SHIM_DROPPABLE_ID = "my-shim-droppable";
export const CHECK_LIBRARY_DROPPABLE_ID = "check-library-droppable";
export const MY_SHIM_BETWEEN_PREFIX = "my-shim-between-";

/**
 * DndState: Minimaler globaler Drag-Status fuer Konsumenten wie die Sidebar-Poll-Logik.
 * Zweck: Andere Komponenten sollen nur wissen, ob gerade ein Drag laeuft, ohne interne dnd-kit-Events zu kennen.
 * Problem: Ohne diesen gemeinsamen State kann die Sidebar den Settings-Poll nicht waehrend Drag-and-drop pausieren.
 * Eingabe: keine. Ausgabe: Objekt mit `isDragging`.
 */
type DndState = {
  isDragging: boolean;
};

const dndStateDefault: DndState = { isDragging: false }; // Sicheren Standardwert fuer alle Konsumenten bereitstellen; ohne kann useContext ausserhalb des Providers undefiniert sein.
const DndStateContext = createContext<DndState>(dndStateDefault); // React-Context fuer den globalen Drag-Status anlegen; ohne kann der Provider unten keinen Zustand teilen.

/**
 * useDndState: Liefert den globalen Drag-Status aus dem Shim-DnD-Provider.
 * Zweck: Konsumenten wie `SidebarMyShim` koennen Polling pausieren, solange ein Drag aktiv ist.
 * Problem: Ohne Hook muessten andere Komponenten den Context direkt kennen und duplizierte Fallbacks pflegen.
 * Eingabe: keine. Ausgabe: `DndState` mit `isDragging`.
 */
export function useDndState(): DndState {
  return useContext(DndStateContext); // Context-Wert zentral ueber Hook auslesen; ohne greifen Konsumenten direkt auf die interne Context-Variable zu.
}

/** Drag payload set by MyShimChecks / AvailableChecks so overlay can render full card. */
export type CheckDragData = {
  orderIndex?: number | null;
  leftTags?: string[];
  statusTag?: "active" | "inactive";
};

/**
 * DragOverlayCard: Vollstaendige Kartenkopie fuer das Drag-Overlay.
 * Zweck: Beim Ziehen soll der Nutzer eine realistische Karten-Vorschau mit Status, Tags und Reihenfolge sehen.
 * Problem: Ohne eigene Overlay-Karte waere der Drag nur ein nackter Ghost ohne klares Active/Inactive-Feedback.
 * Eingabe: `def`, `overId`, `dragData`. Ausgabe: React-Knoten fuer die visuelle Drag-Vorschau.
 */
function DragOverlayCard({
  def,
  overId,
  dragData,
}: {
  def: CheckDef;
  overId: string | null;
  dragData: CheckDragData | null;
}) {
  const t = useTranslations("common");
  const tChecks = useTranslations("checks");

  /**
   * getCheckLabel: Liest das lokalisierte Label eines Checks und faellt bei fehlendem i18n-Key auf das statische Label zurueck.
   * Zweck: Overlay soll auch bei unvollstaendigen Uebersetzungen stabil rendern. Ohne Fallback koennte ein fehlender Key den Drag-Clone brechen.
   * Eingabe: keine direkten Parameter; liest `def` und `tChecks`. Ausgabe: Anzeigename als String.
   */
  const getCheckLabel = (): string => {
    try {
      return tChecks(`${def.id}.label`); // Lokalisierte Check-Bezeichnung bevorzugen; ohne ginge i18n im Overlay verloren.
    } catch {
      return def.label; // Statisches Label als Fallback liefern; ohne wirft ein fehlender Key den Overlay-Render aus der Bahn.
    }
  };

  /**
   * buildLeftTagNodes: Baut die sichtbaren Tag-Badges ohne anonymen map-Callback.
   * Zweck: Render-Logik explizit kapseln und jeden Badge-Knoten stabil mit Key erzeugen. Ohne Helper bleibt diese Logik inline und schwerer dokumentierbar.
   * Eingabe: Tag-Liste. Ausgabe: Array aus React-Knoten fuer die Badge-Zeile.
   */
  const buildLeftTagNodes = (tags: string[]): React.ReactNode[] => {
    const nodes: React.ReactNode[] = [];
    for (const tag of tags) {
      nodes.push(
        <span
          key={tag}
          className="text-[9px] leading-tight px-1 py-0.5 rounded border border-white/40 bg-white/5 capitalize text-white"
        >
          {tag}
        </span>
      );
    }
    return nodes;
  };

  const checkLabel = getCheckLabel(); // Sichtbares Check-Label frueh berechnen; ohne steht die Renderlogik spaeter inline im JSX.
  const isOverLibrary = overId === CHECK_LIBRARY_DROPPABLE_ID; // Library-Hover erkennen; ohne kann das Overlay keinen Inaktiv-Status zeigen.
  const isOverMyShim = overId === MY_SHIM_DROPPABLE_ID || (overId != null && overId.startsWith(MY_SHIM_BETWEEN_PREFIX)); // My-Shim-Hover inkl. Zwischen-Slots erkennen.
  const showInactive = isOverLibrary; // Roter Status nur ueber der Library; ohne inkonsistente Badge-Logik.
  const showActive = isOverMyShim; // Gruener Status nur ueber My Shim; ohne fehlt klares Drop-Feedback.
  const statusLabel = showInactive
    ? t("inactive")
    : showActive
      ? t("active")
      : dragData?.statusTag === "active"
        ? t("active")
        : t("inactive");
  // Klassen analog zum Statuslabel ableiten; ohne koennen Text und Badge-Farbe auseinanderlaufen.
  const statusClass = showInactive
    ? "bg-red-600/80 text-white"
    : showActive || dragData?.statusTag === "active"
      ? "bg-green-600/80 text-white"
      : "bg-red-600/80 text-white";
  const leftTags = dragData?.leftTags ?? [...def.tags, def.role]; // Drag-spezifische Tags bevorzugen; ohne verliert das Overlay den aktuellen Kontext.
  const renderedLeftTags = leftTags.length > 0 ? buildLeftTagNodes(leftTags) : null; // Badge-Knoten vor dem JSX erzeugen; ohne bleibt Mapping-Logik inline.
  const orderIndex = dragData?.orderIndex ?? null; // Reihenfolgenummer nur zeigen, wenn sie fuer den Drag bekannt ist.

  return (
    <div
      className="border rounded-lg border-white/80 bg-[#0f0f0f] shadow-2xl pointer-events-none relative w-[360px] min-h-[88px]" // Overlay bewusst nicht klickbar und optisch ueber allen Karten.
      data-check-card // Gleiches Datenattribut wie die Originalkarte; ohne koennen styles/Tests vom Overlay abweichen.
    >
      {/* Header: order, handle, badge (always visible), name, tags, Details, expand */}
      <div className="flex items-center gap-2 py-2 pr-3 pl-3 border-b border-white/20 flex-wrap">
        {" "}
        {/* Kopfzeile der Overlay-Karte rendern; ohne fehlen Status, Name und Toolbar des Drag-Abbilds. */}
        {orderIndex != null && orderIndex > 0 && (
          <span
            className="flex items-center justify-center w-6 h-6 rounded bg-white/20 text-white text-xs font-semibold shrink-0 ml-2" // Reihenfolgebadge sichtbar formatieren; ohne ist die Positionsnummer im Overlay nicht lesbar.
            title={`${t("runOrder")}: ${orderIndex}`} // Tooltip fuer Reihenfolge beibehalten; ohne fehlt Kontext bei schmalem Layout.
          >
            {orderIndex} {/* Nummer selbst ausgeben; ohne bleibt nur ein leerer Badge-Kreis uebrig. */}
          </span>
        )}
        <div className="shrink-0 flex items-stretch border-r border-white/20 self-stretch rounded-l-lg bg-white/5 pl-1.5 pr-1.5 min-h-[2.25rem]">
          {" "}
          {/* Handle-Spalte nachbauen; ohne fehlt der typische Drag-Griff im Overlay. */}
          <span className="w-6 h-full min-h-6 flex items-center justify-center select-none text-neutral-400">
            ⋮⋮
          </span>{" "}
          {/* Reines Griffsymbol anzeigen; ohne erkennt der Nutzer die Karte weniger als verschiebbares Element. */}
        </div>
        {/* Badge immediately after handle so it's always visible (name/tags can wrap) */}
        <span className={`text-[9px] leading-tight px-1.5 py-0.5 rounded shrink-0 ${statusClass}`}>
          {statusLabel}
        </span>{" "}
        {/* Aktuellen Aktiv/Inaktiv-Status direkt sichtbar machen; ohne fehlt das wichtigste Drop-Feedback. */}
        <span className="font-medium text-sm pl-1 text-white break-words min-w-0">{checkLabel}</span>{" "}
        {/* Namen des Checks ausgeben; ohne ist das Overlay fuer den Nutzer nicht identifizierbar. */}
        {renderedLeftTags ? (
          <span className="flex gap-0.5 shrink-0 flex-wrap">
            {" "}
            {/* Vorbereitete Tag-Badges gruppiert rendern; ohne geht Kontext wie Rolle/Tags im Overlay verloren. */}
            {renderedLeftTags} {/* Badge-Knoten einsetzen; ohne bleibt die Tag-Zeile trotz Daten leer. */}
          </span>
        ) : null}
        <button
          type="button" // Semantisch als Button markieren; ohne stimmt die Struktur der Originalkarte im Overlay nicht mehr.
          className="btn btn-ghost btn-sm shrink-0 text-white/70 gap-1 cursor-default" // DaisyUI-Optik der echten Karte spiegeln; ohne sieht das Overlay wie ein fremdes Element aus.
          tabIndex={-1} // Fokus aus Overlay fernhalten; ohne koennte der Drag-Clone unnoetig in die Tab-Reihenfolge geraten.
          aria-hidden // Overlay-Attrappe fuer Screenreader ausblenden; ohne wuerden doppelte inaktive Controls vorgelesen.
        >
          <span className="text-xs">{t("details")}</span>{" "}
          {/* Details-Label spiegeln; ohne wirkt Overlay nicht wie die echte Karte. */}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {" "}
            {/* Chevron als statische Detail-Andeutung zeigen; ohne fehlt die visuelle Struktur. */}
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <button
          type="button" // Auch das Expand-Placeholder-Element semantisch sauber als Button halten.
          className="btn btn-ghost btn-sm btn-square shrink-0 text-white/70 cursor-default" // Quadrat-Button wie in der Originalkarte stylen; ohne wirkt die Toolbar asymmetrisch.
          tabIndex={-1} // Overlay-Button nicht fokussierbar machen; ohne kann Tastaturnavigation in die Attrappe geraten.
          aria-hidden // Screenreader sollen dieses rein visuelle Duplikat ignorieren; ohne entsteht doppelte Bedienoberflaeche.
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {" "}
            {/* Expand-Icon als statischer Platzhalter; ohne fehlt der rechte Abschluss der Karten-Toolbar. */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
        </button>
      </div>
      {/* Info | Settings tab row (folded state) */}
      <div className="flex gap-0 border-b border-white/20">
        {" "}
        {/* Untere Info/Settings-Leiste als gefalteten Kartenrumpf rendern; ohne wirkt die Vorschau abgeschnitten. */}
        <span className="flex-1 py-2 px-3 text-xs font-medium text-white/70 bg-white/5">{t("info")}</span>{" "}
        {/* Linke Tab-Haelfte als Info-Spalte markieren; ohne stimmt Overlay-Struktur nicht. */}
        <span className="flex-1 py-2 px-3 text-xs font-medium text-white/70 bg-white/5">{t("settingsLabel")}</span>{" "}
        {/* Rechte Tab-Haelfte als Settings-Spalte markieren; ohne wirkt die Karte abgeschnitten. */}
      </div>
    </div>
  );
}

/**
 * When the pointer is over My Checks, resolve to the between-slot whose center is closest to
 * the pointer Y so the drop placeholder appears exactly between two cards. Otherwise use pointerWithin.
 */
const collisionDetection: CollisionDetection = (args) => {
  const { droppableRects, droppableContainers, pointerCoordinates } = args; // Relevante dnd-kit-Daten lokal entpacken; ohne werden spaetere Zugriffe unnötig verschachtelt.

  /**
   * findDroppableById: Sucht einen Droppable-Container ohne anonymen find-Callback.
   * Zweck: Zielcontainer explizit aufloesen und dokumentieren. Ohne Helper bleibt die Suchlogik mehrfach inline und schwerer erklaerbar.
   * Eingabe: `targetId`. Ausgabe: passender Container oder undefined.
   */
  const findDroppableById = (targetId: string) => {
    for (const container of droppableContainers) {
      if (String(container.id) === targetId) return container;
    }
    return undefined;
  };

  /**
   * collectBetweenSlots: Liest alle Between-Droppables aus und berechnet ihre vertikale Mitte.
   * Zweck: Nur so koennen wir den naechsten Einfuege-Slot per Abstand bestimmen. Ohne Helper bleibt diese Sammellogik als anonymer Callback verborgen.
   * Eingabe: keine direkten Parameter; liest `droppableRects`. Ausgabe: Liste aus Slot-ID und centerY.
   */
  const collectBetweenSlots = (): { id: string; centerY: number }[] => {
    const slots: { id: string; centerY: number }[] = [];
    for (const [id, rect] of droppableRects.entries()) {
      const idStr = String(id); // Droppable-ID auf String normieren; ohne funktionieren Prefix-Pruefungen nicht stabil.
      if (idStr.startsWith(MY_SHIM_BETWEEN_PREFIX) && rect) {
        slots.push({ id: idStr, centerY: rect.top + rect.height / 2 }); // Slot samt Mittelpunkt sammeln; ohne keine Distanz-basierte Insert-Logik.
      }
    }
    return slots;
  };

  const containerRect = pointerCoordinates && droppableRects.get(MY_SHIM_DROPPABLE_ID); // My-Shim-Container-Rechteck nur bei Pointerbezug lesen; ohne drohen sinnlose Bounds-Pruefungen.
  const isInsideMyChecks =
    pointerCoordinates &&
    containerRect &&
    pointerCoordinates.x >= containerRect.left &&
    pointerCoordinates.x <= containerRect.left + containerRect.width &&
    pointerCoordinates.y >= containerRect.top &&
    pointerCoordinates.y <= containerRect.top + containerRect.height; // Pointer explizit gegen Containergrenzen pruefen; ohne wissen wir nicht, wann Between-Slots priorisiert werden muessen.
  if (isInsideMyChecks) {
    // Speziallogik nur innerhalb der My-Shim-Flaeche aktivieren; ohne stoert sie Library-Drops.
    const betweenSlots = collectBetweenSlots(); // Between-Slots gesammelt lesen; ohne steckt die Slot-Extraktion wieder inline in der Hauptlogik.
    if (betweenSlots.length > 0) {
      // Nur bei vorhandenen Slots den naechsten Insert-Punkt suchen; ohne waere die Schleife sinnlos.
      let best = betweenSlots[0]; // Mit erstem Slot starten; ohne haetten wir keinen Vergleichswert fuer den Naechsten.
      let bestDist = Math.abs(pointerCoordinates.y - best.centerY); // Anfangsdistanz setzen; ohne funktioniert das Minimum nicht.
      for (let i = 1; i < betweenSlots.length; i++) {
        const d = Math.abs(pointerCoordinates.y - betweenSlots[i].centerY); // Abstand dieses Slots zum Pointer berechnen; ohne kein Nearest-Slot-Verhalten.
        if (d < bestDist) {
          best = betweenSlots[i]; // Neuen besten Slot uebernehmen; ohne bleibt evtl. ein weiter entfernter Slot aktiv.
          bestDist = d; // Vergleichsdistanz aktualisieren; ohne waeren spaetere Vergleiche falsch.
        }
      }
      const container = findDroppableById(best.id); // Container-Objekt zum besten Slot suchen; ohne kann dnd-kit das Ziel nicht aufloesen.
      if (container) {
        return [
          {
            id: best.id, // Besten Zwischen-Slot als Kollisionsziel melden; ohne springt Placeholder nicht an die naechste Position.
            data: { droppableContainer: container, value: bestDist }, // dnd-kit Metadaten mitliefern; ohne unvollstaendiges Collision-Result.
          },
        ];
      }
    }
    const myShimContainer = findDroppableById(MY_SHIM_DROPPABLE_ID); // Fallback auf gesamten My-Shim-Container; ohne gaebe es bei leerer Liste kein Drop-Ziel.
    if (myShimContainer) {
      return [{ id: MY_SHIM_DROPPABLE_ID, data: { droppableContainer: myShimContainer, value: 0 } }]; // Container selbst als Treffer melden; ohne laesst sich auf leeren Bereich nicht droppen.
    }
  }
  const collisions = pointerWithin(args); // Standard-Collision-Fallback nutzen; ohne reagieren andere Drop-Ziele ueberhaupt nicht.
  const between: typeof collisions = [];
  const rest: typeof collisions = [];
  for (const collision of collisions) {
    if (String(collision.id).startsWith(MY_SHIM_BETWEEN_PREFIX)) {
      between.push(collision); // Zwischen-Slots separat priorisieren; ohne verliert der Placeholder seine genaue Position.
    } else {
      rest.push(collision); // Alle anderen Treffer als Fallback behalten; ohne blieben Library/My-Shim-Treffer auf der Strecke.
    }
  }
  return between.length > 0 ? between : rest;
};

/**
 * getSettings: Laedt den aktuellen Settings-Stand fuer Drag-End-Operationen.
 * Zweck: DnD soll immer gegen den neuesten serverseitigen Stand rechnen. Ohne Fetch wuerde applyDragEnd auf stale Daten arbeiten.
 * Eingabe: keine. Ausgabe: SettingsData oder null bei Fehler/ungueltiger Payload.
 */
async function getSettings(): Promise<SettingsData | null> {
  try {
    const r = await fetch("/api/settings"); // Frischen Stand holen; ohne koennen parallele Saves ueberschrieben werden.
    const data = await r.json(); // JSON-Antwort lesen; ohne kann keine Nutzlast validiert werden.
    return data?.presets?.length ? data : null; // Nur valide Settings durchlassen; ohne wuerde Drag-End mit kaputter Payload rechnen.
  } catch {
    return null;
  }
}

/**
 * applyDragEnd: Berechnet den neuen Settings-Stand fuer Library-Remove, Add und Reorder.
 * Zweck: Pure Transformationslogik aus dem Event-Handler auslagern. Ohne diese Funktion waere handleDragEnd schwer test- und wartbar.
 * Eingabe: aktueller Settings-Stand, `activeId`, `overId`. Ausgabe: neuer Settings-Stand oder null bei No-op.
 */
function applyDragEnd(settings: SettingsData, activeId: string, overId: string): SettingsData | null {
  const order = settings.checkOrder ?? []; // Vorhandene Check-Reihenfolge normalisieren; ohne muesste jeder Zweig null/undefined separat behandeln.
  /**
   * isInOrder: Prueft, ob eine Check-ID aktuell in der My-Shim-Reihenfolge liegt.
   * Zweck: Add/Reorder/Remove-Zweige klar unterscheiden. Ohne Helper wuerde dieselbe Includes-Logik mehrfach undokumentiert auftauchen.
   * Eingabe: `id` der Check-Karte. Ausgabe: true, wenn die ID in `order` vorkommt.
   */
  const isInOrder = (id: string) => order.includes(id); // Membership-Check kapseln; ohne waere die Branch-Logik schwerer lesbar.

  /**
   * removeFromOrder: Entfernt eine Check-ID aus der aktuellen Reihenfolge ohne anonymen filter-Callback.
   * Zweck: Deaktivieren eines Checks klar und dokumentierbar abbilden. Ohne Helper bleibt die Remove-Logik als kurze Inline-Funktion versteckt.
   * Eingabe: `id` des zu entfernenden Checks. Ausgabe: neue Reihenfolge ohne diese ID.
   */
  const removeFromOrder = (id: string): string[] => {
    const nextOrder: string[] = [];
    for (const existingId of order) {
      if (existingId !== id) {
        nextOrder.push(existingId); // Nur andere IDs uebernehmen; ohne bleibt der entfernte Check in der aktiven Reihenfolge.
      }
    }
    return nextOrder;
  };

  // Drop on library = deactivate (remove from My Shim)
  if (overId === CHECK_LIBRARY_DROPPABLE_ID) {
    // Library-Drop als Deaktivieren behandeln; ohne wuerde Entfernen aus My Shim nicht funktionieren.
    if (!isInOrder(activeId)) return null; // Nur bereits aktive Checks koennen in die Library zurueckgeschoben werden.
    const nextOrder = removeFromOrder(activeId); // Check aus My-Shim-Reihenfolge entfernen; ohne bleibt er trotz Library-Drop aktiv.
    const nextToggles = { ...settings.checkToggles } as Record<string, boolean>; // Toggle-Kopie erzeugen; ohne direkte Mutation am alten Settings-Objekt.
    nextToggles[activeId] = false; // Check deaktivieren; ohne waere er zwar aus Order, aber logisch noch an.
    return { ...settings, checkOrder: nextOrder, checkToggles: nextToggles as unknown as CheckToggles };
  }

  // Drop on "between" slot in My Checks
  const betweenMatch = overId.startsWith(MY_SHIM_BETWEEN_PREFIX) ? overId.slice(MY_SHIM_BETWEEN_PREFIX.length) : null; // Reine Index-Komponente aus Between-ID extrahieren.
  const insertIndexFromBetween = betweenMatch != null ? parseInt(betweenMatch, 10) : -1; // String-Index in Zahl wandeln; ohne kann kein Insert berechnet werden.
  const isBetweenSlot = insertIndexFromBetween >= 0 && insertIndexFromBetween <= order.length; // Nur gueltige Between-Positionen akzeptieren; ohne drohen Out-of-range Inserts.

  // Drop on My Shim area, on a sortable item, or on a between-slot
  if (overId === MY_SHIM_DROPPABLE_ID || isInOrder(overId) || isBetweenSlot) {
    // Alle My-Shim-bezogenen Drop-Ziele in denselben Add/Reorder-Zweig fuehren.
    const toggles = { ...settings.checkToggles } as Record<string, boolean>; // Toggle-Kopie erzeugen; ohne wird das Ausgangsobjekt mutiert.
    toggles[activeId] = true; // Gedroppten Check aktivieren; ohne waere Add/Reorder visuell da, logisch aber aus.

    if (!isInOrder(activeId)) {
      // Fehlende aktive ID bedeutet: Der Check kommt neu aus der Library.
      // Add from library: insert at index from between-slot, or at end, or before overId
      let insertIndex: number;
      if (isBetweenSlot)
        insertIndex = insertIndexFromBetween; // Zwischen-Slot direkt respektieren; ohne springt Add an falsche Position.
      else if (overId === MY_SHIM_DROPPABLE_ID)
        insertIndex = order.length; // Auf den Container selbst => ans Ende haengen.
      else insertIndex = order.indexOf(overId); // Sonst vor dem getroffenen Element einfuegen; ohne kein erwartbares Sortierverhalten.
      const safeIndex = insertIndex < 0 ? order.length : Math.min(insertIndex, order.length); // Index absichern; ohne koennen -1 oder zu grosse Werte die Liste zerstoeren.
      const nextOrder = [...order.slice(0, safeIndex), activeId, ...order.slice(safeIndex)]; // Neue Reihenfolge mit eingefuegtem Check bauen.
      return { ...settings, checkOrder: nextOrder, checkToggles: toggles as unknown as CheckToggles }; // Add-Ergebnis komplett zurueckgeben; ohne bleibt Persistenz-Handler ohne neuen State.
    }

    // Reorder within My Shim
    const fromIdx = order.indexOf(activeId); // Alte Position des gezogenen Checks finden; ohne kein valider Reorder.
    let toIdx: number;
    if (isBetweenSlot)
      toIdx = insertIndexFromBetween > fromIdx ? insertIndexFromBetween - 1 : insertIndexFromBetween; // Zwischen-Slot relativ zur alten Position korrigieren.
    else if (overId === MY_SHIM_DROPPABLE_ID)
      toIdx = order.length - 1; // Container-Drop bedeutet ans Listenende.
    else toIdx = order.indexOf(overId); // Sonst Zielposition am getroffenen Element orientieren.
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return null; // Ungueltige oder identische Reorders ignorieren; ohne entstehen nutzlose Saves.
    const nextOrder = arrayMove(order, fromIdx, toIdx); // Sortierreihenfolge umstellen; ohne bleibt Reorder nur visuell.
    return { ...settings, checkOrder: nextOrder };
  }

  return null; // Alle unbekannten Drop-Ziele als No-op behandeln; ohne koennte fremdes Ziel unkontrolliert State veraendern.
}

type ShimDndProviderProps = { children: React.ReactNode; onSettingsSaved?: () => void };
/**
 * ShimDndProvider: Kapselt DnD-Kontext, Overlay und Persistenz fuer Check-Library <-> My Shim.
 * Zweck: Dragging, Reordering und Hinzufuegen/Entfernen von Checks zentral steuern. Ohne Provider haetten Kinder keinen gemeinsamen DnD-State.
 * Eingabe: `children` und optional `onSettingsSaved`. Ausgabe: Provider-/DndContext-Baum.
 */
export default function ShimDndProvider({ children, onSettingsSaved }: ShimDndProviderProps) {
  const [activeId, setActiveId] = useState<string | null>(null); // Aktive Drag-ID halten; ohne weiss der Provider nicht, welche Karte gezogen wird.
  const [overId, setOverId] = useState<string | null>(null); // Aktuelles Hover-Ziel halten; ohne fehlen Overlay-Status und Between-Slot-Sync.
  const [activeDragData, setActiveDragData] = useState<CheckDragData | null>(null); // Zusatzdaten fuer Overlay sichern; ohne gehen Tags/Order/Status beim Drag verloren.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), // Kleine Mindestbewegung verlangen; ohne startet Drag schon bei minimalem Klick-Zittern.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }) // Keyboard-DnD aktivieren; ohne ist Reordering per Tastatur nicht moeglich.
  ); // Sensoren einmal zentral konfigurieren; ohne muessten Pointer/Keyboard-Drags separat undonsistent verdrahtet werden.

  /**
   * isKnownCheckId: Prueft, ob die aktive ID zu einer echten Check-Definition gehoert.
   * Zweck: Folgeevents nur fuer echte Check-Karten ausloesen. Ohne Helper bleibt die Erkennung als anonymer some-Callback inline.
   * Eingabe: `candidateId`. Ausgabe: true bei bekannter Check-ID.
   */
  const isKnownCheckId = (candidateId: string): boolean => {
    for (const check of CHECK_DEFINITIONS) {
      if (check.id === candidateId) return true;
    }
    return false;
  };

  /**
   * handleDragStart: Initialisiert lokalen Drag-State fuer Overlay und Poll-Skip.
   * Zweck: Aktive ID und Drag-Daten sofort merken. Ohne Handler wuesste der Provider nicht, welcher Check gerade gezogen wird.
   * Eingabe: `event` vom dnd-kit. Ausgabe: kein Rueckgabewert.
   */
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id)); // Aktive Check-ID speichern; ohne funktioniert weder Overlay noch isDragging.
    setOverId(null); // Altes Hover-Ziel loeschen; ohne kann vom vorherigen Drag ein stale Ziel haengen bleiben.
    const data = event.active.data.current as CheckDragData | undefined; // Mitgelieferte Overlay-Daten aus dem Event lesen.
    setActiveDragData(data ?? null); // Overlay-Daten speichern; ohne fehlen Status/Tags/Order im Drag-Clone.
  };

  /**
   * handleDragOver: Spiegelt das aktuelle Drop-Ziel fuer Overlay und Zwischen-Slot-Anzeige.
   * Zweck: UI muss waehrend des Drags wissen, worueber der Pointer gerade liegt. Ohne Handler bleibt das Overlay statisch.
   * Eingabe: `event` vom dnd-kit. Ausgabe: kein Rueckgabewert.
   */
  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null); // Hover-Ziel setzen oder loeschen; ohne kein korrektes Active/Inactive-Feedback.
  };

  /**
   * handleDragEnd: Persistiert das Ergebnis eines Drops und feuert die passenden UI-Events.
   * Zweck: DnD-Aktion in Settings speichern und Sidebar/Listen synchron halten. Ohne Handler waere Dragging rein visuell.
   * Eingabe: `event` vom dnd-kit. Ausgabe: Promise<void>.
   */
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event; // Drag-Quelle und Drop-Ziel aus dem Abschluss-Event lesen; ohne fehlt jede Persistenzgrundlage.
    const activeIdStr = String(active.id); // Aktive ID frueh normieren; ohne muessten spaetere Vergleiche mehrere Typen abdecken.
    const overIdStr = over && over.id != null ? String(over.id) : null; // Drop-Ziel sicher auf String/null abbilden; ohne waeren Prefix- und Equality-Pruefungen fragil.
    setActiveId(null); // Drag-State zuruecksetzen; ohne bleibt isDragging nach dem Drop faelschlich aktiv.
    setOverId(null); // Hover-Ziel loeschen; ohne haengt der letzte Drop-Status im Overlay fest.
    setActiveDragData(null); // Overlay-Daten loeschen; ohne wird ein alter Drag-Clone weiterverwendet.
    if (!overIdStr) return; // Ohne valides Drop-Ziel keine sichere Persistenz moeglich.
    const settings = await getSettings();
    if (!settings) return; // Ohne aktuellen Settings-Stand keine korrekte Add/Remove/Reorder-Berechnung.
    const next = applyDragEnd(settings, activeIdStr, overIdStr);
    if (!next) return; // No-op nicht speichern; ohne entstehen unnoetige POSTs und Events.
    const wasAddToMyChecks =
      !(settings.checkOrder ?? []).includes(activeIdStr) && (next.checkOrder ?? []).includes(activeIdStr); // Add-vs-Reorder fuer spaetere Events unterscheiden.
    try {
      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" }, // JSON-Request deklarieren; ohne kann das Backend den Payload falsch lesen.
        body: JSON.stringify(next), // Kompletten neuen Settings-Stand speichern; ohne bleibt Dragging nicht dauerhaft.
      });
      if (r.ok && typeof window !== "undefined") {
        window.dispatchEvent(new Event("settings-updated")); // Andere Settings-Leser neu laden; ohne bleiben UI-Bereiche stale.
        const isCheckCardDrag = isKnownCheckId(activeIdStr); // Nur echte Check-DnD-Events weiterreichen; ohne faelschliche Folgeevents moeglich.
        const orderChanged = JSON.stringify(settings.checkOrder ?? []) !== JSON.stringify(next.checkOrder ?? []); // Reihenfolge veraendert? Ohne Vergleich keine gezielten Reorder-Events.
        const togglesChanged = JSON.stringify(settings.checkToggles ?? {}) !== JSON.stringify(next.checkToggles ?? {}); // Aktivierungsstatus veraendert? Ohne Vergleich kein Add/Remove-Signal.
        if (isCheckCardDrag && (orderChanged || togglesChanged)) {
          window.dispatchEvent(
            new CustomEvent("my-checks-saved", {
              detail: wasAddToMyChecks ? { addedCheckId: activeIdStr } : {}, // Nur beim Add die neue Check-ID mitgeben; ohne kann UI nicht gezielt highlighten.
            })
          );
          onSettingsSaved?.(); // Optionalen Save-Callback ausfuehren; ohne koennen Eltern keinen Side-Effect nach DnD triggern.
        }
        const orderBefore = settings.checkOrder ?? []; // Vorherige Reihenfolge fuer Reorder-Erkennung sichern; ohne keine saubere Unterscheidung Add vs Move.
        const wasReorder =
          orderChanged && orderBefore.includes(activeIdStr) && (next.checkOrder ?? []).includes(activeIdStr); // Reorder nur dann, wenn die Karte vorher und nachher in My Shim war.
        if (wasReorder && typeof window !== "undefined") {
          const newIndex = (next.checkOrder ?? []).indexOf(activeIdStr); // Neue Position fuer Reorder-Animation/Sync bestimmen.
          window.dispatchEvent(new CustomEvent("my-checks-reordered", { detail: { movedId: activeIdStr, newIndex } })); // Reorder-Event mit Zielindex senden; ohne fehlt Listen-Sync nach Move.
        }
        if (wasAddToMyChecks && typeof window !== "undefined") {
          const newIndex = (next.checkOrder ?? []).indexOf(activeIdStr); // Auch bei Add die Zielposition melden; ohne kann die UI nicht auf die neue Stelle scrollen.
          window.dispatchEvent(new CustomEvent("my-checks-reordered", { detail: { movedId: activeIdStr, newIndex } })); // Auch Add als neue Position melden; ohne kann die UI den frischen Eintrag nicht fokussieren.
        }
        const wasReturnToLibrary =
          overIdStr === CHECK_LIBRARY_DROPPABLE_ID &&
          (settings.checkOrder ?? []).includes(activeIdStr) &&
          !(next.checkOrder ?? []).includes(activeIdStr);
        if (wasReturnToLibrary && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("check-returned-to-library")); // Library-Rueckgabe melden; ohne kann die Library-UI nicht gezielt reagieren.
        }
      }
    } catch {
      // Fehler hier bewusst schlucken: Drag-End darf die UI nicht hart abbrechen, auch wenn das Persistieren fehlschlaegt.
      // Ohne diesen Catch koennte ein einzelner Netzwerkfehler den gesamten DnD-Flow mit einer ungefangenen Promise verwerfen.
    }
  };

  let activeDef: CheckDef | null = null; // Aktive Check-Definition spaeter fuer das Overlay aufloesen; ohne haette der Drag-Clone keinen Inhalt.
  if (activeId) {
    // Overlay-Definition nur waehrend eines aktiven Drags aufloesen; ohne machen wir pro Render unnoetige Vollscans.
    for (const check of CHECK_DEFINITIONS) {
      if (check.id === activeId) {
        activeDef = check; // Aktive Check-Definition fuer das Overlay merken; ohne fehlt dem Drag-Clone seine Karte.
        break;
      }
    }
  }
  const dndState: DndState = { isDragging: activeId !== null }; // Poll-Skip-Signal aus lokalem Drag-State ableiten; ohne sieht Sidebar nie isDragging=true.

  return (
    <DndStateContext.Provider value={dndState}>
      {" "}
      {/* Drag-Zustand fuer andere Komponenten wie die Poll-Logik freigeben; ohne bleibt der globale Drag-Kontext blind. */}
      {/* DndState fuer Sidebar/Poll bereitstellen; ohne sehen Konsumenten immer nur den Default `isDragging: false`. */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection} // Eigene Between-Slot-Logik einspeisen; ohne ist Drop zwischen Karten unpraezise.
        onDragStart={handleDragStart} // Drag-Start in lokalen Provider-State spiegeln; ohne kein Overlay-/Poll-Skip-Start.
        onDragOver={handleDragOver} // Hover-Ziel live aktualisieren; ohne fehlt Active/Inactive-Umschaltung waehrend des Drags.
        onDragEnd={handleDragEnd} // Drop-Ergebnis persistieren; ohne waeren Drags nur visuelles Feedback ohne Wirkung.
      >
        {
          children /* Eigentlichen Seiteninhalt innerhalb des DnD-Kontexts rendern; ohne koennen Kinder keine Drags starten. */
        }
        {typeof document !== "undefined" && // Nur im Browser portalen; ohne wuerde SSR auf `document` crashen.
          createPortal(
            <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 2147483647 }} aria-hidden>
              {" "}
              {/* Vollbild-Overlay-Container ueber die gesamte App legen; ohne kann der Drag-Clone abgeschnitten werden. */}
              <DragOverlay dropAnimation={null}>
                {" "}
                {/* Native Drop-Animation deaktivieren; ohne kann der Clone unpassend nachfedern und irritieren. */}
                {
                  activeDef ? (
                    <DragOverlayCard def={activeDef} overId={overId} dragData={activeDragData} />
                  ) : null /* Overlay nur rendern, wenn es eine aktive Karte gibt. */
                }
              </DragOverlay>
            </div>,
            document.body // Overlay in `body` portalen; ohne wuerde es von Layout-Containern abgeschnitten/ueberlagert.
          )}
      </DndContext>
    </DndStateContext.Provider>
  );
}
