"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLifecycleMetrics } from "@/lib/brainMemoryClient";
import type { BrainMemoryMode, LifecycleMetrics } from "@hermes-ui/brain-memory-client";

type LifecycleMetricsState = {
  error: string | null;
  isLoading: boolean;
  metrics: LifecycleMetrics | null;
  mode: BrainMemoryMode | null;
};

/**
 * Pass enabled=false while the Gateway is disconnected/disabled so standalone
 * mode never issues lifecycle requests; the hook reports an idle state instead.
 */
export function useLifecycleMetrics(enabled = true) {
  const [state, setState] = useState<LifecycleMetricsState>({
    error: null,
    isLoading: enabled,
    metrics: null,
    mode: null
  });

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setState((current) => ({ ...current, error: null, isLoading: true }));
    const response = await fetchLifecycleMetrics();
    setState({
      error: response.error?.message ?? null,
      isLoading: false,
      metrics: response.metrics,
      mode: response.mode
    });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setState({ error: null, isLoading: false, metrics: null, mode: null });
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  return {
    error: state.error,
    isLoading: state.isLoading,
    metrics: state.metrics,
    mode: state.mode,
    refresh
  };
}
