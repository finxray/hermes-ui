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
      for (const frame of frames) {
        const event = parseUiSseFrame(frame);
        if (event) {
          onEvent(event);
        }
      }
    }

    if (buffer.trim()) {
      const event = parseUiSseFrame(buffer);
      if (event) {
        onEvent(event);
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
