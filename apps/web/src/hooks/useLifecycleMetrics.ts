"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLifecycleMetrics } from "@/lib/brainMemoryClient";
import type { LifecycleMetrics } from "@hermes-ui/brain-memory-client";

type LifecycleMetricsState = {
  error: string | null;
  isLoading: boolean;
  metrics: LifecycleMetrics | null;
};

export function useLifecycleMetrics() {
  const [state, setState] = useState<LifecycleMetricsState>({
    error: null,
    isLoading: true,
    metrics: null
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, error: null, isLoading: true }));
    try {
      const metrics = await fetchLifecycleMetrics();
      setState({ error: null, isLoading: false, metrics });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Could not fetch lifecycle metrics.",
        isLoading: false
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    error: state.error,
    isLoading: state.isLoading,
    metrics: state.metrics,
    refresh
  };
}
