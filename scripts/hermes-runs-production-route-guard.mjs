#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const args = parseArgs(process.argv.slice(2));
const routePath = "apps/web/src/app/api/hermes/runs/chat/stream/route.ts";
const sessionRoutePath = "apps/web/src/app/api/hermes/chat/stream/route.ts";
const experimentalRoutePath = "apps/web/src/app/api/hermes/runs/experimental-chat/route.ts";
const routeUrlPath = "/api/hermes/runs/chat/stream";
const validDisabledRequestBody = {
  agentAccessMode: "ask_before_tools",
  clientRunId: "client-run-route-guard-16q",
  hermesSessionId: "hermes-session-route-guard-16q",
  memoryScope: {
    includeProjectContext: true,
    includeSessionContext: true,
    stableProjectKey: "project-stable-route-guard-16q",
    stableSessionKey: "session-stable-route-guard-16q",
    tenantId: "local-dev"
  },
  message: "Validate that the disabled route stays disabled for a valid future Runs request.",
  model: "future-model-disabled",
  options: {
    includeActivity: true,
    includeReplayPreview: true,
    stream: true,
    timeoutMs: 30_000
  },
  projectId: "project-route-guard-16q",
  provider: "future-provider-disabled",
  sessionId: "session-route-guard-16q"
};
const invalidDisabledRequestBody = {
  ...validDisabledRequestBody,
  agentAccessMode: "unbounded_runtime_access"
};
const validChatOnlyDisabledRequestBody = {
  ...validDisabledRequestBody,
  agentAccessMode: "chat_only"
};
const validFullAccessDisabledRequestBody = {
  ...validDisabledRequestBody,
  agentAccessMode: "full_access"
};
const credentialDisabledRequestBody = {
  ...validDisabledRequestBody,
  apiKey: "fixture-credential-value"
};

const sourceResult = checkSourceGuard();
console.log(`[ok] source guard: ${sourceResult}`);

if (args.baseUrl) {
  const liveResult = await checkLiveGuard(args.baseUrl);
  console.log(`[ok] live route guard: ${liveResult}`);
} else {
  console.log("[skip] live route guard: pass --base-url or set HERMES_UI_BASE_URL for HTTP verification.");
}

console.log("HERMES_RUNS_PRODUCTION_ROUTE_GUARD_OK");

function checkSourceGuard() {
  const absoluteRoutePath = resolve(root, routePath);
  assert.equal(existsSync(absoluteRoutePath), true, `${routePath} must exist.`);
  assert.equal(existsSync(resolve(root, sessionRoutePath)), true, `${sessionRoutePath} must remain present.`);
  assert.equal(existsSync(resolve(root, experimentalRoutePath)), true, `${experimentalRoutePath} must remain present.`);

  const source = readFileSync(absoluteRoutePath, "utf8");

  for (const token of [
    "PRODUCTION_RUNS_ROUTE_DISABLED_REASON",
    "production_runs_route_not_enabled",
    "DisabledHermesRunsChatStreamResponse",
    "validateHermesRunsBffRequest",
    "requestValidation",
    "lifecycleDryRun",
    "createHermesRunsBffLifecycleDryRun",
    "rawRequestEchoed: false",
    "execution",
    "storageAccess: false",
    "sessionStreamDefault: true",
    "hermesRunCreated: false",
    "hermesCalled: false",
    "brainMemoryCalled: false",
    "eventStreamStarted: false",
    "productionChatUntouched: true",
    "directBrowserHermes: false",
    "directBrowserBrainMemory: false",
    "directStorageAccess: false",
    "approvalCalled: false",
    "stopCalled: false",
    "composerRunsSwitch: false",
    "agentAccessSelector: \"future-only\"",
    "status: 501",
    "Cache-Control"
  ]) {
    assert.equal(source.includes(token), true, `Disabled production Runs route is missing ${token}.`);
  }

  for (const token of [
    "@hermes-ui/hermes-client",
    "streamHermesSessionChat",
    "runHermesRunsExperimentalChat",
    "runHermesRunsProbe",
    "runHermesRunsApprovalProbe",
    "runHermesRunsStopProbe",
    "runHermesRunsMemoryProbe",
    "buildMemoryScopeBridgeInstruction",
    "process.env.HERMES",
    "process.env.BRAIN_MEMORY",
    "fetch(",
    "/v1/runs",
    "/api/sessions",
    "searchBrainMemory",
    "inspectBrainMemory",
    "localStorage",
    "readFileSync",
    "writeFileSync"
  ]) {
    assert.equal(source.includes(token), false, `Disabled production Runs route includes forbidden token ${token}.`);
  }

  return `${routePath} exists and is disabled-by-default.`;
}

