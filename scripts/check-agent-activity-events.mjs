#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(process.cwd());
const sourcePath = resolve(root, "apps/web/src/lib/agentActivityEvents.ts");
const source = readFileSync(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: false
  },
  fileName: sourcePath
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`;
const activity = await import(moduleUrl);

const checks = [];

checkMemoryStoreStarted();
checkMemoryStoreCompleted();
checkMemorySearch();
checkGenericTool();
checkCommandTool();
checkRunEvent();
checkErrorEvent();
checkUnknownRunFallback();
checkElapsedEvent();
checkStoppedEvent();
checkDurationFormatting();
checkDurationHelpers();
checkSecretRedaction();

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? "[ok]" : "[!!]"} ${check.name}: ${check.message}`);
}

if (failed.length > 0) {
  console.error("");
  console.error(`Agent activity checks failed: ${failed.length}`);
  process.exit(1);
}

console.log("");
console.log(`Agent activity checks passed: ${checks.length}`);

function checkMemoryStoreStarted() {
  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "memory_store",
    status: "started",
    payload: {
      memory_id: "mem-1",
      preview: "Saving scoped memory",
      project_key: "project-a",
      session_key: "session-a"
    }
  }, { id: "memory-store-started", now: "2026-05-30T00:00:00.000Z" });

  record(
    "memory-store-started",
    event.type === "memory" &&
      event.status === "running" &&
      event.title === "Stored memory" &&
      event.source === "brain-memory" &&
      event.memory?.operation === "store",
    "memory_store started maps to a running Brain Memory event."
  );
}

function checkMemoryStoreCompleted() {
  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "brain_memory_store",
    status: "completed",
    payload: { memory_id: "mem-2", result_count: 1 }
  }, { id: "memory-store-completed" });

  record(
    "memory-store-completed",
    event.type === "memory" && event.status === "completed" && event.title === "Stored memory",
    "memory_store completed maps to a completed memory event."
  );
}

function checkMemorySearch() {
  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "memory_search",
    status: "completed",
    payload: { preview: "Found 3 memories", result_count: 3 }
  }, { id: "memory-search" });

  record(
    "memory-search",
    event.type === "memory" &&
      event.title === "Searched memory" &&
      event.memory?.operation === "search" &&
      event.summary === "Found 3 memories",
    "memory_search maps to a memory search event with summary."
  );
}

function checkGenericTool() {
  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "web_lookup",
    status: "started",
    payload: { preview: "Looking up docs" }
  }, { id: "generic-tool" });

  record(
    "generic-tool",
    event.type === "tool" && event.status === "running" && event.source === "hermes",
    "generic Hermes tool maps to a tool activity event."
  );
}

function checkCommandTool() {
  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "shell",
    status: "completed",
    payload: { command: "npm test", exit_code: 0, stdout: "ok" }
  }, { id: "command-tool" });

  record(
    "command-tool",
    event.type === "command" && event.status === "completed" && event.source === "mcp",
    "command-like tool payload maps to a command activity event."
  );
}

function checkRunEvent() {
  const event = activity.createActivityEventFromHermesRunEvent({
    type: "run_event",
    name: "run.started",
    status: "started",
    payload: { run_id: "run-1", session_id: "session-1" }
  }, { id: "run-started" });

  record(
    "run-event",
    event.type === "status" &&
      event.status === "running" &&
      event.title === "Run Started" &&
      event.hermes?.runId === "run-1",
    "run.started maps to a running status event."
  );
}

function checkErrorEvent() {
  const event = activity.createActivityEventFromHermesError({
    type: "error",
    error: {
      kind: "network",
      message: "Stream ended unexpectedly."
    }
  }, { id: "stream-error" });

  record(
    "error-event",
    event.type === "error" &&
      event.status === "failed" &&
      event.collapsedByDefault === false &&
      event.summary === "Stream ended unexpectedly.",
    "stream errors map to expanded failed error activity."
  );
}

function checkUnknownRunFallback() {
  const event = activity.createActivityEventFromHermesRunEvent({
    type: "run_event",
    name: "run.heartbeat",
    status: "heartbeat",
    payload: { seq: 9 }
  }, { id: "run-heartbeat" });

  record(
    "unknown-run-fallback",
    event.type === "status" && event.status === "info" && event.collapsedByDefault === true,
    "unknown run events map to compact informational status rows."
  );
}

function checkElapsedEvent() {
  const event = activity.makeElapsedActivityEvent({
    startedAt: "2026-05-30T00:00:00.000Z",
    completedAt: "2026-05-30T00:01:03.000Z",
    durationMs: 63_000
  });

  record(
    "elapsed-event",
    event.type === "elapsed" && event.status === "info" && event.title === "Worked for 1m 3s",
    "elapsed helper formats duration and creates an informational event."
  );
}

function checkStoppedEvent() {
  const event = activity.makeStoppedActivityEvent({
    startedAt: "2026-05-30T00:00:00.000Z",
    stoppedAt: "2026-05-30T00:00:05.000Z",
    durationMs: 5_000
  });

  record(
    "stopped-event",
    event.type === "status" &&
      event.status === "cancelled" &&
      event.title === "Stopped" &&
      event.summary === "Generation stopped by user" &&
      event.details?.stopStrategy === "client_stream_abort",
    "stopped helper creates an honest cancelled client-abort activity event."
  );
}

function checkDurationFormatting() {
  record(
    "duration-formatting",
    activity.formatActivityDuration(0) === "0s" &&
      activity.formatActivityDuration(500) === "<1s" &&
      activity.formatActivityDuration(12_000) === "12s" &&
      activity.formatActivityDuration(134_000) === "2m 14s" &&
      activity.formatActivityDuration(3_723_000) === "1h 2m 3s",
    "duration formatter covers 0s, subsecond, seconds, minutes, and hours."
  );
}

function checkDurationHelpers() {
  const event = activity.createActivityEventFromHermesRunEvent({
    type: "run_event",
    name: "run.completed",
    status: "completed",
    payload: { run_id: "run-2" }
  }, { id: "run-completed", now: "2026-05-30T00:00:04.000Z" });

  record(
    "duration-helpers",
    activity.computeActivityDuration({
      ...event,
      startedAt: "2026-05-30T00:00:00.000Z"
    }) === 4_000 &&
      activity.computeRunElapsed("2026-05-30T00:00:00.000Z", "2026-05-30T00:00:02.500Z") === 2_500 &&
      activity.computeRunElapsed("bad", "2026-05-30T00:00:02.500Z") === undefined,
    "duration helpers derive elapsed time only from safe start/end timestamps."
  );
}

function checkSecretRedaction() {
  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "memory_health_check",
    status: "completed",
    payload: {
      api_key: "super-secret",
      headers: {
        Authorization: "Bearer abc123"
      },
      preview: "Authorization: Bearer abc123"
    }
  }, { id: "secret-redaction" });

  record(
    "secret-redaction",
    event.type === "memory" &&
      event.title === "Checked memory health" &&
      event.details?.api_key === "[redacted]" &&
      event.details?.headers?.Authorization === "[redacted]" &&
      event.summary === "Authorization: Bearer [redacted]",
    "secret-like keys and bearer strings are redacted in details and summaries."
  );
}

function record(name, ok, message) {
  checks.push({ message, name, ok });
}
