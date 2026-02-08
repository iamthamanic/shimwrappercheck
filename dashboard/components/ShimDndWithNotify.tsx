/**
 * Wraps ShimDndProvider and connects it to SettingsSavedContext so the sidebar
 * gets notified when DnD saves (reorder or add from library).
 * Location: /components/ShimDndWithNotify.tsx
 */
"use client";

import React from "react";
import { useSettingsSavedRef } from "./SettingsSavedContext";
import ShimDndProvider from "./ShimDndProvider";

export default function ShimDndWithNotify({ children }: { children: React.ReactNode }) {
  const savedRef = useSettingsSavedRef();
  return <ShimDndProvider onSettingsSaved={() => savedRef.current?.()}>{children}</ShimDndProvider>;
}
