import type {
  HermesChatError,
  HermesChatRequest,
  HermesChatStreamEvent
} from "@hermes-ui/hermes-client";

type StreamHermesChatHandlers = {
  onEvent: (event: HermesChatStreamEvent) => void;
  signal?: AbortSignal;
};

type StreamHermesChatResult = "completed" | "aborted";

const MAX_STREAM_EVENTS_PER_FRAME = 3;
const MAX_STREAM_DISPATCH_BUDGET_MS = 6;

export async function streamHermesChatFromBff(
  request: HermesChatRequest,
  handlers: StreamHermesChatHandlers
): Promise<StreamHermesChatResult> {
  let response: Response;
  try {
    response = await fetch("/api/hermes/chat/stream", {
      body: JSON.stringify(request),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      signal: handlers.signal
    });
  } catch (error) {
    if (handlers.signal?.aborted || isAbortError(error)) {
      return "aborted";
    }
    throw error;
  }

  if (!response.ok) {
    const error = await readError(response);
    handlers.onEvent({
      type: "error",
      error
    });
    handlers.onEvent({ type: "done" });
    return "completed";
  }

  if (!response.body) {
    handlers.onEvent({
      type: "error",
      error: {
        kind: "bad_response",
        message: "Hermes chat route did not return a stream."
      }
    });
    handlers.onEvent({ type: "done" });
    return "completed";
  }

  return readUiEventStream(response.body, handlers.onEvent, handlers.signal);
}

async function readUiEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: HermesChatStreamEvent) => void,
  signal?: AbortSignal
): Promise<StreamHermesChatResult> {
  const reader = body.getReader();
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
      const events: HermesChatStreamEvent[] = [];
      for (const frame of frames) {
        const event = parseUiSseFrame(frame);
        if (event) {
          events.push(event);
        }
      }
      await dispatchUiStreamEvents(events, onEvent, signal);
    }

    if (buffer.trim()) {
      const event = parseUiSseFrame(buffer);
      if (event) {
        await dispatchUiStreamEvents([event], onEvent, signal);
      }
    }
    return "completed";
  } catch {
    if (signal?.aborted) {
      return "aborted";
    }
    onEvent({
      type: "error",
      error: {
        kind: "network",
        message: "The local Hermes chat stream ended unexpectedly."
      }
    });
    return "completed";
  } finally {
    reader.releaseLock();
  }
}

async function dispatchUiStreamEvents(
  events: HermesChatStreamEvent[],
  onEvent: (event: HermesChatStreamEvent) => void,
  signal?: AbortSignal
) {
  if (events.length === 0) {
    return;
  }

  let eventsSincePaint = 0;
  let textSincePaint = false;
  let batchStartedAt = nowMs();

  for (const event of events) {
    if (signal?.aborted) {
      return;
    }

    if (event.type === "message_done" && textSincePaint) {
      await waitForNextPaint();
      if (signal?.aborted) {
        return;
      }
      eventsSincePaint = 0;
      textSincePaint = false;
      batchStartedAt = nowMs();
    }

    onEvent(event);
    eventsSincePaint += 1;

    if (event.type === "message_delta") {
      textSincePaint = true;
    }

    const usedBudget = nowMs() - batchStartedAt >= MAX_STREAM_DISPATCH_BUDGET_MS;
    const usedFrameQuota = eventsSincePaint >= MAX_STREAM_EVENTS_PER_FRAME;
    if (textSincePaint && (usedBudget || usedFrameQuota)) {
      await waitForNextPaint();
      eventsSincePaint = 0;
      textSincePaint = false;
      batchStartedAt = nowMs();
    }
  }
}

function waitForNextPaint() {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    return new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function nowMs() {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function parseUiSseFrame(frame: string): HermesChatStreamEvent | null {
  const dataLines: string[] = [];

  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(dataLines.join("\n")) as unknown;
    return isHermesChatStreamEvent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function readError(response: Response): Promise<HermesChatError> {
  try {
    const payload = (await response.json()) as unknown;
    if (payload && typeof payload === "object") {
      const error = (payload as { error?: unknown }).error;
      if (error && typeof error === "object") {
        const kind = (error as { kind?: unknown }).kind;
        const message = (error as { message?: unknown }).message;
        return {
          kind: isHermesChatErrorKind(kind) ? kind : "unknown",
          message: typeof message === "string" ? message : "Hermes chat request failed."
        };
      }
    }
  } catch {
    // Fall through to a safe generic message.
  }

  return {
    kind: "http_error",
    message: `Hermes chat route returned HTTP ${response.status}.`
  };
}

function isHermesChatStreamEvent(value: unknown): value is HermesChatStreamEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return (
    type === "message_delta" ||
    type === "message_done" ||
    type === "metadata" ||
    type === "tool_event" ||
    type === "run_event" ||
    type === "approval_event" ||
    type === "error" ||
    type === "done"
  );
}

function isHermesChatErrorKind(value: unknown): value is HermesChatError["kind"] {
  return (
    value === "disabled" ||
    value === "unconfigured" ||
    value === "invalid_config" ||
    value === "network" ||
    value === "timeout" ||
    value === "http_error" ||
    value === "bad_response" ||
    value === "unknown"
  );
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}
