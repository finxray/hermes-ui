"use client";

import { Pencil } from "@/components/ui/AppIcons";
import { memo, useMemo } from "react";
import type { ChatMessage } from "@/data/types";
import { CollapsibleUserMessage } from "@/components/chat/CollapsibleUserMessage";
import { StreamingAssistantBody } from "@/components/chat/StreamingAssistantBody";
import type { StreamStatusLabel } from "@/lib/streamStatus";
import { CopyTextButton } from "./MessageMarkdown";
import styles from "./MessageBubble.module.css";
import markdownStyles from "./MessageMarkdown.module.css";

type MessageBubbleProps = {
  message: ChatMessage;
  onRevealComplete?: () => void;
  showFooterAlways?: boolean;
  streamStatusLabel?: StreamStatusLabel | null;
};

export const MessageBubble = memo(function MessageBubble({
  message,
  onRevealComplete,
  showFooterAlways = false,
  streamStatusLabel = null
}: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";
  const isStreaming = message.status === "streaming";
  const userParagraphs = useMemo(
    () => message.content.split("\n"),
    [message.content]
  );
  const showMessageFooter = Boolean(message.content) && !isStreaming;
  const usageParts = isAssistant ? formatUsageParts(message.usage) : [];

  if (!isAssistant) {
    return (
      <article
        className={styles.message}
        data-chat-message-id={message.id}
        data-role="user"
        data-status={message.status ?? "complete"}
      >
        <div className={styles.userStack}>
          <div className={styles.userBubble}>
            {message.content ? (
              <CollapsibleUserMessage messageId={message.id} paragraphs={userParagraphs} />
            ) : null}
          </div>
          {showMessageFooter ? (
            <div className={styles.messageFooter} aria-label="Message actions">
              <span className={styles.messageMeta}>{message.createdAt}</span>
              <div className={styles.messageActions}>
                <CopyTextButton
                  className={`${markdownStyles.iconActionButton} ${styles.messageActionButton}`}
                  icon={ChatCopyIcon}
                  label="Copy message"
                  text={message.content}
                  variant="icon"
                />
                <button
                  aria-label="Edit message coming soon"
                  className={`${markdownStyles.iconActionButton} ${styles.messageActionButton}`}
                  disabled
                  title="Edit message is coming soon."
                  type="button"
                >
                  <Pencil aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      className={styles.message}
      data-chat-message-id={message.id}
      data-footer-always={showFooterAlways ? "true" : "false"}
      data-role="assistant"
      data-status={message.status ?? "complete"}
    >
      <div className={styles.assistantStack}>
        <div className={styles.content}>
          {isStreaming || message.content ? (
            // Route completed assistant text through the same body so the reveal
            // that began while streaming can finish smoothly instead of snapping
            // to the full text the instant the status flips to "complete".
            <StreamingAssistantBody
              content={message.content}
              isStreaming={isStreaming}
              onRevealComplete={onRevealComplete}
              statusLabel={streamStatusLabel}
            />
          ) : message.status === "complete" ? (
            <p className={styles.emptyAssistantText}>Hermes completed without returning assistant text.</p>
          ) : null}
        </div>
        {showMessageFooter ? (
          <div className={`${styles.messageFooter} ${styles.assistantFooter}`} aria-label="Message actions">
            <div className={styles.messageActions}>
              <CopyTextButton
                className={`${markdownStyles.iconActionButton} ${styles.messageActionButton}`}
                icon={ChatCopyIcon}
                label="Copy message"
                text={message.content}
                variant="icon"
              />
            </div>
            <span className={styles.messageMeta}>{message.createdAt}</span>
            {usageParts.map((part) => (
              <span
                className={styles.usageMeta}
                key={part.key}
                title={part.title ?? "Provider or Hermes reported usage."}
              >
                {part.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
});

function ChatCopyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <rect x="6.2" y="2.7" width="10.6" height="10.6" rx="2.6" stroke="currentColor" strokeWidth="1.65" />
      <rect x="2.7" y="6.2" width="10.6" height="10.6" rx="2.6" fill="var(--bg-workspace-solid)" />
      <rect x="2.7" y="6.2" width="10.6" height="10.6" rx="2.6" stroke="currentColor" strokeWidth="1.65" />
    </svg>
  );
}

type UsagePart = {
  key: string;
  label: string;
  title?: string;
};

function formatUsageParts(usage: ChatMessage["usage"]) {
  if (!usage) {
    return [] as UsagePart[];
  }

  const parts: UsagePart[] = [];
  const usageTitle = usage.source === "estimated" ? "Estimated token usage." : "Provider or Hermes reported usage.";
  if (typeof usage.promptTokens === "number") {
    parts.push({ key: "in", label: `${formatCompactTokenCount(usage.promptTokens)} in`, title: usageTitle });
  }
  if (typeof usage.completionTokens === "number") {
    parts.push({ key: "out", label: `${formatCompactTokenCount(usage.completionTokens)} out`, title: usageTitle });
  }
  return parts;
}

function formatCompactTokenCount(value: number) {
  const safe = Math.max(0, Math.round(value));
  if (safe >= 1_000_000) {
    return `${formatCompactTokenValue(safe / 1_000_000)}m`;
  }
  if (safe >= 1_000) {
    return `${formatCompactTokenValue(safe / 1_000)}k`;
  }
  return new Intl.NumberFormat().format(safe);
}

function formatCompactTokenValue(value: number) {
  if (value >= 100) {
    return String(Math.round(value));
  }
  if (value >= 10) {
    return value.toFixed(1).replace(/\.0$/, "");
  }
  return value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1");
}
