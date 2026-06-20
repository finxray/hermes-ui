"use client";

import type { HermesSkillsListResult } from "@hermes-ui/hermes-client";
import { useCallback, useEffect, useState } from "react";
import { fetchHermesSkills } from "@/lib/hermesSkillsClient";

type HermesSkillsState = {
  isLoading: boolean;
  result: HermesSkillsListResult | null;
};

export function useHermesSkills(enabled: boolean) {
  const [state, setState] = useState<HermesSkillsState>({
    isLoading: enabled,
    result: null
  });

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({ isLoading: false, result: null });
      return;
    }

    setState((current) => ({ ...current, isLoading: true }));
    const result = await fetchHermesSkills();
    setState({ isLoading: false, result });
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    isLoading: state.isLoading,
    refresh,
    result: state.result,
    skills: state.result?.skills ?? []
  };
}
