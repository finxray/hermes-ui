"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchLifecycleTimeline } from "@/lib/brainMemoryClient";
import type { TimelineEvent } from "@hermes-ui/brain-memory-client";

type LifecycleTimelineState = {
  error: string | null;
  events: TimelineEvent[];
  isLoading: boolean;
  total: number;
};

export function useLifecycleTimeline(limit = 20, offset = 0) {
  const [state, setState] = useState<LifecycleTimelineState>({
    error: null,
    events: [],
    isLoading: true,
    total: 0
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, error: null, isLoading: true }));
    try {
      const response = await fetchLifecycleTimeline({ limit, offset });
      setState({
        error: null,
        events: response.events,
        isLoading: false,
        total: response.total
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Could not fetch lifecycle timeline.",
        isLoading: false
      }));
    }
  }, [limit, offset]);

  const loadMore = useCallback(async () => {
    if (state.isLoading || state.events.length >= state.total) {
      return;
    }
    setState((current) => ({ ...current, error: null, isLoading: true }));
    try {
      const response = await fetchLifecycleTimeline({
        limit,
        offset: offset + state.events.length
      });
      setState((current) => ({
        error: null,
        events: [...current.events, ...response.events],
        isLoading: false,
        total: response.total
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : "Could not fetch more lifecycle events.",
        isLoading: false
      }));
    }
  }, [limit, offset, state.events.length, state.isLoading, state.total]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    error: state.error,
    events: state.events,
    hasMore: state.events.length < state.total,
    isLoading: state.isLoading,
    loadMore,
    refresh,
    total: state.total
  };
}
