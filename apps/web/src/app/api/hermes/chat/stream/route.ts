import {
  streamHermesSessionChat,
  type HermesChatContext,
  type HermesChatError,
  type HermesChatHistoryMessage,
  type HermesChatRequest
} from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";
import { buildMemoryScopeBridgeInstruction } from "@/lib/memoryScopeBridge";
import { buildHermesRuntimeIdentityInstruction } from "@/lib/hermesRuntimeIdentity";

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
      signal: request.signal,
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
  const context = readContext(input.context);
  const model = cleanOptionalString(input.model, 128);
  const modelRuntime = readModelRuntime(input.modelRuntime);
  const modelSelectionScope = readModelSelectionScope(input.modelSelectionScope);
  const provider = cleanOptionalString(input.provider, 128);

  if (!message) {
    return badRequest("bad_response", "Message is required.");
  }
  if (!context) {
    return badRequest("bad_response", "Structured project and session context is required.");
  }

  return {
    ok: true,
    request: {
      context,
      instructions: joinInstructions(
        buildHermesRuntimeIdentityInstruction({ model, modelRuntime, provider }),
        isMemoryScopeBridgeEnabled() ? buildMemoryScopeBridgeInstruction(context) : null
      ),
      message,
      provider,
      modelRuntime,
      modelSelectionScope,
      model,
      recentMessages: readRecentMessages(input.recentMessages)
    }
  };
}

function isMemoryScopeBridgeEnabled(): boolean {
  return process.env.HERMES_UI_ENABLE_MEMORY_SCOPE_BRIDGE !== "false";
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

function readModelSelectionScope(value: unknown): HermesChatRequest["modelSelectionScope"] {
  return value === "session" || value === "turn" ? value : null;
}

function readModelRuntime(value: unknown): HermesChatRequest["modelRuntime"] {
  const runtime = readObject(value);
  if (!runtime) {
    return null;
  }
  const runtimeConfig = readObject(runtime.runtimeConfig);
  return {
    architecture: cleanOptionalString(runtime.architecture, 80),
    format: cleanOptionalString(runtime.format, 40),
    loadedContextLength: cleanOptionalNumber(runtime.loadedContextLength),
    maxContextLength: cleanOptionalNumber(runtime.maxContextLength),
    params: cleanOptionalString(runtime.params, 40),
    quantization: cleanOptionalString(runtime.quantization, 40),
    quantizationBits: cleanOptionalNumber(runtime.quantizationBits),
    runtimeConfig: runtimeConfig
      ? {
          contextLength: cleanOptionalNumber(runtimeConfig.contextLength),
          evalBatchSize: cleanOptionalNumber(runtimeConfig.evalBatchSize),
          flashAttention: cleanOptionalBoolean(runtimeConfig.flashAttention),
          kCacheQuantizationType: cleanOptionalString(runtimeConfig.kCacheQuantizationType, 40),
          numExperts: cleanOptionalNumber(runtimeConfig.numExperts),
          offloadKvCacheToGpu: cleanOptionalBoolean(runtimeConfig.offloadKvCacheToGpu),
          parallel: cleanOptionalNumber(runtimeConfig.parallel),
          vCacheQuantizationType: cleanOptionalString(runtimeConfig.vCacheQuantizationType, 40)
        }
      : null,
    selectedVariant: cleanOptionalString(runtime.selectedVariant, 160),
    sizeBytes: cleanOptionalNumber(runtime.sizeBytes),
    state: cleanOptionalString(runtime.state, 40)
  };
}

function cleanOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function cleanOptionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function joinInstructions(...parts: Array<string | null>): string | null {
  const clean = parts.filter((part): part is string => Boolean(part?.trim()));
  return clean.length > 0 ? clean.join("\n\n") : null;
}

function readContext(value: unknown): HermesChatContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const context = value as Record<string, unknown>;
  const project = readObject(context.project);
  const session = readObject(context.session);
  const ui = readObject(context.ui);
  if (!project || !session || !ui) {
    return null;
  }

  const projectId = cleanString(project.id, 256);
  const projectTitle = cleanString(project.title, 256);
  const projectStableKey = cleanString(project.stableKey, 256);
  const tenantId = cleanString(project.tenantId, 256);
  const sessionId = cleanString(session.id, 256);
  const sessionTitle = cleanString(session.title, 256);
  const sessionStableKey = cleanString(session.stableKey, 256);
  const hermesSessionId = cleanString(session.hermesSessionId, 256);
  const workspaceVersion = Number(ui.workspaceVersion);

  if (
    !projectId ||
    !projectTitle ||
    !projectStableKey ||
    !tenantId ||
    !sessionId ||
    !sessionTitle ||
    !sessionStableKey ||
    !hermesSessionId ||
    !Number.isInteger(workspaceVersion)
  ) {
    return null;
  }

  return {
    project: {
      id: projectId,
      title: projectTitle,
      stableKey: projectStableKey,
      tenantId,
      retrievalProfile: cleanString(project.retrievalProfile, 64) || "balanced",
      contextPolicy: cleanString(project.contextPolicy, 64) || "balanced",
      pinnedMemoryIds: readStringArray(project.pinnedMemoryIds, 24, 256),
      userVisibleSummary: cleanOptionalString(project.userVisibleSummary, 512) ?? undefined
    },
    session: {
      id: sessionId,
      title: sessionTitle,
      stableKey: sessionStableKey,
      hermesSessionId,
      includeProjectContext: session.includeProjectContext !== false,
      includeSessionContext: session.includeSessionContext !== false,
      lastContextRefreshAt: cleanOptionalString(session.lastContextRefreshAt, 64) ?? undefined,
      userVisibleSummary: cleanOptionalString(session.userVisibleSummary, 512) ?? undefined
    },
    ui: {
      source: "hermes-ui",
      workspaceVersion
    }
  };
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
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
