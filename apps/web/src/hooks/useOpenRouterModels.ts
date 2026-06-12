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

  return {
    ...state,
    refresh
  };
}
