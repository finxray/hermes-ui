import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AgentActivityBlock } from "@/components/chat/AgentActivityBlock";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { computeRunElapsed, makeElapsedActivityEvent } from "@/lib/agentActivityEvents";
import { restoreActivityEventFromPersisted } from "@/lib/persistedActivityReplay";
import { resolveStreamStatusLabel } from "@/lib/streamStatus";
import type { LiveTokenUsageSnapshot } from "@/components/chat/LiveTokenUsageTicker";
import type { ChatMessage, Project, RunRecord, Session } from "@/data/types";
import type { AgentActivityEvent } from "@/types/agentActivity";
import styles from "./ChatView.module.css";

const COMPLETED_WORK_ANCHOR_LOCK_MS = 900;

type ChatTranscriptProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  ariaLabel?: string;
  bottomClearancePx?: number;
  createSession: () => void;
  generationStartedAt?: string | null;
  isFinalizingResponse?: boolean;
  isGenerating?: boolean;
  isStartState?: boolean;
  liveTokenUsage?: LiveTokenUsageSnapshot | null;
};

export function ChatTranscript({
  activeProject,
  activeSession,
  activityEvents,
  ariaLabel,
  bottomClearancePx,
  createSession,
  generationStartedAt = null,
  isFinalizingResponse = false,
  isGenerating = false,
  isStartState = false,
  liveTokenUsage = null
}: ChatTranscriptProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const previousSessionIdRef = useRef<string | undefined>(undefined);
  const needsBottomSnapRef = useRef(false);
  const previousStreamContentLenRef = useRef(0);
  const previousActivitySignalRef = useRef("");
  const bottomFollowFrameRef = useRef<number | null>(null);
  const bottomFollowPassesRef = useRef(0);
  const bottomFollowBehaviorRef = useRef<ScrollBehavior>("auto");
  const collapseAnchorObserverRef = useRef<ResizeObserver | null>(null);
  const collapseAnchorTimerRef = useRef<number | null>(null);
  const collapseAnchorLastHeightRef = useRef(0);
  const [revealedAssistantMessageId, setRevealedAssistantMessageId] = useState<string | null>(null);
  const lastMessage = activeSession?.messages.at(-1);
  const messageCount = activeSession?.messages.length ?? 0;
  const activityAnchorRun = activeSession
    ? resolveActivityAnchorRun({
        activityEvents,
        generationStartedAt,
        isGenerating,
        liveTokenUsage,
        session: activeSession
      })
    : null;
  const activityAnchorMessage = activeSession
    ? resolveActivityAnchorMessageForDisplay(activityAnchorRun, activeSession)
    : undefined;
  const activityAnchorMessageId = activityAnchorMessage?.id;
  const messageElapsedFallbackEvent =
    !activityAnchorRun && activityAnchorMessage
      ? makeMessageElapsedActivityEvent(activityAnchorMessage)
      : null;
  const activityBlockEvents = activityAnchorRun
    ? activityEventsForRun(activityAnchorRun, activityEvents)
    : messageElapsedFallbackEvent
      ? [...activityEvents, messageElapsedFallbackEvent]
    : activityEvents;
  const activityBlockLegacyEvents = activityAnchorRun ? [] : activeSession?.toolEvents ?? [];
  const activityIsWorking = isGenerating && !isFinalizingResponse;
  const assistantRevealComplete =
    !activityAnchorMessage?.content ||
    !activityIsWorking ||
    revealedAssistantMessageId === activityAnchorMessageId;
  const isStreamingAssistant =
    lastMessage?.role === "assistant" && lastMessage.status === "streaming";
  const streamStatusLabel =
    isStreamingAssistant && activityIsWorking ? resolveStreamStatusLabel(activityEvents) : null;
  const shouldShowActivityBlock = activeSession
    ? shouldShowAgentActivityBlock({
        events: activityBlockEvents,
        isGenerating: activityIsWorking,
        legacyEventCount: activityBlockLegacyEvents.length
      })
    : false;
  const activitySignal = `${activityAnchorRun?.id ?? "legacy"}:${shouldShowActivityBlock ? "visible" : "hidden"}:${activityBlockEvents.length}:${activityBlockLegacyEvents.length}`;

  function activityBlockForMessage(message: ChatMessage) {
    if (!activeSession || message.role !== "assistant") {
      return null;
    }

    const run = resolveRunForAssistantMessage(activeSession, message.id, activityAnchorRun);
    const isCurrentAnchor = message.id === activityAnchorMessageId;
    const isCurrentRun = Boolean(run && activityAnchorRun && run.id === activityAnchorRun.id);
    const runEvents = run ? activityEventsForRun(run, activityEvents) : [];
    const messageFallbackEvent = makeMessageElapsedActivityEvent(message);
    const events = runEvents.length > 0
      ? runEvents
      : messageFallbackEvent
        ? [messageFallbackEvent]
        : isCurrentAnchor
          ? activityBlockEvents
          : [];
    const legacyEvents = !run && isCurrentAnchor ? activityBlockLegacyEvents : [];
    const isWorking = isCurrentRun && activityIsWorking;
    const showBlock = shouldShowAgentActivityBlock({
      events,
      isGenerating: isWorking,
      legacyEventCount: legacyEvents.length
    });

    if (!showBlock) {
      return null;
    }

    const revealComplete =
      message.id === activityAnchorMessageId
        ? assistantRevealComplete
        : true;

    return (
      <AgentActivityBlock
        autoCollapseCompletedWork={isCurrentAnchor && !isWorking && revealComplete}
        events={events}
        isWorking={isWorking}
        legacyEvents={legacyEvents}
        liveTokenUsage={isCurrentAnchor ? liveTokenUsage : null}
        onCompletedWorkAutoCollapse={isCurrentAnchor ? handleCompletedWorkAutoCollapse : undefined}
        startedAt={isCurrentAnchor ? generationStartedAt : null}
      />
    );
  }

  function handleCompletedWorkAutoCollapse() {
    startActivityCollapseAnchorLock(COMPLETED_WORK_ANCHOR_LOCK_MS);
  }

  const getScrollViewport = () => transcriptRef.current?.parentElement ?? null;

  const isNearBottom = (scrollViewport: HTMLElement, thresholdPx = 96) => {
    const distanceFromBottom =
      scrollViewport.scrollHeight - scrollViewport.clientHeight - scrollViewport.scrollTop;
    return distanceFromBottom <= thresholdPx;
  };

  const scrollToBottom = (behavior: ScrollBehavior) => {
    const scrollViewport = getScrollViewport();
    if (!scrollViewport) {
      return;
    }

    scrollViewport.scrollTo({
      top: Math.max(0, scrollViewport.scrollHeight - scrollViewport.clientHeight),
      behavior
    });
  };

  const scheduleBottomFollow = (behavior: ScrollBehavior = "auto", passes = 2) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      behavior = "auto";
    }

    bottomFollowPassesRef.current = Math.max(bottomFollowPassesRef.current, passes);
    if (behavior === "smooth") {
      bottomFollowBehaviorRef.current = "smooth";
    } else if (bottomFollowBehaviorRef.current !== "smooth") {
      bottomFollowBehaviorRef.current = "auto";
    }

    if (bottomFollowFrameRef.current !== null) {
      return;
    }

    const follow = () => {
      bottomFollowFrameRef.current = null;
      const nextBehavior = bottomFollowBehaviorRef.current;
      bottomFollowBehaviorRef.current = "auto";
      scrollToBottom(nextBehavior);
      bottomFollowPassesRef.current -= 1;

      if (bottomFollowPassesRef.current > 0) {
        bottomFollowFrameRef.current = window.requestAnimationFrame(follow);
      }
    };

    bottomFollowFrameRef.current = window.requestAnimationFrame(follow);
  };

  const stopActivityCollapseAnchorLock = () => {
    collapseAnchorObserverRef.current?.disconnect();
    collapseAnchorObserverRef.current = null;
    if (collapseAnchorTimerRef.current !== null) {
      window.clearTimeout(collapseAnchorTimerRef.current);
      collapseAnchorTimerRef.current = null;
    }
    collapseAnchorLastHeightRef.current = 0;
  };

  const startActivityCollapseAnchorLock = (durationMs: number) => {
    const scrollViewport = getScrollViewport();
    const transcript = transcriptRef.current;
    const activityBlock = transcript?.querySelector<HTMLElement>('[data-agent-activity-block="true"]') ?? null;
    if (!scrollViewport || !transcript || !activityBlock) {
      return;
    }

    const anchorMessage = activityAnchorMessageId
      ? findMessageElementById(transcript, activityAnchorMessageId)
      : null;
    const scrollThreshold = typeof bottomClearancePx === "number" ? bottomClearancePx + 120 : 180;
    if (
      !needsBottomSnapRef.current &&
      !isNearBottom(scrollViewport, scrollThreshold) &&
      (!anchorMessage || !isElementNearViewport(anchorMessage, scrollViewport, 80))
    ) {
      return;
    }

    stopActivityCollapseAnchorLock();
    collapseAnchorLastHeightRef.current = activityBlock.getBoundingClientRect().height;

    const keepOutputTextStable = () => {
      const viewport = getScrollViewport();
      if (!viewport || !activityBlock.isConnected) {
        stopActivityCollapseAnchorLock();
        return;
      }

      const nextHeight = activityBlock.getBoundingClientRect().height;
      const previousHeight = collapseAnchorLastHeightRef.current;
      const delta = nextHeight - previousHeight;
      collapseAnchorLastHeightRef.current = nextHeight;
      if (Math.abs(delta) > 0.1) {
        viewport.scrollTop = Math.max(0, viewport.scrollTop + delta);
      }
    };

    collapseAnchorObserverRef.current = new ResizeObserver(keepOutputTextStable);
    collapseAnchorObserverRef.current.observe(activityBlock);
    keepOutputTextStable();
    collapseAnchorTimerRef.current = window.setTimeout(
      stopActivityCollapseAnchorLock,
      durationMs + 180
    );
  };

  useLayoutEffect(() => {
    return () => {
      if (bottomFollowFrameRef.current !== null) {
        window.cancelAnimationFrame(bottomFollowFrameRef.current);
        bottomFollowFrameRef.current = null;
      }
      stopActivityCollapseAnchorLock();
    };
  }, []);

  useEffect(() => {
    setRevealedAssistantMessageId(null);
  }, [activeSession?.id]);

  useEffect(() => {
    if (activityIsWorking) {
      setRevealedAssistantMessageId(null);
    }
  }, [activityIsWorking, lastMessage?.id]);

  useLayoutEffect(() => {
    if (isStartState || !activeSession) {
      previousSessionIdRef.current = activeSession?.id;
      previousMessageCountRef.current = messageCount;
      needsBottomSnapRef.current = false;
      return;
    }

    const sessionChanged = previousSessionIdRef.current !== activeSession.id;
    previousSessionIdRef.current = activeSession.id;

    if (messageCount === 0) {
      previousMessageCountRef.current = messageCount;
      needsBottomSnapRef.current = false;
      return;
    }

    if (sessionChanged) {
      previousMessageCountRef.current = messageCount;
      needsBottomSnapRef.current = true;
      scrollToBottom("auto");
      scheduleBottomFollow("auto", 3);
      return;
    }

    const addedMessages = messageCount > previousMessageCountRef.current;
    previousMessageCountRef.current = messageCount;
    if (!addedMessages) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scheduleBottomFollow(prefersReducedMotion ? "auto" : "smooth", 3);
  }, [activeSession?.id, isStartState, lastMessage?.id, messageCount]);

  useLayoutEffect(() => {
    if (isStartState || !activeSession || messageCount === 0 || typeof bottomClearancePx !== "number") {
      return;
    }

    const scrollViewport = getScrollViewport();
    if (!scrollViewport) {
      return;
    }

    if (!needsBottomSnapRef.current && !isNearBottom(scrollViewport, bottomClearancePx + 48)) {
      return;
    }

    scheduleBottomFollow("auto", 2);
    needsBottomSnapRef.current = false;
  }, [activeSession?.id, bottomClearancePx, isStartState, messageCount]);

  useLayoutEffect(() => {
    if (isStartState || !activeSession || messageCount === 0) {
      previousActivitySignalRef.current = activitySignal;
      return;
    }

    const previousActivitySignal = previousActivitySignalRef.current;
    previousActivitySignalRef.current = activitySignal;
    if (previousActivitySignal === activitySignal || !shouldShowActivityBlock) {
      return;
    }

    const scrollViewport = getScrollViewport();
    if (!scrollViewport) {
      return;
    }

    const scrollThreshold = typeof bottomClearancePx === "number" ? bottomClearancePx + 96 : 144;
    if (!needsBottomSnapRef.current && !isNearBottom(scrollViewport, scrollThreshold)) {
      return;
    }

    const blockJustAppeared =
      previousActivitySignal === "" || previousActivitySignal.includes("hidden");
    if (blockJustAppeared) {
      scheduleBottomFollow("smooth", 4);
    } else if (activityIsWorking) {
      // A new activity row was appended mid-run. Its height is allocated
      // immediately (the reveal only animates opacity/clip), so a single smooth
      // scroll eases the shift into view instead of snapping the transcript.
      scheduleBottomFollow("smooth", 1);
    } else {
      scheduleBottomFollow("auto", 4);
    }
  }, [
    activeSession?.id,
    activitySignal,
    bottomClearancePx,
    activityIsWorking,
    isStartState,
    messageCount,
    shouldShowActivityBlock
  ]);

  useLayoutEffect(() => {
    if (isStartState || !activeSession || messageCount === 0) {
      previousStreamContentLenRef.current = 0;
      return;
    }

    const scrollViewport = getScrollViewport();
    if (!scrollViewport) {
      return;
    }

    const contentLen = isStreamingAssistant ? lastMessage.content.length : 0;
    const wasEmpty = previousStreamContentLenRef.current === 0;
    const grew = contentLen > previousStreamContentLenRef.current;
    previousStreamContentLenRef.current = contentLen;

    if (!isStreamingAssistant && contentLen === 0) {
      return;
    }

    const scrollThreshold = typeof bottomClearancePx === "number" ? bottomClearancePx + 80 : 120;
    if (!activityIsWorking && !needsBottomSnapRef.current && !isNearBottom(scrollViewport, scrollThreshold)) {
      return;
    }

    if (!grew && !isStreamingAssistant) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const firstTokensArrived = wasEmpty && contentLen > 0;
    scheduleBottomFollow(firstTokensArrived && !prefersReducedMotion ? "smooth" : "auto", firstTokensArrived ? 4 : 2);
  }, [
    activeSession?.id,
    activityIsWorking,
    bottomClearancePx,
    isStartState,
    isStreamingAssistant,
    lastMessage?.content,
    lastMessage?.id,
    messageCount
  ]);

  return (
    <div
      ref={transcriptRef}
      className={styles.transcript}
      data-start-state={isStartState ? "true" : "false"}
      aria-label={ariaLabel}
    >
      <div className={styles.transcriptInner}>
        {!isStartState && activeSession ? (
          activeSession.messages.length > 0 ? (
            activeSession.messages.map((message) => (
              <Fragment key={message.id}>
                {activityBlockForMessage(message)}
                <MessageBubble
                  message={message}
                  onRevealComplete={
                    message.id === activityAnchorMessageId
                      ? () => setRevealedAssistantMessageId(message.id)
                      : undefined
                  }
                  showFooterAlways={
                    message.role === "assistant" && message.id === activityAnchorMessageId
                  }
                  streamStatusLabel={message.id === lastMessage?.id ? streamStatusLabel : null}
                />
              </Fragment>
            ))
          ) : (
            <EmptyState
              title="New chat is empty"
              body="Send a message to use real Hermes when configured, or a local mock fallback when unavailable."
            />
          )
        ) : !isStartState ? (
          <EmptyState
            title="No chats in this project"
            body="Projects can exist without sessions. Create a new local mock chat when you want a transcript under this project."
            actionLabel="New chat"
            onAction={createSession}
          />
        ) : null}
        {!isStartState && bottomClearancePx ? (
          <div
            className={styles.transcriptBottomSpacer}
            style={{ height: bottomClearancePx }}
            aria-hidden="true"
          />
        ) : null}
      </div>
    </div>
  );
}

