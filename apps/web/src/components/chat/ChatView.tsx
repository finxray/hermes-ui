import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, UIEvent } from "react";
import { useComposerInset } from "@/hooks/useComposerInset";
import { ChatHeader, type ChatHeaderTabs } from "@/components/chat/ChatHeader";
import { ChatTranscript } from "@/components/chat/ChatTranscript";
import { ConversationMinimap } from "@/components/chat/ConversationMinimap";
import { Composer } from "@/components/chat/Composer";
import {
  computeRunElapsed,
  createActivityEventFromHermesStreamEvent,
  makeElapsedActivityEvent,
  makeStoppedActivityEvent,
  normalizeActivityTokenUsage
} from "@/lib/agentActivityEvents";
import { streamHermesChatFromBff } from "@/lib/hermesChatClient";
import { generateChatTitleFromBff } from "@/lib/hermesTitleClient";
import { createTokenUsageAccumulator } from "@/lib/tokenUsageAggregator";
import {
  createPersistedActivityEvent,
  limitPersistedActivityEvents
} from "@/lib/persistedActivityReplay";
import {
  DEFAULT_USER_DISPLAY_NAME,
  WORKSPACE_STORAGE_VERSION,
  shouldGenerateSessionTitle
} from "@/lib/workspaceStore";
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import type { QueuedComposerMessage } from "@/components/chat/Composer";
import type { HermesChatRequest, HermesTokenUsage, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type {
  ChatMessage,
  ChatAttachment,
  PersistedActivityEvent,
  Project,
  RunActivitySummary,
  RunRecord,
  Session,
  ToolEvent
} from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { useScrollOverflowTarget } from "@/hooks/useScrollOverflowTarget";
import type { AgentActivityEvent } from "@/types/agentActivity";
import type { LiveTokenUsageSnapshot } from "@/components/chat/LiveTokenUsageTicker";
import styles from "./ChatView.module.css";

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];
type ActivityRecorder = (sessionId: string, event: AgentActivityEvent) => void;
type QueuedTurn = QueuedComposerMessage & { attachments?: ChatAttachment[]; sessionId: string };
const STREAM_FLUSH_INTERVAL_MS = 32;
const LIVE_TOKEN_AFTERGLOW_MS = 15_000;
const CHATS_PROJECT_NAME = "Chats";

type ChatViewProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  createSession: () => void;
  hermesStatus: NormalizedHermesStatus | null;
  isHermesStatusLoading: boolean;
  isFocused?: boolean;
  isSplitViewOpen?: boolean;
  onActivate?: () => void;
  onActivityEvent: (sessionId: string, event: AgentActivityEvent) => void;
  onCloseMainInSplit?: () => void;
  onGeneratingChange?: (sessionId: string, isGenerating: boolean) => void;
  onRefreshHermes?: () => void | Promise<void>;
  onSplitView?: () => void;
  projects: Project[];
  sessionModel: HermesSessionModelSync;
  showHeader?: boolean;
  tabs?: ChatHeaderTabs;
  variant?: "main" | "side";
  workspaceActions: WorkspaceActions;
};

