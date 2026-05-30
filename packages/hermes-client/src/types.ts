export type HermesStatusMode = "real" | "mock" | "unconfigured" | "error";

export type HermesStatusError = {
  kind:
    | "disabled"
    | "unconfigured"
    | "invalid_config"
    | "network"
    | "timeout"
    | "http_error"
    | "unknown";
  message: string;
};

export type HermesCapabilityState = "available" | "unavailable" | "unknown" | "deferred";

export type HermesModelSelectionStatus =
  | "server-configured"
  | "client-selectable"
  | "deferred"
  | "unavailable"
  | "unknown";

export type HermesFastStreamProfile = "normal" | "high-throughput" | "unknown";

export type HermesModelDescriptor = {
  id: string;
  label: string;
  provider?: string | null;
};

export type HermesUiCapabilities = {
  status: {
    configured: boolean;
    reachable: boolean;
    mode: HermesStatusMode;
  };
  chat: {
    canSend: boolean;
    sessionChat: boolean;
    sessionStreaming: boolean;
    chatCompletions: boolean;
    chatCompletionsStreaming: boolean;
    responses: boolean;
    responsesStreaming: boolean;
  };
  runs: {
    submission: boolean;
    status: boolean;
    eventsSse: boolean;
    reconnect: HermesCapabilityState;
  };
  tools: {
    registry: boolean;
    skills: boolean;
    toolsets: boolean;
    progressEvents: boolean;
    uiState: HermesCapabilityState;
  };
  approvals: {
    hermesAvailable: boolean;
    uiState: HermesCapabilityState;
  };
  cancellation: {
    runStopEndpoint: boolean;
    streamAbortSupportedByUi: boolean;
    uiState: HermesCapabilityState;
  };
  files: {
    uploadSupported: boolean;
    artifacts: HermesCapabilityState;
    uiState: HermesCapabilityState;
  };
  models: {
    listAvailable: boolean;
    serverAdvertisedModel: string | null;
    serverConfiguredOnly: boolean;
    clientSelectable: boolean;
    availableModels: HermesModelDescriptor[];
    currentModelLabel: string;
    currentProviderLabel: string;
    selectedModelId: string | null;
    selectionStatus: HermesModelSelectionStatus;
    reason: string;
    fastStreamProfile: HermesFastStreamProfile;
    uiState: HermesCapabilityState;
  };
  memory: {
    sessionContinuityHeader: string | null;
    sessionKeyHeader: string | null;
    metadataContextPropagation: HermesCapabilityState;
    instructionBridgeActive: boolean;
    memoryWriteApi: boolean;
  };
  ui: {
    canSendChat: boolean;
    canShowToolActivity: boolean;
    canShowApprovals: boolean;
    canShowFiles: boolean;
    canShowProviderSelector: boolean;
    stopControl: HermesCapabilityState;
  };
};

export type HermesChatError = {
  kind:
    | "disabled"
    | "unconfigured"
    | "invalid_config"
    | "network"
    | "timeout"
    | "http_error"
    | "bad_response"
    | "unknown";
  message: string;
};

export type NormalizedHermesStatus = {
  mode: HermesStatusMode;
  configured: boolean;
  reachable: boolean;
  baseUrl: string | null;
  capabilities: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  models: Record<string, unknown> | null;
  uiCapabilities: HermesUiCapabilities;
  error: HermesStatusError | null;
  checkedAt: string;
};

export type HermesClientConfig = {
  baseUrl?: string | null;
  apiKey?: string | null;
  enabled?: boolean;
  memoryScopeBridgeEnabled?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type HermesEndpointName = "health" | "healthDetailed" | "capabilities" | "models";

export type HermesEndpointResult = {
  name: HermesEndpointName;
  ok: boolean;
  status: number | null;
  data: Record<string, unknown> | null;
  error: HermesStatusError | null;
};

export type HermesChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type HermesChatContext = {
  project: {
    id: string;
    title: string;
    stableKey: string;
    tenantId: string;
    retrievalProfile: string;
    contextPolicy: string;
    pinnedMemoryIds?: string[];
    userVisibleSummary?: string;
  };
  session: {
    id: string;
    title: string;
    stableKey: string;
    hermesSessionId: string;
    includeProjectContext: boolean;
    includeSessionContext: boolean;
    lastContextRefreshAt?: string;
    userVisibleSummary?: string;
  };
  ui: {
    source: "hermes-ui";
    workspaceVersion: number;
  };
};

export type HermesChatRequest = {
  context: HermesChatContext;
  instructions?: string | null;
  message: string;
  recentMessages?: HermesChatHistoryMessage[];
  model?: string | null;
  provider?: string | null;
};

export type HermesNormalizedMessage = {
  role: "assistant";
  content: string;
};

export type HermesChatStreamEvent =
  | {
      type: "message_delta";
      delta: string;
      messageId?: string;
      runId?: string;
    }
  | {
      type: "message_done";
      message: HermesNormalizedMessage;
      messageId?: string;
      runId?: string;
    }
  | {
      type: "tool_event";
      name: string;
      status: "started" | "completed" | "failed";
      payload: Record<string, unknown>;
    }
  | {
      type: "run_event";
      name: string;
      status: string;
      payload: Record<string, unknown>;
    }
  | {
      type: "approval_event";
      name: string;
      status: string;
      payload: Record<string, unknown>;
    }
  | {
      type: "error";
      error: HermesChatError;
    }
  | {
      type: "done";
    };

export type HermesChatStreamResult =
  | {
      ok: true;
      stream: ReadableStream<Uint8Array>;
      hermesSessionId: string;
    }
  | {
      ok: false;
      status: number;
      error: HermesChatError;
    };
