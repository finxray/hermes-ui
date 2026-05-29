import type {
  HermesChatError,
  HermesChatContext,
  HermesChatRequest,
  HermesChatStreamEvent,
  HermesChatStreamResult,
  HermesClientConfig,
  HermesEndpointName,
  HermesEndpointResult,
  HermesStatusError,
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
  HermesChatError,
  HermesChatContext,
  HermesChatHistoryMessage,
  HermesChatRequest,
  HermesChatStreamEvent,
  HermesChatStreamResult,
  HermesClientConfig,
  HermesEndpointName,
  HermesEndpointResult,
  HermesStatusError,
  NormalizedHermesStatus
} from "./types";

export async function getHermesStatus(
  config: HermesClientConfig
): Promise<NormalizedHermesStatus> {
  const checkedAt = new Date().toISOString();

  if (config.enabled === false) {
    return {
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
    };
  }

  if (!config.baseUrl?.trim()) {
    return {
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
    };
  }

  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return {
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
    };
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
    return {
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
    };
  }

  return {
    mode: "real",
    configured: true,
    reachable: true,
    baseUrl: safeDisplayUrl(base),
    capabilities,
    health,
    models,
    error: null,
    checkedAt
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
    sessionId: hermesSessionId,
    sessionTitle: request.context.session.title,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });

  if (!sessionResult.ok) {
    return sessionResult;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
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
        metadata: {
          context: request.context,
          project_id: request.context.project.id,
          project_title: request.context.project.title,
          provider: request.provider ?? null,
          studio_session_id: request.context.session.id
        }
      }),
      cache: "no-store",
      headers,
      method: "POST",
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeout);
    return {
      ok: false,
      status: error instanceof Error && error.name === "AbortError" ? 504 : 502,
      error: normalizeChatFetchError(error)
    };
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const message = await safeHermesErrorMessage(response, "/api/sessions/{session_id}/chat/stream");
    return chatFailure(response.status, "http_error", message);
  }

  if (!response.body) {
    return chatFailure(502, "bad_response", "Hermes did not return a streaming response body.");
  }

  return {
    ok: true,
    hermesSessionId,
    stream: normalizeHermesSseStream(response.body)
  };
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
  timeoutMs: number;
}): Promise<boolean | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const headers = new Headers({ Accept: "application/json" });
  applyHermesAuth(headers, args.apiKey);

  try {
    const response = await args.fetchImpl(buildEndpointUrl(args.base, "/v1/capabilities"), {
      cache: "no-store",
      headers,
      signal: controller.signal
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
    clearTimeout(timeout);
  }
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
  sessionId: string;
  sessionTitle: string;
  timeoutMs: number;
}): Promise<HermesChatStreamResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
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
        title: args.sessionTitle
      }),
      cache: "no-store",
      headers,
      method: "POST",
      signal: controller.signal
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
      status: error instanceof Error && error.name === "AbortError" ? 504 : 502,
      error: normalizeChatFetchError(error)
    };
  } finally {
    clearTimeout(timeout);
  }
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

function normalizeHermesSseStream(upstream: ReadableStream<Uint8Array>) {
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
      } catch {
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
      } finally {
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
  if (error instanceof Error && error.name === "AbortError") {
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
  if (error instanceof Error && error.name === "AbortError") {
    return {
      kind: "timeout",
      message: "Timed out while contacting Hermes chat."
    };
  }

  return {
    kind: "network",
    message: "Could not reach Hermes at the configured base URL."
  };
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
