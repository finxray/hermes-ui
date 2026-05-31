#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const root = resolve(process.cwd());

registerHooks({
  resolve(specifier, context, nextResolve) {
    const resolvedAlias = resolveTsAlias(specifier);
    if (resolvedAlias) {
      return {
        shortCircuit: true,
        url: pathToFileURL(resolvedAlias).toString()
      };
    }

    const resolvedRelative = resolveRelativeTs(specifier, context.parentURL);
    if (resolvedRelative) {
      return {
        shortCircuit: true,
        url: pathToFileURL(resolvedRelative).toString()
      };
    }

    return nextResolve(specifier, context);
  }
});

const lifecycle = await import(
  pathToFileURL(resolve(root, "apps/web/src/lib/hermesRunsBffLifecycleDryRun.ts")).toString()
);
const fixtures = await import(
  pathToFileURL(resolve(root, "apps/web/src/data/hermesRunsBffLifecycleFixtures.ts")).toString()
);
const disabledRouteResponseFixtures = await import(
  pathToFileURL(resolve(root, "apps/web/src/data/hermesRunsDisabledRouteResponseFixtures.ts")).toString()
);
const disabledRouteResponseValidation = await import(
  pathToFileURL(resolve(root, "apps/web/src/lib/hermesRunsDisabledRouteResponseValidation.ts")).toString()
);

const checks = [];
const expectedStages = [
  "validate_request",
  "validate_scope",
  "validate_agent_access_policy",
  "prepare_context",
  "create_run",
  "stream_or_poll_events",
  "normalize_event",
  "update_run_record",
  "update_activity_replay",
  "handle_approval_request",
  "submit_approval_response",
  "handle_stop_request",
  "finalize_run",
  "emit_done",
  "emit_error"
];
const runtimeStages = expectedStages.filter((stage) => stage !== "validate_request");

checkAllLifecycleStagesDefined();
checkFixtureMatrix();
checkRuntimeStagesNotExecuted();
checkDisabledRouteResponseFixtures();
checkDisabledRouteResponseSourcePurity();
checkDisabledReasonAndNoSecrets();
checkSourcePurity();
checkDisabledRouteLifecyclePosture();
checkProductionSessionStreamStillPresent();
checkNoAgentAccessSelector();
checkPackageScript();

