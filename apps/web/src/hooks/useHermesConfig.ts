"use client";

import type { HermesConfigResult } from "@hermes-ui/hermes-client";
import { useCallback, useEffect, useState } from "react";
import { fetchHermesConfig } from "@/lib/hermesSkillsClient";

type HermesConfigState = {
  isLoading: boolean;
  result: HermesConfigResult | null;
};

export function useHermesConfig(enabled: boolean) {
  const [state, setState] = useState<HermesConfigState>({
    isLoading: enabled,
    result: null
  });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({ isLoading: false, result: null });
      return;
    }

    setState((current) => ({ ...current, isLoading: true }));
    const result = await fetchHermesConfig();
    setState({ isLoading: false, result });
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    isLoading: state.isLoading,
    refresh,
    result: state.result,
    sections: state.result?.ok ? state.result.sections : []
  };
}
