import { ArrowUp, Mic, Plus, Square } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import type { HermesCapabilityState, HermesUiCapabilities } from "@hermes-ui/hermes-client";
import styles from "./Composer.module.css";

type ComposerProps = {
  disabled?: boolean;
  isGenerating?: boolean;
  isStopRequested?: boolean;
  modelLabel?: string;
  modelState?: HermesUiCapabilities["models"];
  onSend: (message: string) => void;
  onStop?: () => void;
  stopControlState?: HermesCapabilityState;
};

export function Composer({
  disabled = false,
  isGenerating = false,
  isStopRequested = false,
  modelLabel = "Hermes default",
  modelState,
  onSend,
  onStop,
  stopControlState = "deferred"
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const canSend = draft.trim().length > 0 && !disabled && !isGenerating;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || disabled || isGenerating) {
      return;
    }
    setDraft("");
    onSend(message);
  }

  function stopGeneration() {
    if (!isGenerating || isStopRequested) {
      return;
    }
    onStop?.();
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
              <button
                className={styles.toolButton}
                type="button"
                aria-label="Attach context coming soon"
                title="Attach context controls are coming soon."
                disabled
              >
                <Plus size={17} />
              </button>
              <button
                className={styles.modelButton}
                type="button"
                aria-label="Provider and model selector disabled"
                title={modelSelectorTitle(modelState)}
                disabled
              >
                {modelLabel}
              </button>
            </div>
            <div className={styles.controlsRight}>
              <button
                className={styles.toolButton}
                type="button"
                aria-label="Voice input coming soon"
                title="Voice input is coming soon."
                disabled
              >
                <Mic size={16} />
              </button>
              <button
                className={[
                  styles.sendButton,
                  canSend ? styles.ready : "",
                  isGenerating ? styles.stopButton : ""
                ]
                  .filter(Boolean)
                  .join(" ")}
                type={isGenerating ? "button" : "submit"}
                disabled={isGenerating ? disabled || isStopRequested : disabled || draft.trim().length === 0}
                aria-label={isGenerating ? "Stop generation" : "Send message"}
                onClick={isGenerating ? stopGeneration : undefined}
                title={isGenerating ? stopControlTitle(stopControlState) : undefined}
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

function modelSelectorTitle(state?: HermesUiCapabilities["models"]) {
  if (!state) {
    return "Hermes model status is loading; runtime model switching is disabled.";
  }
  if (state.clientSelectable) {
    return "Runtime model switching is available through the verified Hermes BFF path.";
  }
  return state.reason || "Runtime model switching is not verified for the current Hermes session API.";
}

function stopControlTitle(state: HermesCapabilityState) {
  if (state === "unavailable") {
    return "Stop closes the active local stream if one is running; Hermes has not advertised run stop for this UI path.";
  }
  if (state === "available") {
    return "Stop generation by aborting the active browser-to-BFF stream. This is not a Hermes run-stop request.";
  }
  return "Stop generation by aborting the active browser-to-BFF stream. Server-side run stop remains deferred until chat uses Hermes runs.";
}
