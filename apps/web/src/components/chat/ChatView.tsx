import { AlertTriangle, BookOpenText, SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { useComposerInset } from "@/hooks/useComposerInset";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatTranscript } from "@/components/chat/ChatTranscript";
import { Composer } from "@/components/chat/Composer";
import {
  computeRunElapsed,
  createActivityEventFromHermesStreamEvent,
  makeElapsedActivityEvent,
  makeStoppedActivityEvent
} from "@/lib/agentActivityEvents";
import { streamHermesChatFromBff } from "@/lib/hermesChatClient";
import {
  createPersistedActivityEvent,
  limitPersistedActivityEvents
} from "@/lib/persistedActivityReplay";
import { DEFAULT_USER_DISPLAY_NAME, WORKSPACE_STORAGE_VERSION } from "@/lib/workspaceStore";
import type { HermesUiCapabilities, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type {
  ChatMessage,
  ModelChoice,
  PersistedActivityEvent,
  Project,
  RunActivitySummary,
  RunRecord,
  Session,
  ToolEvent
} from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
import type { AgentActivityEvent } from "@/types/agentActivity";
import styles from "./ChatView.module.css";

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];
type ActivityRecorder = (sessionId: string, event: AgentActivityEvent) => void;

type ChatViewProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  createSession: () => void;
  hermesStatus: NormalizedHermesStatus | null;
  isHermesStatusLoading: boolean;
  modelChoices: ModelChoice[];
  onActivityEvent: (sessionId: string, event: AgentActivityEvent) => void;
  workspaceActions: WorkspaceActions;
};

