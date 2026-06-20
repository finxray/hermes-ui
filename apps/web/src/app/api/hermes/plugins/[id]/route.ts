import { setHermesPluginEnabled } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const checkedAt = new Date().toISOString();
  const body = await request.json().catch(() => ({}));

  if (!id) {
    return NextResponse.json(
      {
        ok: false,
        pluginId: "",
        enabled: false,
        plugin: null,
        checkedAt,
        raw: null,
        error: { kind: "invalid_config", message: "Plugin id is required." }
      },
      { status: 400 }
    );
  }

  if (typeof body?.enabled !== "boolean") {
    return NextResponse.json(
      {
        ok: false,
        pluginId: id,
        enabled: false,
        plugin: null,
        checkedAt,
        raw: null,
        error: { kind: "invalid_request", message: "enabled must be a boolean." }
      },
      { status: 400 }
    );
  }

  const result = await setHermesPluginEnabled(
    {
      apiKey: process.env.HERMES_API_KEY,
      baseUrl: process.env.HERMES_API_BASE_URL,
      dashboardBaseUrl: process.env.HERMES_DASHBOARD_BASE_URL,
      dashboardSessionToken: process.env.HERMES_DASHBOARD_SESSION_TOKEN,
      enabled: process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false",
      signal: request.signal,
      timeoutMs: 10_000
    },
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
