import { getOpenRouterModelCatalog } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getOpenRouterModelCatalog({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_API_BASE_URL,
    timeoutMs: 8_000
  });

  return NextResponse.json(result, {
    headers: {
      // Keep the catalog fresh so newly launched OpenRouter models (e.g. new
      // DeepSeek/Kimi SKUs) surface quickly, while still allowing a brief
      // stale-while-revalidate window to absorb bursts.
      "Cache-Control": result.ok ? "public, max-age=60, stale-while-revalidate=300" : "no-store"
    },
    status: result.ok ? 200 : 502
  });
}
