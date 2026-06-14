import { deleteHermesSession, getHermesSession } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, session: null, sessionId: "", error: { kind: "invalid_config", message: "Session id is required." } }, { status: 400 });
  }

  const result = await getHermesSession(
    {
      apiKey: process.env.HERMES_API_KEY,
      baseUrl: process.env.HERMES_API_BASE_URL,
      enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false",
      signal: _request.signal,
      timeoutMs: 8000
    },
    id
  );

  if (!result.ok) {
    if (isHermesSessionNotFound(result)) {
      return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" }
      });
    }

    const status =
      result.error.kind === "network" || result.error.kind === "timeout"
        ? 502
        : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" }
  });
}

function isHermesSessionNotFound(result: Awaited<ReturnType<typeof getHermesSession>>) {
  return !result.ok && result.error.kind === "http_error" && result.error.message.includes("HTTP 404");
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: { kind: "invalid_config", message: "Session id is required." } }, { status: 400 });
  }

  const result = await deleteHermesSession(
    {
      apiKey: process.env.HERMES_API_KEY,
      baseUrl: process.env.HERMES_API_BASE_URL,
      enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false",
      timeoutMs: 8000
    },
    id
  );

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" }
  });
}
