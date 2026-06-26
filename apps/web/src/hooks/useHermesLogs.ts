"use client";

import type { HermesLogsResult } from "@hermes-ui/hermes-client";
import { useCallback, useEffect, useState } from "react";
import { fetchHermesLogs } from "@/lib/hermesSkillsClient";

type HermesLogsState = {
  isLoading: boolean;
  result: HermesLogsResult | null;
};

export function useHermesLogs(enabled: boolean, file: string) {
  const [state, setState] = useState<HermesLogsState>({ isLoading: enabled, result: null });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({ isLoading: false, result: null });
      return;
    }
    setState((current) => ({ ...current, isLoading: true }));
    const result = await fetchHermesLogs(file);
    setState({ isLoading: false, result });
  }, [enabled, file]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    isLoading: state.isLoading,
    refresh,
    result: state.result,
    lines: state.result?.ok ? state.result.lines : []
  };
}
