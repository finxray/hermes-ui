import { runHermesRunsStopProbe } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const result = await runHermesRunsStopProbe({
    apiKey: process.env.HERMES_API_KEY,
    baseUrl: process.env.HERMES_API_BASE_URL,
    enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false",
    timeoutMs: 45_000
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
