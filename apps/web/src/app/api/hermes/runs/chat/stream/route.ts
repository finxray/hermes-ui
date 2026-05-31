import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRODUCTION_RUNS_ROUTE_PATH = "/api/hermes/runs/chat/stream";
const SESSION_STREAM_ROUTE_PATH = "/api/hermes/chat/stream";
const EXPERIMENTAL_RUNS_ROUTE_PATH = "/api/hermes/runs/experimental-chat";
const PRODUCTION_RUNS_ROUTE_DISABLED_REASON = "production_runs_route_not_enabled";

type DisabledHermesRunsChatStreamResponse = {
  ok: false;
  mode: "disabled";
  route: typeof PRODUCTION_RUNS_ROUTE_PATH;
  reason: typeof PRODUCTION_RUNS_ROUTE_DISABLED_REASON;
  status: "not_implemented";
  sessionStreamDefault: true;
  sessionStreamRoute: typeof SESSION_STREAM_ROUTE_PATH;
  experimentalRoute: typeof EXPERIMENTAL_RUNS_ROUTE_PATH;
  hermesRunCreated: false;
  hermesCalled: false;
  brainMemoryCalled: false;
  eventStreamStarted: false;
  productionChatUntouched: true;
  directBrowserHermes: false;
  directBrowserBrainMemory: false;
  directStorageAccess: false;
  approvalCalled: false;
  stopCalled: false;
  composerRunsSwitch: false;
  agentAccessSelector: "future-only";
};

export async function POST() {
  return NextResponse.json(createDisabledRunsRouteResponse(), {
    headers: {
      "Cache-Control": "no-store"
    },
    status: 501
  });
}

function createDisabledRunsRouteResponse(): DisabledHermesRunsChatStreamResponse {
  return {
    ok: false,
    mode: "disabled",
    route: PRODUCTION_RUNS_ROUTE_PATH,
    reason: PRODUCTION_RUNS_ROUTE_DISABLED_REASON,
    status: "not_implemented",
    sessionStreamDefault: true,
    sessionStreamRoute: SESSION_STREAM_ROUTE_PATH,
    experimentalRoute: EXPERIMENTAL_RUNS_ROUTE_PATH,
    hermesRunCreated: false,
    hermesCalled: false,
    brainMemoryCalled: false,
    eventStreamStarted: false,
    productionChatUntouched: true,
    directBrowserHermes: false,
    directBrowserBrainMemory: false,
    directStorageAccess: false,
    approvalCalled: false,
    stopCalled: false,
    composerRunsSwitch: false,
    agentAccessSelector: "future-only"
  };
}
