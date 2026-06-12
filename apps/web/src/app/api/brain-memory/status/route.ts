import { getBrainMemoryStatus } from "@hermes-ui/brain-memory-client";
import { NextResponse } from "next/server";
import { resolveBrainMemoryGatewayConfig } from "@/lib/server/brainMemoryGatewayConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await getBrainMemoryStatus(resolveBrainMemoryGatewayConfig({ timeoutMs: 3_500 }));

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