async function checkLiveGuard(baseUrl) {
  const url = new URL(routeUrlPath, normalizeBaseUrl(baseUrl));
  const validBody = await postDisabledRoute(url, validDisabledRequestBody);
  assertDisabledEnvelope(validBody);
  assertNoEnabledAgentAccess(validBody);
  assert.equal(validBody.requestValidation?.attempted, true, "Valid request should be validation-checked.");
  assert.equal(validBody.requestValidation?.ok, true, "Valid request should have validation ok posture.");
  assert.deepEqual(validBody.requestValidation?.errorKinds, [], "Valid request should not report validation errors.");

  const chatOnlyBody = await postDisabledRoute(url, validChatOnlyDisabledRequestBody);
  assertDisabledEnvelope(chatOnlyBody);
  assertNoEnabledAgentAccess(chatOnlyBody);
  assert.equal(chatOnlyBody.requestValidation?.ok, true, "chat_only should validate but stay disabled.");

  const fullAccessBody = await postDisabledRoute(url, validFullAccessDisabledRequestBody);
  assertDisabledEnvelope(fullAccessBody);
  assertNoEnabledAgentAccess(fullAccessBody);
  assert.equal(fullAccessBody.requestValidation?.ok, true, "full_access should validate but stay disabled.");
  assert.equal(fullAccessBody.execution?.hermesRunCreated, false, "full_access must not create a Hermes run.");
  assert.equal(fullAccessBody.execution?.hermesCalled, false, "full_access must not call Hermes while disabled.");
  assert.equal(fullAccessBody.execution?.brainMemoryCalled, false, "full_access must not call Brain Memory while disabled.");

  const invalidBody = await postDisabledRoute(url, invalidDisabledRequestBody);
  assertDisabledEnvelope(invalidBody);
  assertNoEnabledAgentAccess(invalidBody);
  assert.equal(invalidBody.requestValidation?.attempted, true, "Invalid request should be validation-checked.");
  assert.equal(invalidBody.requestValidation?.ok, false, "Invalid request should have validation failure posture.");
  assert.equal(
    invalidBody.requestValidation?.errorKinds?.includes("invalid_agent_access_mode"),
    true,
    "Invalid request should report invalid_agent_access_mode."
  );

  const credentialBody = await postDisabledRoute(url, credentialDisabledRequestBody);
  assertDisabledEnvelope(credentialBody);
  assertNoEnabledAgentAccess(credentialBody);
  assert.equal(credentialBody.requestValidation?.ok, false, "Credential request should have validation failure posture.");
  assert.equal(
    credentialBody.requestValidation?.errorKinds?.includes("forbidden_credential_field"),
    true,
    "Credential request should report forbidden_credential_field."
  );

  return `${url.toString()} returned disabled HTTP 501 JSON.`;
}

async function postDisabledRoute(url, body) {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json"
    },
    method: "POST"
  });
  const contentType = response.headers.get("content-type") ?? "";
  assert.equal(response.status, 501, `${url.toString()} should return HTTP 501 while disabled.`);
  assert.equal(contentType.includes("application/json"), true, "Disabled route should return JSON, not SSE.");
  assert.equal(contentType.includes("text/event-stream"), false, "Disabled route must not start an event stream.");
  return response.json();
}

