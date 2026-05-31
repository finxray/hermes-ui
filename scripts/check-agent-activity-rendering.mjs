#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(process.cwd());
const componentPath = resolve(root, "apps/web/src/components/chat/AgentActivityBlock.tsx");
const composerPath = resolve(root, "apps/web/src/components/chat/Composer.tsx");
const cssPath = resolve(root, "apps/web/src/components/chat/AgentActivityBlock.module.css");
const chatViewPath = resolve(root, "apps/web/src/components/chat/ChatView.tsx");
const appShellPath = resolve(root, "apps/web/src/components/shell/AppShell.tsx");
const helperPath = resolve(root, "apps/web/src/lib/agentActivityEvents.ts");
const replayHelperPath = resolve(root, "apps/web/src/lib/persistedActivityReplay.ts");
const memoryTimelinePath = resolve(root, "apps/web/src/lib/memoryTimeline.ts");
const memoryConsolePath = resolve(root, "apps/web/src/components/memory/BrainMemoryConsole.tsx");
const checks = [];

checkFilesExist();
checkComponentSource();
await checkHelperBehavior();

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? "[ok]" : "[!!]"} ${check.name}: ${check.message}`);
}

if (failed.length > 0) {
  console.error("");
  console.error(`Agent activity rendering checks failed: ${failed.length}`);
  process.exit(1);
}

console.log("");
console.log(`Agent activity rendering checks passed: ${checks.length}`);

function checkFilesExist() {
  record("component-exists", existsSync(componentPath), "AgentActivityBlock component file exists.");
  record("composer-exists", existsSync(composerPath), "Composer component file exists.");
  record("css-exists", existsSync(cssPath), "AgentActivityBlock CSS module exists.");
  record("memory-timeline-helper-exists", existsSync(memoryTimelinePath), "Memory timeline helper file exists.");
  record("persisted-replay-helper-exists", existsSync(replayHelperPath), "Persisted activity replay helper file exists.");
  record("memory-console-exists", existsSync(memoryConsolePath), "Brain Memory console component file exists.");
}

function checkComponentSource() {
  if (!existsSync(componentPath) || !existsSync(cssPath)) {
    return;
  }
  const component = readFileSync(componentPath, "utf8");
  const appShell = readFileSync(appShellPath, "utf8");
  const chatView = readFileSync(chatViewPath, "utf8");
  const composer = readFileSync(composerPath, "utf8");
  const memoryConsole = readFileSync(memoryConsolePath, "utf8");
  const memoryTimeline = readFileSync(memoryTimelinePath, "utf8");
  const persistedReplay = readFileSync(replayHelperPath, "utf8");
  const css = readFileSync(cssPath, "utf8");

  record(
    "collapsed-details",
    component.includes("<details") && component.includes("<summary") && !component.includes("open={"),
    "Activity blocks use native details/summary and stay collapsed by default."
  );
  record(
    "thinking-row",
    component.includes("Thinking...") && css.includes("activityShimmer"),
    "Thinking/running row has a generic label and shimmer styling."
  );
  record(
    "no-private-reasoning-labels",
    !component.includes("chain-of-thought") &&
      !component.includes("private reasoning") &&
      !component.includes("reasoning summary"),
    "Activity block source does not render private reasoning or chain-of-thought labels."
  );
  record(
    "specific-running-suppresses-generic-thinking",
    existsSync(chatViewPath) &&
      chatView.includes("!hasRunningActivity") &&
      chatView.includes("makeElapsedActivityEvent") &&
      chatView.includes("makeStoppedActivityEvent"),
    "Chat view lets specific running activity replace generic Thinking and appends elapsed/stopped markers."
  );
  record(
    "stream-delta-batching",
    chatView.includes("accumulated += event.delta") &&
      chatView.includes("window.requestAnimationFrame") &&
      composer.includes("not one React update per token"),
    "Chat view buffers deltas and flushes assistant text on animation frames."
  );
  record(
    "model-selection-not-faked",
    chatView.includes("providerModelState.clientSelectable ? providerModelState.selectedModelId : null") &&
      composer.includes("Provider and model selector disabled") &&
      composer.includes("Runtime model switching is not verified"),
    "Provider/model control stays disabled and does not send a placeholder model id."
  );
  record(
    "stop-button-accessibility",
    composer.includes("Stop generation") &&
      composer.includes('type={isGenerating ? "button" : "submit"}') &&
      composer.includes("onStop?.()"),
    "Composer exposes an enabled stop-generation button during active streaming."
  );
  record(
    "metadata-rendering",
    component.includes("projectKey") &&
      component.includes("sessionKey") &&
      component.includes("primary.approval?.approvalId") &&
      component.includes("safeJson"),
    "Component renders scope/approval metadata and compact JSON details."
  );
  record(
    "command-detail-rendering",
    component.includes("extractCommandDetails") &&
      component.includes("CommandDetails") &&
      component.includes("stdoutPreview") &&
      component.includes("stderrPreview") &&
      component.includes("exitCode") &&
      css.includes(".commandDetails") &&
      css.includes(".outputBlock"),
    "Command activity blocks render structured command metadata and stdout/stderr previews."
  );
  record(
    "command-right-rail-summary",
    contextRailHasRecentCommands(),
    "Tools rail exposes a compact Recent commands section with an honest empty state."
  );
  record(
    "run-history-persisted-replay",
    contextRailHasPersistedReplay() &&
      persistedReplay.includes("createPersistedActivityEvent") &&
      persistedReplay.includes("MAX_PERSISTED_ACTIVITY_EVENTS_PER_RUN") &&
      persistedReplay.includes("restoreActivityEventFromPersisted") &&
      persistedReplay.includes("createSessionExportPreview"),
    "Run history exposes persisted replay and helper supports compact replay/export shapes."
  );
  record(
    "export-preview-display-only",
    contextRailHasExportPreview(),
    "Context rail exposes a collapsed local export preview without download, filesystem, or network behavior."
  );
  record(
    "persisted-replay-no-rerun",
    !persistedReplay.includes("fetch(") &&
      !persistedReplay.includes("exec(") &&
      !persistedReplay.includes("localStorage") &&
      !persistedReplay.includes("dangerouslySetInnerHTML"),
    "Persisted replay helper is local shape logic only, with no network, storage, execution, or unsafe HTML."
  );
  record(
    "memory-timeline-right-rail",
    memoryConsole.includes("Memory activity") &&
      memoryConsole.includes("No memory activity in this session yet.") &&
      memoryConsole.includes("createMemoryTimelineItems") &&
      memoryConsole.includes("Redacted details"),
    "Brain Memory console renders an honest session memory activity timeline and empty state."
  );
  record(
    "memory-timeline-derived-not-persisted",
      appShell.includes("activityEvents={activeActivityEvents}") &&
      appShell.includes("setActivityEventsBySession") &&
      memoryConsole.includes("activityEvents: AgentActivityEvent[]") &&
      memoryTimeline.includes("function createMemoryTimelineItems") &&
      !memoryTimeline.includes("localStorage") &&
      !memoryTimeline.includes("fetch("),
    "Memory timeline is derived from normalized activity events without persistence or direct network calls."
  );
  record(
    "memory-timeline-display-only",
    memoryConsole.includes("canInspectMemory") &&
      !memoryConsole.includes("deleteMemory") &&
      !memoryConsole.includes("updateMemory") &&
      !memoryConsole.includes("supersede") &&
      !memoryConsole.includes("pinMemory"),
    "Memory timeline remains display-only except optional read-only inspect detail."
  );
  record(
    "approval-display-only",
    component.includes("Approval action unavailable in current stream path") &&
      component.includes("ShieldAlert") &&
      !component.includes("onApprove") &&
      !component.includes("onReject"),
    "Approval activity renders as display-only until a BFF approval action route exists."
  );
  record(
    "status-styling",
      css.includes('data-status="running"') &&
      css.includes('data-status="failed"') &&
      css.includes('data-status="completed"') &&
      css.includes('data-status="cancelled"') &&
      css.includes('data-status="waiting_for_approval"'),
    "CSS includes running, failed, completed, cancelled, and approval-waiting status states."
  );
  record(
    "no-dangerous-html",
    !component.includes("dangerouslySetInnerHTML"),
    "Activity details are rendered without dangerouslySetInnerHTML."
  );
}

async function checkHelperBehavior() {
  const activity = await importHelperModule(helperPath);
  const replay = await importHelperModule(replayHelperPath);
  const memoryTimeline = await importHelperModule(memoryTimelinePath);
  record(
    "duration-format",
    activity.formatActivityDuration(500) === "<1s" &&
      activity.formatActivityDuration(73_000) === "1m 13s" &&
      activity.formatActivityDuration(3_723_000) === "1h 2m 3s",
    "Duration formatter supports subsecond, minute, and hour Worked for style labels."
  );

  const event = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "memory_search",
    status: "completed",
    payload: {
      Authorization: "Bearer abc123",
      preview: "Bearer abc123",
      project_key: "project-a",
      session_key: "session-a"
    }
  }, { id: "render-redaction" });

  const serialized = JSON.stringify(event);
  record(
    "redacted-details",
    event.summary === "Bearer [redacted]" &&
      serialized.includes("[redacted]") &&
      !serialized.includes("abc123"),
    "Rendered activity inputs keep secret-like values redacted."
  );

  const approval = activity.createActivityEventFromHermesApprovalEvent({
    type: "approval_event",
    name: "approval.request",
    status: "request",
    payload: {
      approval_id: "approval-1",
      message: "Allow action?",
      run_id: "run-approval"
    }
  }, { id: "render-approval" });

  record(
    "approval-helper",
    approval.type === "approval" &&
      approval.status === "waiting_for_approval" &&
      approval.approval?.actionAvailable === false,
    "Approval helper produces a waiting display-only activity event for rendering."
  );

  const runsDelta = activity.createActivityEventFromHermesRunsEvent({
    delta: "token",
    event: "message.delta",
    run_id: "run-render-runs"
  }, { id: "render-runs-delta" });
  const runsReasoning = activity.createActivityEventFromHermesRunsEvent({
    event: "reasoning.available",
    run_id: "run-render-runs",
    text: "do not render reasoning text"
  }, { id: "render-runs-reasoning" });
  const serializedReasoning = JSON.stringify(runsReasoning);

  record(
    "runs-event-helper-render-shape",
    runsDelta === null &&
      runsReasoning.type === "reasoning" &&
      runsReasoning.title === "Thinking signal received" &&
      runsReasoning.details.text === "[omitted: reasoning text not rendered]" &&
      !serializedReasoning.includes("do not render reasoning text"),
    "Runs event helper suppresses message deltas and renders reasoning.available as a safe public signal."
  );

  const command = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "run_command",
    status: "completed",
    payload: {
      channel: "cli",
      command: "npm test",
      cwd: "C:/repo",
      exitCode: 0,
      stderr: "",
      stdout: "ok"
    }
  }, { id: "render-command" });

  record(
    "command-helper-render-shape",
    command.type === "command" &&
      command.command?.command === "npm test" &&
      command.command?.cwd === "C:/repo" &&
      command.command?.stdoutPreview === "ok" &&
      command.command?.sourceChannel === "cli",
    "Command helper provides render-ready command metadata and source channel."
  );

  const failedCommand = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "powershell",
    status: "completed",
    payload: {
      command: "npm run build",
      exit_code: 1,
      stderr: "Authorization: Bearer abc123"
    }
  }, { id: "render-failed-command" });

  record(
    "command-helper-redaction-status",
    failedCommand.status === "failed" &&
      failedCommand.title === "Command failed" &&
      failedCommand.command?.stderrPreview === "Authorization: Bearer [redacted]" &&
      !JSON.stringify(failedCommand).includes("abc123"),
    "Failed command metadata is status-correct and redacted before rendering."
  );

  const persisted = replay.createPersistedActivityEvent(failedCommand, "run-render");
  const restored = replay.restoreActivityEventFromPersisted(persisted);
  const bounded = replay.limitPersistedActivityEvents(
    Array.from({ length: 45 }, (_, index) => ({ ...persisted, id: `persisted-${index}` }))
  );
  record(
    "persisted-replay-helper",
    persisted.command?.stderrPreview?.includes("[redacted]") &&
      !JSON.stringify(persisted).includes("abc123") &&
      restored.details?.replay === true &&
      bounded.length === 40,
    "Persisted replay helper redacts, restores display-only events, and bounds snapshots."
  );

  const memoryStore = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "memory_store",
    status: "completed",
    payload: {
      Authorization: "Bearer abc123",
      memory_id: "mem-13k",
      preview: "Stored safely",
      project_key: "project-a",
      session_key: "session-a"
    }
  }, { id: "timeline-store" });
  const memorySearch = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "memory_search",
    status: "completed",
    payload: {
      result_count: 2
    }
  }, { id: "timeline-search" });
  const memoryHealth = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "memory_health_check",
    status: "completed",
    payload: {}
  }, { id: "timeline-health" });
  const memoryUpdate = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "memory_update",
    status: "completed",
    payload: {}
  }, { id: "timeline-update" });
  const memoryDelete = activity.createActivityEventFromHermesToolEvent({
    type: "tool_event",
    name: "memory_delete",
    status: "completed",
    payload: {}
  }, { id: "timeline-delete" });

  const timelineItems = memoryTimeline.createMemoryTimelineItems(
    [memoryStore, memorySearch, memoryHealth, memoryUpdate, memoryDelete],
    { projectKey: "fallback-project", sessionKey: "fallback-session" }
  );
  const serializedTimeline = JSON.stringify(timelineItems);
  record(
    "memory-timeline-helper",
    timelineItems.length === 5 &&
      timelineItems[0].operation === "store" &&
      timelineItems[1].operation === "search" &&
      timelineItems[2].operation === "health_check" &&
      timelineItems[3].operation === "update" &&
      timelineItems[4].operation === "delete",
    "Memory timeline helper classifies store, search, health_check, update, and delete operations."
  );
  record(
    "memory-timeline-redaction",
    timelineItems[0].collapsedByDefault === true &&
      serializedTimeline.includes("[redacted]") &&
      !serializedTimeline.includes("abc123"),
    "Memory timeline details stay collapsed and redacted."
  );
  record(
    "memory-timeline-empty-safe",
    memoryTimeline.createMemoryTimelineItems([]).length === 0 &&
      memoryTimeline.summarizeMemoryTimeline([]).total === 0,
    "Memory timeline helper is safe without live Brain Memory Gateway events."
  );
}

async function importHelperModule(path) {
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false
    },
    fileName: path
  });

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputText).toString("base64")}`;
  return import(moduleUrl);
}

