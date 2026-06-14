#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = resolve(process.cwd());
const componentPath = resolve(root, "apps/web/src/components/chat/AgentActivityBlock.tsx");
const composerPath = resolve(root, "apps/web/src/components/chat/Composer.tsx");
const cssPath = resolve(root, "apps/web/src/components/chat/AgentActivityBlock.module.css");
const chatViewPath = resolve(root, "apps/web/src/components/chat/ChatView.tsx");
const chatTranscriptPath = resolve(root, "apps/web/src/components/chat/ChatTranscript.tsx");
const liveTokenTickerPath = resolve(root, "apps/web/src/components/chat/LiveTokenUsageTicker.tsx");
const liveTokenTickerCssPath = resolve(root, "apps/web/src/components/chat/LiveTokenUsageTicker.module.css");
const messageMarkdownCssPath = resolve(root, "apps/web/src/components/chat/MessageMarkdown.module.css");
const messageBubbleCssPath = resolve(root, "apps/web/src/components/chat/MessageBubble.module.css");
const shimmerCssPath = resolve(root, "apps/web/src/components/chat/ShimmerStatusText.module.css");
const streamingBodyPath = resolve(root, "apps/web/src/components/chat/StreamingAssistantBody.tsx");
const streamStatusPath = resolve(root, "apps/web/src/lib/streamStatus.ts");
const appShellPath = resolve(root, "apps/web/src/components/shell/AppShell.tsx");
const helperPath = resolve(root, "apps/web/src/lib/agentActivityEvents.ts");
const hermesClientPackagePath = resolve(root, "packages/hermes-client/src/index.ts");
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
  const agentActivity = readFileSync(helperPath, "utf8");
  const hermesClientPackage = readFileSync(hermesClientPackagePath, "utf8");

  record(
    "no-legacy-run-completed-row",
    !component.includes("Run Completed") && !component.includes("CheckCircle2"),
    "Chat transcript activity UI does not render legacy Run Completed icon rows."
  );
  const streamingBody = existsSync(streamingBodyPath) ? readFileSync(streamingBodyPath, "utf8") : "";
  const streamStatus = existsSync(streamStatusPath) ? readFileSync(streamStatusPath, "utf8") : "";
  const shimmerCss = existsSync(shimmerCssPath) ? readFileSync(shimmerCssPath, "utf8") : "";
  const messageMarkdownCss = existsSync(messageMarkdownCssPath) ? readFileSync(messageMarkdownCssPath, "utf8") : "";
  const messageBubbleCss = existsSync(messageBubbleCssPath) ? readFileSync(messageBubbleCssPath, "utf8") : "";
  const chatTranscript = existsSync(chatTranscriptPath) ? readFileSync(chatTranscriptPath, "utf8") : "";
  const liveTokenTicker = existsSync(liveTokenTickerPath) ? readFileSync(liveTokenTickerPath, "utf8") : "";
  const liveTokenTickerCss = existsSync(liveTokenTickerCssPath) ? readFileSync(liveTokenTickerCssPath, "utf8") : "";

  record(
    "stream-status-shimmer",
    streamingBody.includes("ShimmerStatusText") &&
      streamStatus.includes("activeEventTarget") &&
      streamStatus.includes('withDetail("Thinking"') &&
      streamStatus.includes('withDetail("Searching"') &&
      streamStatus.includes('withDetail("Editing"') &&
      streamStatus.includes('withDetail("Running"') &&
      shimmerCss.includes("shimmerTextPulse") &&
      messageBubbleCss.includes('data-phase="exit"'),
    "Streaming assistant shows specific shimmering status labels with inline targets and fades status without layout jump."
  );
  record(
    "worked-and-command-details",
    component.includes("AnimatedDisclosure") &&
      component.includes("Worked for") &&
      component.includes("Ran ") &&
      component.includes("<ActivityTimeline allowActiveState items={items} />") &&
      component.includes("<ActivityTimeline items={items} />") &&
      component.includes("allowActiveState && commandItems.some(commandItemIsActive)") &&
      component.includes("allowActiveState && isActiveActivityStatus(event.status)") &&
      component.includes("commandItemRowLabel(item, allowActiveState)") &&
      component.includes("ChevronRight") &&
      component.includes("styles.workedChevron") &&
      component.indexOf("styles.workedLabel") < component.indexOf("styles.workedChevron") &&
      component.includes("commandIconChevron") &&
      component.includes("buildCommandItems") &&
      css.includes(".disclosureBody") &&
      css.includes('data-open="true"') &&
      css.includes('.workedBlock[data-type="completed-work"][data-open="true"] .workedChevron') &&
      css.includes("transform: rotate(90deg)") &&
      css.includes("margin-left: 4px") &&
      !css.includes("margin-left: auto") &&
      !css.includes("transform: translateX(-2px)") &&
      css.includes("grid-template-rows 320ms") &&
      css.includes(".commandItems") &&
      css.includes(".commandSummary:hover .commandLabel"),
    "Completed runs expose animated Worked and Ran command disclosures, with the Worked chevron trailing, visible after completion, and rotated down while open."
  );
  record(
    "worked-auto-collapse-after-final-reveal",
    component.includes("COMPLETED_WORK_AUTO_COLLAPSE_DELAY_MS = 1000") &&
      component.includes("completedWorkAutoCollapseDelayMs") &&
      chatTranscript.includes("assistantRevealComplete") &&
      chatTranscript.includes("autoCollapseCompletedWork={!activityIsWorking && assistantRevealComplete}") &&
      !chatTranscript.includes("FINALIZING_WORK_AUTO_COLLAPSE_DELAY_MS") &&
      !chatView.includes("FINAL_ACTIVITY_PREFOLD_MS") &&
      chatView.includes("completePendingAssistantMessage") &&
      css.includes("grid-template-rows 1400ms") &&
      css.includes("cubic-bezier(0.42, 0, 0.2, 1)") &&
      css.includes("ease-in-out") &&
      chatTranscript.includes("startActivityCollapseAnchorLock(COMPLETED_WORK_ANCHOR_LOCK_MS)") &&
      chatTranscript.includes("ResizeObserver") &&
      chatTranscript.includes("viewport.scrollTop = Math.max(0, viewport.scrollTop + delta)"),
    "Completed Worked details wait for the assistant reveal to finish, then fold after 1s with ease-in-out motion while the transcript compensates height loss above the answer."
  );
  record(
    "transcript-session-bottom-snap",
    chatTranscript.includes("if (sessionChanged)") &&
      chatTranscript.includes("needsBottomSnapRef.current = true") &&
      chatTranscript.includes('scrollToBottom("auto")') &&
      !chatTranscript.includes("TRANSCRIPT_SCROLL_STORAGE_PREFIX") &&
      !chatTranscript.includes("readTranscriptScrollTop"),
    "Transcript opens each chat at the latest message instead of restoring a stale scroll offset."
  );
  record(
    "transcript-smooth-bottom-follow",
    chatTranscript.includes("scheduleBottomFollow") &&
      chatTranscript.includes("bottomFollowPassesRef") &&
      chatTranscript.includes("window.requestAnimationFrame(follow)") &&
      chatTranscript.includes("shouldShowAgentActivityBlock") &&
      chatTranscript.includes("hasSubstantialAssistantContent"),
    "Transcript delays activity rows until meaningful data and follows bottom layout changes on animation frames."
  );
  record(
    "transcript-activity-reveal-delay",
      chatTranscript.includes("ACTIVITY_REVEAL_DELAY_MS = 5_000") &&
      chatTranscript.includes("activityDelayElapsed") &&
      chatTranscript.includes("commandStartCount >= 2") &&
      chatTranscript.includes("isRunLifecycleNoiseEvent") &&
      component.includes("function isRunLifecycleNoiseEvent") &&
      chatTranscript.includes("hasLiveTokenUsage"),
    "Transcript delays noisy live activity, but shows live token usage immediately when available."
  );
  record(
    "worked-static-token-footer-size",
    css.includes(".tokenPart") &&
      css.includes("font-size: var(--font-xs)") &&
      css.includes("line-height: 1.35") &&
      css.includes("align-items: center"),
    "Static Worked token metadata uses completed-message footer sizing and tool icons sit on the text midline."
  );
  record(
    "activity-progress-body-text",
    css.includes(".commandLabel") &&
      css.includes("font-size: var(--font-body)") &&
      css.includes(".reasoningTitle") &&
      css.includes("font-size: var(--font-body)") &&
      !css.includes("opacity: 0.74"),
    "Activity progress rows match stream-status body text sizing without live dimming."
  );
  record(
    "live-token-digit-reel",
    liveTokenTicker.includes("RollingDigit") &&
      liveTokenTicker.includes("Math.sqrt(Math.abs(to - from))") &&
      liveTokenTickerCss.includes(".digitReel") &&
      liveTokenTickerCss.includes("transition: transform 680ms") &&
      !liveTokenTickerCss.includes("tokenDigitSettle"),
    "Live token usage uses slower transform-based per-digit reels instead of fast pop/fade digits."
  );
  record(
    "streaming-line-reveal",
    messageMarkdownCss.includes("markdownStreamLineReveal") &&
      messageMarkdownCss.includes("clip-path: inset(0 100% 0 0)") &&
      messageMarkdownCss.includes('data-streaming="true"') &&
      messageMarkdownCss.includes(":is(p, li, h1, h2, h3, h4, blockquote)") &&
      streamingBody.includes("useBufferedStreamingContent") &&
      streamingBody.includes("REVEAL_MAX_CHARS_PER_FRAME") &&
      streamingBody.includes("REVEAL_CATCHUP_FRACTION") &&
      streamingBody.includes("onRevealComplete"),
    "Streaming markdown reveals smoothly left-to-right through a frame-paced buffered display layer that stays independent of how long the model paused between bursts."
  );
  record(
    "live-token-activity-strip",
    component.includes("LiveTokenUsageTicker") &&
      component.includes('variant="activity"') &&
      chatTranscript.includes("liveTokenUsage") &&
      chatView.includes("authoritativePromptTokensRef") &&
      chatView.includes("authoritativeCompletionTokensRef") &&
      chatView.includes("LIVE_TOKEN_ESTIMATE_INTERVAL_MS") &&
      chatView.includes("ESTIMATED_THINKING_OUTPUT_TOKENS_PER_SECOND") &&
      chatView.includes("estimatedActivityChars"),
    "Live token usage is visible in the activity strip and estimated output advances during thinking/tool activity until authoritative usage arrives."
  );
  record(
    "working-activity-list-stable",
    component.includes("function WorkingLog") &&
      component.includes("LiveTokenUsageTicker") &&
      component.includes("liveProgressBody") &&
      component.includes("buildLiveTimelineItems"),
    "The live Working block keeps token/header state while rendering bounded Codex-like progress blocks."
  );
  record(
    "public-reasoning-summary-events",
    agentActivity.includes("isPublicReasoningEventType") &&
      agentActivity.includes("public_reasoning_summary") &&
      agentActivity.includes("rawReasoningTextRendered: includesReasoningText") &&
      hermesClientPackage.includes("reasoning.summary.delta") &&
      hermesClientPackage.includes("publicReasoningSummaryFromSummaryEvent") &&
      hermesClientPackage.includes("pickStreamCorrelationFields"),
    "Public reasoning-summary events are normalized into ordered Thinking blocks while raw reasoning remains omitted."
  );
  record(
    "informative-live-command-labels",
    component.includes("commandItemIsActive") &&
      component.includes("Running") &&
      streamStatus.includes("activeEventTarget") &&
      streamStatus.includes("withDetail(\"Running\"") &&
      streamStatus.includes("withDetail(\"Reading\""),
    "Live status and command rows include active command/file targets instead of vague Running labels."
  );
  record(
    "activity-inline-reveal",
    css.includes("activityInlineReveal") &&
      css.includes("clip-path: inset(0 100% 0 0)") &&
      css.includes(".commandSummary") &&
      css.includes(".commandItemSummary") &&
      css.includes(".reasoningChunk"),
    "Command and reasoning rows use a fast left-to-right reveal as they arrive."
  );
  record(
    "no-private-reasoning-labels",
    !component.includes("chain-of-thought") &&
      !component.includes("private reasoning") &&
      !component.includes("reasoning summary"),
    "Activity block source does not render private reasoning or chain-of-thought labels."
  );
  record(
    "running-indicator-lifecycle",
    existsSync(chatViewPath) &&
      !chatView.includes("isRunning=") &&
      streamStatus.includes("latestCurrentActiveEvent") &&
      streamStatus.includes("hasLaterTerminalEvent") &&
      streamStatus.includes("labelForActiveEvent") &&
      chatTranscript.includes("resolveStreamStatusLabel") &&
      chatView.includes("makeElapsedActivityEvent") &&
      chatView.includes("makeStoppedActivityEvent"),
    "Thinking shows while waiting; active operations get specific labels without stale completed events keeping Running alive."
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
    chatView.includes("model: modelRequest?.selectModelId ?? null") &&
      composer.includes("canSelectModel") &&
      composer.includes("disabled={!canSelectModel}"),
    "Model selection flows through the verified session pipeline and never sends a placeholder model id."
  );
  record(
    "stop-button-accessibility",
    composer.includes("Stop generation") &&
      composer.includes('type={isGenerating ? "button" : "submit"}') &&
      composer.includes("onStop?.()"),
    "Composer exposes an enabled stop-generation button during active streaming."
  );
  record(
    "activity-helper-still-available",
    existsSync(helperPath) &&
      readFileSync(helperPath, "utf8").includes("extractCommandDetails") &&
      readFileSync(helperPath, "utf8").includes("formatActivityDuration"),
    "Activity normalization helpers remain available for rails and replay even though chat hides completed rows."
  );
  record(
    "command-right-rail-summary",
    contextRailHasRecentCommands(),
    "Tools rail exposes a compact Recent commands section with an honest empty state."
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
    !component.includes("onApprove") &&
      !component.includes("onReject") &&
      existsSync(helperPath) &&
      readFileSync(helperPath, "utf8").includes("approval"),
    "Chat activity UI stays display-only; approval handling remains in helpers/rails."
  );
  record(
    "status-styling",
    shimmerCss.includes(".shimmerText") &&
      messageBubbleCss.includes("streamContentReveal") &&
      messageBubbleCss.includes("streamTrailingStatus"),
    "Stream status uses text shimmer, a trailing active line, and a gentle content reveal transition."
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
    activity.formatActivityDuration(500) === "1s" &&
      activity.formatActivityDuration(73_000) === "1m 13s" &&
      activity.formatActivityDuration(3_723_000) === "1h 2m 3s",
    "Duration formatter floors sub-second runs to 1s and supports minute and hour Worked for style labels."
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
      runsReasoning.title === "Thinking" &&
      runsReasoning.summary === "Hermes emitted a reasoning progress signal. Private reasoning text is not rendered." &&
      runsReasoning.details.text === "[omitted: reasoning text not rendered]" &&
      !serializedReasoning.includes("do not render reasoning text"),
    "Runs event helper suppresses message deltas and renders reasoning progress as a safe public signal."
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
