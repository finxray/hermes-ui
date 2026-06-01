"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import { fetchHermesStatus } from "@/lib/hermesStatusClient";

const POLL_INTERVAL_MS = 8_000;

type HermesStatusState = {
  status: NormalizedHermesStatus | null;
  isLoading: boolean;
};

export function useHermesStatus() {
  const [state, setState] = useState<HermesStatusState>({
    status: null,
    isLoading: true
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, isLoading: true }));
    const status = await fetchHermesStatus();
    if (mountedRef.current) {
      setState({ status, isLoading: false });
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
    isLoading: state.isLoading,
    refresh,
    status: state.status
  };
}
