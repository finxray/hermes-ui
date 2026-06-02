"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import { fetchHermesStatus } from "@/lib/hermesStatusClient";

const POLL_INTERVAL_MS = 8_000;

type HermesStatusState = {
  status: NormalizedHermesStatus | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
};

export function useHermesStatus() {
  const [state, setState] = useState<HermesStatusState>({
    status: null,
    isInitialLoading: true,
    isRefreshing: false
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    setState((current) => ({
      ...current,
      isRefreshing: true
    }));
    const newStatus = await fetchHermesStatus();
    if (mountedRef.current) {
      setState((current) => {
        const resolvedStatus = preserveKnownModelOnTransientFailure(current.status, newStatus);
        if (!isMeaningfullyChanged(current.status, resolvedStatus)) {
          return { ...current, isInitialLoading: false, isRefreshing: false };
        }
        return { status: resolvedStatus, isInitialLoading: false, isRefreshing: false };
      });
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
    isLoading: state.isInitialLoading,
    isRefreshing: state.isRefreshing,
    refresh,
    status: state.status
  };
}

function preserveKnownModelOnTransientFailure(
  previous: NormalizedHermesStatus | null,
  next: NormalizedHermesStatus
): NormalizedHermesStatus {
  if (!previous?.reachable || previous.mode !== "real") {
    return next;
  }

  const previousModels = previous.uiCapabilities.models;
  const shouldPreserveModel =
    (previousModels.selectionStatus === "server-configured" ||
      previousModels.selectionStatus === "client-selectable") &&
    Boolean(previousModels.currentModelLabel) &&
    (next.mode === "error" ||
      !next.reachable ||
      next.uiCapabilities.models.selectionStatus === "unavailable" ||
      next.uiCapabilities.models.selectionStatus === "unknown");

  if (!shouldPreserveModel) {
    return next;
  }

  return {
    ...next,
    uiCapabilities: {
      ...next.uiCapabilities,
      models: {
        ...next.uiCapabilities.models,
        availableModels:
          next.uiCapabilities.models.availableModels.length > 0
            ? next.uiCapabilities.models.availableModels
            : previousModels.availableModels,
        currentModelLabel: previousModels.currentModelLabel,
        currentProviderLabel: previousModels.currentProviderLabel,
        clientSelectable: previousModels.clientSelectable,
        selectedModelId: previousModels.selectedModelId ?? next.uiCapabilities.models.selectedModelId,
        selectionStatus: previousModels.selectionStatus,
        serverAdvertisedModel:
          previousModels.serverAdvertisedModel ?? next.uiCapabilities.models.serverAdvertisedModel,
        serverConfiguredOnly: previousModels.serverConfiguredOnly
      }
    }
  };
}

function isMeaningfullyChanged(
  prev: NormalizedHermesStatus | null,
  next: NormalizedHermesStatus
): boolean {
  if (!prev) {
    return true;
  }
  return (
    prev.mode !== next.mode ||
    prev.reachable !== next.reachable ||
    prev.configured !== next.configured ||
    prev.baseUrl !== next.baseUrl ||
    prev.uiCapabilities.models.currentModelLabel !== next.uiCapabilities.models.currentModelLabel ||
    prev.uiCapabilities.models.selectionStatus !== next.uiCapabilities.models.selectionStatus ||
    (prev.error?.message ?? null) !== (next.error?.message ?? null)
  );
}
