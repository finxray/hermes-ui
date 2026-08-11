import { listHermesSkills } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";
import { resolveHermesClientConfig } from "@/server/hermesClientConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await resolveHermesClientConfig({
    dashboardBaseUrl: process.env.HERMES_DASHBOARD_BASE_URL,
    dashboardSessionToken: process.env.HERMES_DASHBOARD_SESSION_TOKEN,
    timeoutMs: 8000
  });
  const result = await listHermesSkills(config);

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json({ ...result, raw: null }, {
    headers: { "Cache-Control": "no-store" }
  });
}
