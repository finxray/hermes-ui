"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchHermesSession } from "@/lib/hermesSessionsClient";
import {
  formatHermesProviderLabel,
  resolveCatalogModelIdFromRuntimeModel,
  resolveModelSelectRequest,
  resolveRuntimeModelId,
  type HermesSessionDetail,
  type HermesModelDescriptor,
  type HermesUiCapabilities,
  type NormalizedHermesStatus
} from "@hermes-ui/hermes-client";
import type { ModelChoice, Session, SessionModelPreference } from "@/data/types";

export type HermesSessionModelSyncStatus =
  | "unavailable"
  | "loading"
  | "fallback"
  | "synced"
  | "turn-ready"
  | "verifying"
  | "error";

export type OutgoingHermesModelRequest = {
  catalogModelId: string;
  catalogSource?: HermesModelDescriptor["catalogSource"];
  provider: string | null;
  modelRuntime?: HermesModelDescriptor["runtime"];
  selectionScope?: HermesModelDescriptor["selectionScope"];
  selectModelId: string;
};

export type HermesSessionModelSync = {
  checkedAt: string | null;
  effectiveModel: string | null;
  effectiveProvider: string | null;
  error: string | null;
  hermesSessionId: string | null;
  modelLabel: string;
  modelRequest: OutgoingHermesModelRequest | null;
  modelSelectInProgress: boolean;
  modelState: HermesUiCapabilities["models"];
  providerLabel: string;
  refresh: () => Promise<void>;
  selectModel: (modelId: string) => Promise<void>;
  sessionId: string | null;
  syncStatus: HermesSessionModelSyncStatus;
};

type ExpectedSelection = {
  catalogModelId: string;
  provider: string | null;
};

type SessionModelSnapshot = {
  catalogModelId: string | null;
  checkedAt: string | null;
  effectiveModel: string | null;
  effectiveProvider: string | null;
  error: string | null;
  errorModelId: string | null;
  hermesSessionId: string | null;
  localSessionId: string | null;
  syncStatus: HermesSessionModelSyncStatus;
};

