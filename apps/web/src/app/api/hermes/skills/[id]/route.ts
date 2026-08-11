import { setHermesSkillEnabled } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";
import { isTrustedMutationRequest } from "@/lib/server/requestTrust";
import { resolveHermesClientConfig } from "@/server/hermesClientConfig";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ error: { kind: "forbidden", message: "Cross-origin requests are not allowed." } }, { status: 403 });
  }

  const { id } = await params;
  const checkedAt = new Date().toISOString();
  const body = await request.json().catch(() => ({}));

  if (!id) {
    return NextResponse.json(
      {
        ok: false,
        skillId: "",
        enabled: false,
        skill: null,
        checkedAt,
        raw: null,
        error: { kind: "invalid_config", message: "Skill id is required." }
      },
      { status: 400 }
    );
  }

  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json(
      {
        ok: false,
        skillId: id,
        enabled: false,
        skill: null,
        checkedAt,
        raw: null,
        error: { kind: "invalid_request", message: "enabled must be a boolean." }
      },
      { status: 400 }
    );
  }

  const config = await resolveHermesClientConfig({
    dashboardBaseUrl: process.env.HERMES_DASHBOARD_BASE_URL,
    dashboardSessionToken: process.env.HERMES_DASHBOARD_SESSION_TOKEN,
    signal: request.signal,
    timeoutMs: 10_000
  });
  const result = await setHermesSkillEnabled(
    config,
    decodeURIComponent(id),
    body.enabled
  );

  if (!result.ok) {
    const status = result.error.kind === "network" || result.error.kind === "timeout" ? 502 : 400;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" }
  });
}
