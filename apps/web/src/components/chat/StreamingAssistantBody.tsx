import { memo } from "react";
import { ShimmerStatusText } from "@/components/chat/ShimmerStatusText";
import { MessageMarkdown } from "@/components/chat/MessageMarkdown";
import type { StreamStatusLabel } from "@/lib/streamStatus";
import styles from "./MessageBubble.module.css";

type StreamingAssistantBodyProps = {
  content: string;
  isStreaming: boolean;
  statusLabel: StreamStatusLabel | null;
};

export const StreamingAssistantBody = memo(function StreamingAssistantBody({
  content,
  isStreaming,
  statusLabel
}: StreamingAssistantBodyProps) {
  const hasContent = content.trim().length > 0;
  const showStatus = Boolean(statusLabel) && isStreaming;
  const statusPhase = showStatus ? (hasContent ? "exit" : "active") : "hidden";

  return (
    <div className={styles.streamingFrame} data-streaming={isStreaming ? "true" : "false"}>
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
          <MessageMarkdown content={content} isStreaming={isStreaming} />
        </div>
      ) : null}
    </div>
  );
});
