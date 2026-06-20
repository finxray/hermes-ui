import type {
  HermesCapabilityState,
  HermesChatError,
  HermesChatContext,
  HermesChatRequest,
  HermesChatStreamEvent,
  HermesChatStreamResult,
  HermesClientConfig,
  HermesEndpointName,
  HermesEndpointResult,
  HermesModelRuntimeMetadata,
  HermesModelDescriptor,
  LmStudioModelCatalogResult,
  OpenRouterModelCatalogResult,
  HermesModelSelectResult,
  HermesRunApprovalChoice,
  HermesRunApprovalResult,
  HermesRunStopResult,
  HermesRunsExperimentalChatResult,
  HermesRunProbeEvent,
  HermesRunsApprovalProbeResult,
  HermesRunsProbeResult,
  HermesRunsStopProbeResult,
  HermesSessionDeleteResult,
  HermesSessionDetail,
  HermesSessionDetailResult,
  HermesSessionListResult,
  HermesSessionMessage,
  HermesSessionMessagesResult,
  HermesSessionSummary,
  HermesSkillDescriptor,
  HermesSkillToggleResult,
  HermesSkillsListResult,
  HermesStatusError,
  HermesTokenUsage,
  HermesUiCapabilities,
  NormalizedHermesStatus
} from "./types";

const DEFAULT_TIMEOUT_MS = 3500;
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const LMSTUDIO_MODELS_URL = "http://127.0.0.1:1234/api/v1/models";
const LOCAL_LMSTUDIO_PROVIDER_KEY = "local-lmstudio";
const PROJECT_DEFAULT_MODEL_ID = "deepseek/deepseek-v4-flash";
const KIMI_K27_CODE_OPENROUTER_MODEL_ID = "moonshotai/kimi-k2.7-code";
const UNSAFE_HTTP_SESSION_PROVIDER_KEYS = new Set(["nvidia", "nous", "ollama", "ollama-local"]);
const STABLE_HERMES_MODEL_ORDER = [
  PROJECT_DEFAULT_MODEL_ID,
  KIMI_K27_CODE_OPENROUTER_MODEL_ID,
  "gpt-oss-120b",
  "zai-glm-4.7"
];

export type {
  HermesCapabilityState,
  HermesChatError,
  HermesChatContext,
  HermesChatHistoryMessage,
  HermesChatRequest,
  HermesChatStreamEvent,
  HermesChatStreamResult,
  HermesClientConfig,
  HermesEndpointName,
  HermesEndpointResult,
  HermesFastStreamProfile,
  HermesModelCatalogSource,
  HermesModelDescriptor,
  HermesModelRuntimeConfig,
  HermesModelRuntimeMetadata,
  LmStudioModelCatalogResult,
  OpenRouterModelCatalogResult,
  HermesModelSelectResult,
  HermesModelSelectionStatus,
  HermesRunApprovalChoice,
  HermesRunApprovalResult,
  HermesRunsExperimentalChatResult,
  HermesRunProbeEvent,
  HermesRunsApprovalProbeResult,
  HermesRunsProbeResult,
  HermesRunStopResult,
  HermesRunsStopProbeResult,
  HermesSessionDeleteResult,
  HermesSessionDetail,
  HermesSessionDetailResult,
  HermesSessionListResult,
  HermesSessionMessage,
  HermesSessionMessagesResult,
  HermesSessionSummary,
  HermesSkillDescriptor,
  HermesSkillToggleResult,
  HermesSkillsListResult,
  HermesStatusError,
  HermesTokenUsage,
  HermesUiCapabilities,
  NormalizedHermesStatus
} from "./types";

const HERMES_RUNS_PROBE_EXPECTED_TEXT = "HERMES_RUNS_PROBE_OK";
const HERMES_RUNS_PROBE_PROMPT = `Reply exactly: ${HERMES_RUNS_PROBE_EXPECTED_TEXT}`;
const HERMES_RUNS_EXPERIMENTAL_CHAT_EXPECTED_TEXT = "HERMES_RUNS_EXPERIMENTAL_CHAT_OK";
const RUNS_PROBE_TIMEOUT_MS = 20_000;
const RUNS_STOP_PROBE_TIMEOUT_MS = 45_000;
const RUNS_STOP_PROBE_STOP_AFTER_MS = 650;
const HERMES_RUNS_STOP_PROBE_PROMPTS = [
  "Count from 1 to 2000, one number per line. Do not summarize, skip numbers, or use tools.",
  "Count from 1 to 10000, one number per line. Do not summarize, skip numbers, or use tools."
];
const HERMES_RUNS_APPROVAL_PROBE_EXPECTED_TEXT = "HERMES_RUNS_APPROVAL_PROBE_DONE";
const HERMES_RUNS_APPROVAL_PROBE_COMMAND = "rm -rf /tmp/hermes-ui-approval-probe-nonexistent";
const HERMES_RUNS_APPROVAL_PROBE_PROMPT = [
  "This is a controlled Hermes Runs approval diagnostic.",
  `Use the terminal tool to attempt exactly this command: ${HERMES_RUNS_APPROVAL_PROBE_COMMAND}`,
  "Do not use any other tool or command.",
  "After the approval decision is resolved, reply exactly:",
  HERMES_RUNS_APPROVAL_PROBE_EXPECTED_TEXT
].join("\n");
const RUNS_APPROVAL_PROBE_TIMEOUT_MS = 60_000;
const PROBE_PREVIEW_LIMIT = 600;
const MODEL_LABEL_ACRONYMS: Record<string, string> = {
  ai: "AI",
  api: "API",
  glm: "GLM",
  gpt: "GPT",
  oss: "OSS",
  ui: "UI"
};
const MODEL_LABEL_UNITS = new Set(["b", "k", "m"]);

export async function getHermesStatus(
  config: HermesClientConfig
): Promise<NormalizedHermesStatus> {
  const checkedAt = new Date().toISOString();

  if (config.enabled === false) {
    return withUiCapabilities({
      mode: "mock",
      configured: false,
      reachable: false,
      baseUrl: null,
      capabilities: null,
      health: null,
      models: null,
      error: {
        kind: "disabled",
        message: "Real Hermes status is disabled for this UI process."
      },
      checkedAt
    }, config);
  }

  if (!config.baseUrl?.trim()) {
    return withUiCapabilities({
      mode: "unconfigured",
      configured: false,
      reachable: false,
      baseUrl: null,
      capabilities: null,
      health: null,
      models: null,
      error: {
        kind: "unconfigured",
        message: "Set HERMES_API_BASE_URL to enable real Hermes status checks."
      },
      checkedAt
    }, config);
  }

  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return withUiCapabilities({
      mode: "error",
      configured: true,
      reachable: false,
      baseUrl: null,
      capabilities: null,
      health: null,
      models: null,
      error: {
        kind: "invalid_config",
        message: "HERMES_API_BASE_URL must be a valid http:// or https:// URL."
      },
      checkedAt
    }, config);
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const includeModels = config.includeModels !== false;
  const modelsTimeoutMs = config.modelsTimeoutMs ?? timeoutMs;

  // `/health` is cheap and is the single source of truth for reachability. The
  // expensive `/v1/models` fetch is kept off this critical path: while Hermes is
  // busy answering `/v1/models` it cannot answer `/health`, so coupling them lets
  // one slow model listing flip the whole UI to "unreachable".
  const healthResult = await fetchEndpoint({
    apiKey: config.apiKey,
    auth: false,
    base,
    fetchImpl,
    name: "health",
    path: "/health",
    timeoutMs
  });

  if (!healthResult.ok) {
    return withUiCapabilities(
      {
        mode: "error",
        configured: true,
        reachable: false,
        baseUrl: safeDisplayUrl(base),
        capabilities: null,
        health: null,
        models: null,
        error: healthResult.error ?? {
          kind: "unknown",
          message: "Hermes did not return a successful health response."
        },
        checkedAt
      },
      config
    );
  }

  // `/health/detailed` and `/v1/capabilities` are both cheap, so they stay on the
  // fast path. Only `/v1/models` is slow enough to block Hermes and must be gated.
  const [healthDetailedResult, capabilitiesResult] = await Promise.all([
    fetchEndpoint({
      apiKey: config.apiKey,
      auth: false,
      base,
      fetchImpl,
      name: "healthDetailed",
      path: "/health/detailed",
      timeoutMs
    }),
    fetchEndpoint({
      apiKey: config.apiKey,
      auth: true,
      base,
      fetchImpl,
      name: "capabilities",
      path: "/v1/capabilities",
      timeoutMs
    })
  ]);

  const modelsResult = includeModels
    ? await fetchEndpoint({
        apiKey: config.apiKey,
        auth: true,
        base,
        fetchImpl,
        name: "models",
        path: "/v1/models",
        timeoutMs: modelsTimeoutMs
      })
    : null;

  const results: HermesEndpointResult[] = [
    healthResult,
    healthDetailedResult,
    capabilitiesResult,
    ...(modelsResult ? [modelsResult] : [])
  ];

  const capabilities = getData(results, "capabilities");
  const health = {
    basic: getData(results, "health"),
    detailed: getData(results, "healthDetailed")
  };
  // Reuse the last-known model catalog when the live fetch was skipped or failed
  // so the model selector does not blank out on a transient `/v1/models` stall.
  const models = getData(results, "models") ?? config.injectedModels ?? null;
  const reachable = healthResult.ok;

  if (!reachable) {
    return withUiCapabilities({
      mode: "error",
      configured: true,
      reachable: false,
      baseUrl: safeDisplayUrl(base),
      capabilities: null,
      health: null,
      models: null,
      error: firstError(results) ?? {
        kind: "unknown",
        message: "Hermes did not return a successful health or capability response."
      },
      checkedAt
    }, config);
  }

  return withUiCapabilities({
    mode: "real",
    configured: true,
    reachable: true,
    baseUrl: safeDisplayUrl(base),
    capabilities,
    health,
    models,
    error: null,
    checkedAt
  }, config);
}

export async function getOpenRouterModelCatalog(options: {
  apiKey?: string | null;
  baseUrl?: string | null;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
} = {}): Promise<OpenRouterModelCatalogResult> {
  const checkedAt = new Date().toISOString();
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = openRouterModelsUrl(options.baseUrl);
  const abort = createLinkedAbortController(options.signal, options.timeoutMs ?? 8_000);
  const headers = new Headers({
    Accept: "application/json"
  });
  if (options.apiKey?.trim()) {
    headers.set("Authorization", `Bearer ${options.apiKey.trim()}`);
  }

  try {
    const response = await fetchImpl(endpoint, {
      cache: "no-store",
      headers,
      method: "GET",
      signal: abort.signal
    });

    if (!response.ok) {
      const data = await readJsonObject(response);
      return {
        ok: false,
        models: [],
        checkedAt,
        source: "openrouter",
        error: {
          kind: "http_error",
          message: await safeHermesErrorMessageFromData(response.status, data, "/api/v1/models")
        }
      };
    }

    const data = await readJsonObject(response);
    return {
      ok: true,
      models: normalizeOpenRouterModels(data),
      checkedAt,
      source: "openrouter",
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      models: [],
      checkedAt,
      source: "openrouter",
      error: normalizeChatFetchError(error)
    };
  } finally {
    abort.cleanup();
  }
}

export async function getLmStudioModelCatalog(options: {
  apiKey?: string | null;
  baseUrl?: string | null;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  timeoutMs?: number;
} = {}): Promise<LmStudioModelCatalogResult> {
  const checkedAt = new Date().toISOString();
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = lmStudioModelsUrl(options.baseUrl);
  const abort = createLinkedAbortController(options.signal, options.timeoutMs ?? 4_000);
  const headers = new Headers({
    Accept: "application/json"
  });
  if (options.apiKey?.trim()) {
    headers.set("Authorization", `Bearer ${options.apiKey.trim()}`);
  }

  try {
    const response = await fetchImpl(endpoint, {
      cache: "no-store",
      headers,
      method: "GET",
      signal: abort.signal
    });

    if (!response.ok) {
      const data = await readJsonObject(response);
      return {
        ok: false,
        models: [],
        checkedAt,
        source: "lmstudio",
        error: {
          kind: "http_error",
          message: await safeHermesErrorMessageFromData(response.status, data, "/api/v1/models")
        }
      };
    }

    const data = await readJsonObject(response);
    return {
      ok: true,
      models: normalizeLmStudioModels(data),
      checkedAt,
      source: "lmstudio",
      error: null
    };
  } catch (error) {
    return {
      ok: false,
      models: [],
      checkedAt,
      source: "lmstudio",
      error: mapChatErrorToStatusError(normalizeChatFetchError(error))
    };
  } finally {
    abort.cleanup();
  }
}

export function normalizeHermesUiCapabilities(
  status: Omit<NormalizedHermesStatus, "uiCapabilities">,
  options: { configuredDefaultModelId?: string | null; memoryScopeBridgeEnabled?: boolean } = {}
): HermesUiCapabilities {
  const features = objectRecord(status.capabilities?.features);
  const endpoints = objectRecord(status.capabilities?.endpoints);
  const configuredDefaultCandidates = extractConfiguredDefaultModelIds(
    status,
    options.configuredDefaultModelId
  );
  const catalogModels = modelDescriptors(status.models).filter((model) => !isPlaceholderHermesModelId(model.id));
  const selectableModels = preferPublicProviderCatalogModels(
    catalogModels.filter(isSessionSelectableCatalogModel)
  );
  const rawServerAdvertisedModel =
    configuredDefaultCandidates[0] ||
    asString(status.capabilities?.model) ||
    firstModelId(status.models) ||
    null;
  const serverAdvertisedModel = resolveAdvertisedModelId(
    rawServerAdvertisedModel,
    selectableModels,
    configuredDefaultCandidates
  );
  const orderedModels = orderModelsWithDefaultFirst(selectableModels, serverAdvertisedModel);
  const modelsListAvailable = Boolean(status.models) || hasEndpoint(endpoints, "models");
  const sessionModelOverrideObj = objectRecord(status.capabilities?.session_model_override);
  const explicitOverrideSupported = Boolean(sessionModelOverrideObj?.supported === true);
  const hasSessionModelEndpoint = hasEndpoint(endpoints, "session_model");
  const clientSelectable =
    status.mode === "real" &&
    explicitOverrideSupported &&
    selectableModels.length > 1 &&
    hasSessionModelEndpoint;
  const modelState = normalizeModelUiState({
    availableModels: orderedModels,
    catalogModels,
    clientSelectable,
    listAvailable: modelsListAvailable,
    serverAdvertisedModel,
    statusMode: status.mode
  });
  const sessionChat = flag(features, "session_chat") || hasEndpoint(endpoints, "session_chat");
  const sessionStreaming =
    flag(features, "session_chat_streaming") || hasEndpoint(endpoints, "session_chat_stream");
  const chatCompletions =
    flag(features, "chat_completions") || hasEndpoint(endpoints, "chat_completions");
  const chatCompletionsStreaming = flag(features, "chat_completions_streaming");
  const responses = flag(features, "responses_api") || hasEndpoint(endpoints, "responses");
  const responsesStreaming = flag(features, "responses_streaming");
  const runSubmission = flag(features, "run_submission") || hasEndpoint(endpoints, "runs");
  const runStatus = flag(features, "run_status") || hasEndpoint(endpoints, "run_status");
  const runEvents = flag(features, "run_events_sse") || hasEndpoint(endpoints, "run_events");
  const runStop = flag(features, "run_stop") || hasEndpoint(endpoints, "run_stop");
  const approvalEvents = flag(features, "approval_events");
  const approvalResponse =
    flag(features, "run_approval_response") || hasEndpoint(endpoints, "run_approval");
  const skills = flag(features, "skills_api") || hasEndpoint(endpoints, "skills");
  const toolsets = hasEndpoint(endpoints, "toolsets");
  const progressEvents = flag(features, "tool_progress_events");
  const sessionContinuityHeader = asString(features?.session_continuity_header) || null;
  const sessionKeyHeader = asString(features?.session_key_header) || null;
  const canSend = status.mode === "real" && status.reachable && sessionStreaming;

  return {
    status: {
      configured: status.configured,
      mode: status.mode,
      reachable: status.reachable
    },
    chat: {
      canSend,
      chatCompletions,
      chatCompletionsStreaming,
      responses,
      responsesStreaming,
      sessionChat,
      sessionStreaming
    },
    runs: {
      eventsSse: runEvents,
      reconnect: runEvents && runStatus ? "available" : runEvents ? "unknown" : "unavailable",
      status: runStatus,
      submission: runSubmission
    },
    tools: {
      progressEvents,
      registry: skills || toolsets,
      skills,
      toolsets,
      uiState: progressEvents ? "available" : skills || toolsets ? "deferred" : "unavailable"
    },
    approvals: {
      hermesAvailable: approvalEvents && approvalResponse,
      uiState: approvalEvents && approvalResponse ? "deferred" : "unavailable"
    },
    cancellation: {
      runStopEndpoint: runStop,
      streamAbortSupportedByUi: canSend,
      uiState: canSend ? "available" : runStop ? "deferred" : "unavailable"
    },
    files: {
      artifacts: "unknown",
      uiState: "deferred",
      uploadSupported: false
    },
    models: {
      availableModels: orderedModels,
      clientSelectable,
      currentModelLabel: modelState.currentModelLabel,
      currentProviderLabel: modelState.currentProviderLabel,
      fastStreamProfile: modelState.fastStreamProfile,
      listAvailable: modelsListAvailable,
      reason: modelState.reason,
      selectedModelId: modelState.selectedModelId,
      selectionStatus: modelState.selectionStatus,
      serverAdvertisedModel,
      serverConfiguredOnly: !clientSelectable,
      uiState: clientSelectable ? "available" : "deferred",
      sessionModelOverrideCapable: explicitOverrideSupported,
      explicitOverrideSupported
    },
    memory: {
      instructionBridgeActive: options.memoryScopeBridgeEnabled !== false,
      memoryWriteApi: flag(features, "memory_write_api"),
      metadataContextPropagation: "unknown",
      sessionContinuityHeader,
      sessionKeyHeader
    },
    ui: {
      canSendChat: canSend,
      canShowApprovals: false,
      canShowFiles: false,
      canShowProviderSelector: false,
      canShowToolActivity: progressEvents,
      stopControl: canSend ? "available" : runStop ? "deferred" : "unavailable"
    }
  };
}