function resolveActivityAnchorRun({
  activityEvents,
  generationStartedAt,
  isGenerating,
  liveTokenUsage,
  session
}: {
  activityEvents: AgentActivityEvent[];
  generationStartedAt: string | null;
  isGenerating: boolean;
  liveTokenUsage: LiveTokenUsageSnapshot | null;
  session: Session;
}) {
  if (isGenerating) {
    const runningRun = findCurrentRun(session, generationStartedAt);
    if (runningRun) {
      return runningRun;
    }
  }

  const liveEventIds = new Set(activityEvents.map((event) => event.id));
  const hasLiveTokenUsage =
    typeof liveTokenUsage?.promptTokens === "number" ||
    typeof liveTokenUsage?.completionTokens === "number";

  // runRecords is stored newest-first (appendRunRecord prepends), so iterate in
  // natural order to anchor the block to the most recent qualifying run. Do NOT
  // reverse here — reversing returns the oldest run with activity, which made the
  // latest run's "Worked for" summary vanish the instant a turn completed.
  for (const run of session.runRecords) {
    if (!resolveAssistantMessageForRun(run, session)) {
      continue;
    }
    if (hasRunDisplayActivity(run, liveEventIds) || (run.status === "running" && hasLiveTokenUsage)) {
      return run;
    }
  }

  if (!isGenerating) {
    return session.runRecords.find((run) => resolveAssistantMessageForRun(run, session)) ?? null;
  }

  return null;
}

