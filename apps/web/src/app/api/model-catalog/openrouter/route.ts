import { getOpenRouterModelCatalog } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getOpenRouterModelCatalog({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseUrl: process.env.OPENROUTER_API_BASE_URL,
    sort: "most-popular",
    supportedParameters: ["tools"],
    timeoutMs: 8_000
  });

  return NextResponse.json(result, {
    headers: {
      // Rankings are weekly and can move during a long-running Stoix session.
      // Keep them fresh without turning model-menu opens into upstream bursts.
      "Cache-Control": result.ok ? "public, max-age=60, stale-while-revalidate=300" : "no-store"
    },
    status: result.ok ? 200 : 502
  });
}
