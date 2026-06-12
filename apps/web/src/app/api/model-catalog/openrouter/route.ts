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
      "Cache-Control": result.ok ? "public, max-age=300, stale-while-revalidate=900" : "no-store"
    },
    status: result.ok ? 200 : 502
  });
}
