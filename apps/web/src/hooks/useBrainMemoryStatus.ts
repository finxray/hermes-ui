"use client";

import { useCallback, useEffect, useState } from "react";
import type { NormalizedBrainMemoryStatus } from "@hermes-ui/brain-memory-client";
import { fetchBrainMemoryStatus } from "@/lib/brainMemoryClient";

type BrainMemoryStatusState = {
  status: NormalizedBrainMemoryStatus | null;
  isLoading: boolean;
};

export function useBrainMemoryStatus() {
  const [state, setState] = useState<BrainMemoryStatusState>({
    status: null,
    isLoading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true }));
    const status = await fetchBrainMemoryStatus();
    setState({ status, isLoading: false });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    isLoading: state.isLoading,
    refresh,
    status: state.status
  };
}