export async function streamHermesSessionChat(
  config: HermesClientConfig,
  request: HermesChatRequest
): Promise<HermesChatStreamResult> {
  if (config.enabled === false) {
    return chatFailure(503, "disabled", "Real Hermes chat is disabled for this UI process.");
  }

  if (!config.baseUrl?.trim()) {
    return chatFailure(503, "unconfigured", "Set HERMES_API_BASE_URL to enable Hermes chat.");
  }

  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return chatFailure(
      500,
      "invalid_config",
      "HERMES_API_BASE_URL must be a valid http:// or https:// URL."
    );
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const hermesSessionId = sanitizeHermesId(request.context.session.hermesSessionId);
  const memoryScopeKey = sanitizeHeaderValue(request.context.project.stableKey);
  const supportsSessionStream = await checkSessionStreamingCapability({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    signal: config.signal,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });

  if (supportsSessionStream === false) {
    return chatFailure(
      501,
      "bad_response",
      "This Hermes server does not advertise session chat streaming support."
    );
  }

  const sessionResult = await ensureHermesSession({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    model: null,
    signal: config.signal,
    sessionId: hermesSessionId,
    sessionTitle: request.context.session.title,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });

  if (!sessionResult.ok) {
    return sessionResult;
  }

  const runtimeModelId = resolveRuntimeModelId(request.model);
  if (runtimeModelId) {
    const modelResult = await selectHermesModel(config, hermesSessionId, runtimeModelId, {
      expectedProviderKey: request.provider ?? null,
      provider: request.provider ?? null,
      sessionTitle: request.context.session.title
    });
    if (!modelResult.ok) {
      const error = modelResult.error ?? {
        kind: "http_error" as const,
        message: "Failed to apply the selected Hermes model for this session."
      };
      const status =
        error.kind === "timeout" || error.kind === "network"
          ? 502
          : error.kind === "disabled" || error.kind === "unconfigured"
            ? 503
            : error.kind === "invalid_config"
              ? 500
              : 400;
      return chatFailure(
        status,
        error.kind === "unknown" ? "http_error" : error.kind,
        error.message
      );
    }
  }

  const abort = createLinkedAbortController(config.signal, config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = new Headers({
    Accept: "text/event-stream",
    "Content-Type": "application/json"
  });
  applyHermesAuth(headers, config.apiKey);
  if (memoryScopeKey) {
    headers.set("X-Hermes-Session-Key", memoryScopeKey);
  }

  let response: Response;
  try {
    response = await fetchImpl(buildEndpointUrl(base, `/api/sessions/${encodeURIComponent(hermesSessionId)}/chat/stream`), {
      body: JSON.stringify({
        conversation_history: request.recentMessages ?? [],
        input: request.message,
        instructions: request.instructions || undefined,
        // Current Hermes API-server routing is verified through the session
        // model endpoint above. These fields are preserved for diagnostics and
        // for future Hermes versions that may expose provider-aware chat routes.
        model: runtimeModelId || undefined,
        provider: request.provider || undefined,
        metadata: {
          context: request.context,
          memory_scope_bridge_enabled: Boolean(request.instructions),
          model_runtime: request.modelRuntime ?? null,
          model_selection_scope: request.modelSelectionScope ?? null,
          project_id: request.context.project.id,
          project_title: request.context.project.title,
          provider: request.provider ?? null,
          requested_model: runtimeModelId ?? null,
          requested_provider: request.provider ?? null,
          studio_session_id: request.context.session.id
        }
      }),
      cache: "no-store",
      headers,
      method: "POST",
      signal: abort.signal
    });
  } catch (error) {
    abort.cleanup();
    return {
      ok: false,
      status: isAbortError(error) ? 499 : 502,
      error: normalizeChatFetchError(error)
    };
  }
  abort.clearTimeout();

  if (!response.ok) {
    abort.cleanup();
    const message = await safeHermesErrorMessage(response, "/api/sessions/{session_id}/chat/stream");
    return chatFailure(response.status, "http_error", message);
  }

  if (!response.body) {
    abort.cleanup();
    return chatFailure(502, "bad_response", "Hermes did not return a streaming response body.");
  }

  return {
    ok: true,
    hermesSessionId,
    stream: normalizeHermesSseStream(
      response.body,
      abort,
      runtimeModelId
        ? emptyAssistantModelFallback(runtimeModelId, request.provider)
        : undefined
    )
  };
}

export function isPlaceholderHermesModelId(modelId: string | null | undefined): boolean {
  if (!modelId) {
    return false;
  }
  const normalized = modelId.trim().toLowerCase();
  return (
    normalized === "hermes-agent" ||
    normalized === "hermes-default" ||
    normalized === "hermes" ||
    normalized === "default"
  );
}

export function isSessionSelectableCatalogModel(descriptor: HermesModelDescriptor): boolean {
  const providerKey = (descriptor.providerKey ?? descriptor.provider ?? "").trim().toLowerCase();
  const id = descriptor.id.trim().toLowerCase();

  if (isPlaceholderHermesModelId(descriptor.id)) {
    return false;
  }

  // Copilot catalog entries are listed by GET /v1/models but not session-switchable.
  if (providerKey === "copilot") {
    return false;
  }

  // Do not offer provider families known to misroute or reject this HTTP
  // selector. OpenRouter and LM Studio providers are allowed and verified after
  // selection by validateDedicatedProviderSelect.
  if (UNSAFE_HTTP_SESSION_PROVIDER_KEYS.has(providerKey)) {
    return false;
  }

  // Cerebras has been removed from the local Hermes config; keep stale direct
  // entries out if a cached/provider catalog still advertises them.
  if (providerKey.startsWith("cerebras")) {
    return false;
  }

  // Embedding and other non-chat models.
  if (id.includes("embed") || id.startsWith("text-embedding")) {
    return false;
  }

  // Ollama-style runtime tags.
  if (id.includes(":")) {
    return false;
  }

  // LM Studio local providers are selectable through the provider-aware Hermes
  // session-model endpoint. Other local runtimes stay out until they are
  // verified through the same path.
  const isLmStudioProvider = providerKey === "lmstudio" || providerKey.includes("lmstudio");
  if (providerKey.startsWith("local-") && !isLmStudioProvider) {
    return false;
  }

  // Hermes currently rejects OpenRouter ids that repeat the provider prefix.
  if (id.startsWith("openrouter/")) {
    return false;
  }

  return true;
}

export function resolveCatalogModelIdFromRuntimeModel(
  modelId: string | null | undefined,
  availableModels: HermesModelDescriptor[] = []
): string | null {
  if (!modelId) {
    return null;
  }
  if (availableModels.some((model) => model.id === modelId)) {
    return modelId;
  }
  const matchedSelectId = availableModels.find((model) => model.selectModelId === modelId);
  if (matchedSelectId) {
    return matchedSelectId.id;
  }

  const aliasKey = catalogAliasKey(modelId);
  const matchedAlias = availableModels.find((model) => catalogAliasKey(model.id) === aliasKey);
  return matchedAlias?.id ?? modelId;
}

export function formatHermesModelLabel(modelId: string): string {
  const slug = (modelId.includes("/") ? modelId.split("/").pop() : modelId)?.trim();
  if (!slug) {
    return modelId;
  }

  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(formatModelLabelSegment)
    .join(" ");
}

export function formatHermesProviderLabel(provider: string | null | undefined): string {
  const raw = provider?.trim();
  if (!raw) {
    return "";
  }
  const normalized = raw.toLowerCase();
  if (normalized.startsWith("cerebras")) {
    return "Cerebras";
  }
  if (normalized === "openrouter" || normalized.startsWith("openrouter-")) {
    return "OpenRouter";
  }
  if (normalized === "nous") {
    return "Nous";
  }
  if (normalized === "nvidia") {
    return "NVIDIA";
  }
  if (normalized === "lmstudio" || normalized === LOCAL_LMSTUDIO_PROVIDER_KEY || normalized.startsWith("local-lmstudio")) {
    return "LM Studio";
  }
  if (normalized === "anthropic") {
    return "Anthropic";
  }
  if (normalized === "openai") {
    return "OpenAI";
  }
  if (normalized === "moonshot" || normalized === "kimi") {
    return "Moonshot";
  }
  if (normalized === "zai" || normalized === "z.ai") {
    return "Z.ai";
  }
  if (normalized.startsWith("local-")) {
    return raw.replace(/^local-/i, "Local ");
  }
  return raw
    .split(/[-_]+/)
    .filter(Boolean)
    .map(formatModelLabelSegment)
    .join(" ");
}

function formatModelLabelSegment(segment: string): string {
  const lower = segment.toLowerCase();
  const acronym = MODEL_LABEL_ACRONYMS[lower];
  if (acronym) {
    return acronym;
  }
  const numberWithUnit = segment.match(/^(\d+)([a-z]+)$/i);
  if (numberWithUnit && MODEL_LABEL_UNITS.has(numberWithUnit[2].toLowerCase())) {
    return `${numberWithUnit[1]}${numberWithUnit[2].toUpperCase()}`;
  }
  const expertArchitecture = segment.match(/^[a-z]\d+[a-z]$/i);
  if (expertArchitecture) {
    return segment.toUpperCase();
  }
  const version = segment.match(/^v(\d+)$/i);
  if (version) {
    return `V${version[1]}`;
  }
  if (lower === "deepseek") {
    return "DeepSeek";
  }
  if (lower === "openrouter") {
    return "OpenRouter";
  }
  if (lower === "openai") {
    return "OpenAI";
  }
  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

export function findHermesModelDescriptor(
  availableModels: HermesModelDescriptor[],
  catalogModelId: string | null | undefined
): HermesModelDescriptor | undefined {
  if (!catalogModelId) {
    return undefined;
  }
  return availableModels.find((model) => model.id === catalogModelId);
}

export function resolveModelSelectRequest(
  catalogModelId: string | null | undefined,
  availableModels: HermesModelDescriptor[] = []
): {
  catalogModelId: string;
  catalogSource?: HermesModelDescriptor["catalogSource"];
  provider: string | null;
  selectionScope?: HermesModelDescriptor["selectionScope"];
  selectModelId: string;
} | null {
  const descriptor = findHermesModelDescriptor(availableModels, catalogModelId);
  if (!descriptor) {
    if (!catalogModelId || isPlaceholderHermesModelId(catalogModelId)) {
      return null;
    }
    return {
      catalogModelId,
      catalogSource: undefined,
      provider: null,
      selectionScope: undefined,
      selectModelId: catalogModelId
    };
  }

  return {
    catalogModelId: descriptor.id,
    catalogSource: descriptor.catalogSource,
    provider: descriptor.providerKey ?? descriptor.provider ?? null,
    selectionScope: descriptor.selectionScope,
    selectModelId: descriptor.selectModelId || descriptor.id
  };
}

export function resolveRuntimeModelId(
  modelId: string | null | undefined,
  availableModels: HermesModelDescriptor[] = []
): string | null {
  if (!modelId || isPlaceholderHermesModelId(modelId)) {
    return null;
  }
  if (availableModels.length === 0) {
    return modelId;
  }
  return availableModels.some((model) => model.id === modelId) ? modelId : null;
}

export async function selectHermesModel(
  config: HermesClientConfig,
  sessionId: string,
  modelId: string,
  options: {
    expectedProviderKey?: string | null;
    provider?: string | null;
    sessionTitle?: string;
  } = {}
): Promise<HermesModelSelectResult> {
  if (isPlaceholderHermesModelId(modelId)) {
    return {
      ok: false,
      sessionId: null,
      selectedModel: null,
      provider: null,
      scope: null,
      error: {
        kind: "http_error",
        message:
          "Placeholder model ids such as 'hermes-agent' cannot be selected. Use GET /v1/models for real model ids."
      }
    };
  }

  if (config.enabled === false) {
    return {
      ok: false,
      sessionId: null,
      selectedModel: null,
      provider: null,
      scope: null,
      error: { kind: "disabled", message: "Real Hermes is disabled for this UI process." }
    };
  }

  if (!config.baseUrl?.trim()) {
    return {
      ok: false,
      sessionId: null,
      selectedModel: null,
      provider: null,
      scope: null,
      error: { kind: "unconfigured", message: "Set HERMES_API_BASE_URL to enable Hermes model switching." }
    };
  }

  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return {
      ok: false,
      sessionId: null,
      selectedModel: null,
      provider: null,
      scope: null,
      error: { kind: "invalid_config", message: "HERMES_API_BASE_URL must be a valid URL." }
    };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const safeSessionId = sanitizeHermesId(sessionId);
  const sessionResult = await ensureHermesSession({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    model: null,
    signal: config.signal,
    sessionId: safeSessionId,
    sessionTitle: options.sessionTitle || safeSessionId,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });

  if (!sessionResult.ok) {
    return {
      ok: false,
      sessionId: null,
      selectedModel: null,
      provider: null,
      scope: null,
      error: mapChatErrorToStatusError(
        sessionResult.error ?? {
          kind: "http_error",
          message: "Failed to ensure Hermes session before model selection."
        }
      )
    };
  }

  const abort = createLinkedAbortController(config.signal, config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = new Headers({ "Content-Type": "application/json" });
  applyHermesAuth(headers, config.apiKey);

  try {
    const response = await fetchImpl(
      buildEndpointUrl(base, `/api/sessions/${encodeURIComponent(safeSessionId)}/model`),
      {
        body: JSON.stringify({
          model: modelId,
          scope: "session",
          global: false,
          ...(options.provider ? { provider: options.provider } : {})
        }),
        cache: "no-store",
        headers,
        method: "POST",
        signal: abort.signal
      }
    );

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const bodyRecord = objectRecord(body);
      const errorRecord = objectRecord(bodyRecord?.error);
      const message = asString(errorRecord?.message) || `HTTP ${response.status}`;
      return {
        ok: false,
        sessionId: null,
        selectedModel: null,
        provider: null,
        scope: null,
        error: { kind: "http_error", message }
      };
    }

    const data = await response.json().catch(() => ({}));
    const record = objectRecord(data);
    const result: HermesModelSelectResult = {
      ok: true,
      sessionId: asString(record?.session_id) || safeSessionId,
      selectedModel:
        asString(record?.effective_model) ||
        asString(record?.selected_model) ||
        asString(record?.model) ||
        modelId,
      provider:
        asString(record?.effective_provider) || asString(record?.provider) || null,
      scope: asString(record?.scope) || "session",
      error: null
    };
    const providerMismatch = validateDedicatedProviderSelect(options.expectedProviderKey, result);
    if (providerMismatch) {
      return {
        ok: false,
        sessionId: null,
        selectedModel: null,
        provider: null,
        scope: null,
        error: providerMismatch
      };
    }
    return result;
  } catch (error) {
    const normalized = normalizeChatFetchError(error);
    return {
      ok: false,
      sessionId: null,
      selectedModel: null,
      provider: null,
      scope: null,
      error: {
        kind: normalized.kind === "bad_response" ? "unknown" : normalized.kind,
        message: normalized.message
      }
    };
  } finally {
    abort.cleanup();
  }
}

export async function runHermesRunsProbe(
  config: HermesClientConfig,
  options: {
    conversationHistory?: HermesChatRequest["recentMessages"];
    expectedText?: string;
    instructions?: string;
    memoryMutationRequested?: boolean;
    memoryScopeKey?: string | null;
    model?: string | null;
    prompt?: string;
    promptKind?: HermesRunsProbeResult["safety"]["promptKind"];
    sessionId?: string;
    timeoutMs?: number;
  } = {}
): Promise<HermesRunsProbeResult> {
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();
  const prompt = options.prompt ?? HERMES_RUNS_PROBE_PROMPT;
  const expectedText = options.expectedText ?? HERMES_RUNS_PROBE_EXPECTED_TEXT;
  const timeoutMs = options.timeoutMs ?? RUNS_PROBE_TIMEOUT_MS;
  const sessionId = sanitizeHermesId(
    options.sessionId ?? `hermes-ui-runs-probe-${Date.now().toString(36)}`
  );

  const baseResult = {
    checkedAt,
    expectedText,
    prompt,
    runId: null,
    sessionId,
    status: null,
    finalStatus: null,
    eventTypes: [],
    events: [],
    assistantTextPreview: "",
    outputPreview: "",
    timings: {
      durationMs: 0,
      eventStreamMs: null
    },
    counts: {
      events: 0,
      messageDeltaEvents: 0,
      toolEvents: 0,
      brainMemoryToolEvents: 0,
      approvalEvents: 0
    },
    safety: {
      route: "bff-only" as const,
      promptKind: options.promptKind ?? "chat-only",
      stopCalled: false as const,
      approvalCalled: false as const,
      browserDirectHermes: false as const,
      memoryMutationRequested: Boolean(options.memoryMutationRequested)
    }
  };

  const finish = (
    result: Omit<HermesRunsProbeResult, "timings"> & {
      timings?: Partial<HermesRunsProbeResult["timings"]>;
    }
  ): HermesRunsProbeResult => ({
    ...result,
    timings: {
      durationMs: Date.now() - startedAt,
      eventStreamMs: result.timings?.eventStreamMs ?? null
    }
  });

  if (config.enabled === false) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      error: {
        kind: "disabled",
        message: "Real Hermes is disabled for this UI process."
      }
    });
  }

  if (!config.baseUrl?.trim()) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      error: {
        kind: "unconfigured",
        message: "Set HERMES_API_BASE_URL to enable the Hermes Runs probe."
      }
    });
  }

  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "failed",
      error: {
        kind: "invalid_config",
        message: "HERMES_API_BASE_URL must be a valid http:// or https:// URL."
      }
    });
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const capabilities = await fetchJsonEndpoint({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    path: "/v1/capabilities",
    signal: config.signal,
    timeoutMs
  });

  if (!capabilities.ok) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      error: capabilities.error
    });
  }

  const features = objectRecord(capabilities.data?.features);
  if (
    features &&
    (features.run_submission === false ||
      features.run_status === false ||
      features.run_events_sse === false)
  ) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      error: {
        kind: "bad_response",
        message: "Hermes does not advertise the required Runs probe capabilities."
      }
    });
  }

  const createResult = await createHermesRun({
    apiKey: config.apiKey,
    base,
    conversationHistory: options.conversationHistory,
    fetchImpl,
    instructions: options.instructions,
    memoryScopeKey: options.memoryScopeKey ?? "hermes-ui-runs-probe",
    model: options.model,
    prompt,
    sessionId,
    signal: config.signal,
    timeoutMs
  });

  if (!createResult.ok) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "failed",
      error: createResult.error
    });
  }

  const eventStartedAt = Date.now();
  const eventsResult = await readHermesRunEvents({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    runId: createResult.runId,
    signal: config.signal,
    timeoutMs
  });
  const eventStreamMs = Date.now() - eventStartedAt;

  const statusResult = await getHermesRunStatus({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    runId: createResult.runId,
    signal: config.signal,
    timeoutMs
  });

  if (!eventsResult.ok) {
    return finish({
      ...baseResult,
      runId: createResult.runId,
      status: createResult.status,
      ok: false,
      mode: "failed",
      error: eventsResult.error,
      timings: { eventStreamMs }
    });
  }

  const events = eventsResult.events;
  const eventTypes = Array.from(new Set(events.map((event) => event.event))).sort();
  const assistantText = eventsResult.rawEvents
    .filter((event) => asString(event.event) === "message.delta")
    .map((event) => asString(event.delta))
    .join("");
  const output = asString(statusResult.ok ? statusResult.data.output : null) ||
    asString(eventsResult.rawEvents.find((event) => asString(event.event) === "run.completed")?.output);
  const finalStatus = statusResult.ok ? statusResult.data : null;
  const finalStatusName = asString(finalStatus?.status) || createResult.status;
  const combinedText = `${assistantText}\n${output}`;
  const toolEvents = events.filter((event) => event.event.startsWith("tool."));
  const brainMemoryToolEvents = toolEvents.filter((event) =>
    normalizeName(event.toolName ?? "").includes("brain_memory") ||
    normalizeName(event.toolName ?? "").includes("memory")
  );
  const approvalEvents = events.filter((event) => event.event.startsWith("approval."));
  const messageDeltaEvents = events.filter((event) => event.event === "message.delta");
  const success =
    finalStatusName === "completed" &&
    eventTypes.includes("run.completed") &&
    combinedText.includes(expectedText);

  return finish({
    ...baseResult,
    runId: createResult.runId,
    status: finalStatusName || createResult.status,
    finalStatus,
    eventTypes,
    events,
    assistantTextPreview: truncatePreview(assistantText),
    outputPreview: truncatePreview(output),
    counts: {
      events: events.length,
      messageDeltaEvents: messageDeltaEvents.length,
      toolEvents: toolEvents.length,
      brainMemoryToolEvents: brainMemoryToolEvents.length,
      approvalEvents: approvalEvents.length
    },
    ok: success,
    mode: success ? "success" : "failed",
    error: success
      ? null
      : {
          kind: "bad_response",
          message: "Hermes Runs probe did not complete with the expected assistant text."
        },
    timings: { eventStreamMs }
  });
}

