import { getHermesStatus } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getHermesStatus({
    apiKey: process.env.HERMES_API_KEY,
    baseUrl: process.env.HERMES_API_BASE_URL,
    configuredDefaultModelId: process.env.HERMES_UI_DEFAULT_MODEL_ID,
    enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false",
    memoryScopeBridgeEnabled: process.env.HERMES_UI_ENABLE_MEMORY_SCOPE_BRIDGE !== "false"
  });

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