export function useHermesSessionModel({
  activeSession,
  hermesStatus,
  lmStudioModels = [],
  modelChoices,
  openRouterModels = [],
  persistSessionModelPreference,
  refreshHermesStatus
}: {
  activeSession: Session | null;
  hermesStatus: NormalizedHermesStatus | null;
  lmStudioModels?: HermesModelDescriptor[];
  modelChoices: ModelChoice[];
  openRouterModels?: HermesModelDescriptor[];
  persistSessionModelPreference?: (sessionId: string, preference: SessionModelPreference) => void;
  refreshHermesStatus: () => Promise<void>;
}): HermesSessionModelSync {
  const [snapshot, setSnapshot] = useState<SessionModelSnapshot>(() =>
    emptySnapshot(null, null, "unavailable")
  );
  const requestSeqRef = useRef(0);
  const selectionSeqRef = useRef(0);
  const appliedPreferenceKeyRef = useRef<string | null>(null);
  const missingHermesSessionIdsRef = useRef(new Set<string>());
  const snapshotRef = useRef(snapshot);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  const baseModelState = useMemo(
    () => mergeLmStudioModels(
      mergeOpenRouterModels(getProviderModelState(hermesStatus, modelChoices), openRouterModels),
      lmStudioModels
    ),
    [hermesStatus, lmStudioModels, modelChoices, openRouterModels]
  );

  const modelState = useMemo(
    () => applySessionSelectedModel(baseModelState, snapshot.catalogModelId, snapshot.effectiveProvider),
    [baseModelState, snapshot.catalogModelId, snapshot.effectiveProvider]
  );

  const modelRequest = useMemo(() => resolveOutgoingModelRequest(modelState), [modelState]);
  const modelLabel = modelLabelForState(modelState);
  const providerLabel = modelState.currentProviderLabel;

  const loadSessionModel = useCallback(
    async (
      phase: Extract<HermesSessionModelSyncStatus, "loading" | "verifying"> = "loading",
      expected?: ExpectedSelection
    ) => {
      const session = activeSession;
      const canReadHermesSession =
        session &&
        hermesStatus?.mode === "real" &&
        hermesStatus.reachable &&
        hermesStatus.configured;

      if (!session || !canReadHermesSession) {
        setSnapshot(emptySnapshot(session?.id ?? null, session ? resolveHermesSessionId(session) : null, "unavailable"));
        return null;
      }

      const hermesSessionId = resolveHermesSessionId(session);
      const requestId = ++requestSeqRef.current;

      if (!expected && missingHermesSessionIdsRef.current.has(hermesSessionId)) {
        setSnapshot((current) => ({
          ...(current.localSessionId === session.id && current.hermesSessionId === hermesSessionId
            ? current
            : emptySnapshot(session.id, hermesSessionId, "fallback")),
          checkedAt: new Date().toISOString(),
          error: null,
          errorModelId: null,
          hermesSessionId,
          localSessionId: session.id,
          syncStatus: "fallback"
        }));
        return null;
      }

      setSnapshot((current) => {
        const sameSession =
          current.localSessionId === session.id &&
          current.hermesSessionId === hermesSessionId;
        return {
          ...(sameSession ? current : emptySnapshot(session.id, hermesSessionId, phase)),
          error: null,
          errorModelId: null,
          hermesSessionId,
          localSessionId: session.id,
          syncStatus: phase
        };
      });

      const result = await fetchHermesSession(hermesSessionId);
      if (requestSeqRef.current !== requestId) {
        return null;
      }

      if (!result.ok) {
        const message = result.error.message;
        const notFound = isHermesSessionNotFound(result);
        const fallbackOnly = notFound && !expected;
        if (fallbackOnly) {
          missingHermesSessionIdsRef.current.add(hermesSessionId);
        }
        const error = fallbackOnly
          ? null
          : expected
          ? `Hermes accepted the selection request, but the UI could not verify the session model: ${message}`
          : message;
        setSnapshot((current) => ({
          ...(current.localSessionId === session.id && current.hermesSessionId === hermesSessionId
            ? current
            : emptySnapshot(session.id, hermesSessionId, fallbackOnly ? "fallback" : "error")),
          checkedAt: new Date().toISOString(),
          error,
          errorModelId: expected?.catalogModelId ?? null,
          hermesSessionId,
          localSessionId: session.id,
          syncStatus: fallbackOnly ? "fallback" : "error"
        }));
        return null;
      }

      missingHermesSessionIdsRef.current.delete(hermesSessionId);
      const next = snapshotFromHermesSession(
        result.session,
        session.id,
        hermesSessionId,
        baseModelState.availableModels
      );
      const mismatch = expected
        ? expectedMismatchMessage(expected, next.catalogModelId, baseModelState.availableModels)
        : null;
      const verified = {
        ...next,
        error: mismatch,
        errorModelId: mismatch ? next.catalogModelId ?? expected?.catalogModelId ?? null : null,
        syncStatus: mismatch ? "error" as const : "synced" as const
      };
      setSnapshot(verified);
      return verified;
    },
    [activeSession, baseModelState.availableModels, hermesStatus]
  );

  const applySessionModelSelection = useCallback(
    async (selectRequest: OutgoingHermesModelRequest, persistPreference: boolean) => {
      if (!activeSession) {
        return;
      }

      const selectionRequestId = ++selectionSeqRef.current;
      const isCurrentSelectionRequest = () => selectionSeqRef.current === selectionRequestId;
      const selectedModel = baseModelState.availableModels.find(
        (model) => model.id === selectRequest.catalogModelId
      );
      const preference = preferenceFromSelectRequest(selectRequest, selectedModel);
      const preferenceKey = modelPreferenceKey(activeSession.id, preference);
      if (!persistPreference) {
        appliedPreferenceKeyRef.current = preferenceKey;
      }

      setSnapshot((current) => ({
        ...current,
        error: null,
        errorModelId: null,
        syncStatus: "verifying"
      }));

      if (selectRequest.selectionScope === "turn") {
        appliedPreferenceKeyRef.current = preferenceKey;
        if (persistPreference) {
          persistSessionModelPreference?.(activeSession.id, preference);
        }
        setSnapshot(snapshotFromSelectRequest(selectRequest, activeSession, "turn-ready"));
        return;
      }

      try {
        const response = await fetch("/api/hermes/model/select", {
          body: JSON.stringify({
            expectedProviderKey: selectRequest.provider,
            model: selectRequest.selectModelId,
            provider: selectRequest.provider,
            sessionId: resolveHermesSessionId(activeSession),
            sessionTitle: activeSession.title
          }),
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          method: "POST"
        });
        const result = await response.json().catch(() => null);
        if (!isCurrentSelectionRequest()) {
          return;
        }
        if (!response.ok || result?.ok === false) {
          const message =
            result?.error?.message ||
            "Hermes could not switch to that model for this session.";
          setSnapshot((current) => ({
            ...current,
            error: message,
            errorModelId: selectRequest.catalogModelId,
            syncStatus: "error"
          }));
          return;
        }

        if (!isCurrentSelectionRequest()) {
          return;
        }
        const verified = await loadSessionModel("verifying", {
          catalogModelId: selectRequest.catalogModelId,
          provider: selectRequest.provider
        });
        if (!isCurrentSelectionRequest()) {
          return;
        }
        if (verified?.syncStatus === "synced" && !verified.error) {
          appliedPreferenceKeyRef.current = preferenceKey;
          if (persistPreference) {
            persistSessionModelPreference?.(activeSession.id, preference);
          }
        }
        void refreshHermesStatus();
      } catch (error) {
        if (!isCurrentSelectionRequest()) {
          return;
        }
        console.error("Model select error:", error);
        setSnapshot((current) => ({
          ...current,
          error: "Could not reach Hermes to switch models. Try again in a moment.",
          errorModelId: selectRequest.catalogModelId,
          syncStatus: "error"
        }));
      }
    },
    [
      activeSession,
      baseModelState.availableModels,
      loadSessionModel,
      persistSessionModelPreference,
      refreshHermesStatus
    ]
  );

  useEffect(() => {
    const preference = activeSession?.modelPreference;
    if (!activeSession || !preference) {
      appliedPreferenceKeyRef.current = null;
      void loadSessionModel("loading");
      return;
    }

    const selectRequest = resolveOutgoingModelRequest(baseModelState, preference.catalogModelId);
    if (!selectRequest) {
      void loadSessionModel("loading");
      return;
    }

    const preferenceKey = modelPreferenceKey(activeSession.id, preference);
    if (appliedPreferenceKeyRef.current === preferenceKey) {
      return;
    }

    void applySessionModelSelection(selectRequest, false);
  }, [activeSession, applySessionModelSelection, baseModelState, loadSessionModel]);

  const selectModel = useCallback(
    async (modelId: string) => {
      if (!activeSession) {
        return;
      }

      const selectRequest = resolveOutgoingModelRequest(baseModelState, modelId);
      if (!selectRequest) {
        setSnapshot((current) => ({
          ...current,
          error: "That model id is not available for session switching.",
          errorModelId: modelId,
          syncStatus: "error"
        }));
        return;
      }

      await applySessionModelSelection(selectRequest, true);
    },
    [activeSession, applySessionModelSelection, baseModelState]
  );

  const refreshModel = useCallback(async () => {
    const preference = activeSession?.modelPreference;
    if (activeSession && preference) {
      const selectRequest = resolveOutgoingModelRequest(baseModelState, preference.catalogModelId);
      if (selectRequest) {
        await applySessionModelSelection(selectRequest, false);
        return;
      }
    }

    if (activeSession && snapshotRef.current.syncStatus === "turn-ready" && snapshotRef.current.catalogModelId) {
      const selectRequest = resolveOutgoingModelRequest(baseModelState, snapshotRef.current.catalogModelId);
      if (selectRequest?.selectionScope === "turn") {
        setSnapshot(snapshotFromSelectRequest(selectRequest, activeSession, "turn-ready"));
        return;
      }
    }

    await loadSessionModel("loading");
  }, [activeSession, applySessionModelSelection, baseModelState, loadSessionModel]);

  const scopedError =
    !snapshot.error ||
    snapshot.errorModelId && modelState.selectedModelId && snapshot.errorModelId !== modelState.selectedModelId
      ? null
      : snapshot.error;

  return {
    checkedAt: snapshot.checkedAt,
    effectiveModel: snapshot.effectiveModel,
    effectiveProvider: snapshot.effectiveProvider,
    error: scopedError,
    hermesSessionId: snapshot.hermesSessionId,
    modelLabel,
    modelRequest,
    modelSelectInProgress: snapshot.syncStatus === "verifying",
    modelState,
    providerLabel,
    refresh: refreshModel,
    selectModel,
    sessionId: snapshot.localSessionId,
    syncStatus: snapshot.syncStatus
  };
}

