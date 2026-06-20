import { NextResponse } from "next/server";
import { getCoalescedHermesStatus } from "@/lib/server/hermesStatusProbe";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = await getCoalescedHermesStatus(
    {
      apiKey: process.env.HERMES_API_KEY,
      baseUrl: process.env.HERMES_API_BASE_URL,
      configuredDefaultModelId: process.env.HERMES_UI_DEFAULT_MODEL_ID,
      enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false",
      memoryScopeBridgeEnabled: process.env.HERMES_UI_ENABLE_MEMORY_SCOPE_BRIDGE !== "false"
    },
    {
      forceModels: url.searchParams.get("refreshModels") === "true"
    }
  );

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
