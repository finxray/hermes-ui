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

const fixtures = await import(pathToFileURL(resolve(root, "apps/web/src/data/hermesRunsBffEventFixtures.ts")).toString());
const reducer = await import(pathToFileURL(resolve(root, "apps/web/src/lib/hermesRunsBffEventReducer.ts")).toString());

const checks = [];

checkRequiredEventTypes();
checkFixtureSequencesValid();
checkBasicSuccessfulRun();
checkMessageDeltaNoReplayRows();
checkActivityEventCreatesReplayState();
checkApprovalLifecycle();
checkStopSequence();
checkErrorSequence();
checkReplaySnapshotHydrates();
checkNoHiddenReasoningField();
checkNoSecretLikeFixtureData();
checkProductionSessionRouteStillPresent();
checkProductionRunsRouteAbsent();
checkNoDirectBrowserHermesPath();
checkPackageScript();

for (const check of checks) {
  console.log(`${check.ok ? "[ok]" : "[!!]"} ${check.name}: ${check.message}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.error("");
  console.error(`Hermes Runs BFF event checks failed: ${failed.length}`);
  process.exit(1);
}

console.log("");
console.log(`Hermes Runs BFF event checks passed: ${checks.length}`);

function checkRequiredEventTypes() {
  const observed = new Set(fixtures.hermesRunsBffRequiredEventTypes);
  const expected = [
    "run.started",
    "message.delta",
    "message.completed",
    "activity.event",
    "approval.request",
    "approval.responded",
    "run.stopping",
    "run.stopped",
    "run.completed",
    "run.failed",
    "run.reconnecting",
    "replay.snapshot",
    "error",
    "done"
  ];

  record(
    "required-event-types",
    expected.every((type) => observed.has(type)) && observed.size === expected.length,
    "all future HermesRunsBffEvent variants are represented in fixture metadata."
  );
}

function checkFixtureSequencesValid() {
  const sequences = Object.values(fixtures.hermesRunsBffFixtureSequences);
  const sequenceTypes = new Set(sequences.flat().map((event) => event.type));
  const ordered = sequences.every((sequence) =>
    sequence.every((event, index) => event.sequence === index + 1)
  );
  const schemaValid = sequences.every((sequence) =>
    sequence.every((event) => event.schemaVersion === "hermes-runs-bff-event.v1")
  );
  const doneLast = sequences.every((sequence) => sequence.at(-1)?.type === "done");

  record(
    "fixture-sequences-valid",
    ordered &&
      schemaValid &&
      doneLast &&
      fixtures.hermesRunsBffRequiredEventTypes.every((type) => sequenceTypes.has(type)),
    "fixture sequences are deterministic, schema-versioned, terminal, and cover all event types."
  );
}

function checkBasicSuccessfulRun() {
  const state = reducer.reduceHermesRunsBffEvents(fixtures.hermesRunsBffBasicSuccessEvents);

  record(
    "basic-successful-run",
    state.assistantText === "Hello from Runs." &&
      state.messageCompleted === true &&
      state.done === true &&
      state.runRecord?.status === "completed" &&
      state.runRecord?.hermesRunId === "run_16o_basic" &&
      state.activityReplay.length === 0,
    "basic run assembles assistant text, completes the run record, and creates no replay rows for deltas."
  );
}

function checkMessageDeltaNoReplayRows() {
  const state = reducer.reduceHermesRunsBffEvents(
    fixtures.hermesRunsBffBasicSuccessEvents.filter((event) => event.type === "run.started" || event.type === "message.delta")
  );

  record(
    "message-delta-no-replay",
    state.assistantText === "Hello from Runs." &&
      state.activityEvents.length === 0 &&
      state.activityReplay.length === 0,
    "message.delta updates assistantText only and does not create per-token replay rows."
  );
}

function checkActivityEventCreatesReplayState() {
  const state = reducer.reduceHermesRunsBffEvents(fixtures.hermesRunsBffActivityToolEvents);

  record(
    "activity-event-replay",
    state.activityEvents.length >= 2 &&
      state.activityReplay.length === 2 &&
      state.runRecord?.activitySummary.toolCount === 2 &&
      state.runRecord?.activityReplay.length === 2 &&
      state.replaySnapshot?.complete === true,
    "activity.event appends AgentActivityEvent objects and bounded persisted replay state."
  );
}

function checkApprovalLifecycle() {
  const state = reducer.reduceHermesRunsBffEvents(fixtures.hermesRunsBffApprovalDenyEvents);
  const approval = state.approvals.find((item) => item.approvalId === "approval-16o");

  record(
    "approval-lifecycle",
    approval?.status === "responded" &&
      approval.decision === "deny" &&
      state.activityEvents.some((event) => event.status === "waiting_for_approval") &&
      state.activityEvents.some((event) => event.approval?.decision === "deny") &&
      state.runRecord?.activitySummary.approvalCount === 2,
    "approval.request creates waiting state and approval.responded updates the same approval with deny."
  );
}

function checkStopSequence() {
  const state = reducer.reduceHermesRunsBffEvents(fixtures.hermesRunsBffStopEvents);

  record(
    "stop-sequence",
    state.assistantText === "Partial fixture text." &&
      state.runRecord?.status === "stopped" &&
      state.runRecord?.stoppedByUser === true &&
      state.done === true &&
      state.activityReplay.some((event) => event.status === "cancelled"),
    "stop sequence preserves partial text and ends with a stopped/cancelled replay state."
  );
}

function checkErrorSequence() {
  const state = reducer.reduceHermesRunsBffEvents(fixtures.hermesRunsBffErrorEvents);

  record(
    "error-sequence",
    state.errors.some((error) => error.code === "run_event_stream_failed") &&
      state.runRecord?.status === "failed" &&
      state.runRecord?.activitySummary.errorCount === 1 &&
      state.done === true,
    "error sequence records normalized error payloads and ends failed."
  );
}

function checkReplaySnapshotHydrates() {
  const state = reducer.reduceHermesRunsBffEvents(fixtures.hermesRunsBffReconnectReplayEvents);

  record(
    "replay-snapshot-hydrates",
    state.replaySnapshot?.source === "best_effort" &&
      state.replaySnapshot.complete === false &&
      state.reconnecting === false &&
      state.runRecord?.id === "run-runs-bff-16o-reconnect" &&
      state.activityReplay.length === 1 &&
      state.done === true,
    "replay.snapshot hydrates runRecord and activityReplay while preserving incomplete replay metadata."
  );
}

function checkNoHiddenReasoningField() {
  const combined = readNewSourceFiles({ includeCheckScript: false });
  const forbidden = [
    "hiddenReasoning",
    "reasoningText",
    "chain_of_thought",
    "chainOfThought",
    "privateReasoning"
  ];

  record(
    "no-hidden-reasoning-field",
    forbidden.every((token) => !combined.includes(token)),
    "new BFF event types, fixtures, and reducer do not introduce hidden reasoning fields."
  );
}

function checkNoSecretLikeFixtureData() {
  const serialized = JSON.stringify(fixtures.hermesRunsBffFixtureSequences);
  const source = readNewSourceFiles();
  const secretPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+|api[_-]?key\s*[:=]|token\s*[:=]|password\s*[:=]|secret\s*[:=]/i;

  record(
    "no-secret-like-fixture-data",
    !secretPattern.test(serialized) && !secretPattern.test(source),
    "fixture data and new source files are secret-free."
  );
}

function checkProductionSessionRouteStillPresent() {
  const routePath = resolve(root, "apps/web/src/app/api/hermes/chat/stream/route.ts");
  const routeSource = readFileSync(routePath, "utf8");

  record(
    "session-stream-present",
    existsSync(routePath) &&
      routeSource.includes("streamHermesSessionChat") &&
      routeSource.includes("text/event-stream"),
    "production session stream route remains present."
  );
}

function checkProductionRunsRouteAbsent() {
  const routePath = resolve(root, "apps/web/src/app/api/hermes/runs/chat");

  record(
    "production-runs-route-absent",
    !existsSync(routePath),
    "production /api/hermes/runs/chat/stream route is not implemented in this fixture slice."
  );
}

function checkNoDirectBrowserHermesPath() {
  const browserHermesFetchPattern = /fetch\(\s*["'`]https?:\/\/[^"'`]*8642|fetch\(\s*["'`]\/v1\/runs|fetch\(\s*["'`]\/api\/sessions/;
  const browserFilesToCheck = [
    "apps/web/src/lib/hermesChatClient.ts",
    "apps/web/src/components/chat/ChatView.tsx",
    "apps/web/src/components/shell/ContextRail.tsx"
  ];
  const directCallFile = browserFilesToCheck.find((file) =>
    browserHermesFetchPattern.test(readFileSync(resolve(root, file), "utf8"))
  );

  record(
    "no-direct-browser-hermes",
    directCallFile === undefined,
    "browser sources still avoid direct Hermes /v1/runs or /api/sessions calls."
  );
}

function checkPackageScript() {
  const packageJson = readFileSync(resolve(root, "package.json"), "utf8");

  record(
    "package-script",
    packageJson.includes("\"check:hermes-runs-bff-events\""),
    "package.json exposes npm run check:hermes-runs-bff-events."
  );
}

function readNewSourceFiles(options = { includeCheckScript: true }) {
  const files = [
    "apps/web/src/types/hermesRunsBffEvents.ts",
    "apps/web/src/data/hermesRunsBffEventFixtures.ts",
    "apps/web/src/lib/hermesRunsBffEventReducer.ts"
  ];
  if (options.includeCheckScript) {
    files.push("scripts/check-hermes-runs-bff-events.mjs");
  }
  return files
    .map((file) => readFileSync(resolve(root, file), "utf8"))
    .join("\n");
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
