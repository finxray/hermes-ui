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
  HermesRunProbeEvent,
  HermesRunsProbeResult,
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
  HermesModelSelectionStatus,
  HermesRunProbeEvent,
  HermesRunsProbeResult,
  HermesStatusError,
  HermesUiCapabilities,
  NormalizedHermesStatus
} from "./types";

const HERMES_RUNS_PROBE_EXPECTED_TEXT = "HERMES_RUNS_PROBE_OK";
const HERMES_RUNS_PROBE_PROMPT = `Reply exactly: ${HERMES_RUNS_PROBE_EXPECTED_TEXT}`;
const RUNS_PROBE_TIMEOUT_MS = 20_000;
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
  const modelState = normalizeModelUiState({
    availableModels,
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
      clientSelectable: false,
      currentModelLabel: modelState.currentModelLabel,
      currentProviderLabel: modelState.currentProviderLabel,
      fastStreamProfile: modelState.fastStreamProfile,
      listAvailable: modelsListAvailable,
      reason: modelState.reason,
      selectedModelId: modelState.selectedModelId,
      selectionStatus: modelState.selectionStatus,
      serverAdvertisedModel,
      serverConfiguredOnly: true,
      uiState: "deferred"
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

export async function runHermesRunsProbe(
  config: HermesClientConfig,
  options: {
    expectedText?: string;
    instructions?: string;
    memoryMutationRequested?: boolean;
    memoryScopeKey?: string | null;
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
    fetchImpl,
    instructions: options.instructions,
    memoryScopeKey: options.memoryScopeKey ?? "hermes-ui-runs-probe",
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
  fetchImpl: typeof fetch;
  instructions?: string;
  memoryScopeKey?: string | null;
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
        input: args.prompt,
        instructions: args.instructions ??
          "Do not use tools, memory, commands, files, web browsing, or external resources. Reply with the exact requested text only.",
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
  listAvailable: boolean;
  serverAdvertisedModel: string | null;
  statusMode: string;
}): HermesUiCapabilities["models"]["selectionStatus"] {
  if (args.statusMode === "unconfigured" || args.statusMode === "mock" || args.statusMode === "error") {
    return args.listAvailable ? "deferred" : "unavailable";
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
