import { getLmStudioModelCatalog } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getLmStudioModelCatalog({
    apiKey: process.env.LM_STUDIO_API_KEY ?? process.env.LMSTUDIO_API_KEY,
    baseUrl: process.env.LM_STUDIO_API_BASE_URL ?? process.env.LMSTUDIO_API_BASE_URL,
    timeoutMs: 4_000
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store"
    },
    status: result.ok ? 200 : 502
  });
}