export async function runHermesRunsExperimentalChat(
  config: HermesClientConfig,
  request: HermesChatRequest,
  options: {
    expectedText?: string;
    experimentalEnabled: boolean;
    memoryScopeBridgeEnabled?: boolean;
    timeoutMs?: number;
  }
): Promise<HermesRunsExperimentalChatResult> {
  const expectedText = options.expectedText ?? HERMES_RUNS_EXPERIMENTAL_CHAT_EXPECTED_TEXT;
  const checkedAt = new Date().toISOString();
  const context = publicExperimentalRunsContext(request);
  const safety = experimentalRunsSafety(false);

  if (!options.experimentalEnabled) {
    return {
      ok: false,
      mode: "disabled",
      checkedAt,
      prompt: request.message,
      expectedText,
      runId: null,
      sessionId: context.hermesSessionId,
      status: null,
      finalStatus: null,
      eventTypes: [],
      events: [],
      assistantTextPreview: "",
      outputPreview: "",
      timings: {
        durationMs: 0,
        eventStreamMs: null
      },
      counts: emptyRunsProbeCounts(),
      context,
      experimental: experimentalRunsMetadata(false, options.memoryScopeBridgeEnabled !== false),
      safety,
      error: {
        kind: "disabled",
        message: "Set HERMES_UI_EXPERIMENTAL_RUNS_MODE=true to enable this BFF-only Runs path."
      }
    };
  }

  const result = await runHermesRunsProbe(
    config,
    {
      conversationHistory: request.recentMessages,
      expectedText,
      instructions: request.instructions ?? undefined,
      memoryMutationRequested: false,
      memoryScopeKey: request.context.project.stableKey,
      model: request.model,
      prompt: request.message,
      promptKind: "chat-only",
      sessionId: request.context.session.hermesSessionId,
      timeoutMs: options.timeoutMs
    }
  );

  return {
    ...result,
    context,
    experimental: experimentalRunsMetadata(true, options.memoryScopeBridgeEnabled !== false),
    safety: experimentalRunsSafety(false)
  };
}

export async function runHermesRunsStopProbe(
  config: HermesClientConfig,
  options: {
    sessionId?: string;
    stopAfterMs?: number;
    timeoutMs?: number;
  } = {}
): Promise<HermesRunsStopProbeResult> {
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? RUNS_STOP_PROBE_TIMEOUT_MS;
  const stopAfterMs = options.stopAfterMs ?? RUNS_STOP_PROBE_STOP_AFTER_MS;
  const sessionId = sanitizeHermesId(
    options.sessionId ?? `hermes-ui-runs-stop-probe-${Date.now().toString(36)}`
  );
  const baseResult = {
    checkedAt,
    prompt: HERMES_RUNS_STOP_PROBE_PROMPTS[0],
    promptAttempt: 1,
    runId: null,
    sessionId,
    createStatus: null,
    finalStatusName: null,
    finalStatus: null,
    stop: null,
    stopRequestedAt: null,
    stopTrigger: null,
    eventTypes: [],
    events: [],
    assistantTextPreview: "",
    outputPreview: "",
    counts: {
      events: 0,
      messageDeltaEvents: 0,
      toolEvents: 0,
      brainMemoryToolEvents: 0,
      approvalEvents: 0
    },
    timings: {
      durationMs: 0,
      eventStreamMs: null,
      stopAfterMs
    },
    completedBeforeStop: false,
    serverSideStopEffective: false,
    safety: {
      route: "bff-only" as const,
      promptKind: "chat-only-stop-probe" as const,
      stopCalled: false,
      approvalCalled: false as const,
      browserDirectHermes: false as const,
      memoryMutationRequested: false as const
    },
    blocker: null
  };

  const finish = (
    result: Omit<HermesRunsStopProbeResult, "timings"> & {
      timings?: Partial<HermesRunsStopProbeResult["timings"]>;
    }
  ): HermesRunsStopProbeResult => ({
    ...result,
    timings: {
      durationMs: Date.now() - startedAt,
      eventStreamMs: result.timings?.eventStreamMs ?? null,
      stopAfterMs
    }
  });

  if (config.enabled === false) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      outcome: "skipped",
      error: {
        kind: "disabled",
        message: "Real Hermes is disabled for this UI process."
      },
      blocker: "Real Hermes is disabled for this UI process."
    });
  }

  if (!config.baseUrl?.trim()) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      outcome: "skipped",
      error: {
        kind: "unconfigured",
        message: "Set HERMES_API_BASE_URL to enable the Hermes Runs stop probe."
      },
      blocker: "HERMES_API_BASE_URL is not configured."
    });
  }

  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "failed",
      outcome: "failed",
      error: {
        kind: "invalid_config",
        message: "HERMES_API_BASE_URL must be a valid http:// or https:// URL."
      },
      blocker: "HERMES_API_BASE_URL is invalid."
    });
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const capabilities = await fetchJsonEndpoint({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    path: "/v1/capabilities",
    signal: config.signal,
    timeoutMs
  });

  if (!capabilities.ok) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      outcome: "skipped",
      error: capabilities.error,
      blocker: capabilities.error.message
    });
  }

  const features = objectRecord(capabilities.data?.features);
  if (
    features &&
    (features.run_submission === false ||
      features.run_status === false ||
      features.run_events_sse === false ||
      features.run_stop === false)
  ) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      outcome: "skipped",
      error: {
        kind: "bad_response",
        message: "Hermes does not advertise the required Runs stop capabilities."
      },
      blocker: "Hermes does not advertise run_submission, run_status, run_events_sse, and run_stop."
    });
  }

  let lastResult: HermesRunsStopProbeResult | null = null;
  for (let index = 0; index < HERMES_RUNS_STOP_PROBE_PROMPTS.length; index += 1) {
    const attempt = await runSingleHermesRunsStopAttempt({
      apiKey: config.apiKey,
      base,
      fetchImpl,
      prompt: HERMES_RUNS_STOP_PROBE_PROMPTS[index],
      promptAttempt: index + 1,
      sessionId: index === 0 ? sessionId : `${sessionId}-retry`,
      signal: config.signal,
      stopAfterMs,
      timeoutMs
    });

    lastResult = finish({
      ...baseResult,
      ...attempt,
      ok: attempt.stop?.ok === true && attempt.outcome !== "stop_failed" && attempt.outcome !== "failed",
      mode: attempt.mode,
      error: attempt.error,
      blocker: attempt.blocker
    });

    if (!lastResult.completedBeforeStop || index === HERMES_RUNS_STOP_PROBE_PROMPTS.length - 1) {
      break;
    }
  }

  return lastResult ?? finish({
    ...baseResult,
    ok: false,
    mode: "failed",
    outcome: "failed",
    error: {
      kind: "unknown",
      message: "Hermes Runs stop probe did not execute."
    },
    blocker: "Hermes Runs stop probe did not execute."
  });
}

export async function runHermesRunsApprovalProbe(
  config: HermesClientConfig,
  options: {
    choice?: HermesRunApprovalChoice;
    sessionId?: string;
    timeoutMs?: number;
  } = {}
): Promise<HermesRunsApprovalProbeResult> {
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs ?? RUNS_APPROVAL_PROBE_TIMEOUT_MS;
  const approvalChoice = sanitizeApprovalChoice(options.choice) ?? "deny";
  const sessionId = sanitizeHermesId(
    options.sessionId ?? `hermes-ui-runs-approval-probe-${Date.now().toString(36)}`
  );
  const baseResult = {
    checkedAt,
    prompt: HERMES_RUNS_APPROVAL_PROBE_PROMPT,
    runId: null,
    sessionId,
    createStatus: null,
    finalStatusName: null,
    finalStatus: null,
    approvalRequiredObserved: false,
    approvalActionAttempted: "none" as const,
    approvalChoice,
    approval: null,
    approvalRequestedAt: null,
    approvalRespondedAt: null,
    eventTypes: [],
    approvalEventTypes: [],
    events: [],
    assistantTextPreview: "",
    outputPreview: "",
    counts: {
      events: 0,
      messageDeltaEvents: 0,
      toolEvents: 0,
      brainMemoryToolEvents: 0,
      approvalEvents: 0
    },
    timings: {
      durationMs: 0,
      eventStreamMs: null
    },
    activity: {
      approvalActivityEvents: 0,
      waitingForApprovalEvents: 0,
      completedApprovalEvents: 0,
      cancelledApprovalEvents: 0,
      rawSecretRendered: false
    },
    safety: runsApprovalSafety(false),
    blocker: null
  };

  const finish = (
    result: Omit<HermesRunsApprovalProbeResult, "timings"> & {
      timings?: Partial<HermesRunsApprovalProbeResult["timings"]>;
    }
  ): HermesRunsApprovalProbeResult => ({
    ...result,
    timings: {
      durationMs: Date.now() - startedAt,
      eventStreamMs: result.timings?.eventStreamMs ?? null
    }
  });

  if (config.enabled === false) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      outcome: "skipped",
      error: {
        kind: "disabled",
        message: "Real Hermes is disabled for this UI process."
      },
      blocker: "Real Hermes is disabled for this UI process."
    });
  }

  if (!config.baseUrl?.trim()) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      outcome: "skipped",
      error: {
        kind: "unconfigured",
        message: "Set HERMES_API_BASE_URL to enable the Hermes Runs approval probe."
      },
      blocker: "HERMES_API_BASE_URL is not configured."
    });
  }

  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "failed",
      outcome: "failed",
      error: {
        kind: "invalid_config",
        message: "HERMES_API_BASE_URL must be a valid http:// or https:// URL."
      },
      blocker: "HERMES_API_BASE_URL is invalid."
    });
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const capabilities = await fetchJsonEndpoint({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    path: "/v1/capabilities",
    signal: config.signal,
    timeoutMs
  });

  if (!capabilities.ok) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      outcome: "skipped",
      error: capabilities.error,
      blocker: capabilities.error.message
    });
  }

  const features = objectRecord(capabilities.data?.features);
  if (
    features &&
    (features.run_submission === false ||
      features.run_status === false ||
      features.run_events_sse === false ||
      features.run_approval_response === false ||
      features.approval_events === false)
  ) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "skipped",
      outcome: "skipped",
      error: {
        kind: "bad_response",
        message: "Hermes does not advertise the required Runs approval capabilities."
      },
      blocker: "Hermes does not advertise run submission/status/events plus approval events/response."
    });
  }

  const createResult = await createHermesRun({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    instructions: [
      "This is an opt-in approval diagnostic for a local Web UI.",
      "Use the terminal tool only for the exact command requested by the user.",
      "Do not use Brain Memory, files, web browsing, external network resources, or any other tools.",
      "If the approval is denied, do not retry and do not attempt a different command.",
      `After the approval decision is resolved, reply exactly ${HERMES_RUNS_APPROVAL_PROBE_EXPECTED_TEXT}.`
    ].join("\n"),
    memoryScopeKey: "hermes-ui-runs-approval-probe",
    prompt: HERMES_RUNS_APPROVAL_PROBE_PROMPT,
    sessionId,
    signal: config.signal,
    timeoutMs
  });

  if (!createResult.ok) {
    return finish({
      ...baseResult,
      ok: false,
      mode: "failed",
      outcome: "failed",
      error: createResult.error,
      blocker: createResult.error.message
    });
  }

  const eventStartedAt = Date.now();
  const eventsResult = await readHermesRunEventsWithApproval({
    apiKey: config.apiKey,
    approvalChoice,
    base,
    fetchImpl,
    runId: createResult.runId,
    signal: config.signal,
    timeoutMs
  });
  const eventStreamMs = Date.now() - eventStartedAt;

  const finalStatusResult = await pollHermesRunUntilStable({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    runId: createResult.runId,
    signal: config.signal,
    timeoutMs: Math.min(timeoutMs, 12_000)
  });

  if (!eventsResult.ok) {
    return finish({
      ...baseResult,
      runId: createResult.runId,
      createStatus: createResult.status,
      ok: false,
      mode: "failed",
      outcome: "failed",
      error: eventsResult.error,
      blocker: eventsResult.error.message,
      timings: { eventStreamMs }
    });
  }

  const events = eventsResult.events;
  const rawEvents = eventsResult.rawEvents;
  const eventTypes = Array.from(new Set(events.map((event) => event.event))).sort();
  const approvalEventTypes = eventTypes.filter((eventType) => eventType.startsWith("approval."));
  const assistantText = rawEvents
    .filter((event) => asString(event.event) === "message.delta")
    .map((event) => asString(event.delta))
    .join("");
  const output = asString(finalStatusResult.ok ? finalStatusResult.data.output : null) ||
    asString(rawEvents.find((event) => asString(event.event) === "run.completed")?.output);
  const finalStatus = finalStatusResult.ok ? finalStatusResult.data : null;
  const finalStatusName = asString(finalStatus?.status) || createResult.status;
  const counts = countRunsProbeEvents(events);
  const approvalRequiredObserved = approvalEventTypes.includes("approval.request");
  const approval = eventsResult.approval;
  const approvalCalled = Boolean(approval);
  const actionAttempted = approvalCalled
    ? approvalChoice === "deny"
      ? "reject"
      : "approve"
    : "none";
  const activity = summarizeApprovalActivity(rawEvents);
  const actionSucceeded = approval?.ok === true && eventsResult.approvalRespondedAt !== null;
  const reconciled = finalStatusName === "completed" || finalStatusName === "failed";
  const success = approvalRequiredObserved && actionSucceeded && reconciled;
  const outcome = approvalOutcome({
    actionSucceeded,
    approvalChoice,
    approvalRequiredObserved,
    reconciled
  });
  const blockerMessage = approvalRequiredObserved
    ? approval?.error?.message ?? "Approval request was observed, but the BFF approval action did not reconcile."
    : "Hermes run did not emit approval.request for the diagnostic command.";
  const blocker = success ? null : blockerMessage;

  return finish({
    ...baseResult,
    runId: createResult.runId,
    createStatus: createResult.status,
    finalStatusName,
    finalStatus,
    approvalRequiredObserved,
    approvalActionAttempted: actionAttempted,
    approval,
    approvalRequestedAt: eventsResult.approvalRequestedAt,
    approvalRespondedAt: eventsResult.approvalRespondedAt,
    eventTypes,
    approvalEventTypes,
    events,
    assistantTextPreview: truncatePreview(assistantText),
    outputPreview: truncatePreview(output),
    counts,
    activity,
    safety: runsApprovalSafety(approvalCalled),
    ok: success,
    mode: success ? "success" : "failed",
    outcome,
    error: success
      ? null
      : {
          kind: "bad_response",
          message: blockerMessage
        },
    blocker,
    timings: { eventStreamMs }
  });
}

export async function listHermesSessions(
  config: HermesClientConfig
): Promise<HermesSessionListResult> {
  if (config.enabled === false) {
    return { ok: false, sessions: [], error: { kind: "disabled", message: "Real Hermes is disabled for this UI process." } };
  }
  if (!config.baseUrl?.trim()) {
    return { ok: false, sessions: [], error: { kind: "unconfigured", message: "Set HERMES_API_BASE_URL to enable Hermes sessions." } };
  }
  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return { ok: false, sessions: [], error: { kind: "invalid_config", message: "HERMES_API_BASE_URL must be a valid http:// or https:// URL." } };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const result = await fetchJsonEndpoint({ apiKey: config.apiKey, base, fetchImpl, path: "/api/sessions", signal: config.signal, timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS });
  if (!result.ok) {
    return { ok: false, sessions: [], error: result.error };
  }

  const raw = result.data;
  const rawSessions = Array.isArray(raw?.sessions) ? raw.sessions : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
  const sessions: HermesSessionSummary[] = (rawSessions as unknown[])
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item) => ({
      id: asString(item.id) || asString(item.session_id),
      title: asString(item.title) || "Untitled session",
      model: asString(item.model) || null,
      startedAt: asString(item.started_at) || asString(item.created_at) || new Date().toISOString(),
      endedAt: asString(item.ended_at) || asString(item.end_time) || null,
      messageCount: typeof item.message_count === "number" ? item.message_count : undefined
    }))
    .filter((session) => Boolean(session.id));

  return { ok: true, sessions, error: null };
}

export async function listHermesSkills(
  config: HermesClientConfig
): Promise<HermesSkillsListResult> {
  const checkedAt = new Date().toISOString();
  if (config.enabled === false) {
    return {
      ok: false,
      skills: [],
      checkedAt,
      raw: null,
      error: { kind: "disabled", message: "Real Hermes is disabled for this UI process." }
    };
  }
  if (!config.baseUrl?.trim()) {
    return {
      ok: false,
      skills: [],
      checkedAt,
      raw: null,
      error: { kind: "unconfigured", message: "Set HERMES_API_BASE_URL to enable Hermes skills." }
    };
  }
  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return {
      ok: false,
      skills: [],
      checkedAt,
      raw: null,
      error: { kind: "invalid_config", message: "HERMES_API_BASE_URL must be a valid http:// or https:// URL." }
    };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const result = await fetchJsonEndpoint({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    path: "/v1/skills",
    signal: config.signal,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });
  if (!result.ok) {
    return { ok: false, skills: [], checkedAt, raw: null, error: result.error };
  }

  return {
    ok: true,
    skills: normalizeHermesSkillsPayload(result.data),
    checkedAt,
    raw: result.data,
    error: null
  };
}

export async function setHermesSkillEnabled(
  config: HermesClientConfig,
  skillId: string,
  enabled: boolean
): Promise<HermesSkillToggleResult> {
  const checkedAt = new Date().toISOString();
  const safeId = sanitizeHermesId(skillId);
  if (config.enabled === false) {
    return {
      ok: false,
      skillId: safeId,
      enabled,
      skill: null,
      checkedAt,
      raw: null,
      error: { kind: "disabled", message: "Real Hermes is disabled for this UI process." }
    };
  }
  if (!config.baseUrl?.trim()) {
    return {
      ok: false,
      skillId: safeId,
      enabled,
      skill: null,
      checkedAt,
      raw: null,
      error: { kind: "unconfigured", message: "Set HERMES_API_BASE_URL to enable Hermes skill controls." }
    };
  }
  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return {
      ok: false,
      skillId: safeId,
      enabled,
      skill: null,
      checkedAt,
      raw: null,
      error: { kind: "invalid_config", message: "HERMES_API_BASE_URL must be a valid http:// or https:// URL." }
    };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const targets = await discoverHermesSkillToggleTargets({
    apiKey: config.apiKey,
    base,
    enabled,
    fetchImpl,
    signal: config.signal,
    skillId: safeId,
    timeoutMs
  });
  let lastError: HermesChatError | null = null;

  for (const target of targets) {
    const result = await fetchJsonMutationEndpoint({
      apiKey: config.apiKey,
      base,
      body: target.body,
      fetchImpl,
      method: target.method,
      path: target.path,
      signal: config.signal,
      timeoutMs
    });
    if (!result.ok) {
      lastError = result.error;
      if (!isEndpointMismatchError(result.error)) {
        return {
          ok: false,
          skillId: safeId,
          enabled,
          skill: null,
          checkedAt,
          raw: null,
          error: result.error
        };
      }
      continue;
    }

    const returnedSkill =
      normalizeHermesSkillRecord(objectRecord(result.data.skill) ?? objectRecord(result.data.data) ?? {}, safeId) ??
      normalizeHermesSkillRecord(result.data, safeId);

    return {
      ok: true,
      skillId: safeId,
      enabled: returnedSkill?.enabled ?? enabled,
      skill: returnedSkill,
      checkedAt,
      raw: result.data,
      error: null
    };
  }

  return {
    ok: false,
    skillId: safeId,
    enabled,
    skill: null,
    checkedAt,
    raw: null,
    error: {
      kind: "bad_response",
      message:
        lastError?.message ??
        "Hermes did not expose a writable skill toggle endpoint. Update Hermes or advertise one in /v1/capabilities."
    }
  };
}