for (const check of checks) {
  console.log(`${check.ok ? "[ok]" : "[!!]"} ${check.name}: ${check.message}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error("");
  console.error(`Hermes Runs lifecycle dry-run checks failed: ${failed.length}`);
  process.exit(1);
}

console.log("");
console.log(`Hermes Runs lifecycle dry-run checks passed: ${checks.length}`);

function checkAllLifecycleStagesDefined() {
  const observed = new Set(lifecycle.HERMES_RUNS_BFF_LIFECYCLE_STAGES);

  record(
    "all-lifecycle-stages-defined",
    expectedStages.every((stage) => observed.has(stage)) && observed.size === expectedStages.length,
    "all future production Runs BFF lifecycle stages are defined."
  );
}

function checkFixtureMatrix() {
  const results = fixtures.hermesRunsBffLifecycleDryRunFixtures.map((fixture) => {
    const plan = lifecycle.createHermesRunsBffLifecycleDryRun(fixture);
    const requiredStages = plan.stages.filter((stage) => stage.requiredForFuture).map((stage) => stage.stage);
    const errorKinds = new Set(plan.requestValidation.errorKinds);

    return {
      errorKindsOk: fixture.expectedErrorKinds.every((kind) => errorKinds.has(kind)),
      requiredStagesOk:
        fixture.expectedRequiredStages.length === requiredStages.length &&
        fixture.expectedRequiredStages.every((stage) => requiredStages.includes(stage)),
      runtimeOk: allRuntimeExecutionFalse(plan),
      validationOk: plan.requestValidation.ok === fixture.expectedValidationOk
    };
  });

  record(
    "fixture-matrix",
    fixtures.hermesRunsBffLifecycleDryRunFixtures.length === 7 &&
      results.every((result) => result.validationOk && result.errorKindsOk && result.requiredStagesOk && result.runtimeOk),
    "valid, invalid, stop, approval, and error fixtures produce expected dry-run plans."
  );
}

function checkRuntimeStagesNotExecuted() {
  const plans = fixtures.hermesRunsBffLifecycleDryRunFixtures.map((fixture) =>
    lifecycle.createHermesRunsBffLifecycleDryRun(fixture)
  );
  const ok = plans.every((plan) =>
    runtimeStages.every((stageName) => plan.stages.find((stage) => stage.stage === stageName)?.executed === false)
  );

  record(
    "runtime-stages-not-executed",
    ok && plans.every(allRuntimeExecutionFalse),
    "all runtime lifecycle stages and runtime execution flags remain false while the route is disabled."
  );
}

function checkDisabledRouteResponseFixtures() {
  const routeResponseFixtures = disabledRouteResponseFixtures.hermesRunsDisabledRouteResponseFixtures;
  const expectedNames = [
    "valid-minimal-disabled-route-response",
    "valid-full-future-disabled-route-response",
    "invalid-missing-scope-disabled-route-response",
    "credential-field-disabled-route-response",
    "oversized-message-disabled-route-response"
  ];
  const results = routeResponseFixtures.map((fixture) => {
    const result = disabledRouteResponseValidation.validateHermesRunsDisabledRouteResponse(fixture.response, {
      expectedErrorKinds: fixture.expectedErrorKinds,
      expectedRequestValidationOk: fixture.expectedRequestValidationOk,
      httpStatus: fixture.httpStatus
    });
    return result.ok;
  });

  record(
    "disabled-route-response-fixtures",
    routeResponseFixtures.length === expectedNames.length &&
      expectedNames.every((name) => routeResponseFixtures.some((fixture) => fixture.name === name)) &&
      routeResponseFixtures.every((fixture) => fixture.httpStatus === 501) &&
      results.every(Boolean),
    "valid minimal, valid full future, missing scope, credential, and oversized response fixtures match the disabled HTTP 501 contract."
  );
}

function checkDisabledRouteResponseSourcePurity() {
  const combined = [
    "apps/web/src/lib/hermesRunsDisabledRouteResponseValidation.ts",
    "apps/web/src/data/hermesRunsDisabledRouteResponseFixtures.ts"
  ]
    .map((file) => readFileSync(resolve(root, file), "utf8"))
    .join("\n");
  const forbiddenTokens = [
    "@hermes-ui/hermes-client",
    "@hermes-ui/brain-memory-client",
    "NextResponse",
    "buildMemoryScopeBridgeInstruction",
    "process.env",
    "fetch(",
    "/v1/runs",
    "/api/sessions",
    "searchBrainMemory",
    "inspectBrainMemory",
    "localStorage",
    "sessionStorage",
    "readFileSync",
    "writeFileSync"
  ];

  record(
    "disabled-route-response-source-pure",
    forbiddenTokens.every((token) => !combined.includes(token)),
    "disabled route response helper and fixtures have no network, env, route, storage, service, or memory bridge code."
  );
}

function checkDisabledReasonAndNoSecrets() {
  const plan = lifecycle.createHermesRunsBffLifecycleDryRun(fixtures.hermesRunsBffValidChatOnlyLifecycleDryRun);
  const serialized = JSON.stringify(plan);
  const secretPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+|api[_-]?key|authorization|password|service[_-]?token/i;

  record(
    "disabled-reason-no-secrets",
    plan.disabledReason === "production_runs_route_not_enabled" &&
      plan.routeStatus === "disabled_http_501" &&
      plan.rawRequestEchoed === false &&
      plan.serviceSecretsRead === false &&
      !secretPattern.test(serialized),
    "dry-run output carries disabled reason, no raw request echo, no service secret reads, and no secret-like data."
  );
}

function checkSourcePurity() {
  const combined = [
    "apps/web/src/lib/hermesRunsBffLifecycleDryRun.ts",
    "apps/web/src/data/hermesRunsBffLifecycleFixtures.ts"
  ]
    .map((file) => readFileSync(resolve(root, file), "utf8"))
    .join("\n");
  const forbiddenTokens = [
    "@hermes-ui/hermes-client",
    "@hermes-ui/brain-memory-client",
    "NextResponse",
    "buildMemoryScopeBridgeInstruction",
    "process.env",
    "fetch(",
    "searchBrainMemory",
    "inspectBrainMemory",
    "localStorage",
    "sessionStorage",
    "readFileSync",
    "writeFileSync"
  ];

  record(
    "lifecycle-source-pure",
    forbiddenTokens.every((token) => !combined.includes(token)),
    "lifecycle helper and fixtures have no network, env, route, storage, service, or memory bridge code."
  );
}

function checkDisabledRouteLifecyclePosture() {
  const routePath = resolve(root, "apps/web/src/app/api/hermes/runs/chat/stream/route.ts");
  const routeSource = readFileSync(routePath, "utf8");
  const requiredTokens = [
    "createHermesRunsBffLifecycleDryRun",
    "lifecycleDryRun",
    "production_runs_route_not_enabled",
    "status: 501",
    "hermesRunCreated: false",
    "hermesCalled: false",
    "brainMemoryCalled: false",
    "eventStreamStarted: false",
    "approvalCalled: false",
    "stopCalled: false",
    "storageAccess: false",
    "agentAccessSelector: \"future-only\""
  ];
  const forbiddenTokens = [
    "@hermes-ui/hermes-client",
    "@hermes-ui/brain-memory-client",
    "buildMemoryScopeBridgeInstruction",
    "process.env.HERMES",
    "process.env.BRAIN_MEMORY",
    "fetch(",
    "/v1/runs",
    "/api/sessions",
    "searchBrainMemory",
    "inspectBrainMemory",
    "localStorage",
    "sessionStorage",
    "readFileSync",
    "writeFileSync"
  ];

  record(
    "disabled-route-lifecycle-posture",
    existsSync(routePath) &&
      requiredTokens.every((token) => routeSource.includes(token)) &&
      forbiddenTokens.every((token) => !routeSource.includes(token)),
    "disabled route includes lifecycleDryRun posture while still avoiding execution paths."
  );
}

function checkProductionSessionStreamStillPresent() {
  const routePath = resolve(root, "apps/web/src/app/api/hermes/chat/stream/route.ts");
  const source = readFileSync(routePath, "utf8");

  record(
    "session-stream-present",
    existsSync(routePath) && source.includes("streamHermesSessionChat") && source.includes("text/event-stream"),
    "production session stream route remains present."
  );
}

function checkNoAgentAccessSelector() {
  const combined = [
    "apps/web/src/components/chat/Composer.tsx",
    "apps/web/src/components/chat/ChatView.tsx",
    "apps/web/src/lib/hermesChatClient.ts"
  ]
    .map((file) => readFileSync(resolve(root, file), "utf8"))
    .join("\n");
  const forbiddenTokens = [
    "/api/hermes/runs/chat/stream",
    "agentAccessMode",
    "Agent access",
    "Full access",
    "approval.request"
  ];

  record(
    "no-agent-access-selector",
    forbiddenTokens.every((token) => !combined.includes(token)),
    "browser composer/chat client still has no Runs path, Agent access selector, or approval buttons."
  );
}

function checkPackageScript() {
  const packageJson = readFileSync(resolve(root, "package.json"), "utf8");

  record(
    "package-script",
    packageJson.includes("\"check:hermes-runs-lifecycle\""),
    "package.json exposes npm run check:hermes-runs-lifecycle."
  );
}

function allRuntimeExecutionFalse(plan) {
  return (
    plan.runtimeExecution.hermesRunCreated === false &&
    plan.runtimeExecution.hermesCalled === false &&
    plan.runtimeExecution.brainMemoryCalled === false &&
    plan.runtimeExecution.eventStreamStarted === false &&
    plan.runtimeExecution.runRecordCreated === false &&
    plan.runtimeExecution.activityReplayUpdated === false &&
    plan.runtimeExecution.approvalCalled === false &&
    plan.runtimeExecution.stopCalled === false &&
    plan.runtimeExecution.storageAccess === false
  );
}

function record(name, ok, message) {
  checks.push({ message, name, ok });
}

function resolveTsAlias(specifier) {
  if (!specifier.startsWith("@/")) {
    return null;
  }
  return resolveTsCandidate(resolve(root, "apps/web/src", specifier.slice(2)));
}

function resolveRelativeTs(specifier, parentUrl) {
  if (!parentUrl || (!specifier.startsWith("./") && !specifier.startsWith("../"))) {
    return null;
  }
  const parentPath = fileURLToPath(parentUrl);
  return resolveTsCandidate(resolve(dirname(parentPath), specifier));
}

function resolveTsCandidate(candidate) {
  for (const path of [candidate, `${candidate}.ts`, `${candidate}.tsx`, resolve(candidate, "index.ts")]) {
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}