function record(name, ok, message) {
  checks.push({ message, name, ok });
}

function contextRailHasRecentCommands() {
  const contextRailPath = resolve(root, "apps/web/src/components/shell/ContextRail.tsx");
  if (!existsSync(contextRailPath)) {
    return false;
  }
  const contextRail = readFileSync(contextRailPath, "utf8");
  return (
    contextRail.includes("Recent commands") &&
    contextRail.includes("No command activity in this session yet.") &&
    contextRail.includes("extractCommandDetails") &&
    contextRail.includes("CommandActivityRow") &&
    !contextRail.includes("exec(")
  );
}

function contextRailHasPersistedReplay() {
  const contextRailPath = resolve(root, "apps/web/src/components/shell/ContextRail.tsx");
  if (!existsSync(contextRailPath)) {
    return false;
  }
  const contextRail = readFileSync(contextRailPath, "utf8");
  return (
    contextRail.includes("Persisted replay") &&
    contextRail.includes("No persisted activity replay for this run") &&
    contextRail.includes("createRunReplaySummary") &&
    contextRail.includes("PersistedReplayList") &&
    !contextRail.includes("fetch(") &&
    !contextRail.includes("exec(")
  );
}

function contextRailHasExportPreview() {
  const contextRailPath = resolve(root, "apps/web/src/components/shell/ContextRail.tsx");
  if (!existsSync(contextRailPath)) {
    return false;
  }
  const contextRail = readFileSync(contextRailPath, "utf8");
  return (
    contextRail.includes("ExportPreviewSection") &&
    contextRail.includes("createSessionExportPreview") &&
    contextRail.includes("Local preview only") &&
    contextRail.includes("<details") &&
    !contextRail.includes("navigator.clipboard") &&
    !contextRail.includes("URL.createObjectURL") &&
    !contextRail.includes("download=") &&
    !contextRail.includes("fetch(") &&
    !contextRail.includes("exec(")
  );
}
