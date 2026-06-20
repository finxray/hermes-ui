export type HermesStatusMode = "real" | "mock" | "unconfigured" | "error";

export type HermesStatusError = {
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

export type HermesCapabilityState = "available" | "unavailable" | "unknown" | "deferred";

export type HermesModelSelectionStatus =
  | "server-configured"
  | "client-selectable"
  | "deferred"
  | "unavailable"
  | "unknown";

export type HermesFastStreamProfile = "normal" | "high-throughput" | "unknown";

export type HermesModelCatalogSource = "hermes-config" | "ui-openrouter" | "ui-lmstudio";

export type HermesModelRuntimeConfig = {
  contextLength?: number | null;
  evalBatchSize?: number | null;
  flashAttention?: boolean | null;
  kCacheQuantizationType?: string | null;
  numExperts?: number | null;
  offloadKvCacheToGpu?: boolean | null;
  parallel?: number | null;
  vCacheQuantizationType?: string | null;
};

export type HermesModelRuntimeMetadata = {
  architecture?: string | null;
  format?: string | null;
  loadedContextLength?: number | null;
  maxContextLength?: number | null;
  params?: string | null;
  quantization?: string | null;
  quantizationBits?: number | null;
  runtimeConfig?: HermesModelRuntimeConfig | null;
  selectedVariant?: string | null;
  sizeBytes?: number | null;
  state?: string | null;
};

export type HermesModelDescriptor = {
  id: string;
  label: string;
  provider?: string | null;
  /** Hermes-owned provider key from GET /v1/models `owned_by`, when present. */
  providerKey?: string | null;
  /** Model id sent to POST /api/sessions/{id}/model. */
  selectModelId?: string;
  /** Where the UI discovered this model. */
  catalogSource?: HermesModelCatalogSource;
  /** Whether selection can be verified through Hermes' session model override. */
  selectionScope?: "session" | "turn";
  description?: string | null;
  contextLength?: number | null;
  created?: number | null;
  inputModalities?: string[];
  outputModalities?: string[];
  supportedParameters?: string[];
  pricing?: {
    prompt?: string | null;
    completion?: string | null;
    request?: string | null;
    image?: string | null;
  } | null;
  runtime?: HermesModelRuntimeMetadata | null;
  /**
   * Local-runtime availability. "not-loaded" means the model is installed in the
   * runtime (e.g. LM Studio) but is not currently loaded, so it cannot serve a
   * request and must be surfaced as a disabled row rather than a selectable one.
   * Undefined/"ready" means the model can be selected normally.
   */
  availability?: "ready" | "not-loaded";
};

export type OpenRouterModelCatalogResult = {
  ok: boolean;
  models: HermesModelDescriptor[];
  checkedAt: string;
  source: "openrouter";
  error: HermesStatusError | null;
};

export type LmStudioModelCatalogResult = {
  ok: boolean;
  models: HermesModelDescriptor[];
  checkedAt: string;
  source: "lmstudio";
  error: HermesStatusError | null;
};

export type HermesModelSelectResult = {
  ok: boolean;
  sessionId: string | null;
  selectedModel: string | null;
  provider: string | null;
  scope: string | null;
  error: HermesStatusError | null;
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
    /** Explicit capability from Hermes GET /v1/capabilities session_model_override.supported */
    sessionModelOverrideCapable: boolean;
    /** True when Hermes explicitly reports session_model_override support */
    explicitOverrideSupported: boolean;
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
  configuredDefaultModelId?: string | null;
  enabled?: boolean;
  memoryScopeBridgeEnabled?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  /**
   * When false, `getHermesStatus` skips the (potentially slow, server-blocking)
   * `/v1/models` fetch and relies on `injectedModels` for the model catalog.
   * Reachability is still resolved from the cheap `/health` probe. Defaults to true.
   */
  includeModels?: boolean;
  /** Separate timeout for the `/v1/models` fetch, which can be far slower than `/health`. */
  modelsTimeoutMs?: number;
  /** Previously-fetched raw `/v1/models` payload to use when the live fetch is skipped or fails. */
  injectedModels?: Record<string, unknown> | null;
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
  modelRuntime?: HermesModelRuntimeMetadata | null;
  /** Legacy wire metadata only; selected models are still verified through Hermes session override. */
  modelSelectionScope?: "session" | "turn" | null;
  provider?: string | null;
};

export type HermesNormalizedMessage = {
  role: "assistant";
  content: string;
};

export type HermesTokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  costUsd?: number;
  provider?: string;
  model?: string;
  upstreamModel?: string;
  generationId?: string;
  finishReason?: string;
  latencyMs?: number;
  requestId?: string;
  requestedModel?: string;
  requestedProvider?: string;
  routeMismatch?: boolean;
  routeVerified?: boolean;
  source?: "provider" | "hermes_usage" | "estimated" | "unavailable";
  timeToFirstTokenMs?: number;
  tokensPerSecond?: number;
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
      usage?: HermesTokenUsage;
    }
  | {
      type: "metadata";
      messageId?: string;
      runId?: string;
      usage?: HermesTokenUsage;
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

export type HermesRunProbeEvent = {
  event: string;
  keys: string[];
  runId?: string;
  timestamp?: string | number;
  deltaPreview?: string;
  outputPreview?: string;
  toolName?: string;
  errorPreview?: string;
};

export type HermesRunsProbeResult = {
  ok: boolean;
  mode: "success" | "skipped" | "failed";
  checkedAt: string;
  prompt: string;
  expectedText: string;
  runId: string | null;
  sessionId: string | null;
  status: string | null;
  finalStatus: Record<string, unknown> | null;
  eventTypes: string[];
  events: HermesRunProbeEvent[];
  assistantTextPreview: string;
  outputPreview: string;
  timings: {
    durationMs: number;
    eventStreamMs: number | null;
  };
  counts: {
    events: number;
    messageDeltaEvents: number;
    toolEvents: number;
    brainMemoryToolEvents: number;
    approvalEvents: number;
  };
  safety: {
    route: "bff-only";
    promptKind: "chat-only" | "memory-probe";
    stopCalled: false;
    approvalCalled: false;
    browserDirectHermes: false;
    memoryMutationRequested: boolean;
  };
  error: HermesChatError | null;
};

export type HermesRunsExperimentalChatResult = Omit<HermesRunsProbeResult, "mode" | "safety"> & {
  mode: "success" | "disabled" | "skipped" | "failed";
  context: {
    projectId: string;
    projectStableKey: string;
    sessionId: string;
    sessionStableKey: string;
    hermesSessionId: string;
    tenantId: string;
  };
  experimental: {
    featureFlag: "HERMES_UI_EXPERIMENTAL_RUNS_MODE";
    enabled: boolean;
    defaultEnabled: false;
    route: "bff-only";
    productionChatUntouched: true;
    memoryScopeBridgeEnabled: boolean;
  };
  safety: HermesRunsProbeResult["safety"] & {
    browserDirectBrainMemory: false;
    directStorageAccess: false;
    productionChatUntouched: true;
  };
};

export type HermesRunStopResult = {
  ok: boolean;
  statusCode: number | null;
  status: string | null;
  body: Record<string, unknown> | null;
  error: HermesChatError | null;
};

export type HermesRunsStopProbeResult = {
  ok: boolean;
  mode: "success" | "skipped" | "failed";
  outcome:
    | "server_stop_effective"
    | "stop_accepted_but_completed"
    | "completed_before_stop"
    | "stop_failed"
    | "skipped"
    | "failed";
  checkedAt: string;
  prompt: string;
  promptAttempt: number;
  runId: string | null;
  sessionId: string | null;
  createStatus: string | null;
  finalStatusName: string | null;
  finalStatus: Record<string, unknown> | null;
  stop: HermesRunStopResult | null;
  stopRequestedAt: string | null;
  stopTrigger: "timer" | "first_message_delta" | null;
  eventTypes: string[];
  events: HermesRunProbeEvent[];
  assistantTextPreview: string;
  outputPreview: string;
  counts: {
    events: number;
    messageDeltaEvents: number;
    toolEvents: number;
    brainMemoryToolEvents: number;
    approvalEvents: number;
  };
  timings: {
    durationMs: number;
    eventStreamMs: number | null;
    stopAfterMs: number;
  };
  completedBeforeStop: boolean;
  serverSideStopEffective: boolean;
  safety: {
    route: "bff-only";
    promptKind: "chat-only-stop-probe";
    stopCalled: boolean;
    approvalCalled: false;
    browserDirectHermes: false;
    memoryMutationRequested: false;
  };
  error: HermesChatError | null;
  blocker: string | null;
};

export type HermesSessionSummary = {
  id: string;
  title: string;
  model: string | null;
  startedAt: string;
  endedAt: string | null;
  messageCount?: number;
};

export type HermesSessionDetail = HermesSessionSummary & {
  effectiveModel: string | null;
  effectiveProvider: string | null;
  selectedModel: string | null;
  modelOverrideActive: boolean;
  modelOverrideScope: string | null;
  modelOverridePersistent: boolean | null;
};

export type HermesSessionMessage = {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt?: string;
};

export type HermesSessionListResult =
  | { ok: true; sessions: HermesSessionSummary[]; error: null }
  | { ok: false; sessions: []; error: HermesStatusError };

export type HermesSessionDetailResult =
  | { ok: true; session: HermesSessionDetail; sessionId: string; error: null }
  | { ok: false; session: null; sessionId: string; error: HermesStatusError };

export type HermesSessionMessagesResult =
  | { ok: true; messages: HermesSessionMessage[]; sessionId: string; error: null }
  | { ok: false; messages: []; sessionId: string; error: HermesStatusError };

export type HermesSessionDeleteResult =
  | { ok: true; error: null }
  | { ok: false; error: HermesStatusError };

export type HermesSkillDescriptor = {
  id: string;
  name: string;
  title: string;
  description: string | null;
  source: string | null;
  category: string | null;
  enabled: boolean | null;
  tags: string[];
};

export type HermesSkillsListResult =
  | {
      ok: true;
      skills: HermesSkillDescriptor[];
      checkedAt: string;
      raw: Record<string, unknown> | null;
      error: null;
    }
  | {
      ok: false;
      skills: [];
      checkedAt: string;
      raw: null;
      error: HermesStatusError;
    };

export type HermesSkillToggleResult =
  | {
      ok: true;
      skillId: string;
      enabled: boolean;
      skill: HermesSkillDescriptor | null;
      checkedAt: string;
      raw: Record<string, unknown> | null;
      error: null;
    }
  | {
      ok: false;
      skillId: string;
      enabled: boolean;
      skill: null;
      checkedAt: string;
      raw: null;
      error: HermesStatusError;
    };

export type HermesRunApprovalChoice = "once" | "session" | "always" | "deny";

export type HermesRunApprovalResult = {
  ok: boolean;
  statusCode: number | null;
  choice: HermesRunApprovalChoice | null;
  resolved: number | null;
  body: Record<string, unknown> | null;
  error: HermesChatError | null;
};

export type HermesRunsApprovalProbeResult = {
  ok: boolean;
  mode: "success" | "skipped" | "failed";
  outcome:
    | "approval_denied_and_reconciled"
    | "approval_approved_and_reconciled"
    | "approval_observed_action_failed"
    | "approval_not_observed"
    | "skipped"
    | "failed";
  checkedAt: string;
  prompt: string;
  runId: string | null;
  sessionId: string | null;
  createStatus: string | null;
  finalStatusName: string | null;
  finalStatus: Record<string, unknown> | null;
  approvalRequiredObserved: boolean;
  approvalActionAttempted: "approve" | "reject" | "none";
  approvalChoice: HermesRunApprovalChoice;
  approval: HermesRunApprovalResult | null;
  approvalRequestedAt: string | null;
  approvalRespondedAt: string | null;
  eventTypes: string[];
  approvalEventTypes: string[];
  events: HermesRunProbeEvent[];
  assistantTextPreview: string;
  outputPreview: string;
  counts: {
    events: number;
    messageDeltaEvents: number;
    toolEvents: number;
    brainMemoryToolEvents: number;
    approvalEvents: number;
  };
  timings: {
    durationMs: number;
    eventStreamMs: number | null;
  };
  activity: {
    approvalActivityEvents: number;
    waitingForApprovalEvents: number;
    completedApprovalEvents: number;
    cancelledApprovalEvents: number;
    rawSecretRendered: boolean;
  };
  safety: {
    route: "bff-only";
    promptKind: "approval-deny-probe";
    stopCalled: false;
    approvalCalled: boolean;
    browserDirectHermes: false;
    memoryMutationRequested: false;
    defaultChoice: "deny";
    productionChatUntouched: true;
  };
  error: HermesChatError | null;
  blocker: string | null;
};
