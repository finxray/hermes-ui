"use client";

import type { HermesEnvResult } from "@hermes-ui/hermes-client";
import { useCallback, useEffect, useState } from "react";
import { fetchHermesEnvKeys } from "@/lib/hermesSkillsClient";

type HermesEnvState = {
  isLoading: boolean;
  result: HermesEnvResult | null;
};

export function useHermesEnvKeys(enabled: boolean) {
  const [state, setState] = useState<HermesEnvState>({ isLoading: enabled, result: null });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({ isLoading: false, result: null });
      return;
    }
    setState((current) => ({ ...current, isLoading: true }));
    const result = await fetchHermesEnvKeys();
    setState({ isLoading: false, result });
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    isLoading: state.isLoading,
    refresh,
    result: state.result,
    categories: state.result?.ok ? state.result.categories : []
  };
}
