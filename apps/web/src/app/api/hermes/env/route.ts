import { getHermesEnvKeys } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getHermesEnvKeys({
    apiKey: process.env.HERMES_API_KEY,
    baseUrl: process.env.HERMES_API_BASE_URL,
    dashboardBaseUrl: process.env.HERMES_DASHBOARD_BASE_URL,
    dashboardSessionToken: process.env.HERMES_DASHBOARD_SESSION_TOKEN,
    enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false",
    timeoutMs: 9000
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json({ ...result, raw: null }, { headers: { "Cache-Control": "no-store" } });
}
