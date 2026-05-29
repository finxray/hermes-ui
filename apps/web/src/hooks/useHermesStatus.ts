"use client";

import { useCallback, useEffect, useState } from "react";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import { fetchHermesStatus } from "@/lib/hermesStatusClient";

type HermesStatusState = {
  status: NormalizedHermesStatus | null;
  isLoading: boolean;
};

export function useHermesStatus() {
  const [state, setState] = useState<HermesStatusState>({
    status: null,
    isLoading: true
  });

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true }));
    const status = await fetchHermesStatus();
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
