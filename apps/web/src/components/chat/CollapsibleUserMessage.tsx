"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./MessageBubble.module.css";

const COLLAPSED_MAX_HEIGHT_PX = 240;
const EXPAND_THRESHOLD_PX = 12;

type CollapsibleUserMessageProps = {
  messageId: string;
  paragraphs: string[];
};

export function CollapsibleUserMessage({ messageId, paragraphs }: CollapsibleUserMessageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const controlId = useId();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const node = contentRef.current;
    if (!node || isExpanded) {
      return;
    }
    const measure = () => {
      setIsOverflowing(node.scrollHeight > COLLAPSED_MAX_HEIGHT_PX + EXPAND_THRESHOLD_PX);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isExpanded, messageId, paragraphs]);

  const showToggle = isOverflowing || isExpanded;

  return (
    <div
      className={styles.userContentWrap}
      data-expanded={isExpanded ? "true" : "false"}
      data-overflowing={isOverflowing ? "true" : "false"}
    >
      <div
        ref={contentRef}
        className={styles.userContent}
        id={controlId}
        style={isExpanded ? undefined : { maxHeight: `${COLLAPSED_MAX_HEIGHT_PX}px` }}
      >
        {paragraphs.map((paragraph, index) => (
          <p key={`${messageId}-${index}`}>{paragraph}</p>
        ))}
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
