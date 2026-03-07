/**
 * Ref for sidebar settings poll: skip polling when settings page has unsaved changes.
 * Zweck: Verhindert, dass die Sidebar während Bearbeitung auf der Settings-Seite pollt (UX + unnötige Requests).
 * Location: /components/SettingsDirtyContext.tsx
 */
"use client";

import React, { createContext, useContext, useRef } from "react";

/** Fallback für Konsumenten außerhalb des Providers; current false = nicht dirty. */
const dirtyRefDefault = { current: false };
const SettingsDirtyContext = createContext<React.MutableRefObject<boolean>>(dirtyRefDefault);

/**
 * Liefert die Ref, die anzeigt, ob die Settings-Seite ungespeicherte Änderungen hat.
 * Zweck: SidebarMyShim liest dirtyRef.current vor jedem Poll-Tick; bei true wird load() übersprungen.
 * Eingabe: keine. Ausgabe: MutableRefObject<boolean> (current true = dirty).
 */
export function useSettingsDirtyRef(): React.MutableRefObject<boolean> {
  return useContext(SettingsDirtyContext);
}

/**
 * Stellt die Dirty-Ref bereit; Settings-Seite setzt sie, Sidebar liest sie.
 * Ohne Provider würden Konsumenten die Default-Ref (immer false) erhalten.
 */
export function SettingsDirtyProvider({ children }: { children: React.ReactNode }) {
  const dirtyRef = useRef(false);
  return <SettingsDirtyContext.Provider value={dirtyRef}>{children}</SettingsDirtyContext.Provider>;
}
