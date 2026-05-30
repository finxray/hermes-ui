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
checkCommandDetails();
checkCommandFailureExitCode();
checkCommandOutputRedaction();
checkCommandSourceChannel();
checkArtifactPayload();
checkRunEvent();
checkApprovalRequested();
checkApprovalResponded();
checkApprovalDenied();
checkApprovalWithoutId();
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

function checkCommandDetails() {
  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "run_command",
    status: "completed",
    payload: {
      args: ["run", "build"],
      command: "npm",
      cwd: "C:/repo",
      durationMs: 1250,
      exitCode: 0,
      stderr: "",
      stdout: "Build completed"
    }
  }, { id: "command-details" });

  record(
    "command-details",
    event.type === "command" &&
      event.title === "Command completed" &&
      event.command?.command === "npm" &&
      event.command?.args?.join(" ") === "run build" &&
      event.command?.cwd === "C:/repo" &&
      event.command?.exitCode === 0 &&
      event.command?.durationMs === 1250 &&
      event.command?.stdoutPreview === "Build completed",
    "command payload extracts command, args, cwd, exit code, duration, and stdout preview."
  );
}

function checkCommandFailureExitCode() {
  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "python",
    status: "completed",
    payload: {
      command: "python -m pytest",
      return_code: 2,
      stderr: "tests failed"
    }
  }, { id: "command-failure" });

  record(
    "command-failure-exit-code",
    event.type === "command" &&
      event.status === "failed" &&
      event.title === "Command failed" &&
      event.command?.exitCode === 2 &&
      event.command?.stderrPreview === "tests failed",
    "non-zero command exit code maps completed tool payloads to failed command activity."
  );
}

function checkCommandOutputRedaction() {
  const longOutput = `${"line\n".repeat(400)}Authorization: Bearer abc123`;
  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "shell",
    status: "completed",
    payload: {
      command: "echo secret",
      stdout: longOutput,
      stderr: "token=Bearer abc123"
    }
  }, { id: "command-redaction" });
  const serialized = JSON.stringify(event);

  record(
    "command-output-redaction",
    event.command?.stdoutPreview?.includes("... truncated") &&
      event.command?.stderrPreview === "token=Bearer [redacted]" &&
      serialized.includes("[redacted]") &&
      !serialized.includes("abc123"),
    "stdout/stderr previews are truncated and bearer-like secrets are redacted."
  );
}

function checkCommandSourceChannel() {
  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "bash",
    status: "started",
    payload: {
      channel: "telegram",
      command: "pwd"
    }
  }, { id: "command-channel" });

  record(
    "command-source-channel",
    event.type === "command" &&
      event.status === "running" &&
      event.command?.sourceChannel === "telegram",
    "command metadata preserves future source/channel labels without Telegram integration."
  );
}

function checkArtifactPayload() {
  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "write_file",
    status: "completed",
    payload: {
      artifact: {
        artifact_id: "artifact-1",
        action: "generated",
        mime_type: "text/markdown",
        path: "docs/report.md",
        size_bytes: 2048,
        title: "Report"
      },
      run_id: "run-artifact"
    }
  }, { id: "artifact-payload" });

  record(
    "artifact-payload",
    event.artifact?.artifactId === "artifact-1" &&
      event.artifact?.path === "docs/report.md" &&
      event.artifact?.mimeType === "text/markdown" &&
      event.artifact?.sizeBytes === 2048 &&
      event.artifact?.status === "completed",
    "artifact-shaped tool payloads are preserved for Files rail mapping."
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

function checkApprovalRequested() {
  const event = activity.createActivityEventFromHermesApprovalEvent({
    type: "approval_event",
    name: "approval.request",
    status: "request",
    payload: {
      approval_id: "approval-1",
      choices: ["once", "session", "always", "deny"],
      prompt: "Allow command npm test?",
      risk_level: "medium",
      run_id: "run-approval"
    }
  }, { id: "approval-requested", now: "2026-05-30T00:00:00.000Z" });

  record(
    "approval-requested",
    event.type === "approval" &&
      event.status === "waiting_for_approval" &&
      event.title === "Approval required" &&
      event.approval?.approvalId === "approval-1" &&
      event.approval?.actionAvailable === false &&
      event.approval?.unavailableReason === "Approval action unavailable in current stream path",
    "approval.request maps to a waiting display-only approval event."
  );
}

function checkApprovalResponded() {
  const event = activity.createActivityEventFromHermesApprovalEvent({
    type: "approval_event",
    name: "approval.responded",
    status: "responded",
    payload: {
      choice: "once",
      resolved: 1,
      run_id: "run-approval"
    }
  }, { id: "approval-responded", now: "2026-05-30T00:00:05.000Z" });

  record(
    "approval-responded",
    event.type === "approval" &&
      event.status === "completed" &&
      event.title === "Approval responded" &&
      event.approval?.decision === "once",
    "approval.responded maps to a completed approval event with the chosen response."
  );
}

function checkApprovalDenied() {
  const event = activity.createActivityEventFromHermesRunEvent({
    type: "run_event",
    name: "approval.responded",
    status: "deny",
    payload: {
      event: "approval.responded",
      choice: "deny",
      run_id: "run-denied"
    }
  }, { id: "approval-denied" });

  record(
    "approval-denied",
    event.type === "approval" &&
      event.status === "cancelled" &&
      event.approval?.decision === "deny",
    "denied approval responses stay visible as cancelled approval activity."
  );
}

function checkApprovalWithoutId() {
  const event = activity.createActivityEventFromHermesApprovalEvent({
    type: "approval_event",
    name: "approval.request",
    status: "request",
    payload: {
      Authorization: "Bearer abc123",
      message: "Approval needs Bearer abc123",
      run_id: "run-no-id"
    }
  }, { id: "approval-no-id" });

  const serialized = JSON.stringify(event);
  record(
    "approval-without-id",
    event.type === "approval" &&
      event.status === "waiting_for_approval" &&
      event.approval?.approvalId === undefined &&
      event.summary === "Approval needs Bearer [redacted]" &&
      serialized.includes("[redacted]") &&
      !serialized.includes("abc123"),
    "approval events remain display-only and redacted even when Hermes omits an approval id."
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