function resolveActivityAnchorMessageForDisplay(run: RunRecord | null, session: Session) {
  if (run) {
    return resolveAssistantMessageForRun(run, session);
  }

  const latestGeneratedAssistant = [...session.messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.status !== "streaming" && Boolean(message.usage));
  if (latestGeneratedAssistant) {
    return latestGeneratedAssistant;
  }

  return [...session.messages].reverse().find((message) => message.role === "assistant");
}

function resolveAssistantMessageForRun(run: RunRecord, session: Session) {
  if (run.assistantMessageId) {
    const assistantMessage = session.messages.find((message) => message.id === run.assistantMessageId);
    if (assistantMessage) {
      return assistantMessage;
    }
  }

  if (run.userMessageId) {
    const userIndex = session.messages.findIndex((message) => message.id === run.userMessageId);
    if (userIndex >= 0) {
      const assistantAfterUser = session.messages
        .slice(userIndex + 1)
        .find((message) => message.role === "assistant");
      if (assistantAfterUser) {
        return assistantAfterUser;
      }
    }
  }

  return [...session.messages].reverse().find((message) => message.role === "assistant");
}

function resolveRunForAssistantMessage(
  session: Session,
  messageId: string,
  preferredRun: RunRecord | null
) {
  if (preferredRun && resolveAssistantMessageForRun(preferredRun, session)?.id === messageId) {
    return preferredRun;
  }

  const directRun = session.runRecords.find((run) => run.assistantMessageId === messageId);
  if (directRun) {
    return directRun;
  }

  return session.runRecords.find((run) => resolveAssistantMessageForRun(run, session)?.id === messageId) ?? null;
}

