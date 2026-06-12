import { fetchLifecycleMetrics } from "@hermes-ui/brain-memory-client";
import { NextResponse } from "next/server";
import { resolveBrainMemoryGatewayConfig } from "@/lib/server/brainMemoryGatewayConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const metrics = await fetchLifecycleMetrics(resolveBrainMemoryGatewayConfig());

  return NextResponse.json(metrics, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
