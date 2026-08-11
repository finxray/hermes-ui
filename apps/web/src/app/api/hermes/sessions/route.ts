import { listHermesSessions } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";
import { resolveHermesClientConfig } from "@/server/hermesClientConfig";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await resolveHermesClientConfig({
    timeoutMs: 8000
  });
  const result = await listHermesSessions(config);

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" }
  });
}
