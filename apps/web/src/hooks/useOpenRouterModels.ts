"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HermesModelDescriptor, HermesStatusError } from "@hermes-ui/hermes-client";
import { fetchOpenRouterModels } from "@/lib/openRouterModelsClient";

type OpenRouterModelsState = {
  checkedAt: string | null;
  error: HermesStatusError | null;
  isLoading: boolean;
  isRefreshing: boolean;
  models: HermesModelDescriptor[];
};

export function useOpenRouterModels() {
  const [state, setState] = useState<OpenRouterModelsState>({
    checkedAt: null,
    error: null,
    isLoading: true,
    isRefreshing: false,
    models: []
  });
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setState((current) => ({
      ...current,
      isRefreshing: !current.isLoading
    }));
    try {
      const result = await fetchOpenRouterModels();
      if (!mountedRef.current) {
        return;
      }
      setState((current) => ({
        checkedAt: result.checkedAt,
        error: result.error,
        isLoading: false,
        isRefreshing: false,
        models: result.ok ? result.models : current.models
      }));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    return () => {
      mountedRef.current = false;
    };
  }, [refresh]);

  // Re-pull the catalog when the user returns to the tab so a long-open session
  // picks up models launched on OpenRouter since load, without polling on a timer.
  useEffect(() => {
    let lastRefreshAt = Date.now();
    const MIN_REFRESH_INTERVAL_MS = 60_000;
    const maybeRefresh = () => {
      if (document.visibilityState !== "visible") {
        return;
      }
      if (Date.now() - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) {
        return;
      }
      lastRefreshAt = Date.now();
      void refresh();
    };
    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [refresh]);

  return {
    ...state,
    refresh
  };
}