function findCurrentRun(session: Session, generationStartedAt: string | null) {
  // newest-first order (see resolveActivityAnchorRun): prefer the most recent
  // running run / the run started for the active generation.
  const runningRun = session.runRecords.find((run) => run.status === "running");
  if (runningRun) {
    return runningRun;
  }

  if (!generationStartedAt) {
    return null;
  }

  return session.runRecords.find((run) => run.startedAt === generationStartedAt) ?? null;
}

function hasRunDisplayActivity(run: RunRecord, liveEventIds: Set<string>) {
  // A real completed/stopped run always persists its elapsed event into
  // activityReplay, so replay/live activity is the qualifier. Do NOT qualify a
  // run by completedAt alone: an unreachable-Hermes/mock fallback turn is marked
  // completed with an empty replay, and must not steal the anchor from the prior
  // run that actually did work.
  return (
    run.activityReplay.length > 0 ||
    run.activityEventIds.some((eventId) => liveEventIds.has(eventId))
  );
}

function activityEventsForRun(run: RunRecord, liveEvents: AgentActivityEvent[]) {
  const liveById = new Map(liveEvents.map((event) => [event.id, event]));
  const replayById = new Map(
    (run.activityReplay ?? []).map((event) => [event.id, restoreActivityEventFromPersisted(event)] as const)
  );

  // Drive ordering from activityEventIds, which is the chronological id list.
  // Prefer the richer live event, fall back to the persisted replay. This keeps
  // reasoning interleaved exactly where it occurred (command -> reasoning ->
  // command) instead of appending replay/live leftovers after the commands.
  const orderedIds =
    run.activityEventIds && run.activityEventIds.length > 0
      ? run.activityEventIds
      : (run.activityReplay ?? []).map((event) => event.id);

  const seen = new Set<string>();
  const events: AgentActivityEvent[] = [];
  for (const id of orderedIds) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    const event = liveById.get(id) ?? replayById.get(id);
    if (event) {
      events.push(event);
    }
  }

  // Defensive: include any replay-only events whose ids fell out of the ordered
  // list so persisted history never silently loses a row.
  for (const [id, event] of replayById) {
    if (!seen.has(id)) {
      seen.add(id);
      events.push(event);
    }
  }

  if (!events.some((event) => event.type === "elapsed")) {
    const elapsed = makeRunElapsedActivityEvent(run);
    if (elapsed) {
      return [...events, elapsed];
    }
  }

  return events;
}

