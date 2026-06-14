"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ShimmerStatusText } from "@/components/chat/ShimmerStatusText";
import { MessageMarkdown } from "@/components/chat/MessageMarkdown";
import type { StreamStatusLabel } from "@/lib/streamStatus";
import styles from "./MessageBubble.module.css";

// Reveal pacing is expressed per animation frame so it is independent of how
// long the model paused between bursts. A thinking model can be silent for
// seconds and then deliver its whole answer at once; the reveal must still play
// out smoothly instead of dumping everything in a single frame.
const REVEAL_MAX_CHARS_PER_FRAME = 32; // ~1900 chars/sec at 60fps: fast but legible
const REVEAL_MIN_CHARS_PER_FRAME = 2;
const REVEAL_CATCHUP_FRACTION = 0.16; // ease toward the cursor so big jumps still animate
const STREAM_SCROLL_FOLLOW_THRESHOLD_PX = 1_200;

type StreamingAssistantBodyProps = {
  content: string;
  isStreaming: boolean;
  onRevealComplete?: () => void;
  statusLabel: StreamStatusLabel | null;
};

export const StreamingAssistantBody = memo(function StreamingAssistantBody({
  content,
  isStreaming,
  onRevealComplete,
  statusLabel
}: StreamingAssistantBodyProps) {
  const visibleContent = useBufferedStreamingContent(content, isStreaming, onRevealComplete);
  const frameElementRef = useRef<HTMLDivElement>(null);
  const hasContent = visibleContent.trim().length > 0;
  const isRevealing = isStreaming || visibleContent !== content;
  const showStatus = Boolean(statusLabel) && isStreaming;
  const statusPhase = showStatus ? (hasContent ? "exit" : "active") : "hidden";

  useLayoutEffect(() => {
    if (!isRevealing || !visibleContent) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const viewport = findNearBottomScrollViewport(frameElementRef.current, isStreaming);
      if (!viewport) {
        return;
      }
      viewport.scrollTo({
        top: viewport.scrollHeight - viewport.clientHeight,
        behavior: "auto"
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isRevealing, isStreaming, visibleContent]);

  return (
    <div ref={frameElementRef} className={styles.streamingFrame} data-streaming={isRevealing ? "true" : "false"}>
      {showStatus ? (
        <div
          className={styles.streamStatus}
          data-phase={statusPhase}
          role="status"
          aria-live="polite"
          aria-label={statusLabel ?? undefined}
        >
          <ShimmerStatusText>{statusLabel!}</ShimmerStatusText>
        </div>
      ) : null}
      {hasContent ? (
        <div className={styles.streamContent} data-entering={showStatus ? "true" : "false"}>
          <MessageMarkdown content={visibleContent} isStreaming={isRevealing} />
        </div>
      ) : null}
      {showStatus && hasContent ? (
        <div className={styles.streamTrailingStatus} role="status" aria-live="polite">
          <ShimmerStatusText>{statusLabel!}</ShimmerStatusText>
        </div>
      ) : null}
    </div>
  );
});

function findNearBottomScrollViewport(element: HTMLElement | null, forceFollow = false) {
  const viewport = element?.closest<HTMLElement>('[data-chat-scroll-viewport="true"]');
  if (!viewport) {
    return null;
  }

  if (forceFollow) {
    return viewport;
  }

  const distanceFromBottom = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop;
  return distanceFromBottom <= STREAM_SCROLL_FOLLOW_THRESHOLD_PX ? viewport : null;
}

function useBufferedStreamingContent(content: string, isStreaming: boolean, onRevealComplete?: () => void) {
  const [visibleContent, setVisibleContent] = useState(() => (isStreaming ? "" : content));
  const frameRef = useRef<number | null>(null);
  const targetRef = useRef(content);
  const visibleRef = useRef(isStreaming ? "" : content);
  const onRevealCompleteRef = useRef(onRevealComplete);

  useEffect(() => {
    onRevealCompleteRef.current = onRevealComplete;
  }, [onRevealComplete]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    targetRef.current = content;

    // If the stream rewrote earlier text (not a pure append), resync to the
    // shared prefix so we never show characters that were retracted.
    if (!content.startsWith(visibleRef.current)) {
      visibleRef.current = commonPrefix(content, visibleRef.current);
      setVisibleContent(visibleRef.current);
    }

    if (visibleRef.current === content) {
      notifyRevealComplete();
      return;
    }

    scheduleReveal();

    function scheduleReveal() {
      if (frameRef.current !== null) {
        return;
      }
      frameRef.current = window.requestAnimationFrame(reveal);
    }

    function reveal() {
      frameRef.current = null;

      const target = targetRef.current;
      const remaining = target.length - visibleRef.current.length;
      if (remaining <= 0) {
        notifyRevealComplete();
        return;
      }

      // Per-frame step eases toward the cursor and is hard-capped, so a single
      // large jump (a buffered burst) reveals over many frames rather than one.
      const step = Math.min(
        remaining,
        Math.max(
          REVEAL_MIN_CHARS_PER_FRAME,
          Math.min(REVEAL_MAX_CHARS_PER_FRAME, Math.ceil(remaining * REVEAL_CATCHUP_FRACTION))
        )
      );
      const nextVisible = target.slice(0, visibleRef.current.length + step);
      visibleRef.current = nextVisible;
      setVisibleContent(nextVisible);

      if (nextVisible.length < target.length) {
        scheduleReveal();
      } else {
        notifyRevealComplete();
      }
    }

    function notifyRevealComplete() {
      if (!isStreaming && visibleRef.current === targetRef.current) {
        onRevealCompleteRef.current?.();
      }
    }
  }, [content, isStreaming]);

  return visibleContent;
}

function commonPrefix(left: string, right: string) {
  const length = Math.min(left.length, right.length);
  let index = 0;
  while (index < length && left[index] === right[index]) {
    index += 1;
  }
  return left.slice(0, index);
}