export function ChatView({
  activeProject,
  activeSession,
  activityEvents,
  createSession,
  hermesStatus,
  isHermesStatusLoading,
  modelChoices,
  onActivityEvent,
  workspaceActions
}: ChatViewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStopRequested, setIsStopRequested] = useState(false);
  const [assistantHasContent, setAssistantHasContent] = useState(false);
  const activeStreamControllerRef = useRef<AbortController | null>(null);
  const flushFrameRef = useRef<number | null>(null);
  const stopRequestedRef = useRef(false);
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const isStartState = Boolean(activeSession && activeSession.messages.length === 0);
  const composerInsetPx = useComposerInset(composerWrapRef, !isStartState);
  const providerModelState = getProviderModelState(hermesStatus, modelChoices);
  const modelLabel = modelLabelForState(providerModelState);
  const composerContextItems = activeSession
    ? [
        { label: "Workspace", value: "hermes-ui" },
        { label: "Project", value: activeProject.name },
        { label: "Session", value: activeSession.title },
        { label: "Scope", value: activeProject.memoryScope.stableProjectKey },
        { label: "Route", value: "Browser -> BFF -> Hermes" }
      ]
    : [
        { label: "Workspace", value: "hermes-ui" },
        { label: "Project", value: activeProject.name },
        { label: "Route", value: "Select or create a chat" }
      ];

  async function handleSend(content: string) {
    if (!activeSession || isGenerating) {
      return;
    }

    const session = activeSession;
    const userMessage = createMessage("user", DEFAULT_USER_DISPLAY_NAME, content, "complete");
    const assistantId = `msg-${crypto.randomUUID()}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      author: "Hermes",
      createdAt: currentTimeLabel(),
      content: "",
      status: "streaming"
    };
    const runRecordId = `run-${crypto.randomUUID()}`;
    const runStartedAt = new Date().toISOString();
    let runActivityIds: string[] = [];
    let runActivityReplay: PersistedActivityEvent[] = [];
    let runSummary = makeEmptyRunActivitySummary();
    let hermesRunId: string | undefined;

    const updateRunRecord = (patch: Partial<RunRecord>) => {
      workspaceActions.updateRunRecord(session.id, runRecordId, patch);
    };

    const recordRunActivity: ActivityRecorder = (sessionId, activityEvent) => {
      appendActivityEvent(sessionId, activityEvent);
      runActivityIds = [...new Set([...runActivityIds, activityEvent.id])].slice(-80);
      runActivityReplay = limitPersistedActivityEvents([
        ...runActivityReplay,
        createPersistedActivityEvent(activityEvent, runRecordId)
      ]);
      runSummary = addActivityToRunSummary(runSummary, activityEvent);
      hermesRunId = activityEvent.hermes?.runId || hermesRunId;
      updateRunRecord({
        activityEventIds: runActivityIds,
        activityReplay: runActivityReplay,
        activitySummary: runSummary,
        hermesRunId
      });
    };

    workspaceActions.appendMessage(session.id, userMessage);
    workspaceActions.appendMessage(session.id, assistantMessage);
    workspaceActions.appendRunRecord(session.id, {
      id: runRecordId,
      projectId: activeProject.id,
      sessionId: session.id,
      hermesSessionId: session.hermesSessionId,
      userMessageId: userMessage.id,
      assistantMessageId: assistantId,
      sourceChannel: "web-ui",
      status: "running",
      startedAt: runStartedAt,
      modelLabel: providerModelState.currentModelLabel,
      providerLabel: providerModelState.currentProviderLabel,
      summary: summarizeRunPrompt(content),
      activityEventIds: [],
      activityReplay: [],
      activitySummary: runSummary
    });
    setAssistantHasContent(false);
    setIsGenerating(true);
    setIsStopRequested(false);
    stopRequestedRef.current = false;

    if (!canUseRealHermes(hermesStatus)) {
      const fallback = mockUnavailableResponse(hermesStatus, isHermesStatusLoading);
      workspaceActions.updateMessage(session.id, assistantId, fallback, "mock", [
        "Local mock fallback",
        "BFF boundary preserved"
      ]);
      const completedAt = new Date().toISOString();
      updateRunRecord({
        completedAt,
        durationMs: computeRunElapsed(runStartedAt, completedAt),
        activityReplay: runActivityReplay,
        status: "failed",
        summary: "Hermes unavailable; no real agent call was made."
      });
      setIsGenerating(false);
      setIsStopRequested(false);
      return;
    }

    const streamController = new AbortController();
    activeStreamControllerRef.current = streamController;
    let accumulated = "";
    let completedAssistant = false;
    let hadStreamError = false;

    const flush = (status: ChatMessage["status"] = "streaming", references?: string[]) => {
      if (flushFrameRef.current !== null) {
        return;
      }
      flushFrameRef.current = window.requestAnimationFrame(() => {
        flushFrameRef.current = null;
        workspaceActions.updateMessage(session.id, assistantId, accumulated, status, references);
      });
    };

    const streamResult = await streamHermesChatFromBff(
      {
        context: {
          project: {
            id: activeProject.id,
            title: activeProject.name,
            stableKey: activeProject.memoryScope.stableProjectKey,
            tenantId: activeProject.memoryScope.tenantId,
            retrievalProfile: activeProject.memoryScope.retrievalProfile,
            contextPolicy: activeProject.memoryScope.contextPolicy,
            pinnedMemoryIds: activeProject.memoryScope.pinnedMemoryIds,
            userVisibleSummary: activeProject.memoryScope.userVisibleSummary
          },
          session: {
            id: session.id,
            title: session.title,
            stableKey: session.memoryScope.stableSessionKey,
            hermesSessionId: session.hermesSessionId,
            includeProjectContext: session.memoryScope.includeProjectContext,
            includeSessionContext: session.memoryScope.includeSessionContext,
            lastContextRefreshAt: session.memoryScope.lastContextRefreshAt,
            userVisibleSummary: session.memoryScope.userVisibleSummary
          },
          ui: {
            source: "hermes-ui",
            workspaceVersion: WORKSPACE_STORAGE_VERSION
          }
        },
        message: content,
        model: providerModelState.clientSelectable ? providerModelState.selectedModelId : null,
        provider: null,
        recentMessages: session.messages.slice(-12).map((message) => ({
          role: message.role,
          content: message.content
        }))
      },
      {
        onEvent: (event) => {
          if (event.type === "message_delta") {
            accumulated += event.delta;
            if (event.delta.trim()) {
              setAssistantHasContent(true);
            }
            flush("streaming");
          } else if (event.type === "message_done") {
            completedAssistant = true;
            accumulated = event.message.content || accumulated;
            hermesRunId = event.runId || hermesRunId;
            updateRunRecord({ hermesRunId });
            if (accumulated.trim()) {
              setAssistantHasContent(true);
            }
            workspaceActions.updateMessage(session.id, assistantId, accumulated, "complete", [
              "Hermes session stream",
              activeProject.memoryScope.stableProjectKey
            ]);
          } else if (event.type === "tool_event" || event.type === "run_event" || event.type === "approval_event") {
            const activityEvent = createActivityEventFromHermesStreamEvent(event, {
              now: new Date().toISOString()
            });
            if (activityEvent) {
              recordRunActivity(session.id, activityEvent);
              workspaceActions.appendToolEvent(session.id, toToolEvent(activityEvent));
            }
          } else if (event.type === "error") {
            hadStreamError = true;
            accumulated = event.error.message;
            setAssistantHasContent(true);
            const activityEvent = createActivityEventFromHermesStreamEvent(event, {
              now: new Date().toISOString()
            });
            if (activityEvent) {
              recordRunActivity(session.id, activityEvent);
            }
            workspaceActions.updateMessage(session.id, assistantId, accumulated, "error", [
              "Hermes stream error"
            ]);
          }
        },
        signal: streamController.signal
      }
    );

    if (activeStreamControllerRef.current === streamController) {
      activeStreamControllerRef.current = null;
    }

    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }

    const completedAt = new Date().toISOString();
    if (streamResult === "aborted" || stopRequestedRef.current) {
      finalizeStoppedStream(
        session.id,
        assistantId,
        accumulated,
        runStartedAt,
        completedAt,
        recordRunActivity
      );
      updateRunRecord({
        completedAt,
        durationMs: computeRunElapsed(runStartedAt, completedAt),
        activityReplay: runActivityReplay,
        status: "stopped",
        stoppedByUser: true,
        summary: accumulated.trim()
          ? "Stopped by user after receiving partial assistant output."
          : "Stopped by user before assistant output."
      });
      setAssistantHasContent(true);
      setIsGenerating(false);
      setIsStopRequested(false);
      stopRequestedRef.current = false;
      return;
    }

    if (!completedAssistant && !hadStreamError && accumulated) {
      workspaceActions.updateMessage(session.id, assistantId, accumulated, "complete", [
        "Hermes session stream"
      ]);
    } else if (!completedAssistant && !hadStreamError && !accumulated) {
      workspaceActions.updateMessage(
        session.id,
        assistantId,
        "Hermes finished without returning assistant text.",
        "error",
        ["Hermes stream"]
      );
    }

    appendElapsedActivityEvent(session.id, runStartedAt, completedAt, recordRunActivity);
    updateRunRecord({
      completedAt,
      durationMs: computeRunElapsed(runStartedAt, completedAt),
      activityReplay: runActivityReplay,
      status: hadStreamError ? "failed" : "completed",
      summary: hadStreamError
        ? "Hermes stream failed."
        : accumulated.trim()
          ? summarizeRunPrompt(accumulated)
          : "Hermes completed without assistant text."
    });
    setIsGenerating(false);
    setIsStopRequested(false);
    stopRequestedRef.current = false;
  }

  function handleStop() {
    if (!isGenerating || isStopRequested) {
      return;
    }
    stopRequestedRef.current = true;
    setIsStopRequested(true);
    activeStreamControllerRef.current?.abort();
  }

  function appendActivityEvent(sessionId: string, event: AgentActivityEvent) {
    onActivityEvent(sessionId, event);
  }

  function appendElapsedActivityEvent(
    sessionId: string,
    startedAt: string,
    completedAt: string,
    recorder: ActivityRecorder = appendActivityEvent
  ) {
    const durationMs = computeRunElapsed(startedAt, completedAt);
    if (typeof durationMs !== "number") {
      return;
    }
    recorder(
      sessionId,
      makeElapsedActivityEvent({
        completedAt,
        durationMs,
        id: `elapsed-${assistantSafeId(sessionId)}-${completedAt}`,
        source: "ui",
        startedAt
      })
    );
  }

  function finalizeStoppedStream(
    sessionId: string,
    assistantId: string,
    content: string,
    startedAt: string,
    stoppedAt: string,
    recorder: ActivityRecorder = appendActivityEvent
  ) {
    const durationMs = computeRunElapsed(startedAt, stoppedAt);
    const finalContent = content.trim()
      ? content
      : "Stopped before Hermes returned assistant text.";
    workspaceActions.updateMessage(sessionId, assistantId, finalContent, "complete", [
      "Stopped by user",
      "Client-side stream abort"
    ]);
    recorder(
      sessionId,
      makeStoppedActivityEvent({
        details: {
          serverSideRunStop: false
        },
        durationMs,
        id: `stopped-${assistantSafeId(sessionId)}-${stoppedAt}`,
        source: "ui",
        startedAt,
        stoppedAt
      })
    );
    appendElapsedActivityEvent(sessionId, startedAt, stoppedAt, recorder);
  }

  const activeActivityEvents = activeSession ? activityEvents : [];
  const latestActivityEvent = activeActivityEvents.at(-1);
  const hasRunningActivity = latestActivityEvent ? isActiveActivityEvent(latestActivityEvent) : false;

  return (
    <section
      className={styles.workspace}
      data-start-state={isStartState ? "true" : "false"}
      aria-label="Chat workspace"
    >
      <ChatHeader title={activeSession?.title ?? "No chat selected"} />
      {isStartState ? (
        <div className={styles.startStage}>
          <ChatTranscript
            activeProject={activeProject}
            activeSession={activeSession}
            activityEvents={activeActivityEvents}
            bannerIcon={<AlertTriangle size={15} />}
            composerInsetPx={composerInsetPx}
            createSession={createSession}
            isStartState
            isThinking={isGenerating && !assistantHasContent && !hasRunningActivity}
            routeIcon={<SendHorizontal size={14} />}
            scopeIcon={<BookOpenText size={14} />}
          />
          <div ref={composerWrapRef}>
          <Composer
            contextItems={composerContextItems}
            disabled={!activeSession}
            isGenerating={isGenerating}
            isStopRequested={isStopRequested}
            isStartState
            modelLabel={modelLabel}
            modelState={providerModelState}
            onSend={handleSend}
            onStop={handleStop}
            showContextPanel
            stopControlState={hermesStatus?.uiCapabilities.ui.stopControl}
          />
          </div>
        </div>
      ) : (
        <>
          <ChatTranscript
            activeProject={activeProject}
            activeSession={activeSession}
            activityEvents={activeActivityEvents}
            bannerIcon={<AlertTriangle size={15} />}
            composerInsetPx={composerInsetPx}
            createSession={createSession}
            isThinking={isGenerating && !assistantHasContent && !hasRunningActivity}
            routeIcon={<SendHorizontal size={14} />}
            scopeIcon={<BookOpenText size={14} />}
          />
          <div ref={composerWrapRef}>
          <Composer
            contextItems={composerContextItems}
            disabled={!activeSession}
            isGenerating={isGenerating}
            isStopRequested={isStopRequested}
            modelLabel={modelLabel}
            modelState={providerModelState}
            onSend={handleSend}
            onStop={handleStop}
            showContextPanel={false}
            stopControlState={hermesStatus?.uiCapabilities.ui.stopControl}
          />
          </div>
        </>
      )}
    </section>
  );
}

function getProviderModelState(
  status: NormalizedHermesStatus | null,
  modelChoices: ModelChoice[]
): HermesUiCapabilities["models"] {
  if (status?.uiCapabilities.models) {
    return status.uiCapabilities.models;
  }

  const fallback = modelChoices.find((choice) => choice.id === "hermes-default");
  return {
    availableModels: [],
    clientSelectable: false,
    currentModelLabel: fallback?.label ?? "Hermes server model",
    currentProviderLabel: "Hermes server config",
    fastStreamProfile: "unknown",
    listAvailable: false,
    reason: "Hermes model status has not loaded; runtime selection remains disabled.",
    selectedModelId: null,
    selectionStatus: "unknown",
    serverAdvertisedModel: null,
    serverConfiguredOnly: true,
    uiState: "deferred"
  };
}

function modelLabelForState(state: HermesUiCapabilities["models"]) {
  if (state.selectionStatus === "unavailable") {
    return "Hermes unavailable";
  }
  if (state.currentModelLabel && state.currentModelLabel !== "Hermes server model") {
    return state.currentModelLabel;
  }
  if (state.selectionStatus === "server-configured" && state.currentModelLabel) {
    return state.currentModelLabel;
  }
  if (state.selectionStatus === "unknown" || !state.currentModelLabel) {
    return "Hermes default";
  }
  return state.currentModelLabel;
}

function assistantSafeId(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, "_");
}

function isActiveActivityEvent(event: AgentActivityEvent) {
  return (
    event.status === "queued" ||
    event.status === "running" ||
    event.status === "waiting_for_approval"
  );
}

function canUseRealHermes(status: NormalizedHermesStatus | null) {
  return status?.mode === "real" && status.reachable && status.uiCapabilities.chat.canSend;
}

function createMessage(
  role: ChatMessage["role"],
  author: string,
  content: string,
  status: ChatMessage["status"]
): ChatMessage {
  return {
    id: `msg-${crypto.randomUUID()}`,
    role,
    author,
    content,
    createdAt: currentTimeLabel(),
    status
  };
}

function currentTimeLabel() {
  return new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function makeEmptyRunActivitySummary(): RunActivitySummary {
  return {
    approvalCount: 0,
    commandCount: 0,
    errorCount: 0,
    memoryCount: 0,
    toolCount: 0
  };
}

function addActivityToRunSummary(
  summary: RunActivitySummary,
  event: AgentActivityEvent
): RunActivitySummary {
  return {
    approvalCount: summary.approvalCount + (event.type === "approval" ? 1 : 0),
    commandCount: summary.commandCount + (event.type === "command" ? 1 : 0),
    errorCount:
      summary.errorCount + (event.type === "error" || event.status === "failed" ? 1 : 0),
    memoryCount: summary.memoryCount + (event.type === "memory" ? 1 : 0),
    toolCount: summary.toolCount + (event.type === "tool" ? 1 : 0)
  };
}

function summarizeRunPrompt(content: string): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "Web UI run";
  }
  return clean.length > 96 ? `${clean.slice(0, 93)}...` : clean;
}

function mockUnavailableResponse(
  status: NormalizedHermesStatus | null,
  isLoading: boolean
): string {
  if (isLoading && !status) {
    return "Hermes status is still checking, so this turn was kept local. No real agent call was made.";
  }
  if (!status || status.mode === "unconfigured") {
    return "Hermes is not configured for this Studio process. I saved your message locally and used a mock response instead of calling the agent.";
  }
  if (status.mode === "mock") {
    return "Real Hermes chat is disabled for this UI process, so this response is a local mock fallback.";
  }
  return "Hermes is currently unreachable. Your message stayed in this local session; retry after the status panel reports connected.";
}

function toToolEvent(event: AgentActivityEvent): ToolEvent {
  const now = currentTimeLabel();
  return {
    id: `tool-${crypto.randomUUID()}`,
    name: event.title,
    status: normalizeToolStatus(event.status),
    detail: event.summary ?? describeActivity(event),
    time: now
  };
}

function normalizeToolStatus(status: AgentActivityEvent["status"]): ToolEvent["status"] {
  if (status === "running") {
    return "started";
  }
  if (status === "completed" || status === "failed") {
    return status;
  }
  return "pending";
}

function describeActivity(event: AgentActivityEvent) {
  if (event.type === "memory" && event.memory?.operation) {
    return `Memory ${event.memory.operation} activity`;
  }
  return "Normalized Hermes activity event";
}