function isHermesSessionNotFound(result: Awaited<ReturnType<typeof fetchHermesSession>>) {
  return !result.ok && result.error.kind === "http_error" && result.error.message.includes("HTTP 404");
}

function resolveHermesSessionId(session: Session): string {
  return session.hermesSessionId || `hermes-${session.id}`;
}

function preferenceFromSelectRequest(
  request: OutgoingHermesModelRequest,
  model?: HermesModelDescriptor
): SessionModelPreference {
  return {
    catalogModelId: request.catalogModelId,
    catalogSource: request.catalogSource,
    label: model?.label,
    provider: request.provider,
    selectedAt: new Date().toISOString(),
    selectionScope: request.selectionScope,
    selectModelId: request.selectModelId
  };
}

function modelPreferenceKey(sessionId: string, preference: SessionModelPreference): string {
  return [
    sessionId,
    preference.catalogModelId,
    preference.selectModelId,
    preference.provider ?? "",
    preference.selectionScope ?? "",
    preference.selectedAt
  ].join("|");
}

function snapshotFromSelectRequest(
  request: OutgoingHermesModelRequest,
  session: Session,
  syncStatus: HermesSessionModelSyncStatus
): SessionModelSnapshot {
  return {
    catalogModelId: request.catalogModelId,
    checkedAt: new Date().toISOString(),
    effectiveModel: request.selectModelId,
    effectiveProvider: request.provider,
    error: null,
    errorModelId: null,
    hermesSessionId: resolveHermesSessionId(session),
    localSessionId: session.id,
    syncStatus
  };
}

