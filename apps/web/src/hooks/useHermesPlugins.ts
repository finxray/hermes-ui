"use client";

import type { HermesPluginToggleResult, HermesPluginsListResult } from "@hermes-ui/hermes-client";
import { useCallback, useEffect, useState } from "react";
import { fetchHermesPlugins, setHermesPluginEnabled as requestHermesPluginEnabled } from "@/lib/hermesSkillsClient";

type HermesPluginsState = {
  isLoading: boolean;
  result: HermesPluginsListResult | null;
};

export function useHermesPlugins(enabled: boolean) {
  const [state, setState] = useState<HermesPluginsState>({
    isLoading: enabled,
    result: null
  });
  const [updatingPluginIds, setUpdatingPluginIds] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    if (!enabled) {
      setState({ isLoading: false, result: null });
      return;
    }

    setState((current) => ({ ...current, isLoading: current.result === null }));
    const result = await fetchHermesPlugins();
    setState({ isLoading: false, result });
  }, [enabled]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setPluginEnabled = useCallback(
    async (pluginId: string, nextEnabled: boolean): Promise<HermesPluginToggleResult> => {
      setUpdatingPluginIds((current) => new Set(current).add(pluginId));
      setState((current) => {
        if (!current.result?.ok) {
          return current;
        }
        return {
          ...current,
          result: {
            ...current.result,
            plugins: current.result.plugins.map((plugin) =>
              plugin.id === pluginId
                ? { ...plugin, enabled: nextEnabled, status: nextEnabled ? "active" : "disabled" }
                : plugin
            )
          }
        };
      });

      const result = await requestHermesPluginEnabled(pluginId, nextEnabled);
      if (!result.ok) {
        await refresh();
      } else {
        void refresh();
      }

      setUpdatingPluginIds((current) => {
        const next = new Set(current);
        next.delete(pluginId);
        return next;
      });
      return result;
    },
    [refresh]
  );

  return {
    isLoading: state.isLoading,
    plugins: state.result?.plugins ?? [],
    refresh,
    result: state.result,
    setPluginEnabled,
    updatingPluginIds
  };
}
