import {
  streamHermesSessionChat,
  type HermesChatError,
  type HermesChatHistoryMessage,
  type HermesChatRequest
} from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 64_000;
const MAX_MESSAGE_CHARS = 8_000;
const MAX_HISTORY_ITEMS = 12;

export async function POST(request: Request) {
  const parsed = await readChatRequest(request);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await streamHermesSessionChat(
    {
      apiKey: process.env.HERMES_API_KEY,
      baseUrl: process.env.HERMES_API_BASE_URL,
      enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false",
      timeoutMs: 10_000
    },
    parsed.request
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return new Response(result.stream, {
    headers: {
      "Cache-Control": "no-store, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Hermes-Session-Id": result.hermesSessionId
    }
  });
}

type ParseResult =
  | { ok: true; request: HermesChatRequest }
  | { ok: false; error: HermesChatError };

async function readChatRequest(request: Request): Promise<ParseResult> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return badRequest("bad_response", "Chat request is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return badRequest("bad_response", "Chat request body must be valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("bad_response", "Chat request body must be an object.");
  }

  const input = body as Record<string, unknown>;
  const message = cleanText(input.message, MAX_MESSAGE_CHARS);
  const projectId = cleanString(input.projectId, 256);
  const projectTitle = cleanString(input.projectTitle, 256);
  const sessionId = cleanString(input.sessionId, 256);
  const sessionTitle = cleanString(input.sessionTitle, 256);

  if (!message) {
    return badRequest("bad_response", "Message is required.");
  }
  if (!projectId || !projectTitle || !sessionId || !sessionTitle) {
    return badRequest("bad_response", "Project and session metadata is required.");
  }

  return {
    ok: true,
    request: {
      message,
      projectId,
      projectTitle,
      provider: cleanOptionalString(input.provider, 128),
      memoryScopeKey: cleanOptionalString(input.memoryScopeKey, 256),
      model: cleanOptionalString(input.model, 128),
      recentMessages: readRecentMessages(input.recentMessages),
      sessionId,
      sessionTitle
    }
  };
}

function badRequest(kind: "bad_response", message: string): ParseResult {
  return {
    ok: false,
    error: {
      kind,
      message
    }
  };
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/[\r\n\x00]/g, " ").trim().slice(0, maxLength)
    : "";
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\x00/g, "").trim().slice(0, maxLength) : "";
}

function cleanOptionalString(value: unknown, maxLength: number): string | null {
  return typeof value === "string"
    ? value.replace(/[\r\n\x00]/g, " ").trim().slice(0, maxLength) || null
    : null;
}

function readRecentMessages(value: unknown): HermesChatRequest["recentMessages"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }
      const role = (item as { role?: unknown }).role;
      const content = cleanText((item as { content?: unknown }).content, MAX_MESSAGE_CHARS);
      if ((role !== "user" && role !== "assistant") || !content) {
        return null;
      }
      return { role, content } satisfies HermesChatHistoryMessage;
    })
    .filter((item): item is HermesChatHistoryMessage => Boolean(item));
}
