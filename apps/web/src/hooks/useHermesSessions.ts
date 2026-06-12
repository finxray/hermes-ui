"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HermesSessionSummary } from "@hermes-ui/hermes-client";
import { fetchHermesSessions } from "@/lib/hermesSessionsClient";

export type HermesSessionsState = {
  sessions: HermesSessionSummary[];
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: string | null;
};

const REFRESH_INTERVAL_MS = 30_000;

export function useHermesSessions(enabled = true) {
  const [state, setState] = useState<HermesSessionsState>({
    sessions: [],
    isLoading: false,
    error: null,
    lastFetchedAt: null
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!enabled || inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setState((prev) => ({ ...prev, isLoading: true }));
    try {
      const result = await fetchHermesSessions();
      if (!mountedRef.current) {
        return;
      }
      if (result.ok) {
        setState({
          sessions: result.sessions,
          isLoading: false,
          error: null,
          lastFetchedAt: new Date().toISOString()
        });
      } else {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error.message
        }));
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      return;
    }
    void load();
    intervalRef.current = setInterval(() => { void load(); }, REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, load]);

  return { ...state, refresh: load };
}