function makeRunElapsedActivityEvent(run: RunRecord): AgentActivityEvent | null {
  if (!run.completedAt) {
    return null;
  }
  const durationMs =
    typeof run.durationMs === "number" && Number.isFinite(run.durationMs)
      ? run.durationMs
      : computeRunElapsed(run.startedAt, run.completedAt);
  if (typeof durationMs !== "number") {
    return null;
  }
  return makeElapsedActivityEvent({
    completedAt: run.completedAt,
    durationMs,
    id: `elapsed-${run.id}-${run.completedAt}`,
    metadata: run.metadata,
    source: "ui",
    startedAt: run.startedAt
  });
}

function makeMessageElapsedActivityEvent(message: ChatMessage): AgentActivityEvent | null {
  const durationMs = resolveMessageDurationMs(message);
  if (typeof durationMs !== "number") {
    return null;
  }
  const completedAtMs = Date.UTC(2000, 0, 1, 0, 0, 0, 0);
  return makeElapsedActivityEvent({
    completedAt: new Date(completedAtMs).toISOString(),
    durationMs,
    id: `elapsed-message-${message.id}`,
    metadata: message.usage ? { tokenUsage: message.usage } : undefined,
    source: "ui",
    startedAt: new Date(completedAtMs - durationMs).toISOString()
  });
}

