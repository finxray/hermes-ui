import { Link2 } from "lucide-react";
import type { ChatMessage } from "@/data/types";

type MessageBubbleProps = {
  message: ChatMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const initials = message.role === "assistant" ? "H" : "A";

  return (
    <article className="message" data-role={message.role}>
      <div className="message-avatar" aria-hidden="true">
        {initials}
      </div>
      <div className="message-card">
        <div className="message-head">
          <span className="message-author">{message.author}</span>
          <span className="message-meta">{message.createdAt}</span>
        </div>
        <div className="message-content">
          {message.content.split("\n").map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {message.references ? (
          <div className="reference-row" aria-label="Mock retrieval references">
            {message.references.map((reference) => (
              <span className="reference-chip" key={reference}>
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
