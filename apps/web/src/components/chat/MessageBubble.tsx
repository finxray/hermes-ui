import { Link2 } from "lucide-react";
import type { ChatMessage } from "@/data/types";
import { CopyTextButton, MessageMarkdown } from "./MessageMarkdown";
import styles from "./MessageBubble.module.css";

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";
  const isStreaming = message.status === "streaming";

  return (
    <article
      className={styles.message}
      data-role={message.role}
      data-status={message.status ?? "complete"}
    >
      <div className={styles.card}>
        <div className={styles.head}>
          <span className={styles.author}>{message.author}</span>
          <span className={styles.meta}>{message.createdAt}</span>
          {message.status && message.status !== "complete" ? (
            <span className={styles.pill}>{message.status}</span>
          ) : null}
        </div>
        <div className={styles.content}>
          {message.content ? (
            isAssistant ? (
              <MessageMarkdown content={message.content} isStreaming={isStreaming} />
            ) : (
              message.content
                .split("\n")
                .map((paragraph, index) => <p key={`${message.id}-${index}`}>{paragraph}</p>)
            )
          ) : (
            <p className={styles.streamPlaceholder}>Waiting for Hermes...</p>
          )}
        </div>
        {isAssistant && message.content ? (
          <div className={styles.actionRow} aria-label="Assistant message actions">
            <CopyTextButton className={styles.messageCopyButton} label="Copy message" text={message.content} />
          </div>
        ) : null}
        {message.references ? (
          <div className={styles.referenceRow} aria-label="Mock retrieval references">
            {message.references.map((reference) => (
              <span className={styles.referenceChip} key={reference}>
                <Link2 size={13} aria-hidden="true" />
                {reference}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