function resolveMessageDurationMs(message: ChatMessage) {
  const usage = message.usage;
  if (!usage) {
    return undefined;
  }
  const latencyMs = finitePositiveNumber(usage.latencyMs);
  if (latencyMs !== undefined) {
    return latencyMs;
  }
  const timeToFirstTokenMs = finitePositiveNumber(usage.timeToFirstTokenMs) ?? 0;
  const completionTokens = finitePositiveNumber(usage.completionTokens);
  const tokensPerSecond = finitePositiveNumber(usage.tokensPerSecond);
  if (completionTokens !== undefined && tokensPerSecond !== undefined) {
    return Math.max(1000, Math.round(timeToFirstTokenMs + (completionTokens / tokensPerSecond) * 1000));
  }
  if (timeToFirstTokenMs > 0) {
    return Math.max(1000, Math.round(timeToFirstTokenMs));
  }
  if (completionTokens !== undefined || finitePositiveNumber(usage.promptTokens) !== undefined) {
    return 1000;
  }
  return undefined;
}

function finitePositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function shouldShowAgentActivityBlock({
  events,
  isGenerating,
  legacyEventCount
}: {
  events: AgentActivityEvent[];
  isGenerating: boolean;
  legacyEventCount: number;
}) {
  const commandStartCount = events.filter(isCommandStartActivityEvent).length;
  const hasLiveActivity = commandStartCount >= 1 || events.some(isMeaningfulNonCommandActivityEvent);
  if (isGenerating) {
    // Token usage alone should not steal the first visible state from the
    // streaming assistant message. The user should see "Thinking" first; the
    // timed work log appears only when there is actual progress/tool content.
    return legacyEventCount > 0 || hasLiveActivity;
  }

  // Completed runs only keep a "Worked for…" summary when the turn actually did
  // work: at least one command/tool/memory/approval/error, or a substantial
  // chunk of reasoning text. A plain reply ("Hey!"), however long, gets no
  // summary. Legacy fixture tool events still surface for design/mock paths.
  if (legacyEventCount > 0) {
    return true;
  }

  return events.some(isWorthwhileActivityEvent);
}

