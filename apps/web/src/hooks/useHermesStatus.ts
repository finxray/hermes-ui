"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import { fetchHermesStatus } from "@/lib/hermesStatusClient";

const POLL_INTERVAL_MS = 12_000;
const POLL_INTERVAL_ERROR_MS = 30_000;

type HermesStatusState = {
  status: NormalizedHermesStatus | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
};

type HermesStatusRefreshOptions = {
  refreshModels?: boolean;
};

export function useHermesStatus() {
  const [state, setState] = useState<HermesStatusState>({
    status: null,
    isInitialLoading: true,
    isRefreshing: false
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const refresh = useCallback(async (options: HermesStatusRefreshOptions = {}) => {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    setState((current) => ({
      ...current,
      isRefreshing: current.isInitialLoading ? current.isRefreshing : true
    }));
    try {
      const newStatus = await fetchHermesStatus(options);
      if (mountedRef.current) {
        setState((current) => {
          const resolvedStatus = preserveKnownModelOnTransientFailure(current.status, newStatus);
          if (!isMeaningfullyChanged(current.status, resolvedStatus)) {
            return { ...current, isInitialLoading: false, isRefreshing: false };
          }
          return { status: resolvedStatus, isInitialLoading: false, isRefreshing: false };
        });
      }
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    const schedulePoll = (intervalMs: number) => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        void refresh();
      }, intervalMs);
    };

    schedulePoll(POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refresh]);

  useEffect(() => {
    if (intervalRef.current === null) {
      return;
    }
    const intervalMs =
      state.status?.reachable === true ? POLL_INTERVAL_MS : POLL_INTERVAL_ERROR_MS;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      void refresh();
    }, intervalMs);
  }, [refresh, state.status?.reachable]);

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
    (next.mode === "error" || !next.reachable);

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
    modelListSignature(prev) !== modelListSignature(next) ||
    prev.uiCapabilities.models.selectionStatus !== next.uiCapabilities.models.selectionStatus ||
    (prev.error?.message ?? null) !== (next.error?.message ?? null)
  );
}

function modelListSignature(status: NormalizedHermesStatus): string {
  return status.uiCapabilities.models.availableModels
    .map((model) =>
      [
        model.id,
        model.selectModelId ?? "",
        model.providerKey ?? model.provider ?? "",
        model.catalogSource ?? "",
        model.availability ?? ""
      ].join(":")
    )
    .join("|");
}