function assertDisabledEnvelope(body) {
  assert.deepEqual(
    {
      ok: body.ok,
      mode: body.mode,
      route: body.route,
      reason: body.reason,
      status: body.status,
      sessionStreamDefault: body.sessionStreamDefault,
      sessionStreamRoute: body.sessionStreamRoute,
      experimentalRoute: body.experimentalRoute,
      hermesRunCreated: body.hermesRunCreated,
      hermesCalled: body.hermesCalled,
      brainMemoryCalled: body.brainMemoryCalled,
      eventStreamStarted: body.eventStreamStarted,
      productionChatUntouched: body.productionChatUntouched,
      directBrowserHermes: body.directBrowserHermes,
      directBrowserBrainMemory: body.directBrowserBrainMemory,
      directStorageAccess: body.directStorageAccess,
      approvalCalled: body.approvalCalled,
      stopCalled: body.stopCalled,
      composerRunsSwitch: body.composerRunsSwitch,
      agentAccessSelector: body.agentAccessSelector,
      execution: body.execution
    },
    {
      ok: false,
      mode: "disabled",
      route: routeUrlPath,
      reason: "production_runs_route_not_enabled",
      status: "not_implemented",
      sessionStreamDefault: true,
      sessionStreamRoute: "/api/hermes/chat/stream",
      experimentalRoute: "/api/hermes/runs/experimental-chat",
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
      execution: {
        hermesRunCreated: false,
        hermesCalled: false,
        brainMemoryCalled: false,
        eventStreamStarted: false,
        approvalCalled: false,
        stopCalled: false,
        storageAccess: false
      }
    }
  );
  assert.equal("runId" in body, false, "Disabled route must not return runId.");
  assert.equal("hermesRunId" in body, false, "Disabled route must not return hermesRunId.");
  assert.equal(body.requestValidation?.rawRequestEchoed, false, "Disabled route must not echo raw request data.");
  assert.equal(body.lifecycleDryRun?.disabledReason, "production_runs_route_not_enabled", "Lifecycle dry run must stay disabled.");
  assert.equal(body.lifecycleDryRun?.routeStatus, "disabled_http_501", "Lifecycle dry run must report disabled HTTP 501.");
  assert.equal(body.lifecycleDryRun?.rawRequestEchoed, false, "Lifecycle dry run must not echo raw request data.");
  assert.equal(body.lifecycleDryRun?.runtimeExecution?.hermesRunCreated, false, "Lifecycle dry run must not create runs.");
  assert.equal(body.lifecycleDryRun?.runtimeExecution?.hermesCalled, false, "Lifecycle dry run must not call Hermes.");
  assert.equal(body.lifecycleDryRun?.runtimeExecution?.brainMemoryCalled, false, "Lifecycle dry run must not call Brain Memory.");
  assert.equal(body.lifecycleDryRun?.runtimeExecution?.eventStreamStarted, false, "Lifecycle dry run must not start streams.");
  assert.equal(body.lifecycleDryRun?.runtimeExecution?.approvalCalled, false, "Lifecycle dry run must not call approvals.");
  assert.equal(body.lifecycleDryRun?.runtimeExecution?.stopCalled, false, "Lifecycle dry run must not call stop.");
  assert.equal(body.lifecycleDryRun?.runtimeExecution?.storageAccess, false, "Lifecycle dry run must not touch storage.");
  assert.equal(
    body.lifecycleDryRun?.stages?.some((stage) => stage.stage === "create_run" && stage.executed === false),
    true,
    "Lifecycle dry run must mark create_run as not executed."
  );
}

function assertNoEnabledAgentAccess(body) {
  assert.equal(body.mode, "disabled", "Disabled route must not claim enabled mode.");
  assert.equal(body.agentAccessSelector, "future-only", "Agent access selector must remain future-only.");
  assert.equal("agentAccessModeEnabled" in body, false, "Disabled route must not expose enabled Agent access state.");
  assert.equal("approvalButtons" in body, false, "Disabled route must not expose approval buttons.");
  assert.equal("approvalActions" in body, false, "Disabled route must not expose approval actions.");
  assert.equal("enabledModes" in body, false, "Disabled route must not expose enabled Agent access modes.");
}

function parseArgs(argv) {
  const parsed = {
    baseUrl: process.env.HERMES_UI_BASE_URL ?? ""
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source-only") {
      parsed.baseUrl = "";
    } else if (arg === "--base-url") {
      parsed.baseUrl = argv[index + 1] ?? "";
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      parsed.baseUrl = arg.slice("--base-url=".length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return parsed;
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
