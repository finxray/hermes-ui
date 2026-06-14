"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HermesModelDescriptor, HermesStatusError } from "@hermes-ui/hermes-client";
import { fetchLmStudioModels } from "@/lib/lmStudioModelsClient";

type LmStudioModelsState = {
  checkedAt: string | null;
  error: HermesStatusError | null;
  isLoading: boolean;
  isRefreshing: boolean;
  models: HermesModelDescriptor[];
};

export function useLmStudioModels() {
  const [state, setState] = useState<LmStudioModelsState>({
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
      const result = await fetchLmStudioModels();
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
