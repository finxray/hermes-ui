import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { AgentActivityBlock } from "@/components/chat/AgentActivityBlock";
import { EmptyState } from "@/components/ui/EmptyState";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { resolveStreamStatusLabel } from "@/lib/streamStatus";
import type { Project, Session } from "@/data/types";
import type { AgentActivityEvent } from "@/types/agentActivity";
import styles from "./ChatView.module.css";

type ChatTranscriptProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  ariaLabel?: string;
  bannerIcon: ReactNode;
  bottomClearancePx?: number;
  createSession: () => void;
  isStartState?: boolean;
};

export function ChatTranscript({
  activeProject,
  activeSession,
  activityEvents,
  ariaLabel,
  bannerIcon,
  bottomClearancePx,
  createSession,
  isStartState = false
}: ChatTranscriptProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const previousSessionIdRef = useRef<string | undefined>(undefined);
  const needsBottomSnapRef = useRef(false);
  const previousStreamContentLenRef = useRef(0);
  const lastMessage = activeSession?.messages.at(-1);
  const messageCount = activeSession?.messages.length ?? 0;
  const isStreamingAssistant =
    lastMessage?.role === "assistant" && lastMessage.status === "streaming";
  const streamStatusLabel = isStreamingAssistant ? resolveStreamStatusLabel(activityEvents) : null;

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
      return;
    }

    const addedMessages = messageCount > previousMessageCountRef.current;
    previousMessageCountRef.current = messageCount;
    if (!addedMessages) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollToBottom(prefersReducedMotion ? "auto" : "smooth");
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

    scrollToBottom("auto");
    needsBottomSnapRef.current = false;
  }, [activeSession?.id, bottomClearancePx, isStartState, messageCount]);

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
    if (!needsBottomSnapRef.current && !isNearBottom(scrollViewport, scrollThreshold)) {
      return;
    }

    if (!grew && !isStreamingAssistant) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const firstTokensArrived = wasEmpty && contentLen > 0;
    scrollToBottom(firstTokensArrived && !prefersReducedMotion ? "smooth" : "auto");
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
        <div className={styles.mockBanner} role="status" aria-label="Connection status">
          {bannerIcon}
          <span>Hermes is reached through the BFF when available; offline turns stay local.</span>
        </div>
        {isStartState ? (
          <div className={styles.startHero}>
            <span className={styles.startEyebrow}>{activeProject.name}</span>
            <h2>What should Hermes work on?</h2>
          </div>
        ) : activeSession ? (
          activeSession.messages.length > 0 ? (
            activeSession.messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                streamStatusLabel={message.id === lastMessage?.id ? streamStatusLabel : null}
              />
            ))
          ) : (
            <EmptyState
              title="New chat is empty"
              body="Send a message to use real Hermes when configured, or a local mock fallback when unavailable."
            />
          )
        ) : (
          <EmptyState
            title="No chats in this project"
            body="Projects can exist without sessions. Create a new local mock chat when you want a transcript under this project."
            actionLabel="New chat"
            onAction={createSession}
          />
        )}
        {activeSession ? (
          <AgentActivityBlock events={activityEvents} legacyEvents={activeSession.toolEvents} />
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
