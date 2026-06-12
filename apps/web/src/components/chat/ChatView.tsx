import { AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type {
  ChatMessage,
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
const STREAM_FLUSH_INTERVAL_MS = 48;

type ChatViewProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  createSession: () => void;
  hermesStatus: NormalizedHermesStatus | null;
  isHermesStatusLoading: boolean;
  onActivityEvent: (sessionId: string, event: AgentActivityEvent) => void;
  sessionModel: HermesSessionModelSync;
  workspaceActions: WorkspaceActions;
};

export function ChatView({
  activeProject,
  activeSession,
  activityEvents,
  createSession,
  hermesStatus,
  isHermesStatusLoading,
  onActivityEvent,
  sessionModel,
  workspaceActions
}: ChatViewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStopRequested, setIsStopRequested] = useState(false);
  const [assistantHasContent, setAssistantHasContent] = useState(false);
  const activeStreamControllerRef = useRef<AbortController | null>(null);
  const flushFrameRef = useRef<number | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);
  const lastFlushAtRef = useRef(0);
  const assistantHasContentRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const isStartState = Boolean(activeSession && activeSession.messages.length === 0);
  const composerClearancePx = useComposerInset(scrollViewportRef, composerWrapRef, !isStartState);

  useEffect(() => {
    setIsGenerating(false);
    setIsStopRequested(false);
    stopRequestedRef.current = false;
    activeStreamControllerRef.current?.abort();
    activeStreamControllerRef.current = null;
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }
    assistantHasContentRef.current = false;
  }, [activeSession?.id]);
  const providerModelState = sessionModel.modelState;
  const modelLabel = sessionModel.modelLabel;
  const modelSelectError = sessionModel.error;
  const modelSelectInProgress = sessionModel.modelSelectInProgress;
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
    if (!activeSession || isGenerating || modelSelectInProgress) {
      return;
    }

    const session = activeSession;
    const sendModelState = sessionModel.modelState;
    const modelRequest = sessionModel.modelRequest;
    let generationStarted = false;
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
      hermesSessionId: resolveHermesSessionId(session),
      userMessageId: userMessage.id,
      assistantMessageId: assistantId,
      sourceChannel: "web-ui",
      status: "running",
      startedAt: runStartedAt,
      modelLabel: sendModelState.currentModelLabel,
      providerLabel: sendModelState.currentProviderLabel,
      summary: summarizeRunPrompt(content),
      activityEventIds: [],
      activityReplay: [],
      activitySummary: runSummary
    });
    setAssistantHasContent(false);
    assistantHasContentRef.current = false;
    setIsGenerating(true);
    generationStarted = true;
    setIsStopRequested(false);
    stopRequestedRef.current = false;

    try {
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
      return;
    }

    const streamController = new AbortController();
    activeStreamControllerRef.current = streamController;
    let accumulated = "";
    let completedAssistant = false;
    let hadStreamError = false;

    const markAssistantHasContent = () => {
      if (!assistantHasContentRef.current) {
        assistantHasContentRef.current = true;
        setAssistantHasContent(true);
      }
    };

    const flushNow = (status: ChatMessage["status"] = "streaming", references?: string[]) => {
      lastFlushAtRef.current = performance.now();
      workspaceActions.updateMessage(session.id, assistantId, accumulated, status, references);
    };

    const flush = (status: ChatMessage["status"] = "streaming", references?: string[]) => {
      if (flushFrameRef.current !== null) {
        return;
      }

      const scheduleFrame = () => {
        flushFrameRef.current = window.requestAnimationFrame(() => {
          flushFrameRef.current = null;
          flushNow(status, references);
        });
      };

      const elapsed = performance.now() - lastFlushAtRef.current;
      if (elapsed >= STREAM_FLUSH_INTERVAL_MS) {
        scheduleFrame();
        return;
      }

      if (flushTimeoutRef.current === null) {
        flushTimeoutRef.current = window.setTimeout(() => {
          flushTimeoutRef.current = null;
          scheduleFrame();
        }, STREAM_FLUSH_INTERVAL_MS - elapsed);
      }
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
            hermesSessionId: resolveHermesSessionId(session),
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
        model: modelRequest?.selectModelId ?? null,
        provider: modelRequest?.provider ?? null,
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
              markAssistantHasContent();
            }
            flush("streaming");
          } else if (event.type === "message_done") {
            completedAssistant = true;
            accumulated = event.message.content || accumulated;
            hermesRunId = event.runId || hermesRunId;
            updateRunRecord({ hermesRunId });
            if (accumulated.trim()) {
              markAssistantHasContent();
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
            markAssistantHasContent();
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
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
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
      markAssistantHasContent();
      return;
    }

    const emptyAssistantText = !hadStreamError && !accumulated.trim();

    if (!completedAssistant && !hadStreamError && accumulated) {
      workspaceActions.updateMessage(session.id, assistantId, accumulated, "complete", [
        "Hermes session stream"
      ]);
    } else if (emptyAssistantText) {
      hadStreamError = true;
      workspaceActions.updateMessage(
        session.id,
        assistantId,
        emptyHermesResponseMessage(sendModelState.currentModelLabel),
        "error",
        ["Hermes stream"]
      );
      markAssistantHasContent();
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
    } finally {
      if (generationStarted) {
        void sessionModel.refresh();
        setIsGenerating(false);
        setIsStopRequested(false);
        stopRequestedRef.current = false;
      }
    }
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

  return (
    <section
      className={styles.workspace}
      data-start-state={isStartState ? "true" : "false"}
      aria-label="Chat workspace"
    >
      {isStartState ? (
        <>
          <ChatHeader title={activeSession?.title ?? "No chat selected"} />
          <div className={styles.startStage}>
          <ChatTranscript
            activeProject={activeProject}
            activeSession={activeSession}
            activityEvents={activeActivityEvents}
            bannerIcon={<AlertTriangle size={15} />}
            createSession={createSession}
            isStartState
          />
          <div ref={composerWrapRef} className={styles.composerAnchor}>
          <Composer
            contextItems={composerContextItems}
            disabled={!activeSession}
            isGenerating={isGenerating}
            isStopRequested={isStopRequested}
            isStartState
            modelLabel={modelLabel}
            modelSelectError={modelSelectError}
            modelSelectInProgress={modelSelectInProgress}
            modelState={providerModelState}
            onModelSelect={sessionModel.selectModel}
            onSend={handleSend}
            onStop={handleStop}
            showContextPanel={false}
            stopControlState={hermesStatus?.uiCapabilities.ui.stopControl}
          />
          </div>
        </div>
        </>
      ) : (
        <>
          <div
            ref={scrollViewportRef}
            className={styles.scrollViewport}
            aria-label="Chat transcript"
          >
            <div className={styles.topChrome}>
              <div className={styles.contentFadeLayer} aria-hidden="true" />
              <div className={styles.headerLayer}>
                <ChatHeader title={activeSession?.title ?? "No chat selected"} />
              </div>
            </div>
            <ChatTranscript
              activeProject={activeProject}
              activeSession={activeSession}
              activityEvents={activeActivityEvents}
              bannerIcon={<AlertTriangle size={15} />}
              bottomClearancePx={composerClearancePx}
              createSession={createSession}
            />
            <div className={styles.scrollFadeBottom} aria-hidden="true" />
          </div>
          <div ref={composerWrapRef} className={`${styles.composerAnchor} ${styles.composerDock}`}>
            <Composer
              contextItems={composerContextItems}
              disabled={!activeSession}
              isGenerating={isGenerating}
              isStopRequested={isStopRequested}
              modelLabel={modelLabel}
              modelSelectError={modelSelectError}
              modelSelectInProgress={modelSelectInProgress}
              modelState={providerModelState}
              onModelSelect={sessionModel.selectModel}
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

function resolveHermesSessionId(session: Session): string {
  return session.hermesSessionId || `hermes-${session.id}`;
}

function assistantSafeId(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, "_");
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

function emptyHermesResponseMessage(modelLabel: string): string {
  return `Hermes completed the turn without returning assistant text for ${modelLabel}. The selected provider may be unavailable or misrouted; try another model or check Hermes provider configuration.`;
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