function isWorthwhileActivityEvent(event: AgentActivityEvent) {
  // Only real work earns a "Worked for…" block: commands, tools, memory,
  // approvals, errors. Reasoning and narration are intermediate text and are
  // never surfaced.
  return (
    event.type === "command" ||
    Boolean(event.command) ||
    event.type === "tool" ||
    event.type === "memory" ||
    event.type === "approval" ||
    event.type === "error"
  );
}

function findMessageElementById(root: HTMLElement, messageId: string) {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-chat-message-id]")).find(
    (element) => element.dataset.chatMessageId === messageId
  ) ?? null;
}

function isElementNearViewport(element: HTMLElement, viewport: HTMLElement, marginPx: number) {
  const elementRect = element.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  return elementRect.bottom >= viewportRect.top - marginPx && elementRect.top <= viewportRect.bottom + marginPx;
}

function isMeaningfulActivityEvent(event: AgentActivityEvent) {
  if (event.type === "stream") {
    return false;
  }
  if (event.type === "elapsed") {
    return true;
  }
  if (event.type === "command" || event.command) {
    return true;
  }
  if (isRunLifecycleNoiseEvent(event)) {
    return false;
  }
  return Boolean(event.summary?.trim() || event.title?.trim());
}

function isMeaningfulNonCommandActivityEvent(event: AgentActivityEvent) {
  return !isCommandStartActivityEvent(event) && isMeaningfulActivityEvent(event);
}

function isCommandStartActivityEvent(event: AgentActivityEvent) {
  if (event.type !== "command" && !event.command) {
    return false;
  }
  return Boolean(event.command?.command || event.command?.args?.length || event.summary?.trim() || event.title?.trim());
}

function isRunLifecycleNoiseEvent(event: AgentActivityEvent) {
  if (event.type !== "status") {
    return false;
  }
  const label = `${event.title} ${event.summary ?? ""} ${event.hermes?.eventType ?? ""}`.trim();
  return /\b(?:run|message|response|stream)[\s._-]*(?:start|started|created|complete|completed|done|finished)\b/i.test(label);
}

