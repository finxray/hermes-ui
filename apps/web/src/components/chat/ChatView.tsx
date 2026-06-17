import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useComposerInset } from "@/hooks/useComposerInset";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatTranscript } from "@/components/chat/ChatTranscript";
import { Composer } from "@/components/chat/Composer";
import {
  computeRunElapsed,
  createActivityEventFromHermesStreamEvent,
  makeElapsedActivityEvent,
  makeStoppedActivityEvent,
  normalizeActivityTokenUsage
} from "@/lib/agentActivityEvents";
import { streamHermesChatFromBff } from "@/lib/hermesChatClient";
import { createTokenUsageAccumulator } from "@/lib/tokenUsageAggregator";
import {
  createPersistedActivityEvent,
  limitPersistedActivityEvents
} from "@/lib/persistedActivityReplay";
import { DEFAULT_USER_DISPLAY_NAME, WORKSPACE_STORAGE_VERSION } from "@/lib/workspaceStore";
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import type { HermesTokenUsage, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
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
import type { LiveTokenUsageSnapshot } from "@/components/chat/LiveTokenUsageTicker";
import styles from "./ChatView.module.css";

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];
type ActivityRecorder = (sessionId: string, event: AgentActivityEvent) => void;
const STREAM_FLUSH_INTERVAL_MS = 32;
const ESTIMATED_CHARS_PER_TOKEN = 4;
const ESTIMATED_ACTIVITY_CHARS_PER_TOKEN = 6;
const ESTIMATED_THINKING_OUTPUT_TOKENS_PER_SECOND = 2.5;
const LIVE_TOKEN_ESTIMATE_INTERVAL_MS = 650;
const LIVE_TOKEN_ESTIMATE_MAX_THINKING_TOKENS = 512;
const LIVE_TOKEN_AFTERGLOW_MS = 15_000;
// How many completed tool cycles it takes for the live "in" estimate to climb
// all the way to the prior turn's prompt total (a tool loop re-sends the full
// context each request, so prompt grows roughly per cycle).
const PROMPT_CLIMB_EXPECTED_CYCLES = 6;

type ChatViewProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  createSession: () => void;
  hermesStatus: NormalizedHermesStatus | null;
  isHermesStatusLoading: boolean;
  isSplitViewOpen?: boolean;
  onActivityEvent: (sessionId: string, event: AgentActivityEvent) => void;
  onSplitView?: () => void;
  sessionModel: HermesSessionModelSync;
  showHeader?: boolean;
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
  isSplitViewOpen = false,
  onActivityEvent,
  onSplitView,
  sessionModel,
  showHeader = true,
  variant = "main",
  workspaceActions
}: ChatViewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStopRequested, setIsStopRequested] = useState(false);
  const [assistantHasContent, setAssistantHasContent] = useState(false);
  const [isFinalizingResponse, setIsFinalizingResponse] = useState(false);
  const [liveTokenUsage, setLiveTokenUsage] = useState<LiveTokenUsageSnapshot | null>(null);
  const [visibleLiveTokenUsage, setVisibleLiveTokenUsage] = useState<LiveTokenUsageSnapshot | null>(null);
  const [generationStartedAt, setGenerationStartedAt] = useState<string | null>(null);
  const activeStreamControllerRef = useRef<AbortController | null>(null);
  const flushFrameRef = useRef<number | null>(null);
  const flushTimeoutRef = useRef<number | null>(null);
  const lastFlushAtRef = useRef(0);
  const assistantHasContentRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const activitySequenceRef = useRef(0);
  const authoritativeCompletionTokensRef = useRef(false);
  const authoritativePromptTokensRef = useRef(false);
  const liveTokenPulseRef = useRef<number | null>(null);
  const liveTokenClearTimerRef = useRef<number | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const composerWrapRef = useRef<HTMLDivElement>(null);
  const isStartState = Boolean(activeSession && activeSession.messages.length === 0);
  const composerClearancePx = useComposerInset(scrollViewportRef, composerWrapRef, !isStartState);

  useEffect(() => {
    setIsGenerating(false);
    setIsStopRequested(false);
    setLiveTokenUsage(null);
    setVisibleLiveTokenUsage(null);
    setIsFinalizingResponse(false);
    setGenerationStartedAt(null);
    stopRequestedRef.current = false;
    activeStreamControllerRef.current?.abort();
    activeStreamControllerRef.current = null;
    if (liveTokenPulseRef.current !== null) {
      window.clearInterval(liveTokenPulseRef.current);
      liveTokenPulseRef.current = null;
    }
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
    authoritativeCompletionTokensRef.current = false;
    authoritativePromptTokensRef.current = false;
    if (liveTokenClearTimerRef.current !== null) {
      window.clearTimeout(liveTokenClearTimerRef.current);
      liveTokenClearTimerRef.current = null;
    }
  }, [activeSession?.id]);

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
    let responseTokenUsage: HermesTokenUsage | undefined;
    const usageAccumulator = createTokenUsageAccumulator();
    let estimatedPromptTokens = 0;
    let estimatedActivityChars = 0;
    // The visible text is a tiny fraction of the real prompt — most of it is the
    // context Hermes injects server-side (memory, tool defs, system) and, in a
    // tool loop, the full conversation re-sent each request. The client can't see
    // that, so the live "in" estimate climbs toward the prior turn's prompt total
    // (a good proxy, since context carries forward) as command cycles complete,
    // instead of sitting flat at the visible-text estimate and snapping at the end.
    const priorTurnPromptTokens = recentAuthoritativePromptTokens(session.messages);
    let toolCycleCount = 0;
    let accumulated = "";
    // Assistant text arrives one turn at a time. We hold each turn rather than
    // streaming it immediately: if tool/command activity follows, the turn was
    // intermediate working text and is discarded; only the final turn (nothing
    // follows it) is committed to the answer body. Reasoning text is never
    // surfaced at all.
    let currentTurnText = "";
    let lastAnswerCandidateText = "";
    let streamCompletedSuccessfully = false;
    const liveEstimateStartedAtMs = performance.now();

    const nextActivitySequence = () => activitySequenceRef.current++;

    const syncLiveTokenUsage = (usage: HermesTokenUsage | undefined) => {
      if (!usage) {
        return;
      }
      if (typeof usage.promptTokens !== "number" && typeof usage.completionTokens !== "number") {
        return;
      }
      const usageIsEstimated = usage.source === "estimated";
      if (!usageIsEstimated && typeof usage.promptTokens === "number") {
        authoritativePromptTokensRef.current = true;
      }
      if (!usageIsEstimated && typeof usage.completionTokens === "number") {
        authoritativeCompletionTokensRef.current = true;
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
      const aggregate = usageAccumulator.add(normalized);
      responseTokenUsage = annotateTokenUsageRoute(aggregate ?? responseTokenUsage, modelRequest);
      syncLiveTokenUsage(responseTokenUsage);
      return responseTokenUsage;
    };

    const stopLiveTokenPulse = () => {
      if (liveTokenPulseRef.current !== null) {
        window.clearInterval(liveTokenPulseRef.current);
        liveTokenPulseRef.current = null;
      }
    };

    const estimateLiveCompletionTokens = () => {
      const visibleTextTokens = estimateTokenCount(accumulated);
      const activityTokens = Math.ceil(estimatedActivityChars / ESTIMATED_ACTIVITY_CHARS_PER_TOKEN);
      const elapsedTokens = Math.min(
        LIVE_TOKEN_ESTIMATE_MAX_THINKING_TOKENS,
        Math.floor(((performance.now() - liveEstimateStartedAtMs) / 1000) * ESTIMATED_THINKING_OUTPUT_TOKENS_PER_SECOND)
      );
      return Math.max(visibleTextTokens, activityTokens + elapsedTokens);
    };

    const estimateLivePromptTokens = () => {
      const activityPromptTokens = Math.ceil(estimatedActivityChars / ESTIMATED_CHARS_PER_TOKEN);
      const generatedContextTokens = Math.ceil(accumulated.length / ESTIMATED_CHARS_PER_TOKEN);
      const visibleEstimate = estimatedPromptTokens + activityPromptTokens + generatedContextTokens;
      // Climb toward the prior turn's prompt total as tool cycles complete, so a
      // multi-request run's "in" rises during streaming instead of snapping at the
      // end. Stays at/under the prior total so authoritative usage only corrects
      // upward for heavier turns; lighter turns settle when the real value lands.
      if (priorTurnPromptTokens > visibleEstimate) {
        const cycleProgress = Math.min(1, toolCycleCount / PROMPT_CLIMB_EXPECTED_CYCLES);
        const climbed = visibleEstimate + Math.round((priorTurnPromptTokens - visibleEstimate) * cycleProgress);
        return Math.max(0, climbed);
      }
      return Math.max(0, visibleEstimate);
    };

    const withEstimatedTokenFallback = (usage: HermesTokenUsage | undefined) => {
      const next: HermesTokenUsage = usage ? { ...usage } : {};
      let usedEstimate = false;

      if (typeof next.promptTokens !== "number" && estimatedPromptTokens > 0) {
        next.promptTokens = estimatedPromptTokens;
        usedEstimate = true;
      }

      if (typeof next.completionTokens !== "number") {
        next.completionTokens = estimateLiveCompletionTokens();
        usedEstimate = true;
      }

      if (
        typeof next.totalTokens !== "number" &&
        (typeof next.promptTokens === "number" || typeof next.completionTokens === "number")
      ) {
        next.totalTokens = (next.promptTokens ?? 0) + (next.completionTokens ?? 0);
      }

      if (usedEstimate) {
        next.source = "estimated";
      }

      return next;
    };

    const syncEstimatedLiveTokenUsage = () => {
      const promptTokens = estimateLivePromptTokens();
      const completionTokens = estimateLiveCompletionTokens();
      setLiveTokenUsage((current) => {
        const nextPromptTokens = authoritativePromptTokensRef.current
          ? Math.max(current?.promptTokens ?? 0, promptTokens)
          : promptTokens;
        const nextCompletionTokens = authoritativeCompletionTokensRef.current
          ? current?.completionTokens
          : completionTokens;
        if (current?.promptTokens === nextPromptTokens && current?.completionTokens === nextCompletionTokens) {
          return current;
        }
        return {
          promptTokens: nextPromptTokens,
          completionTokens: nextCompletionTokens
        };
      });
    };

    const startLiveTokenPulse = () => {
      stopLiveTokenPulse();
      liveTokenPulseRef.current = window.setInterval(syncEstimatedLiveTokenUsage, LIVE_TOKEN_ESTIMATE_INTERVAL_MS);
    };

    const addActivityTokenEstimate = (activityEvent: AgentActivityEvent) => {
      const parts = [
        activityEvent.title,
        activityEvent.summary,
        activityEvent.hermes?.eventType,
        activityEvent.hermes?.toolName,
        activityEvent.command?.toolName,
        activityEvent.command?.command,
        activityEvent.command?.args?.join(" "),
        activityEvent.artifact?.title,
        activityEvent.artifact?.path
      ].filter(Boolean);

      estimatedActivityChars += Math.min(parts.join("\n").length, 900);
      syncEstimatedLiveTokenUsage();
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

    // Reasoning text is internal intermediate output and is never surfaced in
    // the activity flow. We only keep its size feeding the live token estimate
    // so usage still advances while the model is thinking.
    const handleReasoningStreamEvent = (_eventName: string, base: AgentActivityEvent) => {
      const reasoningText = base.metadata?.rawReasoningTextRendered === true ? (base.summary ?? "") : "";
      if (reasoningText) {
        estimatedActivityChars += Math.min(reasoningText.length, 900);
        syncEstimatedLiveTokenUsage();
      }
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
    setGenerationStartedAt(runStartedAt);
    setLiveTokenUsage(null);
    authoritativeCompletionTokensRef.current = false;
    authoritativePromptTokensRef.current = false;
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

    sessionModel.markStreamSucceeded();

    estimatedPromptTokens = estimatePromptTokensForRequest({
      message: content,
      project: activeProject,
      recentMessages: session.messages.slice(-12),
      session
    });
    setLiveTokenUsage({
      completionTokens: 0,
      promptTokens: estimatedPromptTokens
    });
    startLiveTokenPulse();
    syncEstimatedLiveTokenUsage();

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
        setAssistantHasContent(true);
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
      syncEstimatedLiveTokenUsage();
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
      const completionUsage = withEstimatedTokenFallback(
        // Prefer the live run aggregate so usage that arrived after message_done
        // (trailing metadata / run-usage events) is still folded into the total.
        annotateTokenUsageRoute(responseTokenUsage ?? nextCompletion.usage, modelRequest)
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
                activeProject.memoryScope.stableProjectKey
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
              if (event.type === "run_event" && isReasoningRunEventName(event.name)) {
                handleReasoningStreamEvent(event.name, activityEvent);
              } else {
                if (activityEndsIntermediateTurn(activityEvent)) {
                  discardIntermediateTurn();
                }
                if (
                  activityEvent.status === "completed" &&
                  (activityEvent.type === "command" || activityEvent.command || activityEvent.type === "tool")
                ) {
                  // Each finished command/tool roughly corresponds to one more
                  // upstream request that re-sends the full context.
                  toolCycleCount += 1;
                }
                addActivityTokenEstimate(activityEvent);
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
              addActivityTokenEstimate(activityEvent);
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
      responseTokenUsage = withEstimatedTokenFallback(annotateTokenUsageRoute(responseTokenUsage, modelRequest));
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
      responseTokenUsage = withEstimatedTokenFallback(annotateTokenUsageRoute(responseTokenUsage, modelRequest));
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
      stopLiveTokenPulse();
      if (generationStarted) {
        if (streamCompletedSuccessfully) {
          sessionModel.markStreamSucceeded();
        } else {
          void sessionModel.refresh();
        }
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
          window.setTimeout(() => {
            setLiveTokenUsage((current) =>
              current?.promptTokens === finalLiveTokenUsage.promptTokens &&
              current?.completionTokens === finalLiveTokenUsage.completionTokens
                ? null
                : current
            );
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
    "--chat-bottom-fade-height": `${Math.max(136, composerClearancePx + 30)}px`
  } as CSSProperties;

  return (
    <section
      className={styles.workspace}
      data-start-state={isStartState ? "true" : "false"}
      data-show-header={showHeader ? "true" : "false"}
      data-variant={variant}
      aria-label="Chat workspace"
    >
      {isStartState ? (
        <>
          {showHeader ? (
            <ChatHeader
              isSplitViewOpen={isSplitViewOpen}
              onSplitView={onSplitView}
              title={activeSession?.title ?? "No chat selected"}
            />
          ) : null}
          <div className={styles.startStage}>
          <ChatTranscript
            activeProject={activeProject}
            activeSession={activeSession}
            activityEvents={activeActivityEvents}
            createSession={createSession}
            generationStartedAt={generationStartedAt}
            isFinalizingResponse={isFinalizingResponse}
            isGenerating={isGenerating}
            isStartState
            liveTokenUsage={liveTokenUsage}
          />
          <div ref={composerWrapRef} className={styles.composerAnchor}>
          <Composer
            contextItems={composerContextItems}
            draftStorageKey={activeSession ? composerDraftStorageKey(variant, activeSession.id) : undefined}
            disabled={!activeSession}
            isGenerating={isGenerating}
            isStopRequested={isStopRequested}
            isStartState
            liveTokenUsage={visibleLiveTokenUsage}
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
            data-chat-scroll-viewport="true"
            aria-label="Chat transcript"
          >
            {showHeader ? (
              <div className={styles.topChrome}>
                <div className={styles.contentFadeLayer} aria-hidden="true" />
                <div className={styles.headerLayer}>
                  <ChatHeader
                    isSplitViewOpen={isSplitViewOpen}
                    onSplitView={onSplitView}
                    title={activeSession?.title ?? "No chat selected"}
                  />
                </div>
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
          <div ref={composerWrapRef} className={`${styles.composerAnchor} ${styles.composerDock}`}>
            <Composer
              contextItems={composerContextItems}
              draftStorageKey={activeSession ? composerDraftStorageKey(variant, activeSession.id) : undefined}
              disabled={!activeSession}
              isGenerating={isGenerating}
              isStopRequested={isStopRequested}
              liveTokenUsage={visibleLiveTokenUsage}
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

function estimatePromptTokensForRequest({
  message,
  project,
  recentMessages,
  session
}: {
  message: string;
  project: Project;
  recentMessages: ChatMessage[];
  session: Session;
}) {
  const promptText = [
    message,
    project.name,
    project.memoryScope.stableProjectKey,
    project.memoryScope.userVisibleSummary,
    session.title,
    session.memoryScope.stableSessionKey,
    session.memoryScope.userVisibleSummary,
    ...recentMessages.map((item) => item.content)
  ]
    .filter(Boolean)
    .join("\n");
  return estimateTokenCount(promptText);
}

function recentAuthoritativePromptTokens(messages: ChatMessage[]): number {
  // The most recent assistant turn's reported prompt size is the best proxy for
  // the next turn's prompt: conversation + injected context carry forward and
  // generally only grow. Estimated usage is skipped so we calibrate off real
  // provider-reported totals only.
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") {
      continue;
    }
    const usage = message.usage;
    if (usage && usage.source !== "estimated" && typeof usage.promptTokens === "number" && usage.promptTokens > 0) {
      return usage.promptTokens;
    }
  }
  return 0;
}

function estimateTokenCount(value: string) {
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean) {
    return 0;
  }
  return Math.max(1, Math.ceil(clean.length / ESTIMATED_CHARS_PER_TOKEN));
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
