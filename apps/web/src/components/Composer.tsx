import { SendHorizontal } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

type ComposerProps = {
  disabled?: boolean;
  isGenerating?: boolean;
  onSend: (message: string) => void;
};

export function Composer({ disabled = false, isGenerating = false, onSend }: ComposerProps) {
  const [draft, setDraft] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || disabled || isGenerating) {
      return;
    }
    setDraft("");
    onSend(message);
  }

  return (
    <div className="composer-wrap">
      <form className="composer" aria-label="Message composer" onSubmit={submit}>
        <div className="composer-box">
          <textarea
            aria-label="Message"
            disabled={disabled || isGenerating}
            placeholder={
              disabled
                ? "Create or select a chat to send a message."
                : "Message Hermes through the local BFF..."
            }
            value={draft}
            onChange={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            className="send-button"
            type="submit"
            disabled={disabled || isGenerating || draft.trim().length === 0}
            aria-label="Send message"
          >
            <SendHorizontal size={17} />
          </button>
        </div>
        <div className="composer-note">
          {isGenerating
            ? "Hermes is responding. Deltas are buffered and flushed on animation frames."
            : "Streaming batches deltas with an animation-frame flush, not one React update per token."}
        </div>
      </form>
    </div>
  );
}
