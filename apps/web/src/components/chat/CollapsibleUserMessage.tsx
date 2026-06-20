"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./MessageBubble.module.css";

const COLLAPSED_MAX_HEIGHT_PX = 220;
const EXPAND_THRESHOLD_PX = 12;

type CollapsibleUserMessageProps = {
  messageId: string;
  paragraphs: string[];
};

export function CollapsibleUserMessage({ messageId, paragraphs }: CollapsibleUserMessageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const controlId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const node = contentRef.current;
    if (!node) {
      return;
    }

    const measure = () => {
      const nextHeight = node.scrollHeight;
      setFullHeight(nextHeight);
      setIsOverflowing(nextHeight > COLLAPSED_MAX_HEIGHT_PX + EXPAND_THRESHOLD_PX);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [messageId, paragraphs]);

  const showToggle = isOverflowing || isExpanded;
  const collapsedHeight = Math.min(fullHeight, COLLAPSED_MAX_HEIGHT_PX);
  const shellStyle =
    isOverflowing && fullHeight > 0
      ? { maxHeight: isExpanded ? fullHeight : collapsedHeight }
      : undefined;

  return (
    <div
      className={styles.userContentWrap}
      data-expanded={isExpanded ? "true" : "false"}
      data-overflowing={isOverflowing ? "true" : "false"}
    >
      <div
        className={styles.userContentShell}
        data-expanded={isExpanded ? "true" : "false"}
        data-overflowing={isOverflowing ? "true" : "false"}
        style={shellStyle}
      >
        <div ref={contentRef} className={styles.userContent} id={controlId}>
          {paragraphs.map((paragraph, index) => (
            <p key={`${messageId}-${index}`}>{paragraph}</p>
          ))}
        </div>
      </div>
      {showToggle ? (
        <button
          type="button"
          className={styles.userExpandButton}
          aria-expanded={isExpanded}
          aria-controls={controlId}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
