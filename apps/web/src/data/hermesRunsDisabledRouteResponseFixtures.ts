import { createHermesRunsBffLifecycleDryRun, type HermesRunsBffLifecycleDryRun } from "@/lib/hermesRunsBffLifecycleDryRun";
import {
  HERMES_RUNS_DISABLED_ROUTE_HTTP_STATUS,
  HERMES_RUNS_DISABLED_ROUTE_PATH,
  HERMES_RUNS_DISABLED_ROUTE_REASON,
  HERMES_RUNS_EXPERIMENTAL_ROUTE_PATH,
  HERMES_RUNS_SESSION_STREAM_ROUTE_PATH
} from "@/lib/hermesRunsDisabledRouteResponseValidation";
import { validateHermesRunsBffRequest } from "@/lib/hermesRunsBffRequestValidation";
import type { HermesRunsBffRequestValidationErrorKind } from "@/types/hermesRunsBffRequest";
import {
  hermesRunsBffInvalidRequestFixtures,
  hermesRunsBffValidAgentAccessRequest,
  hermesRunsBffValidMinimalRequest
} from "./hermesRunsBffRequestFixtures";

export type HermesRunsDisabledRouteResponseFixture = {
  expectedErrorKinds: HermesRunsBffRequestValidationErrorKind[];
  expectedRequestValidationOk: boolean;
  httpStatus: typeof HERMES_RUNS_DISABLED_ROUTE_HTTP_STATUS;
  name: string;
  request: unknown;
  response: HermesRunsDisabledRouteResponseFixtureBody;
};

export type HermesRunsDisabledRouteResponseFixtureBody = {
  ok: false;
  mode: "disabled";
  route: typeof HERMES_RUNS_DISABLED_ROUTE_PATH;
  reason: typeof HERMES_RUNS_DISABLED_ROUTE_REASON;
  status: "not_implemented";
  sessionStreamDefault: true;
  sessionStreamRoute: typeof HERMES_RUNS_SESSION_STREAM_ROUTE_PATH;
  experimentalRoute: typeof HERMES_RUNS_EXPERIMENTAL_ROUTE_PATH;
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
  requestValidation: {
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
  lifecycleDryRun: HermesRunsBffLifecycleDryRun;
  execution: {
    hermesRunCreated: false;
    hermesCalled: false;
    brainMemoryCalled: false;
    eventStreamStarted: false;
    approvalCalled: false;
    stopCalled: false;
    storageAccess: false;
  };
};

const missingMemoryScopeRequest = readInvalidFixtureRequest("missing-memory-scope");
const credentialFieldRequest = readInvalidFixtureRequest("forbidden-credential-field");
const oversizedMessageRequest = readInvalidFixtureRequest("oversized-message");

export const hermesRunsDisabledValidMinimalResponseFixture = createHermesRunsDisabledRouteResponseFixture({
  expectedErrorKinds: [],
  expectedRequestValidationOk: true,
  name: "valid-minimal-disabled-route-response",
  request: hermesRunsBffValidMinimalRequest
});

export const hermesRunsDisabledValidFullFutureResponseFixture = createHermesRunsDisabledRouteResponseFixture({
  expectedErrorKinds: [],
  expectedRequestValidationOk: true,
  name: "valid-full-future-disabled-route-response",
  request: {
    ...hermesRunsBffValidAgentAccessRequest,
    agentAccessMode: "full_access",
    model: "future-model-disabled",
    provider: "future-provider-disabled",
    options: {
      includeActivity: true,
      includeReplayPreview: true,
      stream: true,
      timeoutMs: 45_000
    }
  }
});

export const hermesRunsDisabledInvalidMissingScopeResponseFixture = createHermesRunsDisabledRouteResponseFixture({
  expectedErrorKinds: ["missing_memory_scope"],
  expectedRequestValidationOk: false,
  name: "invalid-missing-scope-disabled-route-response",
  request: missingMemoryScopeRequest
});

export const hermesRunsDisabledCredentialFieldResponseFixture = createHermesRunsDisabledRouteResponseFixture({
  expectedErrorKinds: ["forbidden_credential_field"],
  expectedRequestValidationOk: false,
  name: "credential-field-disabled-route-response",
  request: credentialFieldRequest
});

export const hermesRunsDisabledOversizedMessageResponseFixture = createHermesRunsDisabledRouteResponseFixture({
  expectedErrorKinds: ["message_too_large"],
  expectedRequestValidationOk: false,
  name: "oversized-message-disabled-route-response",
  request: oversizedMessageRequest
});

export const hermesRunsDisabledRouteResponseFixtures = [
  hermesRunsDisabledValidMinimalResponseFixture,
  hermesRunsDisabledValidFullFutureResponseFixture,
  hermesRunsDisabledInvalidMissingScopeResponseFixture,
  hermesRunsDisabledCredentialFieldResponseFixture,
  hermesRunsDisabledOversizedMessageResponseFixture
] satisfies HermesRunsDisabledRouteResponseFixture[];

function createHermesRunsDisabledRouteResponseFixture({
  expectedErrorKinds,
  expectedRequestValidationOk,
  name,
  request
}: {
  expectedErrorKinds: HermesRunsBffRequestValidationErrorKind[];
  expectedRequestValidationOk: boolean;
  name: string;
  request: unknown;
}): HermesRunsDisabledRouteResponseFixture {
  const validation = validateHermesRunsBffRequest(request);
  const validationErrors = validation.ok
    ? []
    : validation.errors.map((item) => ({
        kind: item.kind,
        path: item.path
      }));

  return {
    expectedErrorKinds,
    expectedRequestValidationOk,
    httpStatus: HERMES_RUNS_DISABLED_ROUTE_HTTP_STATUS,
    name,
    request,
    response: {
      agentAccessSelector: "future-only",
      approvalCalled: false,
      brainMemoryCalled: false,
      composerRunsSwitch: false,
      directBrowserBrainMemory: false,
      directBrowserHermes: false,
      directStorageAccess: false,
      eventStreamStarted: false,
      execution: {
        approvalCalled: false,
        brainMemoryCalled: false,
        eventStreamStarted: false,
        hermesCalled: false,
        hermesRunCreated: false,
        stopCalled: false,
        storageAccess: false
      },
      experimentalRoute: HERMES_RUNS_EXPERIMENTAL_ROUTE_PATH,
      hermesCalled: false,
      hermesRunCreated: false,
      lifecycleDryRun: createHermesRunsBffLifecycleDryRun(request),
      mode: "disabled",
      ok: false,
      productionChatUntouched: true,
      reason: HERMES_RUNS_DISABLED_ROUTE_REASON,
      requestValidation: {
        attempted: true,
        errorKinds: Array.from(new Set(validationErrors.map((item) => item.kind))),
        errors: validationErrors,
        futureFields: {
          agentAccessMode: "metadata_only",
          model: "inert_until_client_selectable",
          provider: "inert_until_supported"
        },
        ok: validation.ok,
        rawRequestEchoed: false
      },
      route: HERMES_RUNS_DISABLED_ROUTE_PATH,
      sessionStreamDefault: true,
      sessionStreamRoute: HERMES_RUNS_SESSION_STREAM_ROUTE_PATH,
      status: "not_implemented",
      stopCalled: false
    }
  };
}

function readInvalidFixtureRequest(name: string): unknown {
  const fixture = hermesRunsBffInvalidRequestFixtures.find((item) => item.name === name);
  if (!fixture) {
    throw new Error(`Missing Hermes Runs disabled route response fixture request: ${name}`);
  }
  return fixture.request;
}