function getProviderModelState(
  status: NormalizedHermesStatus | null,
  modelChoices: ModelChoice[]
): HermesUiCapabilities["models"] {
  if (status?.uiCapabilities.models) {
    return status.uiCapabilities.models;
  }

  const fallback = modelChoices.find((choice) => choice.id === "hermes-default");
  return {
    availableModels: [],
    clientSelectable: false,
    currentModelLabel: fallback?.label ?? "Hermes server model",
    currentProviderLabel: "Hermes server config",
    fastStreamProfile: "unknown",
    listAvailable: false,
    reason: "Hermes model status has not loaded; runtime selection remains disabled.",
    selectedModelId: null,
    selectionStatus: "unknown",
    serverAdvertisedModel: null,
    serverConfiguredOnly: true,
    uiState: "deferred",
    sessionModelOverrideCapable: false,
    explicitOverrideSupported: false
  };
}

function mergeOpenRouterModels(
  state: HermesUiCapabilities["models"],
  openRouterModels: HermesModelDescriptor[]
): HermesUiCapabilities["models"] {
  if (openRouterModels.length === 0) {
    return state;
  }

  const knownIds = new Set(state.availableModels.map((model) => model.id));
  const extras = openRouterModels.filter((model) => !knownIds.has(model.id));
  if (extras.length === 0) {
    return state;
  }

  return {
    ...state,
    availableModels: [...state.availableModels, ...extras],
    reason:
      state.reason ||
      "Hermes configured models are shown with additional UI-provided OpenRouter catalog models."
  };
}

function mergeLmStudioModels(
  state: HermesUiCapabilities["models"],
  lmStudioModels: HermesModelDescriptor[]
): HermesUiCapabilities["models"] {
  if (lmStudioModels.length === 0) {
    return state;
  }

  const lmStudioById = new Map(lmStudioModels.map((model) => [model.id, model]));
  const mergedModels = state.availableModels.map((model) => {
    const metadata = lmStudioById.get(model.id);
    return metadata ? mergeLmStudioModelMetadata(model, metadata) : model;
  });
  const knownIds = new Set(mergedModels.map((model) => model.id));
  const extras = lmStudioModels.filter((model) => !knownIds.has(model.id));

  if (extras.length === 0 && mergedModels.every((model, index) => model === state.availableModels[index])) {
    return state;
  }

  return {
    ...state,
    availableModels: [...mergedModels, ...extras],
    reason:
      state.reason ||
      "Hermes configured models are shown with additional UI-provided LM Studio runtime metadata."
  };
}

function mergeLmStudioModelMetadata(
  model: HermesModelDescriptor,
  metadata: HermesModelDescriptor
): HermesModelDescriptor {
  return {
    ...model,
    contextLength: metadata.contextLength ?? model.contextLength,
    description: model.description ?? metadata.description,
    inputModalities: model.inputModalities?.length ? model.inputModalities : metadata.inputModalities,
    label: metadata.label || model.label,
    outputModalities: model.outputModalities?.length ? model.outputModalities : metadata.outputModalities,
    provider: model.provider ?? metadata.provider,
    providerKey: model.providerKey ?? metadata.providerKey,
    runtime: {
      ...(model.runtime ?? {}),
      ...(metadata.runtime ?? {})
    },
    supportedParameters: mergeModelStringList(model.supportedParameters, metadata.supportedParameters)
  };
}

