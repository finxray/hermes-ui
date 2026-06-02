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
  HermesModelDescriptor,
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
  HermesSessionListResult,
  HermesSessionMessage,
  HermesSessionMessagesResult,
  HermesSessionSummary,
  HermesStatusError,
  HermesUiCapabilities,
  NormalizedHermesStatus
} from "./types";

const DEFAULT_TIMEOUT_MS = 3500;

const ENDPOINTS: Array<{
  name: HermesEndpointName;
  path: string;
  auth: boolean;
}> = [
  { name: "capabilities", path: "/v1/capabilities", auth: true },
  { name: "health", path: "/health", auth: false },
  { name: "healthDetailed", path: "/health/detailed", auth: false },
  { name: "models", path: "/v1/models", auth: true }
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
  HermesModelDescriptor,
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
  HermesSessionListResult,
  HermesSessionMessage,
  HermesSessionMessagesResult,
  HermesSessionSummary,
  HermesStatusError,
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
  const results = await Promise.all(
    ENDPOINTS.map((endpoint) =>
      fetchEndpoint({
        apiKey: config.apiKey,
        auth: endpoint.auth,
        base,
        fetchImpl,
        name: endpoint.name,
        path: endpoint.path,
        timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
      })
    )
  );

  const capabilities = getData(results, "capabilities");
  const health = {
    basic: getData(results, "health"),
    detailed: getData(results, "healthDetailed")
  };
  const models = getData(results, "models");
  const reachable = results.some((result) => result.ok);

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

export function normalizeHermesUiCapabilities(
  status: Omit<NormalizedHermesStatus, "uiCapabilities">,
  options: { memoryScopeBridgeEnabled?: boolean } = {}
): HermesUiCapabilities {
  const features = objectRecord(status.capabilities?.features);
  const endpoints = objectRecord(status.capabilities?.endpoints);
  const serverAdvertisedModel =
    asString(status.capabilities?.model) ||
    firstModelId(status.models) ||
    null;
  const availableModels = modelDescriptors(status.models);
  const modelsListAvailable = Boolean(status.models) || hasEndpoint(endpoints, "models");
  const clientSelectable = modelsListAvailable && availableModels.length > 0 && status.mode === "real";
  const modelState = normalizeModelUiState({
    availableModels,
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
      availableModels,
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
      uiState: clientSelectable ? "available" : "deferred"
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
    model: request.model,
    signal: config.signal,
    sessionId: hermesSessionId,
    sessionTitle: request.context.session.title,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });

  if (!sessionResult.ok) {
    return sessionResult;
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
        metadata: {
          context: request.context,
          memory_scope_bridge_enabled: Boolean(request.instructions),
          project_id: request.context.project.id,
          project_title: request.context.project.title,
          provider: request.provider ?? null,
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
    stream: normalizeHermesSseStream(response.body, abort)
  };
}

export async function selectHermesModel(
  config: HermesClientConfig,
  sessionId: string,
  modelId: string
): Promise<HermesModelSelectResult> {
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
  const abort = createLinkedAbortController(config.signal, config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const headers = new Headers({ "Content-Type": "application/json" });
  applyHermesAuth(headers, config.apiKey);

  try {
    const response = await fetchImpl(
      buildEndpointUrl(base, `/api/sessions/${encodeURIComponent(sessionId)}/model`),
      {
        body: JSON.stringify({ model: modelId }),
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
    return {
      ok: true,
      sessionId: asString(record?.session_id) || sessionId,
      selectedModel: asString(record?.selected_model) || modelId,
      provider: asString(record?.provider) || null,
      scope: asString(record?.scope) || "session",
      error: null
    };
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

export function normalizeHermesSseEvent(
  eventName: string,
  payload: Record<string, unknown> | null
): HermesChatStreamEvent | null {
  const data = payload ?? {};
  const messageId = asString(data.message_id);
  const runId = asString(data.run_id);

  if (eventName === "assistant.delta") {
    const delta = asString(data.delta);
    return delta ? { type: "message_delta", delta, messageId, runId } : null;
  }

  if (eventName === "assistant.completed") {
    return {
      type: "message_done",
      message: {
        role: "assistant",
        content: asString(data.content)
      },
      messageId,
      runId
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

function withUiCapabilities(
  status: Omit<NormalizedHermesStatus, "uiCapabilities">,
  config: Pick<HermesClientConfig, "memoryScopeBridgeEnabled">
): NormalizedHermesStatus {
  return {
    ...status,
    uiCapabilities: normalizeHermesUiCapabilities(status, {
      memoryScopeBridgeEnabled: config.memoryScopeBridgeEnabled
    })
  };
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
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
    descriptors.push({
      id,
      label: id,
      provider: asString(record.owned_by) || null
    });
  }
  return descriptors;
}

function normalizeModelUiState(args: {
  availableModels: HermesModelDescriptor[];
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
  const currentModelLabel = selectedModelId ?? "Hermes server model";
  const currentProviderLabel = "Hermes server config";
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
    return "Hermes exposes model catalog data and the Web UI can request session-scoped model switching through the BFF.";
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
  abort: LinkedAbortController
) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      let buffer = "";
      let doneSent = false;

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
            doneSent = writeNormalizedFrame(controller, encoder, frame) || doneSent;
          }
        }

        if (buffer.trim()) {
          doneSent = writeNormalizedFrame(controller, encoder, buffer) || doneSent;
        }
        if (!doneSent) {
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
  frame: string
): boolean {
  const parsed = parseSseFrame(frame);
  if (!parsed) {
    return false;
  }
  const normalized = normalizeHermesSseEvent(parsed.eventName, parsed.payload);
  if (normalized) {
    writeUiSse(controller, encoder, normalized);
    return normalized.type === "done";
  }
  return false;
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

function normalizeChatFetchError(error: unknown): HermesChatError {
  if (isAbortError(error)) {
    return {
      kind: "timeout",
      message: "Hermes chat request was cancelled before a stream was opened."
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

function truncatePreview(value: string): string {
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length > PROBE_PREVIEW_LIMIT ? `${clean.slice(0, PROBE_PREVIEW_LIMIT)}...` : clean;
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/[\s.-]+/g, "_");
}
