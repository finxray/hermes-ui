import {
  inspectBrainMemory,
  type BrainMemoryError,
  type BrainMemoryInspectRequest
} from "@hermes-ui/brain-memory-client";
import { NextResponse } from "next/server";
import { resolveBrainMemoryGatewayConfig } from "@/lib/server/brainMemoryGatewayConfig";
import { cleanText, readBrainMemoryContext } from "@/lib/server/brainMemoryRequestParsing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 32_000;
const MAX_MEMORY_ID_CHARS = 256;

export async function POST(request: Request) {
  const parsed = await readInspectRequest(request);
  if (!parsed.ok) {
    return NextResponse.json(
      {
        mode: "error",
        memoryId: "",
        detail: null,
        evidence: null,
        supersession: null,
        error: parsed.error,
        checkedAt: new Date().toISOString()
      },
      { status: 400 }
    );
  }

  const response = await inspectBrainMemory(resolveBrainMemoryGatewayConfig(), parsed.request);

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

type ParseResult =
  | { ok: true; request: BrainMemoryInspectRequest }
  | { ok: false; error: BrainMemoryError };

async function readInspectRequest(request: Request): Promise<ParseResult> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return badRequest("Memory inspect request is too large.");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw) as unknown;
  } catch {
    return badRequest("Memory inspect request body must be valid JSON.");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return badRequest("Memory inspect request body must be an object.");
  }

  const input = body as Record<string, unknown>;
  const memoryId = cleanText(input.memoryId, MAX_MEMORY_ID_CHARS);
  const context = readBrainMemoryContext(input.context);

  if (!memoryId) {
    return badRequest("Memory id is required.");
  }
  if (!context) {
    return badRequest("Structured project/session context is required.");
  }

  return {
    ok: true,
    request: {
      context,
      memoryId
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
