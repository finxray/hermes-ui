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

const fixtures = await import(pathToFileURL(resolve(root, "apps/web/src/data/hermesRunsBffRequestFixtures.ts")).toString());
const validation = await import(pathToFileURL(resolve(root, "apps/web/src/lib/hermesRunsBffRequestValidation.ts")).toString());
const disabledRouteResponseFixtures = await import(
  pathToFileURL(resolve(root, "apps/web/src/data/hermesRunsDisabledRouteResponseFixtures.ts")).toString()
);
const disabledRouteResponseValidation = await import(
  pathToFileURL(resolve(root, "apps/web/src/lib/hermesRunsDisabledRouteResponseValidation.ts")).toString()
);

const checks = [];

checkValidFixturesPass();
checkInvalidFixturesFail();
checkProviderModelFutureFieldsRemainInert();
checkForbiddenCredentialFieldRejected();
checkDisabledRouteResponseFixtures();
checkValidationSourceIsPure();
checkDisabledRouteResponseSourceIsPure();
checkDisabledRouteValidationEcho();
checkProductionSessionStreamStillPresent();
checkNoComposerRunsSelector();
checkPackageScript();

for (const check of checks) {
  console.log(`${check.ok ? "[ok]" : "[!!]"} ${check.name}: ${check.message}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error("");
  console.error(`Hermes Runs BFF request checks failed: ${failed.length}`);
  process.exit(1);
}

console.log("");
console.log(`Hermes Runs BFF request checks passed: ${checks.length}`);

function checkValidFixturesPass() {
  const results = fixtures.hermesRunsBffValidRequestFixtures.map((request) =>
    validation.validateHermesRunsBffRequest(request)
  );

  record(
    "valid-fixtures-pass",
    results.every((result) => result.ok === true) &&
      results.every((result) => result.schemaVersion === "hermes-runs-bff-request.v1"),
    "valid minimal, agent access metadata, and provider/model future fixtures pass shape validation."
  );
}

function checkInvalidFixturesFail() {
  const ok = fixtures.hermesRunsBffInvalidRequestFixtures.every((fixture) => {
    const result = validation.validateHermesRunsBffRequest(fixture.request);
    if (result.ok) {
      return false;
    }
    const kinds = new Set(result.errors.map((item) => item.kind));
    return fixture.expectedKinds.every((kind) => kinds.has(kind));
  });

  record(
    "invalid-fixtures-fail",
    ok,
    "missing project, missing memory scope, invalid agent access, oversized message, credential field, timeout, and scope flag fixtures fail with expected kinds."
  );
}

function checkProviderModelFutureFieldsRemainInert() {
  const result = validation.validateHermesRunsBffRequest(fixtures.hermesRunsBffProviderModelFutureRequest);

  record(
    "provider-model-future-inert",
    result.ok === true &&
      result.request.model === "future-model-disabled" &&
      result.request.provider === "future-provider-disabled" &&
      result.futureFields.model === "inert_until_client_selectable" &&
      result.futureFields.provider === "inert_until_supported",
    "provider/model are accepted as inert future metadata and do not imply runtime switching."
  );
}

function checkForbiddenCredentialFieldRejected() {
  const result = validation.validateHermesRunsBffRequest({
    ...fixtures.hermesRunsBffValidMinimalRequest,
    authorization: "fixture-credential-value"
  });

  record(
    "forbidden-credential-field",
    result.ok === false && result.errors.some((item) => item.kind === "forbidden_credential_field"),
    "credential-like request fields are rejected before any future runtime can use them."
  );
}

function checkDisabledRouteResponseFixtures() {
  const ok = disabledRouteResponseFixtures.hermesRunsDisabledRouteResponseFixtures.every((fixture) => {
    const result = disabledRouteResponseValidation.validateHermesRunsDisabledRouteResponse(fixture.response, {
      expectedErrorKinds: fixture.expectedErrorKinds,
      expectedRequestValidationOk: fixture.expectedRequestValidationOk,
      httpStatus: fixture.httpStatus
    });
    return result.ok;
  });

  record(
    "disabled-route-response-fixtures",
    ok &&
      disabledRouteResponseFixtures.hermesRunsDisabledValidMinimalResponseFixture.expectedRequestValidationOk === true &&
      disabledRouteResponseFixtures.hermesRunsDisabledValidFullFutureResponseFixture.expectedRequestValidationOk === true &&
      disabledRouteResponseFixtures.hermesRunsDisabledInvalidMissingScopeResponseFixture.expectedErrorKinds.includes(
        "missing_memory_scope"
      ) &&
      disabledRouteResponseFixtures.hermesRunsDisabledCredentialFieldResponseFixture.expectedErrorKinds.includes(
        "forbidden_credential_field"
      ) &&
      disabledRouteResponseFixtures.hermesRunsDisabledOversizedMessageResponseFixture.expectedErrorKinds.includes(
        "message_too_large"
      ),
    "disabled route response fixtures cover valid minimal, valid full future, missing scope, credential, and oversized request postures."
  );
}

function checkValidationSourceIsPure() {
  const files = [
    "apps/web/src/types/hermesRunsBffRequest.ts",
    "apps/web/src/lib/hermesRunsBffRequestValidation.ts",
    "apps/web/src/data/hermesRunsBffRequestFixtures.ts"
  ];
  const combined = files.map((file) => readFileSync(resolve(root, file), "utf8")).join("\n");
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
    "validation-source-pure",
    forbiddenTokens.every((token) => !combined.includes(token)),
    "request types, fixtures, and validator have no network, service, env, storage, route, or memory bridge code."
  );
}

function checkDisabledRouteResponseSourceIsPure() {
  const files = [
    "apps/web/src/lib/hermesRunsDisabledRouteResponseValidation.ts",
    "apps/web/src/data/hermesRunsDisabledRouteResponseFixtures.ts"
  ];
  const combined = files.map((file) => readFileSync(resolve(root, file), "utf8")).join("\n");
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
    "disabled route response fixtures and validator have no network, service, env, storage, route, or memory bridge code."
  );
}

function checkDisabledRouteValidationEcho() {
  const routePath = resolve(root, "apps/web/src/app/api/hermes/runs/chat/stream/route.ts");
  const routeSource = existsSync(routePath) ? readFileSync(routePath, "utf8") : "";
  const requiredTokens = [
    "validateHermesRunsBffRequest",
    "readRequestValidationPosture",
    "requestValidation",
    "attempted: true",
    "rawRequestEchoed: false",
    "errorKinds",
    "errors",
    "execution",
    "storageAccess: false",
    "production_runs_route_not_enabled",
    "status: 501",
    "hermesRunCreated: false",
    "hermesCalled: false",
    "brainMemoryCalled: false",
    "eventStreamStarted: false",
    "productionChatUntouched: true",
    "composerRunsSwitch: false",
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
    "disabled-route-validation-echo",
    existsSync(routePath) &&
      requiredTokens.every((token) => routeSource.includes(token)) &&
      forbiddenTokens.every((token) => !routeSource.includes(token)),
    "production Runs route validates through the pure helper, echoes safe posture, and still avoids Hermes, Gateway, env, bridge, fetch, and storage."
  );
}

function checkProductionSessionStreamStillPresent() {
  const routePath = resolve(root, "apps/web/src/app/api/hermes/chat/stream/route.ts");
  const routeSource = existsSync(routePath) ? readFileSync(routePath, "utf8") : "";

  record(
    "session-stream-present",
    routeSource.includes("streamHermesSessionChat") && routeSource.includes("text/event-stream"),
    "production session stream route remains the chat default surface."
  );
}

function checkNoComposerRunsSelector() {
  const browserFiles = [
    "apps/web/src/components/chat/Composer.tsx",
    "apps/web/src/components/chat/ChatView.tsx",
    "apps/web/src/lib/hermesChatClient.ts"
  ];
  const combined = browserFiles.map((file) => readFileSync(resolve(root, file), "utf8")).join("\n");
  const forbiddenTokens = [
    "/api/hermes/runs/chat/stream",
    "agentAccessMode",
    "ask_before_tools",
    "full_access",
    "Runs mode",
    "Agent access"
  ];

  record(
    "no-composer-runs-selector",
    forbiddenTokens.every((token) => !combined.includes(token)),
    "browser composer/chat client still has no production Runs path or Agent access selector."
  );
}

function checkPackageScript() {
  const packageJson = readFileSync(resolve(root, "package.json"), "utf8");

  record(
    "package-script",
    packageJson.includes("\"check:hermes-runs-bff-request\""),
    "package.json exposes npm run check:hermes-runs-bff-request."
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
