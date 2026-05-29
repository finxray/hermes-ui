import {
  searchBrainMemory,
  type BrainMemoryError,
  type BrainMemorySearchContext,
  type BrainMemorySearchRequest
} from "@hermes-ui/brain-memory-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_000;
const MAX_QUERY_CHARS = 512;

export async function POST(request: Request) {
  const parsed = await readSearchRequest(request);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        mode: "error",
        query: "",
        results: [],
        error: parsed.error,
        searchedAt: new Date().toISOString()
      },
      { status: 400 }
    );
  }

  const response = await searchBrainMemory(
    {
      baseUrl: process.env.BRAIN_MEMORY_GATEWAY_URL,
      enabled: process.env.BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY === "true",
      gatewayMemoryApiKey: process.env.BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY,
      legacyApiKey: process.env.BRAIN_MEMORY_API_KEY,
      timeoutMs: 7_500,
      uiApiKey: process.env.BRAIN_MEMORY_UI_API_KEY
    },
    parsed.request
  );

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

type ParseResult =
  | { ok: true; request: BrainMemorySearchRequest }
  | { ok: false; error: BrainMemoryError };

async function readSearchRequest(request: Request): Promise<ParseResult> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return badRequest("Search request is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return badRequest("Search request body must be valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("Search request body must be an object.");
  }

  const input = body as Record<string, unknown>;
  const query = cleanText(input.query, MAX_QUERY_CHARS);
  const context = readContext(input.context);
  const limit = Number(input.limit);

  if (!query) {
    return badRequest("Search query is required.");
  }
  if (!context) {
    return badRequest("Structured project/session context is required.");
  }

  return {
    ok: true,
    request: {
      context,
      limit: Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 20) : 8,
      query
    }
  };
}

function badRequest(message: string): ParseResult {
  return {
    ok: false,
    error: {
      kind: "bad_response",
      message
    }
  };
}

function readContext(value: unknown): BrainMemorySearchContext | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const context = value as Record<string, unknown>;
  const project = readObject(context.project);
  const ui = readObject(context.ui);
  const session = context.session === null ? null : readObject(context.session);

  if (!project || !ui) {
    return null;
  }

  const projectId = cleanString(project.id, 256);
  const title = cleanString(project.title, 256);
  const stableKey = cleanString(project.stableKey, 256);
  const tenantId = cleanString(project.tenantId, 256);
  const workspaceVersion = Number(ui.workspaceVersion);

  if (!projectId || !title || !stableKey || !tenantId || !Number.isInteger(workspaceVersion)) {
    return null;
  }

  return {
    project: {
      id: projectId,
      title,
      stableKey,
      tenantId,
      retrievalProfile: cleanString(project.retrievalProfile, 64) || "balanced",
      contextPolicy: cleanString(project.contextPolicy, 64) || "balanced"
    },
    session: session ? readSessionContext(session) : null,
    ui: {
      source: "hermes-ui",
      workspaceVersion
    }
  };
}

function readSessionContext(session: Record<string, unknown>) {
  const id = cleanString(session.id, 256);
  const title = cleanString(session.title, 256);
  const stableKey = cleanString(session.stableKey, 256);

  if (!id || !title || !stableKey) {
    return null;
  }

  return {
    id,
    title,
    stableKey,
    includeProjectContext: session.includeProjectContext !== false,
    includeSessionContext: session.includeSessionContext !== false
  };
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string"
    ? value.replace(/[\r\n\x00]/g, " ").trim().slice(0, maxLength)
    : "";
}

function cleanText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/\x00/g, "").trim().slice(0, maxLength) : "";
}