export async function getHermesSession(
  config: HermesClientConfig,
  sessionId: string
): Promise<HermesSessionDetailResult> {
  const safeId = sanitizeHermesId(sessionId);
  if (config.enabled === false) {
    return { ok: false, session: null, sessionId: safeId, error: { kind: "disabled", message: "Real Hermes is disabled for this UI process." } };
  }
  if (!config.baseUrl?.trim()) {
    return { ok: false, session: null, sessionId: safeId, error: { kind: "unconfigured", message: "Set HERMES_API_BASE_URL to enable Hermes session detail." } };
  }
  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return { ok: false, session: null, sessionId: safeId, error: { kind: "invalid_config", message: "HERMES_API_BASE_URL must be a valid http:// or https:// URL." } };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const result = await fetchJsonEndpoint({
    apiKey: config.apiKey,
    base,
    fetchImpl,
    path: `/api/sessions/${encodeURIComponent(safeId)}`,
    signal: config.signal,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });
  if (!result.ok) {
    return { ok: false, session: null, sessionId: safeId, error: result.error };
  }

  const record =
    objectRecord(result.data.session) ??
    objectRecord(result.data.data) ??
    objectRecord(result.data);
  if (!record) {
    return {
      ok: false,
      session: null,
      sessionId: safeId,
      error: {
        kind: "bad_response",
        message: `Hermes session ${safeId} did not return a session object.`
      }
    };
  }

  return {
    ok: true,
    session: normalizeHermesSessionDetail(record, safeId),
    sessionId: safeId,
    error: null
  };
}

export async function getHermesSessionMessages(
  config: HermesClientConfig,
  sessionId: string
): Promise<HermesSessionMessagesResult> {
  const safeId = sanitizeHermesId(sessionId);
  if (config.enabled === false) {
    return { ok: false, messages: [], sessionId: safeId, error: { kind: "disabled", message: "Real Hermes is disabled for this UI process." } };
  }
  if (!config.baseUrl?.trim()) {
    return { ok: false, messages: [], sessionId: safeId, error: { kind: "unconfigured", message: "Set HERMES_API_BASE_URL to enable Hermes session messages." } };
  }
  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return { ok: false, messages: [], sessionId: safeId, error: { kind: "invalid_config", message: "HERMES_API_BASE_URL must be a valid http:// or https:// URL." } };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const result = await fetchJsonEndpoint({ apiKey: config.apiKey, base, fetchImpl, path: `/api/sessions/${encodeURIComponent(safeId)}/messages`, signal: config.signal, timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS });
  if (!result.ok) {
    return { ok: false, messages: [], sessionId: safeId, error: result.error };
  }

  const raw = result.data;
  const rawMessages = Array.isArray(raw?.messages) ? raw.messages : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : [];
  const messages: HermesSessionMessage[] = (rawMessages as unknown[])
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item)))
    .map((item) => ({
      id: asString(item.id) || asString(item.message_id) || `msg-${Math.random().toString(36).slice(2)}`,
      role: normalizeMessageRole(item.role),
      content: asString(item.content),
      createdAt: asString(item.created_at) || asString(item.timestamp) || undefined
    }))
    .filter((msg) => Boolean(msg.content));

  return { ok: true, messages, sessionId: safeId, error: null };
}

function normalizeHermesSessionDetail(
  item: Record<string, unknown>,
  fallbackId: string
): HermesSessionDetail {
  const modelOverride =
    objectRecord(item.model_override) ??
    objectRecord(item.modelOverride) ??
    objectRecord(item.override);
  const model = firstString(
    item.model,
    item.base_model,
    item.default_model,
    modelOverride?.base_model
  ) || null;
  const selectedModel = firstString(
    item.selected_model,
    item.selectedModel,
    item.current_model,
    modelOverride?.selected_model,
    modelOverride?.model
  ) || null;
  const effectiveModel = firstString(
    item.effective_model,
    item.effectiveModel,
    item.current_model,
    item.runtime_model,
    modelOverride?.effective_model,
    selectedModel,
    model
  ) || null;
  const effectiveProvider = firstString(
    item.effective_provider,
    item.effectiveProvider,
    item.provider,
    item.runtime_provider,
    modelOverride?.effective_provider,
    modelOverride?.provider
  ) || null;
  const modelOverrideActive =
    optionalBoolean(item.model_override_active) ??
    optionalBoolean(item.modelOverrideActive) ??
    optionalBoolean(modelOverride?.active) ??
    Boolean(selectedModel && model && selectedModel !== model);

  return {
    id: firstString(item.id, item.session_id) || fallbackId,
    title: firstString(item.title, item.name) || "Untitled session",
    model,
    startedAt: firstString(item.started_at, item.created_at, item.startedAt) || new Date().toISOString(),
    endedAt: firstString(item.ended_at, item.end_time, item.endedAt) || null,
    messageCount: typeof item.message_count === "number"
      ? item.message_count
      : typeof item.messageCount === "number"
        ? item.messageCount
        : undefined,
    effectiveModel,
    effectiveProvider,
    selectedModel,
    modelOverrideActive,
    modelOverrideScope: firstString(
      item.model_override_scope,
      item.modelOverrideScope,
      item.scope,
      modelOverride?.scope
    ) || null,
    modelOverridePersistent: optionalBoolean(
      item.model_override_persistent,
      item.modelOverridePersistent,
      modelOverride?.persistent
    )
  };
}