export function ChatView({
  activeProject,
  activeSession,
  activityEvents,
  createSession,
  hermesStatus,
  isHermesStatusLoading,
  isFocused = true,
  isSplitViewOpen = false,
  onActivate,
  onActivityEvent,
  onCloseMainInSplit,
  onGeneratingChange,
  onRefreshHermes,
  onSplitView,
  projects,
  sessionModel,
  showHeader = true,
  tabs,
  variant = "main",
  workspaceActions
}: ChatViewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStopRequested, setIsStopRequested] = useState(false);
  const [isFinalizingResponse, setIsFinalizingResponse] = useState(false);
  const [isTranscriptUnderTabs, setIsTranscriptUnderTabs] = useState(false);
  const [doTabsOverlapTranscript, setDoTabsOverlapTranscript] = useState(false);
  const [liveTokenUsage, setLiveTokenUsage] = useState<LiveTokenUsageSnapshot | null>(null);
  const [visibleLiveTokenUsage, setVisibleLiveTokenUsage] = useState<LiveTokenUsageSnapshot | null>(null);
  const [generationStartedAt, setGenerationStartedAt] = useState<string | null>(null);
  const [frozenComposerModel, setFrozenComposerModel] = useState<{
    label: string;
    modelState: HermesSessionModelSync["modelState"];
  } | null>(null);
  const [queuedTurns, setQueuedTurns] = useState<QueuedTurn[]>([]);
  const activeStreamControllerRef = useRef<AbortController | null>(null);
  const flushFrameRef = useRef<number | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);
  const lastFlushAtRef = useRef(0);
  const assistantHasContentRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const activitySequenceRef = useRef(0);
  const liveTokenClearTimerRef = useRef<number | null>(null);
  const liveTokenResetTimerRef = useRef<number | null>(null);
  const queuedTurnTimerRef = useRef<number | null>(null);
  const titleGenerationSessionIdsRef = useRef(new Set<string>());
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const isTranscriptUnderTabsRef = useRef(false);
  const tabsOverlapTranscriptRef = useRef(false);
  const startStageRef = useRef<HTMLDivElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const isStartState = Boolean(activeSession && activeSession.messages.length === 0);
  const composerClearancePx = useComposerInset(scrollViewportRef, composerWrapRef, !isStartState);
  const providerModelState = sessionModel.modelState;
  const modelLabel = sessionModel.modelLabel;
  const displayedProviderModelState = frozenComposerModel?.modelState ?? providerModelState;
  const displayedModelLabel = frozenComposerModel?.label ?? modelLabel;
  const modelSelectError = sessionModel.error;
  const modelSelectInProgress = sessionModel.modelSelectInProgress;
  const visibleQueuedMessages = activeSession
    ? queuedTurns
        .filter((turn) => turn.sessionId === activeSession.id)
        .map(({ attachments, id, content }) => ({ attachments, id, content }))
    : [];

  useScrollOverflowTarget(scrollViewportRef, !isStartState);
  useScrollOverflowTarget(startStageRef, isStartState);

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport || isStartState || !showHeader || !tabs) {
      tabsOverlapTranscriptRef.current = false;
      setDoTabsOverlapTranscript(false);
      return;
    }

    const tabViewport = viewport.querySelector<HTMLElement>("[data-chat-tab-viewport='true']");
    const transcriptColumn = viewport.querySelector<HTMLElement>("[data-chat-transcript-column='true']");
    if (!tabViewport || !transcriptColumn) {
      tabsOverlapTranscriptRef.current = false;
      setDoTabsOverlapTranscript(false);
      return;
    }

    let measureFrame: number | null = null;
    const measureOverlap = () => {
      measureFrame = null;
      const tabsBounds = tabViewport.getBoundingClientRect();
      const transcriptBounds = transcriptColumn.getBoundingClientRect();
      const nextOverlap =
        tabsBounds.right > transcriptBounds.left + 1 &&
        tabsBounds.left < transcriptBounds.right - 1;
      if (nextOverlap === tabsOverlapTranscriptRef.current) {
        return;
      }
      tabsOverlapTranscriptRef.current = nextOverlap;
      setDoTabsOverlapTranscript(nextOverlap);
    };
    const scheduleMeasurement = () => {
      if (measureFrame === null) {
        measureFrame = window.requestAnimationFrame(measureOverlap);
      }
    };

    measureOverlap();
    const observer = new ResizeObserver(scheduleMeasurement);
    observer.observe(viewport);
    observer.observe(tabViewport);
    observer.observe(transcriptColumn);

    return () => {
      observer.disconnect();
      if (measureFrame !== null) {
        window.cancelAnimationFrame(measureFrame);
      }
    };
  }, [isStartState, showHeader, Boolean(tabs)]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }

    const syncScrollbarGutter = () => {
      const viewportBounds = viewport.getBoundingClientRect();
      const topChrome = viewport.querySelector<HTMLElement>("[data-chat-top-chrome='true']");
      const contentRight = topChrome?.getBoundingClientRect().right ?? viewportBounds.left + viewport.clientWidth;
      const gutter = Math.max(0, viewportBounds.right - contentRight);
      viewport.style.setProperty("--chat-scrollbar-gutter", `${gutter}px`);
    };

    syncScrollbarGutter();
    const observer = new ResizeObserver(syncScrollbarGutter);
    observer.observe(viewport);
    const topChrome = viewport.querySelector<HTMLElement>("[data-chat-top-chrome='true']");
    if (topChrome) {
      observer.observe(topChrome);
    }
    return () => observer.disconnect();
  }, [isStartState]);

  useEffect(() => {
    isTranscriptUnderTabsRef.current = false;
    setIsTranscriptUnderTabs(false);
  }, [activeSession?.id, isStartState]);

  function handleTranscriptScroll(event: UIEvent<HTMLDivElement>) {
    const nextIsUnderTabs = event.currentTarget.scrollTop > 2;
    if (nextIsUnderTabs === isTranscriptUnderTabsRef.current) {
      return;
    }

    isTranscriptUnderTabsRef.current = nextIsUnderTabs;
    setIsTranscriptUnderTabs(nextIsUnderTabs);
  }

  useEffect(() => {
    if (!activeSession) {
      return;
    }

    onGeneratingChange?.(activeSession.id, isGenerating);

    return () => {
      onGeneratingChange?.(activeSession.id, false);
    };
  }, [activeSession?.id, isGenerating, onGeneratingChange]);

  useEffect(() => {
    setIsGenerating(false);
    setIsStopRequested(false);
    setLiveTokenUsage(null);
    setVisibleLiveTokenUsage(null);
    setIsFinalizingResponse(false);
    setGenerationStartedAt(null);
    setFrozenComposerModel(null);
    setQueuedTurns([]);
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
    activitySequenceRef.current = 0;
    if (liveTokenClearTimerRef.current !== null) {
      window.clearTimeout(liveTokenClearTimerRef.current);
      liveTokenClearTimerRef.current = null;
    }
    if (liveTokenResetTimerRef.current !== null) {
      window.clearTimeout(liveTokenResetTimerRef.current);
      liveTokenResetTimerRef.current = null;
    }
    if (queuedTurnTimerRef.current !== null) {
      window.clearTimeout(queuedTurnTimerRef.current);
      queuedTurnTimerRef.current = null;
    }
  }, [activeSession?.id]);

  useEffect(() => () => {
    activeStreamControllerRef.current?.abort();
    if (flushTimeoutRef.current !== null) {
      window.clearTimeout(flushTimeoutRef.current);
    }
    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
    }
    if (liveTokenClearTimerRef.current !== null) {
      window.clearTimeout(liveTokenClearTimerRef.current);
    }
    if (liveTokenResetTimerRef.current !== null) {
      window.clearTimeout(liveTokenResetTimerRef.current);
    }
    if (queuedTurnTimerRef.current !== null) {
      window.clearTimeout(queuedTurnTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (isGenerating || modelSelectInProgress || !activeSession) {
      return;
    }
    const nextQueuedTurn = queuedTurns.find((turn) => turn.sessionId === activeSession.id);
    if (!nextQueuedTurn) {
      return;
    }
    if (queuedTurnTimerRef.current !== null) {
      return;
    }

    setQueuedTurns((current) => current.filter((turn) => turn.id !== nextQueuedTurn.id));
    queuedTurnTimerRef.current = window.setTimeout(() => {
      queuedTurnTimerRef.current = null;
      void handleSend(nextQueuedTurn.content, nextQueuedTurn.attachments ?? []);
    }, 0);
  }, [activeSession?.id, isGenerating, modelSelectInProgress, queuedTurns]);

  useEffect(() => {
    if (liveTokenClearTimerRef.current !== null) {
      window.clearTimeout(liveTokenClearTimerRef.current);
      liveTokenClearTimerRef.current = null;
    }

    if (liveTokenUsage) {
      setVisibleLiveTokenUsage(liveTokenUsage);
      return;
    }

    if (!visibleLiveTokenUsage) {
      return;
    }

    liveTokenClearTimerRef.current = window.setTimeout(() => {
      setVisibleLiveTokenUsage(null);
      liveTokenClearTimerRef.current = null;
    }, LIVE_TOKEN_AFTERGLOW_MS);

    return () => {
      if (liveTokenClearTimerRef.current !== null) {
        window.clearTimeout(liveTokenClearTimerRef.current);
        liveTokenClearTimerRef.current = null;
      }
    };
  }, [liveTokenUsage, visibleLiveTokenUsage]);
  const composerContextItems = activeSession
    ? [
        { label: "Workspace", value: "hermes-ui" },
        { label: "Project", value: activeProject.name },
        { label: "Session", value: activeSession.title },
        { label: "Scope", value: activeProject.contextScope.stableProjectKey },
        { label: "Route", value: "Browser -> BFF -> Hermes" }
      ]
    : [
        { label: "Workspace", value: "hermes-ui" },
        { label: "Project", value: activeProject.name },
        { label: "Route", value: "Select or create a chat" }
      ];

  async function handleSend(content: string, attachments: ChatAttachment[] = []) {
    if (!activeSession || modelSelectInProgress) {
      return;
    }
    if (isGenerating) {
      setQueuedTurns((current) => [
        ...current,
        { attachments, content, id: `queued-${crypto.randomUUID()}`, sessionId: activeSession.id }
      ]);
      return;
    }

    const session = activeSession;
    const sendModelState = sessionModel.modelState;
    setFrozenComposerModel({
      label: modelLabel,
      modelState: sendModelState
    });
    const modelRequest = sessionModel.modelRequest;
    const shouldRequestTitle =
      shouldGenerateSessionTitle(session) &&
      !titleGenerationSessionIdsRef.current.has(session.id);
    if (shouldRequestTitle) {
      titleGenerationSessionIdsRef.current.add(session.id);
    }
    const chatContext: HermesChatRequest["context"] = {
      project: {
        id: activeProject.id,
        title: activeProject.name,
        stableKey: activeProject.contextScope.stableProjectKey,
        userVisibleSummary: activeProject.contextScope.userVisibleSummary
      },
      session: {
        id: session.id,
        title: session.title,
        stableKey: session.contextScope.stableSessionKey,
        hermesSessionId: resolveHermesSessionId(session),
        includeProjectContext: session.contextScope.includeProjectContext,
        includeSessionContext: session.contextScope.includeSessionContext,
        lastContextRefreshAt: session.contextScope.lastContextRefreshAt,
        userVisibleSummary: session.contextScope.userVisibleSummary
      },
      ui: {
        source: "hermes-ui",
        workspaceVersion: WORKSPACE_STORAGE_VERSION
      }
    };
    let generationStarted = false;
    const userMessage = createMessage("user", DEFAULT_USER_DISPLAY_NAME, content, "complete", attachments);
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
    let responseTokenUsage: HermesTokenUsage | undefined;
    const usageAccumulator = createTokenUsageAccumulator();
    let accumulated = "";
    // Assistant text arrives one turn at a time. We hold each turn rather than
    // streaming it immediately: if tool/command activity follows, the turn was
    // intermediate working text and is discarded; only the final turn (nothing
    // follows it) is committed to the answer body. Reasoning text is never
    // surfaced at all.
    let currentTurnText = "";
    let lastAnswerCandidateText = "";
    let streamCompletedSuccessfully = false;
    const nextActivitySequence = () => activitySequenceRef.current++;

    const syncLiveTokenUsage = (usage: HermesTokenUsage | undefined) => {
      if (!usage || usage.source === "estimated") {
        return;
      }
      if (typeof usage.promptTokens !== "number" && typeof usage.completionTokens !== "number") {
        return;
      }
      setLiveTokenUsage((current) => ({
        promptTokens: usage.promptTokens ?? current?.promptTokens,
        completionTokens: usage.completionTokens ?? current?.completionTokens
      }));
    };

    const updateResponseTokenUsage = (usage: unknown) => {
      // Sum usage across every upstream request in this run (deduped by request
      // id) instead of replacing it with the latest sample, so multi-request
      // runs report the run total rather than one request's `in`/`out` counts.
      const normalized = normalizeActivityTokenUsage(usage);
      if (!normalized || normalized.source === "estimated") {
        return responseTokenUsage;
      }
      const aggregate = usageAccumulator.add(normalized);
      responseTokenUsage = annotateTokenUsageRoute(aggregate ?? responseTokenUsage, modelRequest);
      syncLiveTokenUsage(responseTokenUsage);
      return responseTokenUsage;
    };

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

    if (shouldRequestTitle) {
      workspaceActions.markSessionTitleGenerationRequested(session.id, runStartedAt);
    }
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
    assistantHasContentRef.current = false;
    setIsGenerating(true);
    generationStarted = true;
    setGenerationStartedAt(runStartedAt);
    setLiveTokenUsage(null);
    setVisibleLiveTokenUsage(null);
    setIsStopRequested(false);
    stopRequestedRef.current = false;

    try {
    if (!canUseRealHermes(hermesStatus)) {
      const unavailableMessage = hermesUnavailableMessage(hermesStatus, isHermesStatusLoading);
      workspaceActions.updateMessage(session.id, assistantId, unavailableMessage, "error", [
        "Hermes unavailable",
        "No agent request was sent"
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

    if (shouldRequestTitle) {
      void generateChatTitleFromBff({
        context: chatContext,
        message: content,
        model: modelRequest?.selectModelId ?? null,
        provider: modelRequest?.provider ?? null
      }).then((title) => {
        if (title) {
          workspaceActions.applyGeneratedSessionTitle(
            session.id,
            title,
            new Date().toISOString()
          );
        }
      });
    }

    const streamController = new AbortController();
    activeStreamControllerRef.current = streamController;
    let completedAssistant = false;
    let hadStreamError = false;
    let elapsedActivityAppended = false;
    let pendingCompletion:
      | {
          references?: string[];
          usage?: HermesTokenUsage;
        }
      | null = null;

    const markAssistantHasContent = () => {
      if (!assistantHasContentRef.current) {
        assistantHasContentRef.current = true;
      }
    };

    const cancelPendingFlush = () => {
      if (flushFrameRef.current !== null) {
        window.cancelAnimationFrame(flushFrameRef.current);
        flushFrameRef.current = null;
      }
      if (flushTimeoutRef.current !== null) {
        window.clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
    };

    const commitAssistantMessage = (
      status: ChatMessage["status"] = "streaming",
      references?: string[],
      usage?: HermesTokenUsage
    ) => {
      workspaceActions.updateMessage(session.id, assistantId, accumulated, status, references, usage);
    };

    const flushNow = (
      status: ChatMessage["status"] = "streaming",
      references?: string[],
      usage?: HermesTokenUsage
    ) => {
      lastFlushAtRef.current = performance.now();
      commitAssistantMessage(status, references, usage);
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

    const streamCurrentTurnAsAnswer = (force = false) => {
      if (!currentTurnText.trim()) {
        return;
      }
      accumulated = currentTurnText;
      lastAnswerCandidateText = currentTurnText;
      markAssistantHasContent();
      if (force) {
        flushNow("streaming");
        return;
      }
      flush();
    };

    // An intermediate assistant turn (more activity follows it) carries working
    // text we never surface. Drop it so only the final turn reaches the body.
    const discardIntermediateTurn = () => {
      currentTurnText = "";
    };

    const finalizeCurrentTurnAsAnswer = () => {
      if (!currentTurnText.trim()) {
        return;
      }
      streamCurrentTurnAsAnswer(true);
    };

    // Commands, tools, memory, files, and approvals mean the preceding assistant
    // text was intermediate — discard it before recording the activity row.
    const activityEndsIntermediateTurn = (activityEvent: AgentActivityEvent) =>
      activityEvent.type === "command" ||
      Boolean(activityEvent.command) ||
      activityEvent.type === "tool" ||
      activityEvent.type === "memory" ||
      activityEvent.type === "file" ||
      activityEvent.type === "approval" ||
      activityEvent.status === "waiting_for_approval";

    const completeAssistantMessage = (references?: string[], usage?: HermesTokenUsage) => {
      cancelPendingFlush();
      // Commit the final text immediately. The assistant body keeps its reveal
      // animation mounted across the streaming -> complete transition and plays
      // out any remaining buffered characters, so there is no need to hold the
      // status as "streaming" with an artificial timer here.
      commitAssistantMessage("complete", references, usage);
    };

    const appendElapsedActivityOnce = (completedAt: string) => {
      if (elapsedActivityAppended) {
        return;
      }
      appendElapsedActivityEvent(session.id, runStartedAt, completedAt, recordRunActivity, responseTokenUsage);
      elapsedActivityAppended = true;
    };

    const completePendingAssistantMessage = async (completedAt: string) => {
      if (!pendingCompletion) {
        return false;
      }
      cancelPendingFlush();
      const nextCompletion = pendingCompletion;
      pendingCompletion = null;
      // Prefer the live run aggregate so usage that arrived after message_done
      // (trailing metadata / run-usage events) is still folded into the total.
      const completionCandidate = responseTokenUsage ?? nextCompletion.usage;
      const completionUsage = annotateTokenUsageRoute(
        completionCandidate?.source === "estimated" ? undefined : completionCandidate,
        modelRequest
      );
      responseTokenUsage = completionUsage;
      syncLiveTokenUsage(responseTokenUsage);
      appendElapsedActivityOnce(completedAt);
      completeAssistantMessage(nextCompletion.references, completionUsage);
      if (!hadStreamError && !stopRequestedRef.current) {
        setIsFinalizingResponse(true);
      }
      // Keep isFinalizingResponse true until generation fully ends — the finally
      // block clears it together with isGenerating. Clearing it here, while
      // isGenerating is still true, flips activityIsWorking back to true, which
      // re-shows the live WorkingLog and resets the "Worked for" auto-collapse,
      // leaving the block stuck open instead of folding shut.
      return true;
    };

    const streamResult = await streamHermesChatFromBff(
      {
        context: chatContext,
        clientMessageId: userMessage.id,
        message: content,
        attachments: toHermesChatAttachments(attachments),
        model: modelRequest?.selectModelId ?? null,
        modelRuntime: modelRequest?.modelRuntime ?? null,
        modelSelectionScope: modelRequest?.selectionScope ?? null,
        provider: modelRequest?.provider ?? null,
        recentMessages: session.messages.slice(-12).map((message) => ({
          role: message.role,
          content: message.content
        }))
      },
      {
        onEvent: (event) => {
          if (event.type === "message_delta") {
            // Accumulate the in-progress turn but render NOTHING yet. A turn's
            // role (intermediate working text vs final answer) is only known
            // from what follows it, so streaming partial text now is exactly
            // what caused the "…Sta" leak/flash. We defer: commit at boundaries.
            currentTurnText += event.delta;
          } else if (event.type === "message_done") {
            completedAssistant = true;
            // Hold the completed turn. If activity follows it was intermediate
            // working text (discarded then); if the stream ends it is the final
            // answer (handed to the body at completion). Render nothing here so
            // a completed intermediate turn never flashes in the answer.
            currentTurnText = event.message.content || currentTurnText;
            hermesRunId = event.runId || hermesRunId;
            updateResponseTokenUsage(event.usage);
            updateRunRecord({ hermesRunId });
            if (currentTurnText.trim()) {
              markAssistantHasContent();
            }
            pendingCompletion = {
              references: [
                "Hermes session stream",
                activeProject.contextScope.stableProjectKey
              ],
              usage: responseTokenUsage
            };
          } else if (event.type === "metadata") {
            updateResponseTokenUsage(event.usage);
            if (responseTokenUsage) {
              workspaceActions.updateMessage(session.id, assistantId, accumulated, undefined, undefined, responseTokenUsage);
            }
          } else if (event.type === "tool_event" || event.type === "run_event" || event.type === "approval_event") {
            const activityEvent = createActivityEventFromHermesStreamEvent(event, {
              now: new Date().toISOString(),
              sequence: nextActivitySequence()
            });
            if (activityEvent) {
              if (!(event.type === "run_event" && isReasoningRunEventName(event.name))) {
                if (activityEndsIntermediateTurn(activityEvent)) {
                  discardIntermediateTurn();
                }
                recordRunActivity(session.id, activityEvent);
                workspaceActions.appendToolEvent(session.id, toToolEvent(activityEvent));
              }
            }
          } else if (event.type === "error") {
            discardIntermediateTurn();
            hadStreamError = true;
            cancelPendingFlush();
            accumulated = event.error.message;
            markAssistantHasContent();
            const activityEvent = createActivityEventFromHermesStreamEvent(event, {
              now: new Date().toISOString(),
              sequence: nextActivitySequence()
            });
            if (activityEvent) {
              recordRunActivity(session.id, activityEvent);
            }
            commitAssistantMessage("error", ["Hermes stream error"]);
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
      cancelPendingFlush();
      finalizeCurrentTurnAsAnswer();
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

    // The last turn had no activity after it, so it is the final answer: commit
    // it to the answer body.
    finalizeCurrentTurnAsAnswer();
    if (!accumulated.trim() && lastAnswerCandidateText.trim()) {
      currentTurnText = lastAnswerCandidateText;
      streamCurrentTurnAsAnswer(true);
    }
    const emptyAssistantText = !hadStreamError && !accumulated.trim();

    await completePendingAssistantMessage(completedAt);

    if (!completedAssistant && !hadStreamError && accumulated) {
      responseTokenUsage = annotateTokenUsageRoute(responseTokenUsage, modelRequest);
      syncLiveTokenUsage(responseTokenUsage);
      completeAssistantMessage(["Hermes session stream"], responseTokenUsage);
    } else if (emptyAssistantText) {
      hadStreamError = true;
      cancelPendingFlush();
      workspaceActions.updateMessage(
        session.id,
        assistantId,
        emptyHermesResponseMessage(sendModelState.currentModelLabel),
        "error",
        ["Hermes stream"]
      );
      markAssistantHasContent();
    }

    if (!emptyAssistantText) {
      responseTokenUsage = annotateTokenUsageRoute(responseTokenUsage, modelRequest);
      syncLiveTokenUsage(responseTokenUsage);
    } else {
      responseTokenUsage = annotateTokenUsageRoute(responseTokenUsage, modelRequest);
    }
    appendElapsedActivityOnce(completedAt);
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
    streamCompletedSuccessfully = !hadStreamError && !emptyAssistantText && !stopRequestedRef.current;
    } finally {
      if (generationStarted) {
        if (streamCompletedSuccessfully) {
          sessionModel.markStreamSucceeded();
        } else {
          void sessionModel.refresh();
        }
        setFrozenComposerModel(null);
        setIsGenerating(false);
        setIsStopRequested(false);
        // Commit the final authoritative totals to the visible ticker before
        // clearing live state. The last syncLiveTokenUsage (carrying the final
        // request's prompt/completion) otherwise batches with setLiveTokenUsage(
        // null) below, so React coalesces them and the afterglow keeps the
        // stale next-to-last value — e.g. the composer "in" stuck one request
        // behind the real total.
        const finalPromptTokens = responseTokenUsage?.promptTokens;
        const finalCompletionTokens = responseTokenUsage?.completionTokens;
        if (typeof finalPromptTokens === "number" || typeof finalCompletionTokens === "number") {
          const finalLiveTokenUsage = {
            promptTokens: finalPromptTokens,
            completionTokens: finalCompletionTokens
          };
          setLiveTokenUsage(finalLiveTokenUsage);
          setVisibleLiveTokenUsage(finalLiveTokenUsage);
          if (liveTokenResetTimerRef.current !== null) {
            window.clearTimeout(liveTokenResetTimerRef.current);
          }
          liveTokenResetTimerRef.current = window.setTimeout(() => {
            setLiveTokenUsage((current) =>
              current?.promptTokens === finalLiveTokenUsage.promptTokens &&
              current?.completionTokens === finalLiveTokenUsage.completionTokens
                ? null
                : current
            );
            liveTokenResetTimerRef.current = null;
          }, 0);
        } else {
          setLiveTokenUsage(null);
        }
        setIsFinalizingResponse(false);
        setGenerationStartedAt(null);
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

  function renameActiveSession() {
    if (!activeSession) {
      return;
    }
    const nextTitle = window.prompt("Rename chat", activeSession.title);
    if (nextTitle?.trim()) {
      workspaceActions.renameSession(activeSession.id, nextTitle.trim());
    }
  }

  function openProjectFromComposer(projectId: string) {
    if (activeSession?.projectId === projectId && activeSession.messages.length === 0) {
      return;
    }
    workspaceActions.switchProject(projectId);
    workspaceActions.createSessionForProject(projectId);
  }

  function createProjectFromComposer() {
    const projectId = workspaceActions.createProject();
    workspaceActions.createSessionForProject(projectId);
  }

  function continueInChatsFolder() {
    const chatsProject =
      projects.find((project) => project.name.trim().toLowerCase() === CHATS_PROJECT_NAME.toLowerCase()) ?? null;
    const projectId =
      chatsProject?.id ??
      workspaceActions.createProject({
        activate: false,
        name: CHATS_PROJECT_NAME
      });
    workspaceActions.createSessionForProject(projectId);
  }

  const projectControls = {
    activeProjectId: activeProject.id,
    activeProjectName: activeProject.name,
    onCreateProject: createProjectFromComposer,
    onSelectProject: openProjectFromComposer,
    onUseChats: continueInChatsFolder,
    projects: projects.map((project) => ({ id: project.id, name: project.name }))
  };

  function removeQueuedTurn(id: string) {
    setQueuedTurns((current) => current.filter((turn) => turn.id !== id));
  }

  function prioritizeQueuedTurn(id: string) {
    setQueuedTurns((current) => {
      const target = current.find((turn) => turn.id === id);
      if (!target) {
        return current;
      }
      return [target, ...current.filter((turn) => turn.id !== id)];
    });
  }

  function steerQueuedTurn(id: string) {
    prioritizeQueuedTurn(id);
    handleStop();
  }

  function deferQueuedTurn(id: string) {
    setQueuedTurns((current) => {
      const target = current.find((turn) => turn.id === id);
      if (!target) {
        return current;
      }
      return [...current.filter((turn) => turn.id !== id), target];
    });
  }

  function appendActivityEvent(sessionId: string, event: AgentActivityEvent) {
    onActivityEvent(sessionId, event);
  }

  function appendElapsedActivityEvent(
    sessionId: string,
    startedAt: string,
    completedAt: string,
    recorder: ActivityRecorder = appendActivityEvent,
    tokenUsage?: HermesTokenUsage
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
        metadata: tokenUsage ? { tokenUsage } : undefined,
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
  const bottomFadeStyle = {
    "--chat-bottom-fade-height": `${Math.max(95, composerClearancePx + 21)}px`
  } as CSSProperties;
  const headerFadeStyle = {
    "--chat-top-overlay-height": isSplitViewOpen ? "67px" : "34px"
  } as CSSProperties;
  const showHeaderFade = showHeader && doTabsOverlapTranscript;
  const showTopChrome = showHeader || showHeaderFade;

  return (
    <section
      className={styles.workspace}
      data-start-state={isStartState ? "true" : "false"}
      data-show-header={showHeader ? "true" : "false"}
      data-variant={variant}
      data-chat-pane={tabs?.pane}
      data-focused={isFocused ? "true" : "false"}
      onFocusCapture={onActivate}
      onPointerDownCapture={onActivate}
      aria-label="Chat workspace"
    >
      {isStartState ? (
        <>
          {showHeaderFade ? <div className={styles.contentFadeLayer} style={headerFadeStyle} aria-hidden="true" /> : null}
          {showHeader ? (
            <ChatHeader
              isSplitViewOpen={isSplitViewOpen}
              onArchive={activeSession ? () => workspaceActions.archiveSession(activeSession.id) : undefined}
              onCloseMainInSplit={onCloseMainInSplit}
              onRename={activeSession ? renameActiveSession : undefined}
              onSplitView={onSplitView}
              tabs={tabs}
              title={activeSession?.title ?? "No chat selected"}
            />
          ) : null}
          <div ref={startStageRef} className={styles.startStage}>
            <div className={styles.startStack}>
              <div ref={composerWrapRef} className={styles.composerAnchor}>
                <Composer
                  contextItems={composerContextItems}
                  draftStorageKey={activeSession ? composerDraftStorageKey(variant, activeSession.id) : undefined}
                  disabled={!activeSession}
                  isGenerating={isGenerating}
                  hermesConnected={hermesStatus?.reachable === true}
                  hermesStatusLoading={isHermesStatusLoading}
                  isStopRequested={isStopRequested}
                  isStartState
                  liveTokenUsage={visibleLiveTokenUsage}
                  modelLabel={displayedModelLabel}
                  modelSelectError={modelSelectError}
                  modelSelectInProgress={modelSelectInProgress}
                  modelState={displayedProviderModelState}
                  onModelSelect={sessionModel.selectModel}
                  onHermesRecovered={onRefreshHermes}
                  onSend={handleSend}
                  onStop={handleStop}
                  onDeferQueuedMessage={deferQueuedTurn}
                  onPrioritizeQueuedMessage={prioritizeQueuedTurn}
                  onRemoveQueuedMessage={removeQueuedTurn}
                  onSteerQueuedMessage={steerQueuedTurn}
                  projectControls={projectControls}
                  queuedMessages={visibleQueuedMessages}
                  showContextPanel={false}
                  stopControlState={hermesStatus?.uiCapabilities.ui.stopControl}
                />
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div
            ref={scrollViewportRef}
            className={styles.scrollViewport}
            data-chat-scroll-viewport="true"
            onScroll={handleTranscriptScroll}
            aria-label="Chat transcript"
          >
            {showTopChrome ? (
              <div
                className={styles.topChrome}
                data-chat-top-chrome="true"
                data-content-overlap={showHeaderFade && isTranscriptUnderTabs ? "true" : "false"}
              >
                {showHeaderFade ? <div className={styles.contentFadeLayer} style={headerFadeStyle} aria-hidden="true" /> : null}
                {showHeader ? (
                  <div className={styles.headerLayer}>
                    <ChatHeader
                      isSplitViewOpen={isSplitViewOpen}
                      onArchive={activeSession ? () => workspaceActions.archiveSession(activeSession.id) : undefined}
                      onCloseMainInSplit={onCloseMainInSplit}
                      onRename={activeSession ? renameActiveSession : undefined}
                      onSplitView={onSplitView}
                      tabs={tabs}
                      title={activeSession?.title ?? "No chat selected"}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
            <ChatTranscript
              activeProject={activeProject}
              activeSession={activeSession}
              activityEvents={activeActivityEvents}
              bottomClearancePx={composerClearancePx}
              createSession={createSession}
              generationStartedAt={generationStartedAt}
              isFinalizingResponse={isFinalizingResponse}
              isGenerating={isGenerating}
              liveTokenUsage={liveTokenUsage}
            />
            <div className={styles.bottomChrome} style={bottomFadeStyle}>
              <div className={styles.scrollFadeBottom} aria-hidden="true" />
            </div>
          </div>
          {activeSession ? (
            <ConversationMinimap
              messages={activeSession.messages}
              scrollViewportRef={scrollViewportRef}
            />
          ) : null}
          <div ref={composerWrapRef} className={`${styles.composerAnchor} ${styles.composerDock}`}>
            <Composer
              contextItems={composerContextItems}
              draftStorageKey={activeSession ? composerDraftStorageKey(variant, activeSession.id) : undefined}
              disabled={!activeSession}
              hermesConnected={hermesStatus?.reachable === true}
              hermesStatusLoading={isHermesStatusLoading}
              isGenerating={isGenerating}
              isStopRequested={isStopRequested}
              liveTokenUsage={visibleLiveTokenUsage}
              modelLabel={displayedModelLabel}
              modelSelectError={modelSelectError}
              modelSelectInProgress={modelSelectInProgress}
              modelState={displayedProviderModelState}
              onModelSelect={sessionModel.selectModel}
              onHermesRecovered={onRefreshHermes}
              onSend={handleSend}
              onStop={handleStop}
              onDeferQueuedMessage={deferQueuedTurn}
              onPrioritizeQueuedMessage={prioritizeQueuedTurn}
              onRemoveQueuedMessage={removeQueuedTurn}
              onSteerQueuedMessage={steerQueuedTurn}
              queuedMessages={visibleQueuedMessages}
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

function isReasoningRunEventName(name: string): boolean {
  return (
    name === "reasoning.delta" ||
    name === "reasoning.done" ||
    name === "reasoning.available" ||
    name.startsWith("reasoning.summary.")
  );
}

function assistantSafeId(value: string) {
  return value.replace(/[^a-z0-9_-]/gi, "_");
}

function canUseRealHermes(status: NormalizedHermesStatus | null) {
  return status?.mode === "real" && status.reachable && status.uiCapabilities.chat.canSend;
}

function annotateTokenUsageRoute(
  usage: HermesTokenUsage | undefined,
  modelRequest: HermesSessionModelSync["modelRequest"]
): HermesTokenUsage | undefined {
  const requestedModel = cleanRouteValue(modelRequest?.selectModelId ?? modelRequest?.catalogModelId);
  const requestedProvider = cleanRouteValue(modelRequest?.provider);
  if (!usage && !requestedModel && !requestedProvider) {
    return undefined;
  }

  const next: HermesTokenUsage = usage ? { ...usage } : {};
  if (requestedModel) {
    next.requestedModel = requestedModel;
  }
  if (requestedProvider) {
    next.requestedProvider = requestedProvider;
  }

  const actualModel = cleanRouteValue(next.upstreamModel) || cleanRouteValue(next.model);
  const actualProvider = cleanRouteValue(next.provider);
  const routeVerified = hasAuthoritativeRouteEvidence(next);
  if (routeVerified) {
    next.routeVerified = true;
  }

  const modelMismatch = Boolean(
    routeVerified && requestedModel && actualModel && !sameRouteModel(requestedModel, actualModel)
  );
  const providerMismatch = Boolean(
    routeVerified &&
      requestedProvider &&
      actualProvider &&
      !providerRouteMatches(requestedProvider, actualProvider)
  );
  if (modelMismatch || providerMismatch) {
    next.routeMismatch = true;
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

function hasAuthoritativeRouteEvidence(usage: HermesTokenUsage) {
  if (usage.routeVerified === true) {
    return true;
  }
  return Boolean(
    cleanRouteValue(usage.upstreamModel) ||
      cleanRouteValue(usage.generationId) ||
      cleanRouteValue(usage.requestId)
  );
}

function sameRouteModel(requested: string, actual: string) {
  const requestedVariants = routeModelVariants(requested);
  const actualVariants = routeModelVariants(actual);
  return requestedVariants.some((left) => actualVariants.includes(left));
}

function routeModelVariants(value: string) {
  const normalized = value.trim().toLowerCase().replace(/^openrouter\//, "");
  const suffix = normalized.includes("/") ? normalized.split("/").pop() ?? normalized : normalized;
  return [...new Set([normalized, suffix].map(compactRouteValue).filter(Boolean))];
}

function providerRouteMatches(requested: string, actual: string) {
  if (isOpenRouterRoute(requested)) {
    return true;
  }
  const requestedProvider = normalizeProviderRoute(requested);
  const actualProvider = normalizeProviderRoute(actual);
  if (!requestedProvider || !actualProvider) {
    return true;
  }
  if (requestedProvider === "openrouter") {
    return true;
  }
  if (requestedProvider === "locallmstudio") {
    return actualProvider === "locallmstudio" || actualProvider === "lmstudio";
  }
  return requestedProvider === actualProvider;
}

function isOpenRouterRoute(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "openrouter" || normalized.startsWith("openrouter-");
}

function normalizeProviderRoute(value: string) {
  return compactRouteValue(value.replace(/^local[-_\s]*/, "local"));
}

function compactRouteValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cleanRouteValue(value?: string | null) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function toHermesChatAttachments(attachments: ChatAttachment[]): NonNullable<HermesChatRequest["attachments"]> {
  return attachments.map(({ contentHash, fileName, id, kind, mimeType, sizeBytes, status, storageId }) => ({
    contentHash,
    fileName,
    id,
    kind,
    mimeType,
    sizeBytes,
    storageId,
    status
  }));
}

function createMessage(
  role: ChatMessage["role"],
  author: string,
  content: string,
  status: ChatMessage["status"],
  attachments?: ChatAttachment[]
): ChatMessage {
  return {
    attachments: attachments && attachments.length > 0 ? attachments : undefined,
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

function hermesUnavailableMessage(
  status: NormalizedHermesStatus | null,
  isLoading: boolean
): string {
  if (isLoading && !status) {
    return "Hermes is still connecting. Your message was saved, but no agent request was sent. Retry when the connection is ready.";
  }
  if (!status || status.mode === "unconfigured") {
    return "Hermes is not configured for this UI process. Your message was saved, but no agent request was sent.";
  }
  if (status.mode === "mock") {
    return "Hermes chat is disabled for this UI process. Enable the real Hermes connection before retrying.";
  }
  return "Hermes is currently unreachable. Your message was saved; retry after the Console reports connected.";
}

function emptyHermesResponseMessage(modelLabel: string): string {
  return `Hermes completed the turn without returning assistant text for ${modelLabel}. The selected provider may be unavailable or misrouted; try another model or check Hermes provider configuration.`;
}

function composerDraftStorageKey(variant: ChatViewProps["variant"], sessionId: string) {
  return `hermes-ui:composer-draft:v1:${variant ?? "main"}:${sessionId}`;
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
