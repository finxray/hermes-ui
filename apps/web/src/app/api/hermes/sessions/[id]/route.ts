import { deleteHermesSession, getHermesSession } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";
import { isTrustedMutationRequest } from "@/lib/server/requestTrust";
import { resolveHermesClientConfig } from "@/server/hermesClientConfig";
import { getLocalDataStore } from "@/server/localDataStore";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, session: null, sessionId: "", error: { kind: "invalid_config", message: "Session id is required." } }, { status: 400 });
  }

  const config = await resolveHermesClientConfig({ signal: _request.signal, timeoutMs: 8000 });
  const result = await getHermesSession(
    config,
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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: { kind: "forbidden", message: "Cross-origin requests are not allowed." } }, { status: 403 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: { kind: "invalid_config", message: "Session id is required." } }, { status: 400 });
  }

  const config = await resolveHermesClientConfig({ timeoutMs: 8000 });
  const result = await deleteHermesSession(
    config,
    id
  );

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  await getLocalDataStore().deleteSessionMessageLinks(id);

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" }
  });
}
