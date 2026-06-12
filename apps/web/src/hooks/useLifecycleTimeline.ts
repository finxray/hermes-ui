"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLifecycleTimeline } from "@/lib/brainMemoryClient";
import type { BrainMemoryMode, TimelineEvent } from "@hermes-ui/brain-memory-client";

type LifecycleTimelineState = {
  error: string | null;
  events: TimelineEvent[];
  isLoading: boolean;
  mode: BrainMemoryMode | null;
  total: number;
};

/**
 * Pass enabled=false while the Gateway is disconnected/disabled so standalone
 * mode never issues lifecycle requests; the hook reports an idle state instead.
 */
export function useLifecycleTimeline(limit = 20, offset = 0, enabled = true) {
  const [state, setState] = useState<LifecycleTimelineState>({
    error: null,
    events: [],
    isLoading: enabled,
    mode: null,
    total: 0
  });

  const refresh = useCallback(async () => {
    if (!enabled) {
      return;
    }
    setState((current) => ({ ...current, error: null, isLoading: true }));
    const response = await fetchLifecycleTimeline({ limit, offset });
    setState({
      error: response.error?.message ?? null,
      events: response.events,
      isLoading: false,
      mode: response.mode,
      total: response.total
    });
  }, [enabled, limit, offset]);

  const loadMore = useCallback(async () => {
    if (!enabled || state.isLoading || state.events.length >= state.total) {
      return;
    }
    setState((current) => ({ ...current, error: null, isLoading: true }));
    const response = await fetchLifecycleTimeline({
      limit,
      offset: offset + state.events.length
    });
    setState((current) => ({
      error: response.error?.message ?? null,
      events: response.error ? current.events : [...current.events, ...response.events],
      isLoading: false,
      mode: response.mode,
      total: response.error ? current.total : response.total
    }));
  }, [enabled, limit, offset, state.events.length, state.isLoading, state.total]);

  useEffect(() => {
    if (!enabled) {
      setState({ error: null, events: [], isLoading: false, mode: null, total: 0 });
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  return {
    error: state.error,
    events: state.events,
    hasMore: state.events.length < state.total,
    isLoading: state.isLoading,
    loadMore,
    mode: state.mode,
    refresh,
    total: state.total
  };
}
