/**
 * Provides last run-checks log segments for the per-check Logs tab.
 * Refetch after running checks so new output is available.
 * Location: /components/RunChecksLogContext.tsx
 */
"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";

export type RunChecksLogState = {
  segments: Record<string, string>;
  timestamp: string | null;
  loading: boolean;
  refetch: () => Promise<void>;
};

const defaultState: RunChecksLogState = {
  segments: {},
  timestamp: null,
  loading: false,
  refetch: async () => {},
};

const RunChecksLogContext = createContext<RunChecksLogState>(defaultState);

export function useRunChecksLog(): RunChecksLogState {
  return useContext(RunChecksLogContext);
}

export function RunChecksLogProvider({ children }: { children: React.ReactNode }) {
  const [segments, setSegments] = useState<Record<string, string>>({});
  const [timestamp, setTimestamp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
  };

  return <RunChecksLogContext.Provider value={value}>{children}</RunChecksLogContext.Provider>;
}