export async function deleteHermesSession(
  config: HermesClientConfig,
  sessionId: string
): Promise<HermesSessionDeleteResult> {
  const safeId = sanitizeHermesId(sessionId);
  if (config.enabled === false) {
    return { ok: false, error: { kind: "disabled", message: "Real Hermes is disabled for this UI process." } };
  }
  if (!config.baseUrl?.trim()) {
    return { ok: false, error: { kind: "unconfigured", message: "Set HERMES_API_BASE_URL to enable Hermes session deletion." } };
  }
  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return { ok: false, error: { kind: "invalid_config", message: "HERMES_API_BASE_URL must be a valid http:// or https:// URL." } };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const abort = createLinkedAbortController(config.signal, config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = new Headers({ Accept: "application/json" });
  applyHermesAuth(headers, config.apiKey);

  try {
    const response = await fetchImpl(buildEndpointUrl(base, `/api/sessions/${encodeURIComponent(safeId)}`), {
      cache: "no-store",
      headers,
      method: "DELETE",
      signal: abort.signal
    });
    if (response.ok || response.status === 404) {
      return { ok: true, error: null };
    }
    const data = await readJsonObject(response);
    return {
      ok: false,
      error: { kind: "http_error", message: await safeHermesErrorMessageFromData(response.status, data, `/api/sessions/${safeId}`) }
    };
  } catch (error) {
    return { ok: false, error: normalizeChatFetchError(error) };
  } finally {
    abort.cleanup();
  }
}

function normalizeMessageRole(value: unknown): HermesSessionMessage["role"] {
  const s = asString(value).toLowerCase().trim();
  if (s === "user" || s === "assistant" || s === "system" || s === "tool") {
    return s;
  }
  return "assistant";
}

function normalizeHermesSkillsPayload(data: Record<string, unknown>): HermesSkillDescriptor[] {
  const candidates = [
    ...skillRecordsFromValue(data.skills),
    ...skillRecordsFromValue(data.data),
    ...skillRecordsFromValue(data.items),
    ...skillRecordsFromValue(data.registry),
    ...skillRecordsFromValue(data.available_skills),
    ...skillRecordsFromValue(data.availableSkills)
  ];
  const seen = new Set<string>();

  return candidates
    .map(({ key, record }) => normalizeHermesSkillRecord(record, key))
    .filter((skill): skill is HermesSkillDescriptor => Boolean(skill))
    .filter((skill) => {
      const fingerprint = normalizeName(skill.id || skill.name || skill.title);
      if (!fingerprint || seen.has(fingerprint)) {
        return false;
      }
      seen.add(fingerprint);
      return true;
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}

function skillRecordsFromValue(value: unknown): Array<{ key?: string; record: Record<string, unknown> }> {
  if (Array.isArray(value)) {
    return value
      .map((item) => objectRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item))
      .map((record) => ({ record }));
  }

  const record = objectRecord(value);
  if (!record) {
    return [];
  }

  return Object.entries(record)
    .map(([key, item]) => {
      const child = objectRecord(item);
      return child ? { key, record: child } : null;
    })
    .filter((item): item is { key: string; record: Record<string, unknown> } => Boolean(item));
}

function normalizeHermesSkillRecord(
  record: Record<string, unknown>,
  fallbackId?: string
): HermesSkillDescriptor | null {
  const id = firstString(
    record.id,
    record.name,
    record.slug,
    record.skill_id,
    record.skillId,
    fallbackId
  );
  const name = firstString(record.name, record.slug, record.id, fallbackId);
  const rawTitle = firstString(record.title, record.display_name, record.displayName);
  const title = rawTitle || humanizeSkillTitle(name || id);
  if (!id && !name && !title) {
    return null;
  }

  const enabled =
    optionalBoolean(record.enabled) ??
    optionalBoolean(record.available) ??
    optionalBoolean(record.active) ??
    null;

  return {
    id: id || name || title,
    name: name || id || title,
    title: title || name || id,
    description: firstString(record.description, record.summary, record.detail) || null,
    source: firstString(record.source, record.plugin, record.provider, record.package, record.origin) || null,
    category: firstString(record.category, record.group, record.kind, record.type) || null,
    enabled,
    tags: stringArray(record.tags)
  };
}

function humanizeSkillTitle(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function normalizeHermesSseEvent(
  eventName: string,
  payload: Record<string, unknown> | null
): HermesChatStreamEvent | null {
  const data = payload ?? {};
  const messageId = asString(data.message_id);
  const runId = asString(data.run_id);
  const reasoningSummaryEvent = normalizeReasoningSummaryStreamEvent(eventName, data, messageId, runId);
  if (reasoningSummaryEvent) {
    return reasoningSummaryEvent;
  }
  const reasoningSignalEvent = normalizeReasoningSignalStreamEvent(eventName, data, messageId, runId);
  if (reasoningSignalEvent) {
    return reasoningSignalEvent;
  }

  if (eventName === "assistant.delta") {
    const delta = asString(data.delta);
    return delta ? { type: "message_delta", delta, messageId, runId } : null;
  }

  if (eventName === "response.output_text.delta" || eventName === "output_text.delta") {
    const delta = firstString(data.delta, data.text, data.content, data.output_text);
    return delta ? { type: "message_delta", delta, messageId, runId } : null;
  }

  if (eventName === "response.output_text.done" || eventName === "output_text.done") {
    const content = firstString(data.text, data.content, data.output_text);
    const usage = normalizeTokenUsage(data);
    return {
      type: "message_done",
      message: {
        role: "assistant",
        content
      },
      messageId,
      runId,
      ...(usage ? { usage } : {})
    };
  }

  if (eventName === "response.completed" || eventName === "response.done") {
    const content = extractResponsesOutputText(data);
    const usage = normalizeTokenUsage(data);
    return content || usage
      ? {
          type: "message_done",
          message: {
            role: "assistant",
            content
          },
          messageId,
          runId,
          ...(usage ? { usage } : {})
        }
      : null;
  }

  if (eventName === "message") {
    return normalizeOpenAiCompatibleStreamEvent(data, messageId, runId);
  }

  if (eventName === "message.started") {
    return {
      type: "run_event",
      name: "message.started",
      status: "running",
      payload: {
        ...pickStreamCorrelationFields(data, messageId, runId),
        event: "message.started"
      }
    };
  }

  if (eventName === "assistant.completed") {
    const usage = normalizeTokenUsage(data);
    return {
      type: "message_done",
      message: {
        role: "assistant",
        content: asString(data.content)
      },
      messageId,
      runId,
      ...(usage ? { usage } : {})
    };
  }

  if (eventName === "metadata" || eventName === "usage" || eventName === "assistant.metadata") {
    const usage = normalizeTokenUsage(data);
    return {
      type: "metadata",
      messageId,
      runId,
      ...(usage ? { usage } : {})
    };
  }

  if (eventName === "tool.started" || eventName === "tool.completed" || eventName === "tool.failed") {
    const status =
      eventName === "tool.started"
        ? "started"
        : eventName === "tool.failed"
          ? "failed"
          : "completed";
    return {
      type: "tool_event",
      name: asString(data.tool_name) || "Hermes tool",
      status,
      payload: data
    };
  }

  if (eventName === "tool.progress") {
    const progressEvent = asString(data.event) || asString(data.type) || asString(data.name);
    if (normalizeName(progressEvent) === "reasoning.available") {
      const summary = publicReasoningSummaryFromToolProgress(data);
      return {
        type: "run_event",
        name: summary ? "reasoning.summary.delta" : "reasoning.available",
        status: summary ? "running" : "info",
        payload: {
          ...pickStreamCorrelationFields(data, messageId, runId),
          event: summary ? "reasoning.summary.delta" : "reasoning.available",
          source_event: eventName,
          ...(summary ? { public_reasoning_summary: summary } : {})
        }
      };
    }

    return {
      type: "tool_event",
      name: asString(data.tool_name) || asString(data.tool) || progressEvent || "Hermes tool progress",
      status: "started",
      payload: {
        ...data,
        event: progressEvent || eventName
      }
    };
  }

  if (eventName.startsWith("approval.")) {
    return {
      type: "approval_event",
      name: eventName,
      status: eventName.replace("approval.", ""),
      payload: data
    };
  }

  if (eventName.startsWith("run.")) {
    return {
      type: "run_event",
      name: eventName,
      status: eventName.replace("run.", ""),
      payload: data
    };
  }

  if (eventName === "error") {
    return {
      type: "error",
      error: {
        kind: "unknown",
        message: asString(data.message) || "Hermes stream returned an error."
      }
    };
  }

  if (eventName === "done") {
    return { type: "done" };
  }

  return null;
}

function normalizeOpenAiCompatibleStreamEvent(
  data: Record<string, unknown>,
  messageId: string | undefined,
  runId: string | undefined
): HermesChatStreamEvent | null {
  const dataType = asString(data.type);
  const reasoningSummaryEvent = normalizeReasoningSummaryStreamEvent(dataType, data, messageId, runId);
  if (reasoningSummaryEvent) {
    return reasoningSummaryEvent;
  }
  const reasoningSignalEvent = normalizeReasoningSignalStreamEvent(dataType, data, messageId, runId);
  if (reasoningSignalEvent) {
    return reasoningSignalEvent;
  }

  if (dataType === "response.output_text.delta" || dataType === "output_text.delta") {
    const delta = firstString(data.delta, data.text, data.content, data.output_text);
    return delta ? { type: "message_delta", delta, messageId, runId } : null;
  }
  if (dataType === "response.output_text.done" || dataType === "output_text.done") {
    const usage = normalizeTokenUsage(data);
    return {
      type: "message_done",
      message: {
        role: "assistant",
        content: firstString(data.text, data.content, data.output_text)
      },
      messageId,
      runId,
      ...(usage ? { usage } : {})
    };
  }
  if (dataType === "response.completed" || dataType === "response.done") {
    const content = extractResponsesOutputText(data);
    const usage = normalizeTokenUsage(data);
    return content || usage
      ? {
          type: "message_done",
          message: {
            role: "assistant",
            content
          },
          messageId,
          runId,
          ...(usage ? { usage } : {})
        }
      : null;
  }

  const choices = Array.isArray(data.choices)
    ? data.choices.filter((choice): choice is Record<string, unknown> =>
        Boolean(choice && typeof choice === "object" && !Array.isArray(choice))
      )
    : [];
  const firstChoice = choices[0];
  const firstDelta = objectRecord(firstChoice?.delta);
  const firstMessage = objectRecord(firstChoice?.message);
  const delta =
    asString(firstDelta?.content) ||
    asString(firstDelta?.text) ||
    asString(firstChoice?.text);
  if (delta) {
    return { type: "message_delta", delta, messageId, runId };
  }

  // Providers such as DeepSeek stream chain-of-thought in a separate
  // `reasoning_content` (or `reasoning`) delta field before the answer text.
  const reasoningDelta = asString(firstDelta?.reasoning_content) || asString(firstDelta?.reasoning);
  if (reasoningDelta) {
    return {
      type: "run_event",
      name: "reasoning.delta",
      status: "running",
      payload: {
        ...pickStreamCorrelationFields(data, messageId, runId),
        event: "reasoning.delta",
        source_event: "message",
        reasoning_text: reasoningDelta
      }
    };
  }

  const content =
    asString(firstMessage?.content) ||
    asString(data.content) ||
    asString(data.output_text);
  const usage = normalizeTokenUsage(data);
  const finishReason = firstString(firstChoice?.finish_reason, firstChoice?.finishReason);
  if (content || finishReason) {
    return {
      type: "message_done",
      message: {
        role: "assistant",
        content
      },
      messageId,
      runId,
      ...(usage ? { usage } : {})
    };
  }

  return usage
    ? {
        type: "metadata",
        messageId,
        runId,
        usage
      }
    : null;
}

function normalizeReasoningSummaryStreamEvent(
  eventName: string,
  data: Record<string, unknown>,
  messageId: string | undefined,
  runId: string | undefined
): HermesChatStreamEvent | null {
  if (!isReasoningSummaryEventName(eventName)) {
    return null;
  }
  const summary = publicReasoningSummaryFromSummaryEvent(data);
  const isDone = normalizeName(eventName).includes("done");
  return {
    type: "run_event",
    name: isDone ? "reasoning.summary.done" : "reasoning.summary.delta",
    status: isDone ? "info" : "running",
    payload: {
      ...pickStreamCorrelationFields(data, messageId, runId),
      event: isDone ? "reasoning.summary.done" : "reasoning.summary.delta",
      source_event: eventName,
      ...(summary ? { public_reasoning_summary: summary } : {})
    }
  };
}

function normalizeReasoningSignalStreamEvent(
  eventName: string,
  data: Record<string, unknown>,
  messageId: string | undefined,
  runId: string | undefined
): HermesChatStreamEvent | null {
  if (!isRawReasoningEventName(eventName)) {
    return null;
  }
  const text = rawReasoningTextFromEvent(data);
  const isDone = normalizeName(eventName).includes("done");
  // No readable reasoning text in this frame: keep the bare progress signal so
  // the UI can still show that the model is thinking.
  if (!text) {
    return {
      type: "run_event",
      name: "reasoning.available",
      status: "info",
      payload: {
        ...pickStreamCorrelationFields(data, messageId, runId),
        event: "reasoning.available",
        source_event: eventName
      }
    };
  }
  // Surface the raw reasoning text as an ordered reasoning delta/done so the UI
  // can accumulate it into a "Thinking" block alongside summaries.
  return {
    type: "run_event",
    name: isDone ? "reasoning.done" : "reasoning.delta",
    status: isDone ? "info" : "running",
    payload: {
      ...pickStreamCorrelationFields(data, messageId, runId),
      event: isDone ? "reasoning.done" : "reasoning.delta",
      source_event: eventName,
      reasoning_text: text
    }
  };
}

function rawReasoningTextFromEvent(data: Record<string, unknown>): string {
  const part = objectRecord(data.part);
  const delta = objectRecord(data.delta);
  return firstString(
    data.reasoning_text,
    data.reasoningText,
    data.reasoning,
    data.reasoning_content,
    data.reasoningContent,
    data.delta,
    data.text,
    data.content,
    part?.text,
    part?.content,
    delta?.reasoning_content,
    delta?.reasoning,
    delta?.text,
    delta?.content
  );
}

function isReasoningSummaryEventName(eventName: string) {
  const normalized = normalizeName(eventName);
  return (
    normalized === "response_reasoning_summary_text_delta" ||
    normalized === "response_reasoning_summary_text_done" ||
    normalized === "response_reasoning_summary_delta" ||
    normalized === "response_reasoning_summary_done" ||
    normalized === "response_reasoning_summary_part_added" ||
    normalized === "response_reasoning_summary_part_done" ||
    normalized === "reasoning_summary_text_delta" ||
    normalized === "reasoning_summary_text_done" ||
    normalized === "reasoning_summary_delta" ||
    normalized === "reasoning_summary_done" ||
    normalized === "reasoning_summary_part_added" ||
    normalized === "reasoning_summary_part_done"
  );
}

function isRawReasoningEventName(eventName: string) {
  const normalized = normalizeName(eventName);
  return (
    normalized === "response_reasoning_text_delta" ||
    normalized === "response_reasoning_text_done" ||
    normalized === "reasoning_text_delta" ||
    normalized === "reasoning_text_done" ||
    normalized === "reasoning_available"
  );
}

function publicReasoningSummaryFromSummaryEvent(data: Record<string, unknown>) {
  const part = objectRecord(data.part);
  const summary = objectRecord(data.summary);
  return firstString(
    data.public_reasoning_summary,
    data.publicReasoningSummary,
    data.public_summary,
    data.publicSummary,
    data.reasoning_summary_text,
    data.reasoningSummaryText,
    data.reasoning_summary,
    data.reasoningSummary,
    data.delta,
    data.text,
    data.content,
    part?.text,
    part?.content,
    part?.summary,
    summary?.text,
    summary?.content
  );
}

function publicReasoningSummaryFromToolProgress(data: Record<string, unknown>) {
  const summary = firstString(
    data.public_reasoning_summary,
    data.publicReasoningSummary,
    data.public_summary,
    data.publicSummary,
    data.reasoning_summary_text,
    data.reasoningSummaryText,
    data.reasoning_summary,
    data.reasoningSummary
  );
  if (summary) {
    return summary;
  }
  const visibility = normalizeName(firstString(data.visibility, data.privacy, data.reasoning_visibility));
  return visibility === "public" ? firstString(data.summary, data.message, data.detail) : "";
}

function pickStreamCorrelationFields(
  data: Record<string, unknown>,
  messageId: string | undefined,
  runId: string | undefined
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const resolvedMessageId = messageId || asString(data.messageId);
  const resolvedRunId = runId || asString(data.runId);
  if (resolvedMessageId) {
    result.message_id = resolvedMessageId;
  }
  if (resolvedRunId) {
    result.run_id = resolvedRunId;
  }
  for (const key of ["session_id", "sessionId", "tool_call_id", "toolCallId", "sequence", "seq", "sequence_number", "item_id", "itemId", "output_index", "content_index"]) {
    if (data[key] !== undefined) {
      result[key] = data[key];
    }
  }
  return result;
}

function extractResponsesOutputText(data: Record<string, unknown>): string {
  const direct = firstString(data.output_text, data.text, data.content);
  if (direct) {
    return direct;
  }

  const response = objectRecord(data.response);
  if (response) {
    const fromResponse = extractResponsesOutputText(response);
    if (fromResponse) {
      return fromResponse;
    }
  }

  const output = Array.isArray(data.output) ? data.output : [];
  const parts: string[] = [];
  for (const item of output) {
    const record = objectRecord(item);
    if (!record) {
      continue;
    }
    const itemText = firstString(record.output_text, record.text, record.content);
    if (itemText) {
      parts.push(itemText);
    }
    const content = Array.isArray(record.content) ? record.content : [];
    for (const contentItem of content) {
      const contentRecord = objectRecord(contentItem);
      if (!contentRecord) {
        continue;
      }
      const text = firstString(contentRecord.text, contentRecord.content, contentRecord.output_text);
      if (text) {
        parts.push(text);
      }
    }
  }
  return parts.join("");
}

async function checkSessionStreamingCapability(args: {
  apiKey?: string | null;
  base: URL;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<boolean | null> {
  const abort = createLinkedAbortController(args.signal, args.timeoutMs);
  const headers = new Headers({ Accept: "application/json" });
  applyHermesAuth(headers, args.apiKey);

  try {
    const response = await args.fetchImpl(buildEndpointUrl(args.base, "/v1/capabilities"), {
      cache: "no-store",
      headers,
      signal: abort.signal
    });
    if (!response.ok) {
      return null;
    }
    const data = await readJsonObject(response);
    const features = data?.features;
    if (!features || typeof features !== "object" || Array.isArray(features)) {
      return null;
    }
    const advertised = (features as { session_chat_streaming?: unknown })
      .session_chat_streaming;
    return typeof advertised === "boolean" ? advertised : null;
  } catch {
    return null;
  } finally {
    abort.cleanup();
  }
}

async function createHermesRun(args: {
  apiKey?: string | null;
  base: URL;
  conversationHistory?: HermesChatRequest["recentMessages"];
  fetchImpl: typeof fetch;
  instructions?: string;
  memoryScopeKey?: string | null;
  model?: string | null;
  prompt: string;
  sessionId: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<
  | { ok: true; runId: string; status: string }
  | { ok: false; error: HermesChatError }
> {
  const abort = createLinkedAbortController(args.signal, args.timeoutMs);
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json"
  });
  applyHermesAuth(headers, args.apiKey);
  const memoryScopeKey = sanitizeHeaderValue(args.memoryScopeKey ?? null);
  if (memoryScopeKey) {
    headers.set("X-Hermes-Session-Key", memoryScopeKey);
  }

  try {
    const response = await args.fetchImpl(buildEndpointUrl(args.base, "/v1/runs"), {
      body: JSON.stringify({
        conversation_history: args.conversationHistory?.length ? args.conversationHistory : undefined,
        input: args.prompt,
        instructions: args.instructions ??
          "Do not use tools, memory, commands, files, web browsing, or external resources. Reply with the exact requested text only.",
        model: args.model || undefined,
        session_id: args.sessionId
      }),
      cache: "no-store",
      headers,
      method: "POST",
      signal: abort.signal
    });
    const data = await readJsonObject(response);
    if (!response.ok) {
      return {
        ok: false,
        error: {
          kind: "http_error",
          message: await safeHermesErrorMessageFromData(response.status, data, "/v1/runs")
        }
      };
    }
    const runId = asString(data?.run_id);
    if (!runId) {
      return {
        ok: false,
        error: {
          kind: "bad_response",
          message: "Hermes /v1/runs did not return a run_id."
        }
      };
    }
    return {
      ok: true,
      runId,
      status: asString(data?.status) || "unknown"
    };
  } catch (error) {
    return {
      ok: false,
      error: normalizeChatFetchError(error)
    };
  } finally {
    abort.cleanup();
  }
}

async function runSingleHermesRunsStopAttempt(args: {
  apiKey?: string | null;
  base: URL;
  fetchImpl: typeof fetch;
  prompt: string;
  promptAttempt: number;
  sessionId: string;
  signal?: AbortSignal;
  stopAfterMs: number;
  timeoutMs: number;
}): Promise<Omit<HermesRunsStopProbeResult, "checkedAt">> {
  const createResult = await createHermesRun({
    apiKey: args.apiKey,
    base: args.base,
    fetchImpl: args.fetchImpl,
    instructions: [
      "This is a harmless stop/cancel diagnostic.",
      "Do not use tools, memory, commands, files, web browsing, external resources, or approvals.",
      "Only generate the requested counting text."
    ].join("\n"),
    memoryScopeKey: "hermes-ui-runs-stop-probe",
    prompt: args.prompt,
    sessionId: args.sessionId,
    signal: args.signal,
    timeoutMs: args.timeoutMs
  });

  if (!createResult.ok) {
    return {
      prompt: args.prompt,
      promptAttempt: args.promptAttempt,
      runId: null,
      sessionId: args.sessionId,
      createStatus: null,
      finalStatusName: null,
      finalStatus: null,
      stop: null,
      stopRequestedAt: null,
      stopTrigger: null,
      eventTypes: [],
      events: [],
      assistantTextPreview: "",
      outputPreview: "",
      counts: emptyRunsProbeCounts(),
      timings: {
        durationMs: 0,
        eventStreamMs: null,
        stopAfterMs: args.stopAfterMs
      },
      completedBeforeStop: false,
      serverSideStopEffective: false,
      safety: runsStopSafety(false),
      ok: false,
      mode: "failed",
      outcome: "failed",
      error: createResult.error,
      blocker: createResult.error.message
    };
  }

  const eventStartedAt = Date.now();
  const eventsResult = await readHermesRunEventsWithStop({
    apiKey: args.apiKey,
    base: args.base,
    fetchImpl: args.fetchImpl,
    runId: createResult.runId,
    signal: args.signal,
    stopAfterMs: args.stopAfterMs,
    timeoutMs: args.timeoutMs
  });
  const eventStreamMs = Date.now() - eventStartedAt;

  const finalStatusResult = await pollHermesRunUntilStable({
    apiKey: args.apiKey,
    base: args.base,
    fetchImpl: args.fetchImpl,
    runId: createResult.runId,
    signal: args.signal,
    timeoutMs: Math.min(args.timeoutMs, 12_000)
  });

  const events = eventsResult.ok ? eventsResult.events : [];
  const rawEvents = eventsResult.ok ? eventsResult.rawEvents : [];
  const eventTypes = Array.from(new Set(events.map((event) => event.event))).sort();
  const assistantText = rawEvents
    .filter((event) => asString(event.event) === "message.delta")
    .map((event) => asString(event.delta))
    .join("");
  const output = asString(finalStatusResult.ok ? finalStatusResult.data.output : null) ||
    asString(rawEvents.find((event) => asString(event.event) === "run.completed")?.output);
  const finalStatus = finalStatusResult.ok ? finalStatusResult.data : null;
  const finalStatusName = asString(finalStatus?.status) || createResult.status;
  const counts = countRunsProbeEvents(events);
  const stop = eventsResult.ok ? eventsResult.stop : null;
  const stopRequested = Boolean(stop);
  const completedBeforeStop = finalStatusName === "completed" && !stopRequested;
  const serverSideStopEffective =
    stop?.ok === true &&
    (isRunStopTerminalStatus(finalStatusName) ||
      eventTypes.includes("run.cancelled") ||
      eventTypes.includes("run.canceled") ||
      eventTypes.includes("run.stopped") ||
      eventTypes.includes("run.interrupted"));
  const outcome = outcomeForStopProbe({
    completedBeforeStop,
    finalStatusName,
    serverSideStopEffective,
    stop
  });
  const stopFailed = outcome === "stop_failed";
  const streamError = eventsResult.ok ? null : eventsResult.error;
  const blocker = stopFailed
    ? stop?.error?.message ?? "Hermes run stop request failed."
    : streamError?.message ?? null;

  return {
    prompt: args.prompt,
    promptAttempt: args.promptAttempt,
    runId: createResult.runId,
    sessionId: args.sessionId,
    createStatus: createResult.status,
    finalStatusName,
    finalStatus,
    stop,
    stopRequestedAt: eventsResult.ok ? eventsResult.stopRequestedAt : null,
    stopTrigger: eventsResult.ok ? eventsResult.stopTrigger : null,
    eventTypes,
    events,
    assistantTextPreview: truncatePreview(assistantText),
    outputPreview: truncatePreview(output),
    counts,
    completedBeforeStop,
    serverSideStopEffective,
    safety: runsStopSafety(stopRequested),
    ok: stop?.ok === true && !stopFailed,
    mode: stopFailed || streamError ? "failed" : "success",
    outcome,
    error: stopFailed
      ? stop?.error ?? {
          kind: "unknown",
          message: "Hermes run stop request failed."
        }
      : streamError,
    blocker,
    timings: {
      durationMs: 0,
      eventStreamMs,
      stopAfterMs: args.stopAfterMs
    }
  };
}

function emptyRunsProbeCounts() {
  return {
    events: 0,
    messageDeltaEvents: 0,
    toolEvents: 0,
    brainMemoryToolEvents: 0,
    approvalEvents: 0
  };
}

function countRunsProbeEvents(events: HermesRunProbeEvent[]) {
  const toolEvents = events.filter((event) => event.event.startsWith("tool."));
  const brainMemoryToolEvents = toolEvents.filter((event) =>
    normalizeName(event.toolName ?? "").includes("brain_memory") ||
    normalizeName(event.toolName ?? "").includes("memory")
  );
  return {
    events: events.length,
    messageDeltaEvents: events.filter((event) => event.event === "message.delta").length,
    toolEvents: toolEvents.length,
    brainMemoryToolEvents: brainMemoryToolEvents.length,
    approvalEvents: events.filter((event) => event.event.startsWith("approval.")).length
  };
}

function publicExperimentalRunsContext(request: HermesChatRequest): HermesRunsExperimentalChatResult["context"] {
  return {
    projectId: request.context.project.id,
    projectStableKey: request.context.project.stableKey,
    sessionId: request.context.session.id,
    sessionStableKey: request.context.session.stableKey,
    hermesSessionId: request.context.session.hermesSessionId,
    tenantId: request.context.project.tenantId
  };
}

function experimentalRunsMetadata(
  enabled: boolean,
  memoryScopeBridgeEnabled: boolean
): HermesRunsExperimentalChatResult["experimental"] {
  return {
    featureFlag: "HERMES_UI_EXPERIMENTAL_RUNS_MODE",
    enabled,
    defaultEnabled: false,
    route: "bff-only",
    productionChatUntouched: true,
    memoryScopeBridgeEnabled
  };
}

function experimentalRunsSafety(memoryMutationRequested: boolean): HermesRunsExperimentalChatResult["safety"] {
  return {
    route: "bff-only",
    promptKind: "chat-only",
    stopCalled: false,
    approvalCalled: false,
    browserDirectHermes: false,
    browserDirectBrainMemory: false,
    directStorageAccess: false,
    memoryMutationRequested,
    productionChatUntouched: true
  };
}

function runsStopSafety(stopCalled: boolean): HermesRunsStopProbeResult["safety"] {
  return {
    route: "bff-only",
    promptKind: "chat-only-stop-probe",
    stopCalled,
    approvalCalled: false,
    browserDirectHermes: false,
    memoryMutationRequested: false
  };
}

function outcomeForStopProbe(args: {
  completedBeforeStop: boolean;
  finalStatusName: string;
  serverSideStopEffective: boolean;
  stop: HermesRunStopResult | null;
}): HermesRunsStopProbeResult["outcome"] {
  if (args.serverSideStopEffective) {
    return "server_stop_effective";
  }
  if (args.stop && !args.stop.ok) {
    return "stop_failed";
  }
  if (args.completedBeforeStop) {
    return "completed_before_stop";
  }
  if (args.stop?.ok && args.finalStatusName === "completed") {
    return "stop_accepted_but_completed";
  }
  return args.stop?.ok ? "stop_accepted_but_completed" : "failed";
}

function isRunStopTerminalStatus(status: string) {
  const normalized = normalizeName(status);
  return (
    normalized.includes("cancel") ||
    normalized.includes("stop") ||
    normalized.includes("interrupt")
  );
}

function sanitizeApprovalChoice(value?: HermesRunApprovalChoice): HermesRunApprovalChoice | null {
  return value && ["once", "session", "always", "deny"].includes(value) ? value : null;
}

function runsApprovalSafety(approvalCalled: boolean): HermesRunsApprovalProbeResult["safety"] {
  return {
    route: "bff-only",
    promptKind: "approval-deny-probe",
    stopCalled: false,
    approvalCalled,
    browserDirectHermes: false,
    memoryMutationRequested: false,
    defaultChoice: "deny",
    productionChatUntouched: true
  };
}

function approvalOutcome(args: {
  actionSucceeded: boolean;
  approvalChoice: HermesRunApprovalChoice;
  approvalRequiredObserved: boolean;
  reconciled: boolean;
}): HermesRunsApprovalProbeResult["outcome"] {
  if (!args.approvalRequiredObserved) {
    return "approval_not_observed";
  }
  if (!args.actionSucceeded || !args.reconciled) {
    return "approval_observed_action_failed";
  }
  return args.approvalChoice === "deny"
    ? "approval_denied_and_reconciled"
    : "approval_approved_and_reconciled";
}

function summarizeApprovalActivity(rawEvents: Record<string, unknown>[]): HermesRunsApprovalProbeResult["activity"] {
  let approvalActivityEvents = 0;
  let waitingForApprovalEvents = 0;
  let completedApprovalEvents = 0;
  let cancelledApprovalEvents = 0;

  for (const event of rawEvents) {
    const eventType = asString(event.event);
    if (!eventType.startsWith("approval.")) {
      continue;
    }
    approvalActivityEvents += 1;
    if (eventType === "approval.request") {
      waitingForApprovalEvents += 1;
    } else if (eventType === "approval.responded") {
      const choice = asString(event.choice);
      if (choice === "deny") {
        cancelledApprovalEvents += 1;
      } else {
        completedApprovalEvents += 1;
      }
    }
  }

  return {
    approvalActivityEvents,
    waitingForApprovalEvents,
    completedApprovalEvents,
    cancelledApprovalEvents,
    rawSecretRendered: false
  };
}

async function getHermesRunStatus(args: {
  apiKey?: string | null;
  base: URL;
  fetchImpl: typeof fetch;
  runId: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: HermesChatError }
> {
  const result = await fetchJsonEndpoint({
    apiKey: args.apiKey,
    base: args.base,
    fetchImpl: args.fetchImpl,
    path: `/v1/runs/${encodeURIComponent(args.runId)}`,
    signal: args.signal,
    timeoutMs: args.timeoutMs
  });
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error };
}

async function stopHermesRun(args: {
  apiKey?: string | null;
  base: URL;
  fetchImpl: typeof fetch;
  runId: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<HermesRunStopResult> {
  const abort = createLinkedAbortController(args.signal, args.timeoutMs);
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json"
  });
  applyHermesAuth(headers, args.apiKey);

  try {
    const response = await args.fetchImpl(
      buildEndpointUrl(args.base, `/v1/runs/${encodeURIComponent(args.runId)}/stop`),
      {
        cache: "no-store",
        headers,
        method: "POST",
        signal: abort.signal
      }
    );
    const body = await readJsonObject(response);
    return {
      ok: response.ok,
      statusCode: response.status,
      status: asString(body?.status) || null,
      body,
      error: response.ok
        ? null
        : {
            kind: "http_error",
            message: await safeHermesErrorMessageFromData(response.status, body, "/v1/runs/{run_id}/stop")
          }
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      status: null,
      body: null,
      error: normalizeChatFetchError(error)
    };
  } finally {
    abort.cleanup();
  }
}

async function respondHermesRunApproval(args: {
  apiKey?: string | null;
  base: URL;
  choice: HermesRunApprovalChoice;
  fetchImpl: typeof fetch;
  runId: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<HermesRunApprovalResult> {
  const abort = createLinkedAbortController(args.signal, args.timeoutMs);
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json"
  });
  applyHermesAuth(headers, args.apiKey);

  try {
    const response = await args.fetchImpl(
      buildEndpointUrl(args.base, `/v1/runs/${encodeURIComponent(args.runId)}/approval`),
      {
        body: JSON.stringify({ choice: args.choice }),
        cache: "no-store",
        headers,
        method: "POST",
        signal: abort.signal
      }
    );
    const body = await readJsonObject(response);
    return {
      ok: response.ok,
      statusCode: response.status,
      choice: sanitizeApprovalChoice(asString(body?.choice) as HermesRunApprovalChoice) ?? args.choice,
      resolved: typeof body?.resolved === "number" && Number.isFinite(body.resolved)
        ? body.resolved
        : null,
      body,
      error: response.ok
        ? null
        : {
            kind: "http_error",
            message: await safeHermesErrorMessageFromData(response.status, body, "/v1/runs/{run_id}/approval")
          }
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      choice: null,
      resolved: null,
      body: null,
      error: normalizeChatFetchError(error)
    };
  } finally {
    abort.cleanup();
  }
}

async function pollHermesRunUntilStable(args: {
  apiKey?: string | null;
  base: URL;
  fetchImpl: typeof fetch;
  runId: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: HermesChatError }
> {
  const deadline = Date.now() + args.timeoutMs;
  let latest: Awaited<ReturnType<typeof getHermesRunStatus>> | null = null;
  while (Date.now() < deadline) {
    latest = await getHermesRunStatus({
      apiKey: args.apiKey,
      base: args.base,
      fetchImpl: args.fetchImpl,
      runId: args.runId,
      signal: args.signal,
      timeoutMs: Math.min(3_000, Math.max(500, deadline - Date.now()))
    });
    if (!latest.ok) {
      return latest;
    }
    const status = normalizeName(asString(latest.data.status));
    if (
      status.includes("complete") ||
      status.includes("fail") ||
      status.includes("cancel") ||
      status.includes("stop") ||
      status.includes("interrupt")
    ) {
      return latest;
    }
    await delay(400);
  }

  if (latest?.ok) {
    return latest;
  }
  return {
    ok: false,
    error: {
      kind: "timeout",
      message: "Timed out while polling Hermes run status after stop."
    }
  };
}

async function readHermesRunEventsWithStop(args: {
  apiKey?: string | null;
  base: URL;
  fetchImpl: typeof fetch;
  runId: string;
  signal?: AbortSignal;
  stopAfterMs: number;
  timeoutMs: number;
}): Promise<
  | {
      ok: true;
      rawEvents: Record<string, unknown>[];
      events: HermesRunProbeEvent[];
      stop: HermesRunStopResult | null;
      stopRequestedAt: string | null;
      stopTrigger: "timer" | "first_message_delta" | null;
    }
  | { ok: false; error: HermesChatError }
> {
  const abort = createLinkedAbortController(args.signal, args.timeoutMs);
  const headers = new Headers({ Accept: "text/event-stream" });
  applyHermesAuth(headers, args.apiKey);

  let stop: HermesRunStopResult | null = null;
  let stopPromise: Promise<HermesRunStopResult> | null = null;
  let stopRequestedAt: string | null = null;
  let stopTrigger: "timer" | "first_message_delta" | null = null;
  const triggerStop = (trigger: "timer" | "first_message_delta") => {
    if (stopPromise) {
      return stopPromise;
    }
    stopRequestedAt = new Date().toISOString();
    stopTrigger = trigger;
    stopPromise = stopHermesRun({
      apiKey: args.apiKey,
      base: args.base,
      fetchImpl: args.fetchImpl,
      runId: args.runId,
      signal: args.signal,
      timeoutMs: Math.min(args.timeoutMs, 8_000)
    }).then((result) => {
      stop = result;
      return result;
    });
    return stopPromise;
  };

  const timer = setTimeout(() => {
    void triggerStop("timer");
  }, args.stopAfterMs);

  let response: Response;
  try {
    response = await args.fetchImpl(
      buildEndpointUrl(args.base, `/v1/runs/${encodeURIComponent(args.runId)}/events`),
      {
        cache: "no-store",
        headers,
        signal: abort.signal
      }
    );
  } catch (error) {
    clearTimeout(timer);
    abort.cleanup();
    return { ok: false, error: normalizeChatFetchError(error) };
  }

  if (!response.ok) {
    clearTimeout(timer);
    abort.cleanup();
    const data = await readJsonObject(response);
    return {
      ok: false,
      error: {
        kind: "http_error",
        message: await safeHermesErrorMessageFromData(response.status, data, "/v1/runs/{run_id}/events")
      }
    };
  }

  if (!response.body) {
    clearTimeout(timer);
    abort.cleanup();
    return {
      ok: false,
      error: {
        kind: "bad_response",
        message: "Hermes run events endpoint did not return a stream body."
      }
    };
  }

  const rawEvents: Record<string, unknown>[] = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const parsed = parseRunEventFrame(frame);
        if (parsed) {
          rawEvents.push(parsed);
          if (asString(parsed.event) === "message.delta") {
            void triggerStop("first_message_delta");
          }
        }
      }
    }
    if (buffer.trim()) {
      const parsed = parseRunEventFrame(buffer);
      if (parsed) {
        rawEvents.push(parsed);
      }
    }
  } catch (error) {
    if (!abort.signal.aborted) {
      return { ok: false, error: normalizeChatFetchError(error) };
    }
  } finally {
    clearTimeout(timer);
    if (stopPromise) {
      try {
        stop = await stopPromise;
      } catch {
        stop = {
          ok: false,
          statusCode: null,
          status: null,
          body: null,
          error: {
            kind: "unknown",
            message: "Hermes run stop request failed unexpectedly."
          }
        };
      }
    }
    abort.cleanup();
    reader.releaseLock();
  }

  return {
    ok: true,
    rawEvents,
    events: rawEvents.map(normalizeRunProbeEvent),
    stop,
    stopRequestedAt,
    stopTrigger
  };
}

async function readHermesRunEventsWithApproval(args: {
  apiKey?: string | null;
  approvalChoice: HermesRunApprovalChoice;
  base: URL;
  fetchImpl: typeof fetch;
  runId: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<
  | {
      ok: true;
      rawEvents: Record<string, unknown>[];
      events: HermesRunProbeEvent[];
      approval: HermesRunApprovalResult | null;
      approvalRequestedAt: string | null;
      approvalRespondedAt: string | null;
    }
  | { ok: false; error: HermesChatError }
> {
  const abort = createLinkedAbortController(args.signal, args.timeoutMs);
  const headers = new Headers({ Accept: "text/event-stream" });
  applyHermesAuth(headers, args.apiKey);

  let approval: HermesRunApprovalResult | null = null;
  let approvalPromise: Promise<HermesRunApprovalResult> | null = null;
  let approvalRequestedAt: string | null = null;
  let approvalRespondedAt: string | null = null;
  const triggerApproval = () => {
    if (approvalPromise) {
      return approvalPromise;
    }
    approvalRequestedAt = new Date().toISOString();
    approvalPromise = respondHermesRunApproval({
      apiKey: args.apiKey,
      base: args.base,
      choice: args.approvalChoice,
      fetchImpl: args.fetchImpl,
      runId: args.runId,
      signal: args.signal,
      timeoutMs: Math.min(args.timeoutMs, 8_000)
    }).then((result) => {
      approval = result;
      if (result.ok) {
        approvalRespondedAt = new Date().toISOString();
      }
      return result;
    });
    return approvalPromise;
  };

  let response: Response;
  try {
    response = await args.fetchImpl(
      buildEndpointUrl(args.base, `/v1/runs/${encodeURIComponent(args.runId)}/events`),
      {
        cache: "no-store",
        headers,
        signal: abort.signal
      }
    );
  } catch (error) {
    abort.cleanup();
    return { ok: false, error: normalizeChatFetchError(error) };
  }

  if (!response.ok) {
    abort.cleanup();
    const data = await readJsonObject(response);
    return {
      ok: false,
      error: {
        kind: "http_error",
        message: await safeHermesErrorMessageFromData(response.status, data, "/v1/runs/{run_id}/events")
      }
    };
  }

  if (!response.body) {
    abort.cleanup();
    return {
      ok: false,
      error: {
        kind: "bad_response",
        message: "Hermes run events endpoint did not return a stream body."
      }
    };
  }

  const rawEvents: Record<string, unknown>[] = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const parsed = parseRunEventFrame(frame);
        if (parsed) {
          rawEvents.push(parsed);
          if (asString(parsed.event) === "approval.request") {
            void triggerApproval();
          }
        }
      }
    }
    if (buffer.trim()) {
      const parsed = parseRunEventFrame(buffer);
      if (parsed) {
        rawEvents.push(parsed);
      }
    }
  } catch (error) {
    if (!abort.signal.aborted) {
      return { ok: false, error: normalizeChatFetchError(error) };
    }
  } finally {
    if (approvalPromise) {
      try {
        approval = await approvalPromise;
      } catch {
        approval = {
          ok: false,
          statusCode: null,
          choice: null,
          resolved: null,
          body: null,
          error: {
            kind: "unknown",
            message: "Hermes run approval request failed unexpectedly."
          }
        };
      }
    }
    abort.cleanup();
    reader.releaseLock();
  }

  return {
    ok: true,
    rawEvents,
    events: rawEvents.map(normalizeRunProbeEvent),
    approval,
    approvalRequestedAt,
    approvalRespondedAt
  };
}

async function readHermesRunEvents(args: {
  apiKey?: string | null;
  base: URL;
  fetchImpl: typeof fetch;
  runId: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<
  | { ok: true; rawEvents: Record<string, unknown>[]; events: HermesRunProbeEvent[] }
  | { ok: false; error: HermesChatError }
> {
  const abort = createLinkedAbortController(args.signal, args.timeoutMs);
  const headers = new Headers({ Accept: "text/event-stream" });
  applyHermesAuth(headers, args.apiKey);

  let response: Response;
  try {
    response = await args.fetchImpl(
      buildEndpointUrl(args.base, `/v1/runs/${encodeURIComponent(args.runId)}/events`),
      {
        cache: "no-store",
        headers,
        signal: abort.signal
      }
    );
  } catch (error) {
    abort.cleanup();
    return { ok: false, error: normalizeChatFetchError(error) };
  }

  if (!response.ok) {
    abort.cleanup();
    const data = await readJsonObject(response);
    return {
      ok: false,
      error: {
        kind: "http_error",
        message: await safeHermesErrorMessageFromData(response.status, data, "/v1/runs/{run_id}/events")
      }
    };
  }

  if (!response.body) {
    abort.cleanup();
    return {
      ok: false,
      error: {
        kind: "bad_response",
        message: "Hermes run events endpoint did not return a stream body."
      }
    };
  }

  const rawEvents: Record<string, unknown>[] = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split(/\r?\n\r?\n/);
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const parsed = parseRunEventFrame(frame);
        if (parsed) {
          rawEvents.push(parsed);
        }
      }
    }
    if (buffer.trim()) {
      const parsed = parseRunEventFrame(buffer);
      if (parsed) {
        rawEvents.push(parsed);
      }
    }
  } catch (error) {
    return { ok: false, error: normalizeChatFetchError(error) };
  } finally {
    abort.cleanup();
    reader.releaseLock();
  }

  return {
    ok: true,
    rawEvents,
    events: rawEvents.map(normalizeRunProbeEvent)
  };
}

function parseRunEventFrame(frame: string): Record<string, unknown> | null {
  const dataLines: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }
  if (dataLines.length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(dataLines.join("\n")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeRunProbeEvent(event: Record<string, unknown>): HermesRunProbeEvent {
  return {
    event: asString(event.event) || "unknown",
    keys: Object.keys(event).sort(),
    runId: asString(event.run_id) || undefined,
    timestamp: typeof event.timestamp === "number" || typeof event.timestamp === "string"
      ? event.timestamp
      : undefined,
    deltaPreview: truncatePreview(asString(event.delta)) || undefined,
    outputPreview: truncatePreview(asString(event.output)) || undefined,
    toolName: asString(event.tool) || asString(event.tool_name) || undefined,
    errorPreview: truncatePreview(asString(event.error)) || undefined
  };
}

async function fetchJsonEndpoint(args: {
  apiKey?: string | null;
  base: URL;
  fetchImpl: typeof fetch;
  path: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: HermesChatError }
> {
  const abort = createLinkedAbortController(args.signal, args.timeoutMs);
  const headers = new Headers({ Accept: "application/json" });
  applyHermesAuth(headers, args.apiKey);

  try {
    const response = await args.fetchImpl(buildEndpointUrl(args.base, args.path), {
      cache: "no-store",
      headers,
      signal: abort.signal
    });
    const data = await readJsonObject(response);
    if (!response.ok) {
      return {
        ok: false,
        error: {
          kind: "http_error",
          message: await safeHermesErrorMessageFromData(response.status, data, args.path)
        }
      };
    }
    return { ok: true, data: data ?? {} };
  } catch (error) {
    return {
      ok: false,
      error: normalizeChatFetchError(error)
    };
  } finally {
    abort.cleanup();
  }
}

type HermesSkillToggleTarget = {
  body: Record<string, unknown>;
  method: "PATCH" | "POST" | "PUT";
  path: string;
};

async function discoverHermesSkillToggleTargets(args: {
  apiKey?: string | null;
  base: URL;
  enabled: boolean;
  fetchImpl: typeof fetch;
  signal?: AbortSignal;
  skillId: string;
  timeoutMs: number;
}): Promise<HermesSkillToggleTarget[]> {
  const fromCapabilities: HermesSkillToggleTarget[] = [];
  const capabilities = await fetchJsonEndpoint({
    apiKey: args.apiKey,
    base: args.base,
    fetchImpl: args.fetchImpl,
    path: "/v1/capabilities",
    signal: args.signal,
    timeoutMs: args.timeoutMs
  });

  if (capabilities.ok) {
    for (const endpoint of extractSkillMutationEndpoints(capabilities.data)) {
      fromCapabilities.push({
        body: { enabled: args.enabled },
        method: endpoint.method,
        path: fillSkillEndpointPath(endpoint.path, args.skillId)
      });
    }
  }

  const encodedId = encodeURIComponent(args.skillId);
  const fallbackTargets: HermesSkillToggleTarget[] = [
    { method: "PATCH", path: `/v1/skills/${encodedId}`, body: { enabled: args.enabled } },
    { method: "PATCH", path: `/v1/skills/${encodedId}/enabled`, body: { enabled: args.enabled } },
    { method: "POST", path: `/v1/skills/${encodedId}/${args.enabled ? "enable" : "disable"}`, body: {} },
    { method: "POST", path: `/v1/skills/${encodedId}/toggle`, body: { enabled: args.enabled } },
    { method: "PUT", path: `/v1/skills/${encodedId}`, body: { enabled: args.enabled } },
    { method: "POST", path: `/v1/skills/${encodedId}`, body: { enabled: args.enabled } }
  ];
  const seen = new Set<string>();

  return [...fromCapabilities, ...fallbackTargets].filter((target) => {
    const key = `${target.method} ${target.path}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractSkillMutationEndpoints(data: Record<string, unknown>) {
  const endpoints = objectRecord(data.endpoints);
  if (!endpoints) {
    return [];
  }

  return Object.entries(endpoints)
    .flatMap(([key, value]) => endpointEntriesFromCapability(key, value))
    .filter((endpoint) => {
      const text = `${endpoint.key} ${endpoint.path}`.toLowerCase();
      return text.includes("skill") && /enable|disable|toggle|update|patch|write|set/.test(text);
    });
}

function endpointEntriesFromCapability(key: string, value: unknown): Array<{ key: string; method: "PATCH" | "POST" | "PUT"; path: string }> {
  const record = objectRecord(value);
  if (!record) {
    return [];
  }

  const path = firstString(record.path, record.url, record.href, record.endpoint);
  if (!path) {
    return [];
  }

  const rawMethods = Array.isArray(record.methods)
    ? record.methods
    : Array.isArray(record.method)
      ? record.method
      : [record.method];

  return rawMethods
    .map((method) => asString(method).toUpperCase())
    .filter((method): method is "PATCH" | "POST" | "PUT" => method === "PATCH" || method === "POST" || method === "PUT")
    .map((method) => ({ key, method, path }));
}

function fillSkillEndpointPath(path: string, skillId: string) {
  const encodedId = encodeURIComponent(skillId);
  return path
    .replace("{skill_id}", encodedId)
    .replace("{skillId}", encodedId)
    .replace(":skill_id", encodedId)
    .replace(":skillId", encodedId);
}

async function fetchJsonMutationEndpoint(args: {
  apiKey?: string | null;
  base: URL;
  body: Record<string, unknown>;
  fetchImpl: typeof fetch;
  method: "PATCH" | "POST" | "PUT";
  path: string;
  signal?: AbortSignal;
  timeoutMs: number;
}): Promise<
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: HermesChatError }
> {
  const abort = createLinkedAbortController(args.signal, args.timeoutMs);
  const headers = new Headers({ Accept: "application/json", "Content-Type": "application/json" });
  applyHermesAuth(headers, args.apiKey);

  try {
    const response = await args.fetchImpl(buildEndpointUrl(args.base, args.path), {
      body: JSON.stringify(args.body),
      cache: "no-store",
      headers,
      method: args.method,
      signal: abort.signal
    });
    const data = await readJsonObject(response);
    if (!response.ok) {
      return {
        ok: false,
        error: {
          kind: "http_error",
          message: await safeHermesErrorMessageFromData(response.status, data, args.path)
        }
      };
    }
    return { ok: true, data: data ?? {} };
  } catch (error) {
    return {
      ok: false,
      error: normalizeChatFetchError(error)
    };
  } finally {
    abort.cleanup();
  }
}

function isEndpointMismatchError(error: HermesChatError) {
  return (
    error.kind === "http_error" &&
    (error.message.includes("HTTP 404") ||
      error.message.includes("HTTP 405") ||
      error.message.includes("HTTP 501"))
  );
}

function withUiCapabilities(
  status: Omit<NormalizedHermesStatus, "uiCapabilities">,
  config: Pick<HermesClientConfig, "configuredDefaultModelId" | "memoryScopeBridgeEnabled">
): NormalizedHermesStatus {
  return {
    ...status,
    uiCapabilities: normalizeHermesUiCapabilities(status, {
      configuredDefaultModelId: config.configuredDefaultModelId,
      memoryScopeBridgeEnabled: config.memoryScopeBridgeEnabled
    })
  };
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeTokenUsage(source: Record<string, unknown>): HermesTokenUsage | undefined {
  const metadata = objectRecord(source.metadata);
  const usage =
    objectRecord(source.usage) ??
    objectRecord(source.token_usage) ??
    objectRecord(metadata?.usage) ??
    objectRecord(metadata?.token_usage) ??
    source;
  const stats =
    objectRecord(source.stats) ??
    objectRecord(usage.stats) ??
    objectRecord(metadata?.stats) ??
    objectRecord(metadata?.generation_stats);
  const promptDetails =
    objectRecord(usage.prompt_tokens_details) ??
    objectRecord(usage.promptTokensDetails) ??
    objectRecord(source.prompt_tokens_details) ??
    objectRecord(source.promptTokensDetails);
  const completionDetails =
    objectRecord(usage.completion_tokens_details) ??
    objectRecord(usage.completionTokensDetails) ??
    objectRecord(source.completion_tokens_details) ??
    objectRecord(source.completionTokensDetails);
  const promptTokens =
    finiteNumber(usage.prompt_tokens) ??
    finiteNumber(usage.promptTokens) ??
    finiteNumber(usage.input_tokens) ??
    finiteNumber(usage.inputTokens);
  const completionTokens =
    finiteNumber(usage.completion_tokens) ??
    finiteNumber(usage.completionTokens) ??
    finiteNumber(usage.output_tokens) ??
    finiteNumber(usage.outputTokens);
  const totalTokens =
    finiteNumber(usage.total_tokens) ??
    finiteNumber(usage.totalTokens) ??
    (promptTokens !== undefined || completionTokens !== undefined
      ? (promptTokens ?? 0) + (completionTokens ?? 0)
      : undefined);
  const cachedTokens =
    finiteNumber(usage.cached_tokens) ??
    finiteNumber(usage.cachedTokens) ??
    finiteNumber(promptDetails?.cached_tokens) ??
    finiteNumber(promptDetails?.cachedTokens);
  const reasoningTokens =
    finiteNumber(usage.reasoning_tokens) ??
    finiteNumber(usage.reasoningTokens) ??
    finiteNumber(completionDetails?.reasoning_tokens) ??
    finiteNumber(completionDetails?.reasoningTokens);
  const costUsd =
    finiteNumber(usage.cost_usd) ??
    finiteNumber(usage.costUsd) ??
    finiteNumber(usage.total_cost) ??
    finiteNumber(usage.totalCost) ??
    finiteNumber(usage.cost) ??
    finiteNumber(source.cost_usd) ??
    finiteNumber(source.costUsd) ??
    finiteNumber(source.total_cost) ??
    finiteNumber(source.totalCost) ??
    finiteNumber(source.cost);
  const normalized: HermesTokenUsage = {};
  if (promptTokens !== undefined) {
    normalized.promptTokens = promptTokens;
  }
  if (completionTokens !== undefined) {
    normalized.completionTokens = completionTokens;
  }
  if (totalTokens !== undefined) {
    normalized.totalTokens = totalTokens;
  }
  if (cachedTokens !== undefined) {
    normalized.cachedTokens = cachedTokens;
  }
  if (reasoningTokens !== undefined) {
    normalized.reasoningTokens = reasoningTokens;
  }
  if (costUsd !== undefined) {
    normalized.costUsd = costUsd;
  }
  const provider = asString(usage.provider) || asString(source.provider);
  const model = asString(usage.model) || asString(source.model);
  const upstreamModel =
    asString(usage.upstream_model) ||
    asString(usage.upstreamModel) ||
    asString(source.upstream_model) ||
    asString(source.upstreamModel);
  const generationId =
    asString(usage.generation_id) ||
    asString(usage.generationId) ||
    asString(source.generation_id) ||
    asString(source.generationId) ||
    (asString(source.object).includes("completion") ? asString(source.id) : "");
  const finishReason =
    asString(usage.finish_reason) ||
    asString(usage.finishReason) ||
    asString(source.finish_reason) ||
    asString(source.finishReason) ||
    firstChoiceString(source.choices, "finish_reason", "finishReason");
  const requestId =
    asString(usage.request_id) ||
    asString(usage.requestId) ||
    asString(source.request_id) ||
    asString(source.requestId);
  const requestedModel =
    asString(usage.requested_model) ||
    asString(usage.requestedModel) ||
    asString(source.requested_model) ||
    asString(source.requestedModel) ||
    asString(metadata?.requested_model) ||
    asString(metadata?.requestedModel);
  const requestedProvider =
    asString(usage.requested_provider) ||
    asString(usage.requestedProvider) ||
    asString(source.requested_provider) ||
    asString(source.requestedProvider) ||
    asString(metadata?.requested_provider) ||
    asString(metadata?.requestedProvider);
  const routeMismatch =
    booleanValue(usage.route_mismatch) ??
    booleanValue(usage.routeMismatch) ??
    booleanValue(source.route_mismatch) ??
    booleanValue(source.routeMismatch) ??
    booleanValue(metadata?.route_mismatch) ??
    booleanValue(metadata?.routeMismatch);
  const routeVerified =
    booleanValue(usage.route_verified) ??
    booleanValue(usage.routeVerified) ??
    booleanValue(source.route_verified) ??
    booleanValue(source.routeVerified) ??
    booleanValue(metadata?.route_verified) ??
    booleanValue(metadata?.routeVerified);
  const latencyMs =
    finiteNumber(usage.latency_ms) ??
    finiteNumber(usage.latencyMs) ??
    finiteNumber(source.latency_ms) ??
    finiteNumber(source.latencyMs);
  const tokensPerSecond =
    finiteNumber(usage.tokens_per_second) ??
    finiteNumber(usage.tokensPerSecond) ??
    finiteNumber(usage.tokens_per_sec) ??
    finiteNumber(usage.tokensPerSec) ??
    finiteNumber(source.tokens_per_second) ??
    finiteNumber(source.tokensPerSecond) ??
    finiteNumber(stats?.tokens_per_second) ??
    finiteNumber(stats?.tokensPerSecond) ??
    finiteNumber(stats?.tokens_per_sec) ??
    finiteNumber(stats?.tokensPerSec);
  const timeToFirstTokenMs =
    finiteNumber(usage.time_to_first_token_ms) ??
    finiteNumber(usage.timeToFirstTokenMs) ??
    finiteNumber(source.time_to_first_token_ms) ??
    finiteNumber(source.timeToFirstTokenMs) ??
    finiteNumber(stats?.time_to_first_token_ms) ??
    finiteNumber(stats?.timeToFirstTokenMs) ??
    secondsToMs(
      finiteNumber(usage.time_to_first_token_seconds) ??
        finiteNumber(usage.timeToFirstTokenSeconds) ??
        finiteNumber(source.time_to_first_token_seconds) ??
        finiteNumber(source.timeToFirstTokenSeconds) ??
        finiteNumber(stats?.time_to_first_token_seconds) ??
        finiteNumber(stats?.timeToFirstTokenSeconds) ??
        finiteNumber(stats?.ttft_s)
    );
  if (provider) {
    normalized.provider = provider;
  }
  if (model) {
    normalized.model = model;
  }
  if (upstreamModel) {
    normalized.upstreamModel = upstreamModel;
  }
  if (generationId) {
    normalized.generationId = generationId;
  }
  if (finishReason) {
    normalized.finishReason = finishReason;
  }
  if (requestId) {
    normalized.requestId = requestId;
  }
  if (requestedModel) {
    normalized.requestedModel = requestedModel;
  }
  if (requestedProvider) {
    normalized.requestedProvider = requestedProvider;
  }
  if (routeMismatch !== undefined) {
    normalized.routeMismatch = routeMismatch;
  }
  if (routeVerified !== undefined) {
    normalized.routeVerified = routeVerified;
  }
  if (latencyMs !== undefined) {
    normalized.latencyMs = latencyMs;
  }
  if (tokensPerSecond !== undefined) {
    normalized.tokensPerSecond = tokensPerSecond;
  }
  if (timeToFirstTokenMs !== undefined) {
    normalized.timeToFirstTokenMs = timeToFirstTokenMs;
  }
  const sourceLabel = normalizeUsageSource(asString(usage.source) || asString(source.source));
  const hasUsageValues = Object.keys(normalized).length > 0;
  if (sourceLabel && hasUsageValues) {
    normalized.source = sourceLabel;
  } else if (hasUsageValues) {
    normalized.source = "provider";
  }
  return hasUsageValues ? normalized : undefined;
}

function firstChoiceString(value: unknown, ...keys: string[]): string {
  if (!Array.isArray(value)) {
    return "";
  }
  for (const item of value) {
    const choice = objectRecord(item);
    if (!choice) {
      continue;
    }
    for (const key of keys) {
      const text = asString(choice[key]);
      if (text) {
        return text;
      }
    }
  }
  return "";
}

function normalizeUsageSource(value: string): HermesTokenUsage["source"] | undefined {
  if (
    value === "provider" ||
    value === "hermes_usage" ||
    value === "estimated" ||
    value === "unavailable"
  ) {
    return value;
  }
  return undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function secondsToMs(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.round(value * 1000);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value).trim();
    if (text) {
      return text;
    }
  }
  return "";
}

function optionalBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (normalized === "true" || normalized === "yes" || normalized === "1") {
        return true;
      }
      if (normalized === "false" || normalized === "no" || normalized === "0") {
        return false;
      }
    }
  }
  return null;
}

function flag(value: Record<string, unknown> | null, key: string): boolean {
  return value?.[key] === true;
}

function hasEndpoint(endpoints: Record<string, unknown> | null, key: string): boolean {
  const endpoint = endpoints?.[key];
  return Boolean(endpoint && typeof endpoint === "object" && !Array.isArray(endpoint));
}

function firstModelId(models: Record<string, unknown> | null): string {
  const data = models?.data;
  if (!Array.isArray(data)) {
    return "";
  }
  const first = data.find((item) => item && typeof item === "object" && !Array.isArray(item));
  return first ? asString((first as Record<string, unknown>).id) : "";
}

function extractConfiguredDefaultModelIds(
  status: Omit<NormalizedHermesStatus, "uiCapabilities">,
  configuredDefaultModelId?: string | null
): string[] {
  const capabilities = status.capabilities;
  const healthDetailed = objectRecord(status.health?.detailed);
  const healthBasic = objectRecord(status.health?.basic);
  const modelsRoot = objectRecord(status.models);
  const gatewayDefaults = objectRecord(capabilities?.gateway_model_defaults);
  const modelConfig = objectRecord(capabilities?.model_config);
  const modelObject = objectRecord(capabilities?.model);

  const candidates = [
    asString(configuredDefaultModelId),
    asString(gatewayDefaults?.model),
    asString(gatewayDefaults?.default),
    asString(gatewayDefaults?.default_model),
    asString(capabilities?.default_model),
    asString(modelConfig?.default),
    asString(modelObject?.default),
    asString(healthDetailed?.default_model),
    asString(healthDetailed?.model),
    asString(healthBasic?.default_model),
    asString(healthBasic?.model),
    asString(modelsRoot?.default_model),
    flaggedDefaultModelId(status.models)
  ].filter((value): value is string => Boolean(value) && !isPlaceholderHermesModelId(value));

  return [...new Set(candidates)];
}

function flaggedDefaultModelId(models: Record<string, unknown> | null): string {
  const data = models?.data;
  if (!Array.isArray(data)) {
    return "";
  }

  for (const item of data) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    if (record.default === true) {
      return asString(record.id);
    }
  }

  return "";
}

function orderModelsWithDefaultFirst(
  models: HermesModelDescriptor[],
  defaultModelId: string | null
): HermesModelDescriptor[] {
  return [...models].sort((a, b) => {
    const defaultCompare = modelDefaultRank(a, defaultModelId) - modelDefaultRank(b, defaultModelId);
    if (defaultCompare !== 0) {
      return defaultCompare;
    }
    const stableCompare = stableHermesModelRank(a) - stableHermesModelRank(b);
    if (stableCompare !== 0) {
      return stableCompare;
    }
    const labelCompare = a.label.localeCompare(b.label);
    if (labelCompare !== 0) {
      return labelCompare;
    }
    return a.id.localeCompare(b.id);
  });
}

function modelDefaultRank(model: HermesModelDescriptor, defaultModelId: string | null): number {
  if (!defaultModelId) {
    return 1;
  }
  return sameModelId(model.id, defaultModelId) ? 0 : 1;
}

function stableHermesModelRank(model: HermesModelDescriptor): number {
  const index = STABLE_HERMES_MODEL_ORDER.findIndex((id) => sameModelId(id, model.id));
  return index === -1 ? STABLE_HERMES_MODEL_ORDER.length : index;
}

function sameModelId(a: string, b: string): boolean {
  return normalizeModelIdForCompare(a) === normalizeModelIdForCompare(b);
}

function normalizeModelIdForCompare(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function resolveAdvertisedModelId(
  rawModelId: string | null,
  availableModels: HermesModelDescriptor[],
  configuredDefaults: string[] = []
): string | null {
  const candidates = [
    ...configuredDefaults,
    ...(rawModelId && !isPlaceholderHermesModelId(rawModelId) ? [rawModelId] : [])
  ];

  for (const candidate of candidates) {
    if (availableModels.some((model) => model.id === candidate)) {
      return candidate;
    }
  }

  const inferredDefault = inferCatalogDefaultModelId(availableModels);
  if (inferredDefault) {
    return inferredDefault;
  }

  return availableModels[0]?.id ?? null;
}

function inferCatalogDefaultModelId(availableModels: HermesModelDescriptor[]): string | null {
  const preferredPatterns = [/deepseek-v4-flash/i, /deepseek.*v4.*flash/i, /deepseek.*flash/i];

  for (const pattern of preferredPatterns) {
    const match = availableModels.find((model) => pattern.test(model.id));
    if (match) {
      return match.id;
    }
  }

  return null;
}

function modelDescriptors(models: Record<string, unknown> | null): HermesModelDescriptor[] {
  const data = models?.data;
  if (!Array.isArray(data)) {
    return [];
  }

  const descriptors: HermesModelDescriptor[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = asString(record.id);
    if (!id) {
      continue;
    }
    const providerKey = selectionProviderKeyForModel(id, asString(record.owned_by) || null);
    const provider = providerKey || providerFromModelId(id);
    descriptors.push({
      id,
      label: modelLabelFromDescriptor(record, id),
      provider: formatHermesProviderLabel(provider) || provider,
      catalogSource: "hermes-config",
      selectionScope: "session",
      providerKey,
      selectModelId: resolveModelSelectId(id, providerKey)
    });
  }
  return descriptors;
}

function openRouterModelsUrl(baseUrl: string | null | undefined): string {
  const raw = baseUrl?.trim();
  if (!raw) {
    return OPENROUTER_MODELS_URL;
  }
  try {
    const url = new URL(raw);
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/api/v1/models";
    }
    return url.toString();
  } catch {
    return OPENROUTER_MODELS_URL;
  }
}

function lmStudioModelsUrl(baseUrl: string | null | undefined): string {
  const raw = baseUrl?.trim();
  if (!raw) {
    return LMSTUDIO_MODELS_URL;
  }
  try {
    const url = new URL(raw);
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/api/v1/models";
    }
    return url.toString();
  } catch {
    return LMSTUDIO_MODELS_URL;
  }
}

function normalizeOpenRouterModels(data: Record<string, unknown> | null): HermesModelDescriptor[] {
  const items = data?.data;
  if (!Array.isArray(items)) {
    return [];
  }

  const models: HermesModelDescriptor[] = [];
  for (const item of items) {
    const record = objectRecord(item);
    if (!record) {
      continue;
    }
    const id = asString(record.id);
    if (!id || isPlaceholderHermesModelId(id)) {
      continue;
    }
    const architecture = objectRecord(record.architecture);
    const pricing = objectRecord(record.pricing);
    models.push({
      id,
      label: asString(record.name) || formatHermesModelLabel(id),
      provider: "OpenRouter",
      providerKey: "openrouter",
      selectModelId: id,
      catalogSource: "ui-openrouter",
      selectionScope: "session",
      description: asString(record.description) || null,
      contextLength: numberOrNull(record.context_length),
      created: numberOrNull(record.created),
      inputModalities: stringArray(architecture?.input_modalities),
      outputModalities: stringArray(architecture?.output_modalities),
      supportedParameters: stringArray(record.supported_parameters),
      pricing: pricing
        ? {
            completion: asString(pricing.completion) || null,
            image: asString(pricing.image) || null,
            prompt: asString(pricing.prompt) || null,
            request: asString(pricing.request) || null
          }
        : null
    });
  }

  return models.sort((a, b) => a.label.localeCompare(b.label));
}

function normalizeLmStudioModels(data: Record<string, unknown> | null): HermesModelDescriptor[] {
  const items = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.models)
      ? data.models
      : Array.isArray(data)
        ? data
        : [];
  const models: HermesModelDescriptor[] = [];

  for (const item of items) {
    const record = objectRecord(item);
    if (!record) {
      continue;
    }
    const type = asString(record.type).trim().toLowerCase();
    if (type === "embedding") {
      continue;
    }

    const id = asString(record.id) || asString(record.key) || asString(record.model);
    if (!id || isPlaceholderHermesModelId(id)) {
      continue;
    }

    // An installed-but-unloaded model cannot serve a request, but hiding it
    // entirely is confusing ("why is qwen not even in the menu?"). Surface it
    // with a "not-loaded" availability so the Composer can render it as a
    // disabled row with a "load in LM Studio" hint instead of dropping it.
    const loadedInstances = Array.isArray(record.loaded_instances) ? record.loaded_instances : [];
    const availability = loadedInstances.length === 0 ? "not-loaded" : "ready";

    const runtime = normalizeLmStudioRuntime(record);
    models.push({
      id,
      label: asString(record.display_name) || asString(record.displayName) || formatHermesModelLabel(id),
      provider: "LM Studio",
      providerKey: LOCAL_LMSTUDIO_PROVIDER_KEY,
      selectModelId: id,
      catalogSource: "ui-lmstudio",
      selectionScope: "session",
      availability,
      contextLength: runtime.loadedContextLength ?? runtime.maxContextLength ?? null,
      inputModalities: normalizeLmStudioInputModalities(record),
      outputModalities: ["text"],
      supportedParameters: normalizeLmStudioSupportedParameters(record),
      runtime
    });
  }

  return models.sort((a, b) => a.label.localeCompare(b.label));
}

function normalizeLmStudioRuntime(record: Record<string, unknown>): HermesModelRuntimeMetadata {
  const quantization = objectRecord(record.quantization);
  const loadedInstances = Array.isArray(record.loaded_instances) ? record.loaded_instances : [];
  const loadedInstance = loadedInstances.map(objectRecord).find(Boolean) ?? null;
  const config = objectRecord(loadedInstance?.config);
  const loadedContextLength =
    numberOrNull(config?.context_length) ??
    numberOrNull(config?.contextLength) ??
    numberOrNull(record.loaded_context_length) ??
    numberOrNull(record.loadedContextLength);
  const maxContextLength =
    numberOrNull(record.max_context_length) ??
    numberOrNull(record.maxContextLength) ??
    loadedContextLength;

  return pruneRuntimeMetadata({
    architecture: asString(record.architecture) || null,
    format: asString(record.format) || asString(record.compatibility_type) || null,
    loadedContextLength,
    maxContextLength,
    params: asString(record.params_string) || asString(record.paramsString) || null,
    quantization: asString(quantization?.name) || asString(record.quantization) || null,
    quantizationBits: numberOrNull(quantization?.bits_per_weight) ?? numberOrNull(quantization?.bitsPerWeight),
    runtimeConfig: pruneRuntimeConfig({
      contextLength: loadedContextLength,
      evalBatchSize: numberOrNull(config?.eval_batch_size) ?? numberOrNull(config?.evalBatchSize),
      flashAttention: optionalBoolean(config?.flash_attention, config?.flashAttention),
      kCacheQuantizationType:
        asString(config?.k_cache_quantization_type) ||
        asString(config?.kCacheQuantizationType) ||
        null,
      numExperts: numberOrNull(config?.num_experts) ?? numberOrNull(config?.numExperts),
      offloadKvCacheToGpu: optionalBoolean(config?.offload_kv_cache_to_gpu, config?.offloadKvCacheToGpu),
      parallel: numberOrNull(config?.parallel),
      vCacheQuantizationType:
        asString(config?.v_cache_quantization_type) ||
        asString(config?.vCacheQuantizationType) ||
        null
    }),
    selectedVariant: asString(record.selected_variant) || asString(record.selectedVariant) || null,
    sizeBytes: numberOrNull(record.size_bytes) ?? numberOrNull(record.sizeBytes),
    state: asString(record.state) || null
  });
}

function normalizeLmStudioInputModalities(record: Record<string, unknown>): string[] {
  const capabilities = objectRecord(record.capabilities);
  return optionalBoolean(capabilities?.vision) ? ["text", "image"] : ["text"];
}

function normalizeLmStudioSupportedParameters(record: Record<string, unknown>): string[] {
  const capabilities = objectRecord(record.capabilities);
  const parameters = ["stream"];
  if (optionalBoolean(capabilities?.trained_for_tool_use, capabilities?.trainedForToolUse)) {
    parameters.push("tools");
  }
  if (optionalBoolean(capabilities?.reasoning)) {
    parameters.push("reasoning");
  }
  return parameters;
}

function pruneRuntimeMetadata(runtime: HermesModelRuntimeMetadata): HermesModelRuntimeMetadata {
  return Object.fromEntries(
    Object.entries(runtime).filter(([, value]) => value !== null && value !== undefined)
  ) as HermesModelRuntimeMetadata;
}

function pruneRuntimeConfig(
  config: NonNullable<HermesModelRuntimeMetadata["runtimeConfig"]>
): NonNullable<HermesModelRuntimeMetadata["runtimeConfig"]> | null {
  const pruned = Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== null && value !== undefined)
  ) as NonNullable<HermesModelRuntimeMetadata["runtimeConfig"]>;
  return Object.keys(pruned).length > 0 ? pruned : null;
}

function preferPublicProviderCatalogModels(models: HermesModelDescriptor[]): HermesModelDescriptor[] {
  const publicProviderAliases = new Set(
    models
      .filter((model) => isOpenRouterCatalogProvider(model.providerKey ?? model.provider ?? ""))
      .map((model) => catalogAliasKey(model.id))
  );

  return models.filter((model) => {
    const providerKey = (model.providerKey ?? model.provider ?? "").trim().toLowerCase();
    const id = model.id.trim().toLowerCase();
    if (providerKey === "anthropic" && !id.includes("/") && publicProviderAliases.has(catalogAliasKey(id))) {
      return false;
    }
    return true;
  });
}

function catalogAliasKey(modelId: string): string {
  const slug = (modelId.includes("/") ? modelId.split("/").pop() ?? modelId : modelId).trim().toLowerCase();
  return slug.replace(/[^a-z0-9]/g, "");
}

function modelLabelFromDescriptor(record: Record<string, unknown>, id: string): string {
  const label = (
    asString(record.display_name) ||
    asString(record.displayName) ||
    asString(record.name) ||
    asString(record.label) ||
    formatHermesModelLabel(id)
  );
  return formatHermesModelLabel(label);
}

function providerFromModelId(id: string): string | null {
  const prefix = id.includes("/") ? id.split("/")[0]?.trim() : "";
  if (!prefix) {
    return null;
  }
  return formatHermesProviderLabel(prefix);
}

function selectionProviderKeyForModel(id: string, providerKey: string | null): string | null {
  const normalizedProvider = providerKey?.trim().toLowerCase() ?? "";
  if (normalizedProvider !== "lmstudio") {
    return providerKey;
  }
  const normalizedId = id.trim().toLowerCase();
  if (normalizedId === "qwen/qwen3.6-35b-a3b") {
    return "local-lmstudio-qwen36";
  }
  if (normalizedId === "google/gemma-4-26b-a4b") {
    return LOCAL_LMSTUDIO_PROVIDER_KEY;
  }
  return providerKey;
}

function resolveModelSelectId(id: string, _providerKey: string | null): string {
  // Hermes POST /api/sessions/{id}/model expects the catalog id from GET /v1/models.
  // Do not translate aggregator ids into provider-native aliases here: this
  // endpoint may ignore the separate provider field, and a bare alias can route
  // to a different direct provider.
  return id;
}

function isOpenRouterCatalogProvider(providerKey: string): boolean {
  const normalized = providerKey.trim().toLowerCase();
  return normalized === "openrouter" || normalized.startsWith("openrouter-");
}

function validateDedicatedProviderSelect(
  expectedProviderKey: string | null | undefined,
  result: HermesModelSelectResult
): HermesStatusError | null {
  if (!expectedProviderKey) {
    return null;
  }

  const resolvedProvider = result.provider?.trim().toLowerCase() ?? "";
  const expected = expectedProviderKey.trim().toLowerCase();
  const selectedModel = result.selectedModel?.trim() ?? "";
  if (!resolvedProvider) {
    return null;
  }

  if (isOpenRouterCatalogProvider(expectedProviderKey)) {
    if (isOpenRouterCatalogProvider(resolvedProvider)) {
      return null;
    }
    const resolvedLabel = result.provider || selectedModel || "another provider";
    return {
      kind: "http_error",
      message:
        `Hermes resolved this OpenRouter catalog model through ${resolvedLabel}. ` +
        "The HTTP session model route did not verify the requested OpenRouter provider family; " +
        "use a non-ambiguous model or set the provider with Hermes /model if the provider family cannot be verified."
    };
  }

  const misroutedThroughOpenRouter =
    resolvedProvider === "openrouter" || resolvedProvider === "nous";
  const providerMismatch =
    !misroutedThroughOpenRouter &&
    !resolvedProvider.includes(expected) &&
    !expected.includes(resolvedProvider) &&
    !resolvedProvider.includes(expected.split("-")[0]);

  if (misroutedThroughOpenRouter || providerMismatch) {
    const resolvedLabel = result.provider || selectedModel || "another provider";
    return {
      kind: "http_error",
      message:
        `Hermes routed this model through ${resolvedLabel} instead of ${expectedProviderKey}. ` +
        "Telegram /model can disambiguate providers; this HTTP session model route did not verify that provider path. " +
        "Verify the provider API key and endpoint in Hermes (`hermes model`) and config.yaml."
    };
  }

  return null;
}

function normalizeModelUiState(args: {
  availableModels: HermesModelDescriptor[];
  catalogModels?: HermesModelDescriptor[];
  clientSelectable: boolean;
  listAvailable: boolean;
  serverAdvertisedModel: string | null;
  statusMode: string;
}): {
  currentModelLabel: string;
  currentProviderLabel: string;
  fastStreamProfile: "unknown";
  reason: string;
  selectedModelId: string | null;
  selectionStatus: HermesUiCapabilities["models"]["selectionStatus"];
} {
  const selectedModelId = args.serverAdvertisedModel ?? args.availableModels[0]?.id ?? null;
  const labelCatalog = args.catalogModels ?? args.availableModels;
  const selectedModel = selectedModelId
    ? labelCatalog.find((model) => model.id === selectedModelId) ??
      args.availableModels.find((model) => model.id === selectedModelId)
    : undefined;
  const currentModelLabel = selectedModel?.label ?? selectedModelId ?? "Hermes server model";
  const currentProviderLabel = selectedModel?.provider ?? "Hermes server config";
  const selectionStatus = modelSelectionStatus(args);

  return {
    currentModelLabel,
    currentProviderLabel,
    fastStreamProfile: "unknown",
    reason: modelSelectionReason(selectionStatus, args),
    selectedModelId,
    selectionStatus
  };
}

function modelSelectionStatus(args: {
  availableModels: HermesModelDescriptor[];
  clientSelectable: boolean;
  listAvailable: boolean;
  serverAdvertisedModel: string | null;
  statusMode: string;
}): HermesUiCapabilities["models"]["selectionStatus"] {
  if (args.statusMode === "unconfigured" || args.statusMode === "mock" || args.statusMode === "error") {
    return args.listAvailable ? "deferred" : "unavailable";
  }
  if (args.clientSelectable) {
    return "client-selectable";
  }
  if (args.serverAdvertisedModel || args.availableModels.length > 0) {
    return "server-configured";
  }
  return args.listAvailable ? "unknown" : "unavailable";
}

function modelSelectionReason(
  status: ReturnType<typeof modelSelectionStatus>,
  args: {
    availableModels: HermesModelDescriptor[];
    listAvailable: boolean;
    serverAdvertisedModel: string | null;
  }
) {
  if (status === "server-configured") {
    return "Hermes advertises a model/profile, but current runtime switching is server-configured and not verified for the session stream API.";
  }
  if (status === "client-selectable") {
    return "Hermes exposes session-switchable models and the Web UI can request per-session overrides through the BFF.";
  }
  if (status === "unavailable") {
    return "Hermes has not exposed a model list or verified client-selectable model control for this UI process.";
  }
  if (status === "unknown") {
    return "Hermes model status is partially available, but client-selectable runtime switching is not verified.";
  }
  if (args.availableModels.length > 0 || args.serverAdvertisedModel) {
    return "Model data is visible, but selection remains deferred until runtime switching is verified through the BFF.";
  }
  return "Provider/model selection is deferred until Hermes exposes a verified client-selectable control path.";
}

function parseBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function safeDisplayUrl(url: URL): string {
  const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return `${url.origin}${pathname}`;
}

function buildEndpointUrl(base: URL, path: string): string {
  const root = base.href.endsWith("/") ? base.href : `${base.href}/`;
  return new URL(path.replace(/^\//, ""), root).toString();
}

function applyHermesAuth(headers: Headers, apiKey?: string | null) {
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
}

async function ensureHermesSession(args: {
  apiKey?: string | null;
  base: URL;
  fetchImpl: typeof fetch;
  model?: string | null;
  signal?: AbortSignal;
  sessionId: string;
  sessionTitle: string;
  timeoutMs: number;
}): Promise<HermesChatStreamResult> {
  const abort = createLinkedAbortController(args.signal, args.timeoutMs);
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json"
  });
  applyHermesAuth(headers, args.apiKey);

  try {
    const response = await args.fetchImpl(buildEndpointUrl(args.base, "/api/sessions"), {
      body: JSON.stringify({
        id: args.sessionId,
        model: args.model || undefined,
        title: makeHermesSessionTitle(args.sessionTitle, args.sessionId)
      }),
      cache: "no-store",
      headers,
      method: "POST",
      signal: abort.signal
    });

    if (response.ok || response.status === 409) {
      return {
        ok: true,
        hermesSessionId: args.sessionId,
        stream: new ReadableStream<Uint8Array>()
      };
    }

    const message = await safeHermesErrorMessage(response, "/api/sessions");
    return chatFailure(response.status, "http_error", message);
  } catch (error) {
    return {
      ok: false,
      status: isAbortError(error) ? 499 : 502,
      error: normalizeChatFetchError(error)
    };
  } finally {
    abort.cleanup();
  }
}

function makeHermesSessionTitle(title: string, sessionId: string): string {
  const cleanTitle = title.replace(/[\r\n\x00]/g, " ").trim() || "Studio chat";
  const suffix = sessionId.slice(-8) || "session";
  const base = cleanTitle.length > 80 ? cleanTitle.slice(0, 80).trim() : cleanTitle;
  return `${base} [${suffix}]`;
}

function emptyAssistantModelFallback(modelId: string, provider: string | null | undefined): string {
  const modelLabel = formatHermesModelLabel(modelId);
  const providerLabel = formatHermesProviderLabel(provider) || "Hermes configured provider";
  return (
    `Hermes selected ${modelLabel} via ${providerLabel} for this session, ` +
    "but the provider completed this turn without returning assistant text. " +
    "Detailed model specs were not exposed by Hermes for this request."
  );
}

function sanitizeHermesId(value: string): string {
  return value.replace(/[\r\n\x00]/g, "").slice(0, 256) || "studio-session";
}

function sanitizeHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const clean = value.replace(/[\r\n\x00]/g, "").slice(0, 256);
  return clean || null;
}

function normalizeHermesSseStream(
  upstream: ReadableStream<Uint8Array>,
  abort: LinkedAbortController,
  emptyAssistantFallback?: string
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      let buffer = "";
      let doneSent = false;
      const streamState = {
        emptyAssistantFallback,
        hasAssistantText: false
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            doneSent = writeNormalizedFrame(controller, encoder, frame, streamState) || doneSent;
          }
        }

        if (buffer.trim()) {
          doneSent = writeNormalizedFrame(controller, encoder, buffer, streamState) || doneSent;
        }
        if (!doneSent) {
          writeEmptyAssistantFallback(controller, encoder, streamState);
          writeUiSse(controller, encoder, { type: "done" });
        }
      } catch (error) {
        if (!abort.signal.aborted && !isAbortError(error)) {
          writeUiSse(controller, encoder, {
            type: "error",
            error: {
              kind: "network",
              message: "Hermes stream ended unexpectedly."
            }
          });
          if (!doneSent) {
            writeUiSse(controller, encoder, { type: "done" });
          }
        }
      } finally {
        abort.cleanup();
        controller.close();
        reader.releaseLock();
      }
    }
  });
}

function writeNormalizedFrame(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  frame: string,
  streamState?: {
    emptyAssistantFallback?: string;
    hasAssistantText: boolean;
  }
): boolean {
  const parsed = parseSseFrame(frame);
  if (!parsed) {
    return false;
  }
  let normalized = normalizeHermesSseEvent(parsed.eventName, parsed.payload);
  if (normalized) {
    if (normalized.type === "message_delta" && normalized.delta.trim()) {
      if (streamState) {
        streamState.hasAssistantText = true;
      }
    }
    if (normalized.type === "message_done") {
      if (!normalized.message.content.trim() && streamState?.emptyAssistantFallback && !streamState.hasAssistantText) {
        normalized = {
          ...normalized,
          message: {
            ...normalized.message,
            content: streamState.emptyAssistantFallback
          }
        };
      }
      if (normalized.message.content.trim() && streamState && !streamState.hasAssistantText) {
        writeSyntheticMessageDeltas(controller, encoder, normalized);
      }
      if (normalized.message.content.trim() && streamState) {
        streamState.hasAssistantText = true;
      }
    }
    if (normalized.type === "done") {
      writeEmptyAssistantFallback(controller, encoder, streamState);
    }
    writeUiSse(controller, encoder, normalized);
    const runUsageMetadata = normalizeRunEventUsageMetadata(normalized);
    if (runUsageMetadata) {
      writeUiSse(controller, encoder, runUsageMetadata);
    }
    return normalized.type === "done";
  }
  return false;
}

const SYNTHETIC_STREAM_BLOCK_MAX_CHARS = 560;

function writeSyntheticMessageDeltas(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  doneEvent: Extract<HermesChatStreamEvent, { type: "message_done" }>
) {
  const blocks = splitAssistantTextIntoStreamBlocks(doneEvent.message.content);
  for (const delta of blocks) {
    writeUiSse(controller, encoder, {
      type: "message_delta",
      delta,
      messageId: doneEvent.messageId,
      runId: doneEvent.runId
    });
  }
}

function splitAssistantTextIntoStreamBlocks(content: string) {
  const text = content.replace(/\r\n/g, "\n");
  if (!text) {
    return [];
  }

  const paragraphParts = text.split(/(\n{2,})/);
  const units: string[] = [];
  for (let index = 0; index < paragraphParts.length; index += 2) {
    const paragraph = paragraphParts[index] ?? "";
    const separator = paragraphParts[index + 1] ?? "";
    const unit = `${paragraph}${separator}`;
    if (unit) {
      units.push(...splitLongStreamUnit(unit));
    }
  }

  const blocks: string[] = [];
  let block = "";
  for (const unit of units) {
    if (block && block.length + unit.length > SYNTHETIC_STREAM_BLOCK_MAX_CHARS) {
      blocks.push(block);
      block = "";
    }
    if (unit.length > SYNTHETIC_STREAM_BLOCK_MAX_CHARS) {
      blocks.push(...splitLongStreamUnit(unit));
      continue;
    }
    block += unit;
  }
  if (block) {
    blocks.push(block);
  }
  return blocks;
}

function splitLongStreamUnit(value: string) {
  if (value.length <= SYNTHETIC_STREAM_BLOCK_MAX_CHARS) {
    return [value];
  }

  const blocks: string[] = [];
  let cursor = 0;
  while (cursor < value.length) {
    const maxEnd = Math.min(value.length, cursor + SYNTHETIC_STREAM_BLOCK_MAX_CHARS);
    const slice = value.slice(cursor, maxEnd);
    const newlineIndex = slice.lastIndexOf("\n");
    const spaceIndex = slice.lastIndexOf(" ");
    const softBreakIndex = Math.max(newlineIndex, spaceIndex);
    const end = softBreakIndex > 80 && maxEnd < value.length ? cursor + softBreakIndex + 1 : maxEnd;
    blocks.push(value.slice(cursor, end));
    cursor = end;
  }
  return blocks;
}

function normalizeRunEventUsageMetadata(event: HermesChatStreamEvent): HermesChatStreamEvent | null {
  if (event.type !== "run_event") {
    return null;
  }
  const usage = normalizeTokenUsage({
    ...event.payload,
    source: "hermes_usage"
  });
  return usage
    ? {
        type: "metadata",
        messageId: asString(event.payload.message_id),
        runId: asString(event.payload.run_id),
        usage
      }
    : null;
}

function writeEmptyAssistantFallback(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  streamState?: {
    emptyAssistantFallback?: string;
    hasAssistantText: boolean;
  }
) {
  if (!streamState?.emptyAssistantFallback || streamState.hasAssistantText) {
    return;
  }
  streamState.hasAssistantText = true;
  writeUiSse(controller, encoder, {
    type: "message_done",
    message: {
      role: "assistant",
      content: streamState.emptyAssistantFallback
    }
  });
}

function parseSseFrame(frame: string): { eventName: string; payload: Record<string, unknown> | null } | null {
  let eventName = "message";
  const dataLines: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) {
      continue;
    }
    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  const rawData = dataLines.join("\n");
  if (rawData === "[DONE]") {
    return { eventName: "done", payload: null };
  }

  try {
    const parsed = JSON.parse(rawData) as unknown;
    return {
      eventName,
      payload:
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Record<string, unknown>)
          : null
    };
  } catch {
    return {
      eventName,
      payload: { message: rawData }
    };
  }
}

function writeUiSse(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: HermesChatStreamEvent
) {
  controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`));
}

async function fetchEndpoint(args: {
  apiKey?: string | null;
  auth: boolean;
  base: URL;
  fetchImpl: typeof fetch;
  name: HermesEndpointName;
  path: string;
  timeoutMs: number;
}): Promise<HermesEndpointResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const headers = new Headers({ Accept: "application/json" });
  if (args.auth) {
    applyHermesAuth(headers, args.apiKey);
  }

  try {
    const response = await args.fetchImpl(buildEndpointUrl(args.base, args.path), {
      cache: "no-store",
      headers,
      signal: controller.signal
    });
    const data = await readJsonObject(response);

    if (!response.ok) {
      return {
        name: args.name,
        ok: false,
        status: response.status,
        data,
        error: {
          kind: "http_error",
          message: `${args.path} returned HTTP ${response.status}.`
        }
      };
    }

    return {
      name: args.name,
      ok: true,
      status: response.status,
      data,
      error: null
    };
  } catch (error) {
    return {
      name: args.name,
      ok: false,
      status: null,
      data: null,
      error: normalizeFetchError(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonObject(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const data = (await response.json()) as unknown;
    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function getData(results: HermesEndpointResult[], name: HermesEndpointName) {
  return results.find((result) => result.name === name && result.ok)?.data ?? null;
}

function firstError(results: HermesEndpointResult[]): HermesStatusError | null {
  return results.find((result) => result.error)?.error ?? null;
}

function normalizeFetchError(error: unknown): HermesStatusError {
  if (isAbortError(error)) {
    return {
      kind: "timeout",
      message: "Timed out while checking Hermes status."
    };
  }

  return {
    kind: "network",
    message: "Could not reach Hermes at the configured base URL."
  };
}

function mapChatErrorToStatusError(error: HermesChatError): HermesStatusError {
  if (
    error.kind === "disabled" ||
    error.kind === "unconfigured" ||
    error.kind === "invalid_config" ||
    error.kind === "timeout" ||
    error.kind === "network" ||
    error.kind === "http_error" ||
    error.kind === "bad_response"
  ) {
    return {
      kind: error.kind,
      message: error.message
    };
  }

  return {
    kind: "unknown",
    message: error.message
  };
}

function normalizeChatFetchError(error: unknown): HermesChatError {
  if (isAbortError(error)) {
    return {
      kind: "timeout",
      message: "Hermes chat stream did not open before the request timeout or was cancelled before streaming began."
    };
  }

  return {
    kind: "network",
    message: "Could not reach Hermes at the configured base URL."
  };
}

type LinkedAbortController = {
  signal: AbortSignal;
  clearTimeout: () => void;
  cleanup: () => void;
};

function createLinkedAbortController(
  externalSignal: AbortSignal | undefined,
  timeoutMs: number
): LinkedAbortController {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  let timeout: ReturnType<typeof setTimeout> | null = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal?.aborted) {
    controller.abort();
  } else {
    externalSignal?.addEventListener("abort", onAbort, { once: true });
  }

  const clearLinkedTimeout = () => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return {
    signal: controller.signal,
    clearTimeout: clearLinkedTimeout,
    cleanup: () => {
      clearLinkedTimeout();
      externalSignal?.removeEventListener("abort", onAbort);
    }
  };
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeHermesErrorMessage(response: Response, path: string): Promise<string> {
  try {
    const data = (await response.json()) as unknown;
    if (data && typeof data === "object") {
      const error = (data as { error?: unknown }).error;
      if (error && typeof error === "object") {
        const message = (error as { message?: unknown }).message;
        if (typeof message === "string" && message.trim()) {
          return `${path} returned HTTP ${response.status}: ${message}`;
        }
      }
    }
  } catch {
    // Ignore body parsing errors and fall back to a safe generic message.
  }
  return `${path} returned HTTP ${response.status}.`;
}

async function safeHermesErrorMessageFromData(
  status: number,
  data: Record<string, unknown> | null,
  path: string
): Promise<string> {
  const error = data?.error;
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return `${path} returned HTTP ${status}: ${message}`;
    }
  }
  return `${path} returned HTTP ${status}.`;
}

function chatFailure(
  status: number,
  kind: HermesChatError["kind"],
  message: string
): HermesChatStreamResult {
  return {
    ok: false,
    status,
    error: {
      kind,
      message
    }
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function truncatePreview(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > PROBE_PREVIEW_LIMIT ? `${clean.slice(0, PROBE_PREVIEW_LIMIT)}...` : clean;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/[\s.-]+/g, "_");
}
