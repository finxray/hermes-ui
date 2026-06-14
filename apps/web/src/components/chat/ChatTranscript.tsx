import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AgentActivityBlock } from "@/components/chat/AgentActivityBlock";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { resolveStreamStatusLabel } from "@/lib/streamStatus";
import type { LiveTokenUsageSnapshot } from "@/components/chat/LiveTokenUsageTicker";
import type { Project, Session } from "@/data/types";
import type { AgentActivityEvent } from "@/types/agentActivity";
import styles from "./ChatView.module.css";

const ACTIVITY_REVEAL_DELAY_MS = 5_000;

type ChatTranscriptProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  ariaLabel?: string;
  bottomClearancePx?: number;
  createSession: () => void;
  generationStartedAt?: string | null;
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
  const [activityDelayElapsed, setActivityDelayElapsed] = useState(false);
  const lastMessage = activeSession?.messages.at(-1);
  const messageCount = activeSession?.messages.length ?? 0;
  const activityAnchorMessage = activeSession
    ? [...activeSession.messages].reverse().find((message) => message.role === "assistant")
    : undefined;
  const activityAnchorMessageId = activityAnchorMessage?.id;
  const isStreamingAssistant =
    lastMessage?.role === "assistant" && lastMessage.status === "streaming";
  const streamStatusLabel =
    isStreamingAssistant && isGenerating ? resolveStreamStatusLabel(activityEvents) : null;
  const shouldShowActivityBlock = activeSession
    ? shouldShowAgentActivityBlock({
        activityDelayElapsed,
        assistantContent: activityAnchorMessage?.content ?? "",
        events: activityEvents,
        isGenerating,
        legacyEventCount: activeSession.toolEvents.length,
        liveTokenUsage
      })
    : false;
  const activitySignal = `${shouldShowActivityBlock ? "visible" : "hidden"}:${activityEvents.length}:${activeSession?.toolEvents.length ?? 0}`;
  const activityBlock = activeSession && shouldShowActivityBlock ? (
    <AgentActivityBlock
      events={activityEvents}
      isWorking={isGenerating}
      legacyEvents={activeSession.toolEvents}
      liveTokenUsage={liveTokenUsage}
      startedAt={generationStartedAt}
    />
  ) : null;

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
      top: scrollViewport.scrollHeight - scrollViewport.clientHeight,
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

  useLayoutEffect(() => {
    return () => {
      if (bottomFollowFrameRef.current !== null) {
        window.cancelAnimationFrame(bottomFollowFrameRef.current);
        bottomFollowFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isGenerating || !generationStartedAt) {
      setActivityDelayElapsed(false);
      return;
    }

    const startedAtMs = Date.parse(generationStartedAt);
    if (!Number.isFinite(startedAtMs)) {
      const timer = window.setTimeout(() => setActivityDelayElapsed(true), ACTIVITY_REVEAL_DELAY_MS);
      return () => window.clearTimeout(timer);
    }

    const remainingMs = Math.max(0, ACTIVITY_REVEAL_DELAY_MS - (Date.now() - startedAtMs));
    if (remainingMs === 0) {
      setActivityDelayElapsed(true);
      return;
    }

    setActivityDelayElapsed(false);
    const timer = window.setTimeout(() => setActivityDelayElapsed(true), remainingMs);
    return () => window.clearTimeout(timer);
  }, [generationStartedAt, isGenerating]);

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
    } else if (isGenerating) {
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
    isGenerating,
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
    if (!isGenerating && !needsBottomSnapRef.current && !isNearBottom(scrollViewport, scrollThreshold)) {
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
                {message.id === activityAnchorMessageId ? activityBlock : null}
                <MessageBubble
                  message={message}
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

function shouldShowAgentActivityBlock({
  activityDelayElapsed,
  assistantContent,
  events,
  isGenerating,
  legacyEventCount,
  liveTokenUsage
}: {
  activityDelayElapsed: boolean;
  assistantContent: string;
  events: AgentActivityEvent[];
  isGenerating: boolean;
  legacyEventCount: number;
  liveTokenUsage: LiveTokenUsageSnapshot | null;
}) {
  const hasSubstantialContent = hasSubstantialAssistantContent(assistantContent);
  const commandStartCount = events.filter(isCommandStartActivityEvent).length;
  const hasLiveActivity = commandStartCount >= 2 || events.some(isMeaningfulNonCommandActivityEvent);
  const hasLiveTokenUsage =
    typeof liveTokenUsage?.promptTokens === "number" ||
    typeof liveTokenUsage?.completionTokens === "number";

  if (isGenerating) {
    return hasLiveTokenUsage || (activityDelayElapsed && (legacyEventCount > 1 || hasLiveActivity || hasSubstantialContent));
  }

  if (legacyEventCount > 0 || events.some(isMeaningfulActivityEvent)) {
    return true;
  }

  return false;
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
  const label = `${event.title} ${event.summary ?? ""}`.trim();
  return /\brun\s+(started|completed)\b/i.test(label);
}

function hasSubstantialAssistantContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }
  const visibleLines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (visibleLines.length > 5) {
    return true;
  }
  const sentenceCount = trimmed.split(/[.!?](?:\s|$)/).filter((part) => part.trim().length > 0).length;
  return sentenceCount > 5 || trimmed.length > 420;
}
