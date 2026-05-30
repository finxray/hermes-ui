import { ArrowUp, Mic, Plus, Square } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import styles from "./Composer.module.css";

type ComposerProps = {
  disabled?: boolean;
  isGenerating?: boolean;
  modelLabel?: string;
  onSend: (message: string) => void;
};

export function Composer({
  disabled = false,
  isGenerating = false,
  modelLabel = "Hermes default",
  onSend
}: ComposerProps) {
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
    <div className={styles.wrap}>
      <form className={styles.composer} aria-label="Message composer" onSubmit={submit}>
        <div className={styles.box}>
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
          <div className={styles.controls} aria-label="Composer controls">
            <div className={styles.controlsLeft}>
              <button className={styles.toolButton} type="button" aria-label="Attach context">
                <Plus size={17} />
              </button>
              <button className={styles.modelButton} type="button" aria-label="Selected model">
                {modelLabel}
              </button>
            </div>
            <div className={styles.controlsRight}>
              <button className={styles.toolButton} type="button" aria-label="Voice input">
                <Mic size={16} />
              </button>
              <button
                className={`${styles.sendButton} ${isGenerating ? styles.stopButton : ""}`}
                type="submit"
                disabled={disabled || isGenerating || draft.trim().length === 0}
                aria-label={isGenerating ? "Stop response placeholder" : "Send message"}
                title={
                  isGenerating
                    ? "Stop response will be wired with streaming cancellation."
                    : undefined
                }
              >
                {isGenerating ? <Square size={13} fill="currentColor" /> : <ArrowUp size={17} />}
              </button>
            </div>
          </div>
        </div>
        <div className={styles.note}>
          {isGenerating
            ? "Hermes is responding. Deltas are buffered and flushed on animation frames."
            : "Streaming batches deltas with an animation-frame flush, not one React update per token."}
        </div>
      </form>
    </div>
  );
}
