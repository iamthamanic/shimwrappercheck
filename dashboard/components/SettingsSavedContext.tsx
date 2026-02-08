/**
 * Ref for sidebar to register "on settings saved" callback so DnD provider can notify after reorder/add.
 * Location: /components/SettingsSavedContext.tsx
 */
"use client";

import React, { createContext, useContext, useRef } from "react";

type OnSettingsSaved = () => void;
const refDefault = { current: null as OnSettingsSaved | null };
const SettingsSavedContext = createContext<React.MutableRefObject<OnSettingsSaved | null>>(refDefault);

export function useSettingsSavedRef(): React.MutableRefObject<OnSettingsSaved | null> {
  return useContext(SettingsSavedContext);
}

export function SettingsSavedProvider({ children }: { children: React.ReactNode }) {
  const ref = useRef<OnSettingsSaved | null>(null);
  return <SettingsSavedContext.Provider value={ref}>{children}</SettingsSavedContext.Provider>;
}
