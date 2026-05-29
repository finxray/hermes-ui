import { getBrainMemoryStatus } from "@hermes-ui/brain-memory-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const status = await getBrainMemoryStatus({
    apiKey: process.env.BRAIN_MEMORY_API_KEY,
    baseUrl: process.env.BRAIN_MEMORY_GATEWAY_URL,
    enabled: process.env.BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY === "true"
  });

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
