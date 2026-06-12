import {
  searchBrainMemory,
  type BrainMemoryError,
  type BrainMemorySearchRequest
} from "@hermes-ui/brain-memory-client";
import { NextResponse } from "next/server";
import { resolveBrainMemoryGatewayConfig } from "@/lib/server/brainMemoryGatewayConfig";
import { cleanText, readBrainMemoryContext } from "@/lib/server/brainMemoryRequestParsing";

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

  const response = await searchBrainMemory(resolveBrainMemoryGatewayConfig(), parsed.request);

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
  const context = readBrainMemoryContext(input.context);
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
