#!/usr/bin/env node

import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
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

const policyFixtures = await import(
  pathToFileURL(resolve(root, "apps/web/src/data/agentAccessPolicyFixtures.ts")).toString()
);
const requestTypes = await import(pathToFileURL(resolve(root, "apps/web/src/types/hermesRunsBffRequest.ts")).toString());
const requestFixtures = await import(
  pathToFileURL(resolve(root, "apps/web/src/data/hermesRunsBffRequestFixtures.ts")).toString()
);
const validation = await import(
  pathToFileURL(resolve(root, "apps/web/src/lib/hermesRunsBffRequestValidation.ts")).toString()
);

const checks = [];
const fixtures = policyFixtures.agentAccessPolicyFixtures;
const expectedModes = requestTypes.HERMES_RUNS_BFF_AGENT_ACCESS_MODES;

checkAllModesPresent();
checkAllModesDisabled();
checkFullAccessWarning();
checkModePolicySemantics();
checkValidatorModeContract();
checkNoComposerSelector();
checkNoEnabledFullAccessProductionUi();
checkNoApprovalButtonsInComposer();
checkDisabledRouteStillDisabled();
checkRouteGuardCoversAgentAccessModes();
checkPackageScript();

for (const check of checks) {
  console.log(`${check.ok ? "[ok]" : "[!!]"} ${check.name}: ${check.message}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error("");
  console.error(`Agent access policy checks failed: ${failed.length}`);
  process.exit(1);
}

console.log("");
console.log(`Agent access policy checks passed: ${checks.length}`);

function checkAllModesPresent() {
  const fixtureModes = new Set(fixtures.map((fixture) => fixture.mode));

  record(
    "all-modes-present",
    expectedModes.length === 5 &&
      fixtures.length === expectedModes.length &&
      expectedModes.every((mode) => fixtureModes.has(mode)),
    "all five future Agent access modes have deterministic fixtures."
  );
}

function checkAllModesDisabled() {
  record(
    "all-modes-disabled",
    fixtures.every((fixture) => fixture.productionUiEnabled === false && fixture.enforcementAvailable === false) &&
      fixtures.every((fixture) => typeof fixture.reasonDisabled === "string" && fixture.reasonDisabled.length > 20),
    "every future mode is marked productionUiEnabled=false and enforcementAvailable=false."
  );
}

function checkFullAccessWarning() {
  const fixture = findFixture("full_access");

  record(
    "full-access-warning",
    Boolean(fixture) &&
      fixture.productionUiEnabled === false &&
      fixture.enforcementAvailable === false &&
      /not unrestricted/i.test(`${fixture.intendedMeaning} ${fixture.safetyWarning}`) &&
      /OS|filesystem|shell|network|storage|system/i.test(fixture.safetyWarning ?? ""),
    "full_access is explicitly documented as configured policy access, not unrestricted OS/system access."
  );
}

function checkModePolicySemantics() {
  const chatOnly = findFixture("chat_only");
  const readOnly = findFixture("read_only_tools");
  const askBefore = findFixture("ask_before_tools");
  const custom = findFixture("custom");

  record(
    "chat-only-blocks-tools",
    Boolean(chatOnly) &&
      chatOnly.expectedToolPolicy === "no_tools" &&
      chatOnly.brainMemoryReadAllowed === false &&
      chatOnly.brainMemoryWriteAllowed === false &&
      chatOnly.commandAllowed === false &&
      chatOnly.externalActionAllowed === false,
    "chat_only blocks runtime tools, memory writes, commands, and external actions."
  );

  record(
    "read-only-blocks-side-effects",
    Boolean(readOnly) &&
      readOnly.expectedToolPolicy === "read_only_tools_only" &&
      readOnly.brainMemoryReadAllowed === true &&
      readOnly.brainMemoryWriteAllowed === false &&
      readOnly.commandAllowed === false &&
      readOnly.externalActionAllowed === false,
    "read_only_tools allows read posture only and blocks writes, commands, and external actions."
  );

  record(
    "ask-before-requires-approval",
    Boolean(askBefore) &&
      askBefore.expectedToolPolicy === "approval_required_before_tools" &&
      askBefore.expectedApprovalBehavior.includes("approval.request") &&
      askBefore.expectedApprovalBehavior.includes("BFF approval enforcement") &&
      askBefore.productionUiEnabled === false,
    "ask_before_tools requires approval.request plus BFF approval enforcement before any UI exposure."
  );

  record(
    "custom-future-only",
    Boolean(custom) &&
      custom.expectedToolPolicy === "future_custom_policy" &&
      custom.reasonDisabled.includes("future-only") &&
      custom.productionUiEnabled === false,
    "custom remains a future-only policy profile."
  );
}

function checkValidatorModeContract() {
  const validByMode = expectedModes.every((mode) =>
    validation.validateHermesRunsBffRequest({
      ...requestFixtures.hermesRunsBffValidMinimalRequest,
      agentAccessMode: mode
    }).ok
  );
  const invalid = validation.validateHermesRunsBffRequest({
    ...requestFixtures.hermesRunsBffValidMinimalRequest,
    agentAccessMode: "unbounded_runtime_access"
  });

  record(
    "validator-mode-contract",
    validByMode &&
      invalid.ok === false &&
      invalid.errors.some((item) => item.kind === "invalid_agent_access_mode"),
    "request validator accepts known future modes and rejects unknown modes."
  );
}

function checkNoComposerSelector() {
  const composer = readFileSync(resolve(root, "apps/web/src/components/chat/Composer.tsx"), "utf8");
  const forbiddenTokens = [
    "Agent access",
    "agentAccessMode",
    "chat_only",
    "read_only_tools",
    "ask_before_tools",
    "full_access",
    "Full access",
    "Ask before tools",
    "Read-only tools",
    "Chat only"
  ];

  record(
    "no-composer-agent-access-selector",
    forbiddenTokens.every((token) => !composer.includes(token)),
    "Composer still has no Agent access selector or enabled mode labels."
  );
}

function checkNoEnabledFullAccessProductionUi() {
  const uiSources = productionUiFiles().map((file) => ({
    file,
    source: readFileSync(file, "utf8")
  }));
  const forbiddenPatterns = [
    /Full access/i,
    /Agent access/i,
    /agentAccessMode/,
    /full_access/,
    /ask_before_tools/,
    /read_only_tools/,
    /chat_only/
  ];

  record(
    "no-enabled-full-access-production-ui",
    uiSources.every(({ source }) => forbiddenPatterns.every((pattern) => !pattern.test(source))),
    "production UI source contains no enabled Full access or Agent access selector copy."
  );
}

function checkNoApprovalButtonsInComposer() {
  const composer = readFileSync(resolve(root, "apps/web/src/components/chat/Composer.tsx"), "utf8");
  const forbiddenTokens = ["Approve", "Deny", "Allow once", "Always allow", "approval.request"];

  record(
    "no-approval-buttons-in-composer",
    forbiddenTokens.every((token) => !composer.includes(token)),
    "production composer still has no approval action buttons."
  );
}

function checkDisabledRouteStillDisabled() {
  const routeSource = readFileSync(resolve(root, "apps/web/src/app/api/hermes/runs/chat/stream/route.ts"), "utf8");
  const requiredTokens = [
    "validateHermesRunsBffRequest",
    "agentAccessMode: \"metadata_only\"",
    "agentAccessSelector: \"future-only\"",
    "mode: \"disabled\"",
    "status: 501",
    "hermesRunCreated: false",
    "hermesCalled: false",
    "brainMemoryCalled: false",
    "eventStreamStarted: false",
    "approvalCalled: false",
    "stopCalled: false",
    "storageAccess: false"
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
    "approvalButtons",
    "approvalActions",
    "agentAccessModeEnabled",
    "readFileSync",
    "writeFileSync"
  ];

  record(
    "disabled-route-no-execution",
    requiredTokens.every((token) => routeSource.includes(token)) &&
      forbiddenTokens.every((token) => !routeSource.includes(token)),
    "disabled Runs route validates agentAccessMode as metadata but still cannot execute or expose actions."
  );
}

function checkRouteGuardCoversAgentAccessModes() {
  const guardSource = readFileSync(resolve(root, "scripts/hermes-runs-production-route-guard.mjs"), "utf8");
  const requiredTokens = [
    "validChatOnlyDisabledRequestBody",
    "validFullAccessDisabledRequestBody",
    "invalidDisabledRequestBody",
    "agentAccessMode: \"chat_only\"",
    "agentAccessMode: \"full_access\"",
    "invalid_agent_access_mode",
    "assertNoEnabledAgentAccess"
  ];

  record(
    "route-guard-agent-access-cases",
    requiredTokens.every((token) => guardSource.includes(token)),
    "route guard covers chat_only, full_access, and invalid agentAccessMode disabled-route cases."
  );
}

function checkPackageScript() {
  const packageJson = readFileSync(resolve(root, "package.json"), "utf8");

  record(
    "package-script",
    packageJson.includes("\"check:agent-access-policy\""),
    "package.json exposes npm run check:agent-access-policy."
  );
}

function findFixture(mode) {
  return fixtures.find((fixture) => fixture.mode === mode);
}

function productionUiFiles() {
  const roots = [
    resolve(root, "apps/web/src/components"),
    resolve(root, "apps/web/src/app/page.tsx"),
    resolve(root, "apps/web/src/lib/hermesChatClient.ts")
  ];
  return roots.flatMap((path) => collectSourceFiles(path));
}

function collectSourceFiles(path) {
  if (!existsSync(path)) {
    return [];
  }
  const stat = statSync(path);
  if (stat.isFile()) {
    return /\.(tsx?|jsx?)$/.test(path) ? [path] : [];
  }
  return readdirSync(path)
    .filter((name) => name !== "design" && name !== "api")
    .flatMap((name) => collectSourceFiles(resolve(path, name)));
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
