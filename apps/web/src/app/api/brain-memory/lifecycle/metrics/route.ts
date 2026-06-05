import { fetchLifecycleMetrics } from "@hermes-ui/brain-memory-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const metrics = await fetchLifecycleMetrics({
      baseUrl: process.env.BRAIN_MEMORY_GATEWAY_URL,
      enabled: process.env.BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY === "true",
      gatewayMemoryApiKey: process.env.BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY,
      legacyApiKey: process.env.BRAIN_MEMORY_API_KEY,
      timeoutMs: 7_500,
      uiApiKey: process.env.BRAIN_MEMORY_UI_API_KEY
    });

    return NextResponse.json(metrics, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not fetch lifecycle metrics."
      },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 502
      }
    );
  }
}
