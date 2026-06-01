"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import { fetchHermesStatus } from "@/lib/hermesStatusClient";

const POLL_INTERVAL_MS = 8_000;

type HermesStatusState = {
  status: NormalizedHermesStatus | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
};

export function useHermesStatus() {
  const [state, setState] = useState<HermesStatusState>({
    status: null,
    isInitialLoading: true,
    isRefreshing: false
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setState((current) => ({
      ...current,
      isRefreshing: true
    }));
    const newStatus = await fetchHermesStatus();
    if (mountedRef.current) {
      setState((current) => {
        if (!isMeaningfullyChanged(current.status, newStatus)) {
          return { ...current, isInitialLoading: false, isRefreshing: false };
        }
        return { status: newStatus, isInitialLoading: false, isRefreshing: false };
      });
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    intervalRef.current = setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refresh]);

  return {
    isLoading: state.isInitialLoading,
    isRefreshing: state.isRefreshing,
    refresh,
    status: state.status
  };
}

function isMeaningfullyChanged(
  prev: NormalizedHermesStatus | null,
  next: NormalizedHermesStatus
): boolean {
  if (!prev) {
    return true;
  }
  return (
    prev.mode !== next.mode ||
    prev.reachable !== next.reachable ||
    prev.configured !== next.configured ||
    prev.baseUrl !== next.baseUrl ||
    prev.uiCapabilities.models.currentModelLabel !== next.uiCapabilities.models.currentModelLabel ||
    prev.uiCapabilities.models.selectionStatus !== next.uiCapabilities.models.selectionStatus ||
    (prev.error?.message ?? null) !== (next.error?.message ?? null)
  );
}
