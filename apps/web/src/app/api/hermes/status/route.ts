import { getHermesStatus } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getHermesStatus({
    apiKey: process.env.HERMES_API_KEY,
    baseUrl: process.env.HERMES_API_BASE_URL,
    enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false"
  });

  return NextResponse.json(status, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}
