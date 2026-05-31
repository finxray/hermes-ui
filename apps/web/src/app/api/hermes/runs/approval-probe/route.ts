import {
  runHermesRunsApprovalProbe,
  type HermesRunApprovalChoice
} from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 2_000;

export async function POST(request: Request) {
  const body = await readOptionalBody(request);
  const result = await runHermesRunsApprovalProbe(
    {
      apiKey: process.env.HERMES_API_KEY,
      baseUrl: process.env.HERMES_API_BASE_URL,
      enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false",
      timeoutMs: 60_000
    },
    {
      choice: sanitizeChoice(body.choice) ?? "deny"
    }
  );

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

async function readOptionalBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (!raw.trim() || raw.length > MAX_BODY_BYTES) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function sanitizeChoice(value: unknown): HermesRunApprovalChoice | null {
  return value === "once" || value === "session" || value === "always" || value === "deny"
    ? value
    : null;
}
