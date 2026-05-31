import { NextResponse } from "next/server";
import {
  validateHermesRunsBffRequest
} from "@/lib/hermesRunsBffRequestValidation";
import type {
  HermesRunsBffRequestValidationErrorKind,
  HermesRunsBffRequestValidationResult
} from "@/types/hermesRunsBffRequest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRODUCTION_RUNS_ROUTE_PATH = "/api/hermes/runs/chat/stream";
const SESSION_STREAM_ROUTE_PATH = "/api/hermes/chat/stream";
const EXPERIMENTAL_RUNS_ROUTE_PATH = "/api/hermes/runs/experimental-chat";
const PRODUCTION_RUNS_ROUTE_DISABLED_REASON = "production_runs_route_not_enabled";
const INVALID_JSON_ERROR_KIND = "invalid_body" satisfies HermesRunsBffRequestValidationErrorKind;

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
  requestValidation: DisabledHermesRunsRequestValidationPosture;
  execution: DisabledHermesRunsExecutionPosture;
};

type DisabledHermesRunsRequestValidationPosture = {
  attempted: true;
  ok: boolean;
  errorKinds: HermesRunsBffRequestValidationErrorKind[];
  errors: Array<{
    kind: HermesRunsBffRequestValidationErrorKind;
    path: string;
  }>;
  futureFields: {
    agentAccessMode: "metadata_only";
    model: "inert_until_client_selectable";
    provider: "inert_until_supported";
  };
  rawRequestEchoed: false;
};

type DisabledHermesRunsExecutionPosture = {
  hermesRunCreated: false;
  hermesCalled: false;
  brainMemoryCalled: false;
  eventStreamStarted: false;
  approvalCalled: false;
  stopCalled: false;
  storageAccess: false;
};

export async function POST(request: Request) {
  const validation = await readRequestValidationPosture(request);

  return NextResponse.json(createDisabledRunsRouteResponse(validation), {
    headers: {
      "Cache-Control": "no-store"
    },
    status: 501
  });
}

async function readRequestValidationPosture(request: Request): Promise<DisabledHermesRunsRequestValidationPosture> {
  const raw = await request.text();

  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    return buildValidationPosture({
      errors: [
        {
          kind: INVALID_JSON_ERROR_KIND,
          message: "Request body must be valid JSON.",
          path: "$"
        }
      ],
      ok: false,
      schemaVersion: "hermes-runs-bff-request.v1"
    });
  }

  return buildValidationPosture(validateHermesRunsBffRequest(parsed));
}

function buildValidationPosture(
  validation: HermesRunsBffRequestValidationResult
): DisabledHermesRunsRequestValidationPosture {
  const errors = validation.ok
    ? []
    : validation.errors.map((item) => ({
        kind: item.kind,
        path: item.path
      }));

  return {
    attempted: true,
    errorKinds: Array.from(new Set(errors.map((item) => item.kind))),
    errors,
    futureFields: {
      agentAccessMode: "metadata_only",
      model: "inert_until_client_selectable",
      provider: "inert_until_supported"
    },
    ok: validation.ok,
    rawRequestEchoed: false
  };
}

function createDisabledRunsRouteResponse(
  requestValidation: DisabledHermesRunsRequestValidationPosture
): DisabledHermesRunsChatStreamResponse {
  const execution: DisabledHermesRunsExecutionPosture = {
    approvalCalled: false,
    brainMemoryCalled: false,
    eventStreamStarted: false,
    hermesCalled: false,
    hermesRunCreated: false,
    stopCalled: false,
    storageAccess: false
  };

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
    agentAccessSelector: "future-only",
    execution,
    requestValidation
  };
}
