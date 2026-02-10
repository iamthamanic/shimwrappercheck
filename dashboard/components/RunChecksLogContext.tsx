/**
 * Provides last run-checks log segments for the per-check Logs tab.
 * Refetch after running checks so new output is available.
 * running + currentCheckId: live progress when checks run (SSE); My Checks shows spinner on active card.
 * Location: /components/RunChecksLogContext.tsx
 */
"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

export type RunChecksLogState = {
  segments: Record<string, string>;
  timestamp: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
  /** True while run-checks is in progress (streaming). */
  running: boolean;
  /** Check id currently running (from script echo); null when none or not streaming. */
  currentCheckId: string | null;
  setRunning: (v: boolean) => void;
  setCurrentCheckId: (id: string | null) => void;
};

const defaultState: RunChecksLogState = {
  segments: {},
  timestamp: null,
  loading: false,
  refetch: async () => {},
  running: false,
  currentCheckId: null,
  setRunning: () => {},
  setCurrentCheckId: () => {},
};

const RunChecksLogContext = createContext<RunChecksLogState>(defaultState);

export function useRunChecksLog(): RunChecksLogState {
  return useContext(RunChecksLogContext);
}

export function RunChecksLogProvider({ children }: { children: React.ReactNode }) {
  const [segments, setSegments] = useState<Record<string, string>>({});
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentCheckId, setCurrentCheckId] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/run-checks/log");
      const data = await r.json();
      setSegments(data.segments ?? {});
      setTimestamp(data.timestamp ?? null);
    } catch {
      setSegments({});
      setTimestamp(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const value: RunChecksLogState = {
    segments,
    timestamp,
    loading,
    refetch,
    running,
    currentCheckId,
    setRunning,
    setCurrentCheckId,
  };

  return <RunChecksLogContext.Provider value={value}>{children}</RunChecksLogContext.Provider>;
}
