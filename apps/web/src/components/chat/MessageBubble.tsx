import { Pencil } from "lucide-react";
import { memo, useMemo } from "react";
import type { ChatMessage } from "@/data/types";
import { CollapsibleUserMessage } from "@/components/chat/CollapsibleUserMessage";
import { StreamingAssistantBody } from "@/components/chat/StreamingAssistantBody";
import type { StreamStatusLabel } from "@/lib/streamStatus";
import { CopyTextButton, MessageMarkdown } from "./MessageMarkdown";
import styles from "./MessageBubble.module.css";
import markdownStyles from "./MessageMarkdown.module.css";

type MessageBubbleProps = {
  message: ChatMessage;
  streamStatusLabel?: StreamStatusLabel | null;
};

export const MessageBubble = memo(function MessageBubble({
  message,
  streamStatusLabel = null
}: MessageBubbleProps) {
  const isAssistant = message.role === "assistant";
  const isStreaming = message.status === "streaming";
  const userParagraphs = useMemo(
    () => message.content.split("\n"),
    [message.content]
  );
  const showMessageFooter = Boolean(message.content) && !isStreaming;

  if (!isAssistant) {
    return (
      <article
        className={styles.message}
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
                  className={markdownStyles.iconActionButton}
                  label="Copy message"
                  text={message.content}
                  variant="icon"
                />
                <button
                  aria-label="Edit message coming soon"
                  className={markdownStyles.iconActionButton}
                  disabled
                  title="Edit message is coming soon."
                  type="button"
                >
                  <Pencil size={16} aria-hidden="true" />
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
      data-role="assistant"
      data-status={message.status ?? "complete"}
    >
      <div className={styles.assistantStack}>
        <div className={styles.content}>
          {isStreaming ? (
            <StreamingAssistantBody
              content={message.content}
              isStreaming={isStreaming}
              statusLabel={streamStatusLabel}
            />
          ) : message.content ? (
            <MessageMarkdown content={message.content} isStreaming={false} />
          ) : null}
        </div>
        {showMessageFooter ? (
          <div className={`${styles.messageFooter} ${styles.assistantFooter}`} aria-label="Message actions">
            <span className={styles.messageMeta}>{message.createdAt}</span>
            <div className={styles.messageActions}>
              <CopyTextButton
                className={markdownStyles.iconActionButton}
                label="Copy message"
                text={message.content}
                variant="icon"
              />
            </div>
          </div>
        ) : null}
      </div>
    </article>
  );
});
