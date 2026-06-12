import { fetchLifecycleTimeline } from "@hermes-ui/brain-memory-client";
import { NextResponse } from "next/server";
import { resolveBrainMemoryGatewayConfig } from "@/lib/server/brainMemoryGatewayConfig";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = readBoundedInteger(url.searchParams.get("limit"), 50, 1, 200);
  const offset = readBoundedInteger(url.searchParams.get("offset"), 0, 0, 100_000);
  const operation = cleanOperationFilter(url.searchParams.get("operation"));

  const timeline = await fetchLifecycleTimeline(resolveBrainMemoryGatewayConfig(), {
    limit,
    offset,
    operation
  });

  return NextResponse.json(timeline, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

function readBoundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number
) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function cleanOperationFilter(value: string | null) {
  return value?.replace(/[^a-z_,]/g, "").trim().slice(0, 256) || undefined;
}