function mergeModelStringList(left?: string[], right?: string[]): string[] | undefined {
  const merged = [...(left ?? []), ...(right ?? [])]
    .map((value) => value.trim())
    .filter(Boolean);
  return merged.length > 0 ? [...new Set(merged)] : undefined;
}

function resolveOutgoingModelRequest(
  state: HermesUiCapabilities["models"],
  preferredModelId?: string | null
): OutgoingHermesModelRequest | null {
  if (!state.clientSelectable) {
    return null;
  }
  const candidate = preferredModelId ?? state.selectedModelId;
  const catalogModelId = resolveRuntimeModelId(candidate, state.availableModels);
  if (!catalogModelId) {
    return null;
  }
  const request = resolveModelSelectRequest(catalogModelId, state.availableModels);
  const selectedModel = state.availableModels.find((model) => model.id === catalogModelId);
  return request
    ? {
        ...request,
        modelRuntime: selectedModel?.runtime ?? null
      }
    : null;
}

function snapshotFromHermesSession(
  session: HermesSessionDetail,
  localSessionId: string,
  hermesSessionId: string,
  availableModels: HermesUiCapabilities["models"]["availableModels"]
): SessionModelSnapshot {
  const effectiveModel = session.effectiveModel || session.selectedModel || session.model;
  return {
    catalogModelId: catalogModelIdFromEffectiveModel(effectiveModel, availableModels),
    checkedAt: new Date().toISOString(),
    effectiveModel,
    effectiveProvider: session.effectiveProvider,
    error: null,
    errorModelId: null,
    hermesSessionId,
    localSessionId,
    syncStatus: "synced"
  };
}

function catalogModelIdFromEffectiveModel(
  effectiveModel: string | null | undefined,
  availableModels: HermesUiCapabilities["models"]["availableModels"]
): string | null {
  return resolveCatalogModelIdFromRuntimeModel(effectiveModel, availableModels);
}

function applySessionSelectedModel(
  state: HermesUiCapabilities["models"],
  selectedModelId: string | null,
  effectiveProvider: string | null
): HermesUiCapabilities["models"] {
  const runtimeModelId = resolveRuntimeModelId(selectedModelId, state.availableModels);
  if (!runtimeModelId) {
    return state;
  }
  const selected = state.availableModels.find((model) => model.id === runtimeModelId);
  return {
    ...state,
    currentModelLabel: selected?.label ?? runtimeModelId,
    // Keep the user-facing provider aligned with the catalog/provider the user
    // selected. Hermes may report a lower-level backend route such as NVIDIA
    // for OpenRouter catalog models, but that should not replace the public
    // provider in the Composer or right rail.
    currentProviderLabel:
      selected?.provider ||
      formatHermesProviderLabel(effectiveProvider) ||
      state.currentProviderLabel,
    selectedModelId: runtimeModelId
  };
}

function modelLabelForState(state: HermesUiCapabilities["models"]) {
  if (state.selectionStatus === "unavailable") {
    return "Hermes unavailable";
  }
  if (state.currentModelLabel && state.currentModelLabel !== "Hermes server model") {
    return state.currentModelLabel;
  }
  if (state.selectionStatus === "server-configured" && state.currentModelLabel) {
    return state.currentModelLabel;
  }
  if (state.selectionStatus === "unknown" || !state.currentModelLabel) {
    return "Hermes default";
  }
  return state.currentModelLabel;
}

function expectedMismatchMessage(
  expected: ExpectedSelection,
  actualCatalogModelId: string | null,
  availableModels: HermesUiCapabilities["models"]["availableModels"]
): string | null {
  const expectedRuntime = resolveRuntimeModelId(expected.catalogModelId, availableModels) ?? expected.catalogModelId;
  const actualRuntime = resolveRuntimeModelId(actualCatalogModelId, availableModels) ?? actualCatalogModelId;
  if (actualRuntime === expectedRuntime) {
    return null;
  }
  return `Hermes verified ${actualRuntime ?? "no active model"} instead of requested ${expectedRuntime}. The Composer, rail, and next send now show Hermes' actual session model.`;
}

function emptySnapshot(
  localSessionId: string | null,
  hermesSessionId: string | null,
  syncStatus: HermesSessionModelSyncStatus
): SessionModelSnapshot {
  return {
    catalogModelId: null,
    checkedAt: null,
    effectiveModel: null,
    effectiveProvider: null,
    error: null,
    errorModelId: null,
    hermesSessionId,
    localSessionId,
    syncStatus
  };
}
