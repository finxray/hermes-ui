import { selectHermesModel } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  const sessionId = body?.sessionId || body?.hermesSessionId;
  const modelId = body?.model;

  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json(
      { ok: false, error: { kind: "invalid_request", message: "sessionId is required." } },
      { status: 400 }
    );
  }

  if (!modelId || typeof modelId !== "string") {
    return NextResponse.json(
      { ok: false, error: { kind: "invalid_request", message: "model is required." } },
      { status: 400 }
    );
  }

  const result = await selectHermesModel(
    {
      apiKey: process.env.HERMES_API_KEY,
      baseUrl: process.env.HERMES_API_BASE_URL,
      enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false",
      signal: request.signal,
      timeoutMs: 10_000
    },
    sessionId,
    modelId
  );

  if (!result.ok) {
    const status = result.error?.kind === "network" || result.error?.kind === "timeout" ? 502 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" }
  });
}
