"use client";

import type { HermesSkillToggleResult, HermesSkillsListResult } from "@hermes-ui/hermes-client";
import { useCallback, useEffect, useState } from "react";
import { fetchHermesSkills, setHermesSkillEnabled as requestHermesSkillEnabled } from "@/lib/hermesSkillsClient";

type HermesSkillsState = {
  isLoading: boolean;
  result: HermesSkillsListResult | null;
};

export function useHermesSkills(enabled: boolean) {
  const [state, setState] = useState<HermesSkillsState>({
    isLoading: enabled,
    result: null
  });
  const [updatingSkillIds, setUpdatingSkillIds] = useState<Set<string>>(() => new Set());

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

  const setSkillEnabled = useCallback(
    async (skillId: string, nextEnabled: boolean): Promise<HermesSkillToggleResult> => {
      setUpdatingSkillIds((current) => new Set(current).add(skillId));
      setState((current) => {
        if (!current.result?.ok) {
          return current;
        }

        return {
          ...current,
          result: {
            ...current.result,
            skills: current.result.skills.map((skill) =>
              skill.id === skillId ? { ...skill, enabled: nextEnabled } : skill
            )
          }
        };
      });

      const result = await requestHermesSkillEnabled(skillId, nextEnabled);
      if (!result.ok) {
        await refresh();
      } else {
        setState((current) => {
          if (!current.result?.ok) {
            return current;
          }

          return {
            ...current,
            result: {
              ...current.result,
              skills: current.result.skills.map((skill) =>
                skill.id === skillId
                  ? { ...(result.skill ?? skill), enabled: result.enabled }
                  : skill
              )
            }
          };
        });
        void refresh();
      }

      setUpdatingSkillIds((current) => {
        const next = new Set(current);
        next.delete(skillId);
        return next;
      });
      return result;
    },
    [refresh]
  );

  return {
    isLoading: state.isLoading,
    refresh,
    result: state.result,
    setSkillEnabled,
    skills: state.result?.skills ?? [],
    updatingSkillIds
  };
}
