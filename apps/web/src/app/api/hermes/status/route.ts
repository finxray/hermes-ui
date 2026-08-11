import { NextResponse } from "next/server";
import { getCoalescedHermesStatus } from "@/lib/server/hermesStatusProbe";
import { resolveHermesClientConfig } from "@/server/hermesClientConfig";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const config = await resolveHermesClientConfig({
    configuredDefaultModelId: process.env.HERMES_UI_DEFAULT_MODEL_ID
  });
  const status = await getCoalescedHermesStatus(
    config,
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
