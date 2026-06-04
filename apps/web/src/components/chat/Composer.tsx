import { ArrowUp, Check, ChevronDown, LoaderCircle, Mic, Plus, Square } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { HermesCapabilityState, HermesUiCapabilities } from "@hermes-ui/hermes-client";
import styles from "./Composer.module.css";

type ComposerProps = {
  contextItems?: Array<{
    label: string;
    value: string;
  }>;
  disabled?: boolean;
  isGenerating?: boolean;
  isStopRequested?: boolean;
  isStartState?: boolean;
  modelLabel?: string;
  modelState?: HermesUiCapabilities["models"];
  modelSelectInProgress?: boolean;
  onModelSelect?: (modelId: string) => void;
  onSend: (message: string) => void;
  onStop?: () => void;
  showContextPanel?: boolean;
  stopControlState?: HermesCapabilityState;
};

export function Composer({
  contextItems = [],
  disabled = false,
  isGenerating = false,
  isStopRequested = false,
  isStartState = false,
  modelLabel = "Hermes default",
  modelState,
  modelSelectInProgress = false,
  onModelSelect,
  onSend,
  onStop,
  showContextPanel = false,
  stopControlState = "deferred"
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [modelMenuStyle, setModelMenuStyle] = useState<CSSProperties | null>(null);
  const modelControlRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasDraft = getTrimmedDraft(textareaRef.current, draft).length > 0;
  const canSend = hasDraft && !disabled && !isGenerating;
  const modelOptions = modelState?.availableModels ?? [];
  const canSelectModel =
    Boolean(modelState?.clientSelectable) &&
    modelOptions.length > 1 &&
    Boolean(onModelSelect) &&
    !modelSelectInProgress;
  const streamBatchingDetail = "Streaming batches deltas with an animation-frame flush, not one React update per token.";

  useLayoutEffect(() => {
    if (!isModelMenuOpen) {
      setModelMenuStyle(null);
      return;
    }

    function updateModelMenuPosition() {
      const button = modelButtonRef.current;
      if (!button) {
        return;
      }

      const rect = button.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const menuWidth = Math.min(320, Math.max(220, viewportWidth - 24));
      const left = Math.min(Math.max(12, rect.left), viewportWidth - menuWidth - 12);
      const spaceAbove = Math.max(140, rect.top - 16);

      setModelMenuStyle({
        bottom: viewportHeight - rect.top + 8,
        left,
        maxHeight: Math.min(260, spaceAbove),
        width: menuWidth
      });
    }

    updateModelMenuPosition();
    window.addEventListener("resize", updateModelMenuPosition);
    window.addEventListener("scroll", updateModelMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateModelMenuPosition);
      window.removeEventListener("scroll", updateModelMenuPosition, true);
    };
  }, [isModelMenuOpen]);

  useEffect(() => {
    if (!isModelMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && modelControlRef.current?.contains(target)) {
        return;
      }
      if (target && modelMenuRef.current?.contains(target)) {
        return;
      }
      setIsModelMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsModelMenuOpen(false);
        modelButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModelMenuOpen]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const syncFromDom = () => {
      const next = textarea.value;
      setDraft((current) => (current === next ? current : next));
    };

    syncFromDom();
    textarea.addEventListener("input", syncFromDom);
    return () => textarea.removeEventListener("input", syncFromDom);
  }, []);

  function updateDraft(value: string) {
    setDraft(value);
  }

  function clearDraft() {
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.value = "";
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = getTrimmedDraft(textareaRef.current, draft);
    const canSubmit = message.length > 0 && !disabled && !isGenerating;
    if (!message || !canSubmit) {
      return;
    }
    clearDraft();
    onSend(message);
  }

  function stopGeneration() {
    if (!isGenerating || isStopRequested) {
      return;
    }
    onStop?.();
  }

  function toggleModelMenu() {
    if (!canSelectModel) {
      return;
    }
    setIsModelMenuOpen((current) => !current);
  }

  function selectModel(modelId: string) {
    setIsModelMenuOpen(false);
    onModelSelect?.(modelId);
  }

  const modelMenu =
    isModelMenuOpen && modelMenuStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            className={styles.modelMenu}
            ref={modelMenuRef}
            role="listbox"
            aria-label="Hermes model selector"
            style={modelMenuStyle}
          >
            {modelOptions.map((model) => {
              const isSelected = model.id === modelState?.selectedModelId;
              return (
                <button
                  className={styles.modelOption}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  key={model.id}
                  onClick={() => selectModel(model.id)}
                  title={model.provider ? `${model.id} (${model.provider})` : model.id}
                >
                  <span className={styles.modelOptionText}>
                    <span className={styles.modelOptionLabel}>{model.label}</span>
                    {model.provider ? (
                      <span className={styles.modelOptionProvider}>{model.provider}</span>
                    ) : null}
                  </span>
                  {isSelected ? <Check size={14} /> : null}
                </button>
              );
            })}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={styles.wrap} data-start-state={isStartState ? "true" : "false"}>
      <form className={styles.composer} aria-label="Message composer" onSubmit={submit}>
        <div className={styles.box}>
          <div className={styles.boxContent}>
            <textarea
              ref={textareaRef}
              aria-label="Message"
              disabled={disabled || isGenerating}
              placeholder={
                disabled
                  ? "Create or select a chat to send a message."
                  : "Message Hermes…"
              }
              value={draft}
              onChange={(event) => updateDraft(event.currentTarget.value)}
              onInput={(event) => updateDraft(event.currentTarget.value)}
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
                  className={`${styles.toolButton} ${styles.plusButton}`}
                  type="button"
                  aria-label="Attach context coming soon"
                  title="Attach context controls are coming soon."
                  disabled
                >
                  <Plus size={20} />
                </button>
                <div
                  className={styles.modelControl}
                  ref={modelControlRef}
                >
                  <button
                    className={styles.modelButton}
                    ref={modelButtonRef}
                    type="button"
                    aria-expanded={canSelectModel ? isModelMenuOpen : undefined}
                    aria-haspopup={canSelectModel ? "listbox" : undefined}
                    aria-label={modelButtonLabel(modelState, modelOptions.length)}
                    title={modelSelectorTitle(modelState, modelOptions.length)}
                    disabled={!canSelectModel}
                    onClick={toggleModelMenu}
                  >
                    <span className={styles.modelButtonText}>
                      {modelSelectInProgress ? "Selecting..." : modelLabel}
                    </span>
                    {modelSelectInProgress ? (
                      <LoaderCircle className={styles.modelSpinner} size={14} />
                    ) : canSelectModel ? (
                      <ChevronDown size={14} />
                    ) : null}
                  </button>
                </div>
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
                  data-ready={canSend ? "true" : "false"}
                  type={isGenerating ? "button" : "submit"}
                  disabled={isGenerating ? disabled || isStopRequested : !canSend}
                  aria-label={isGenerating ? "Stop generation" : "Send message"}
                  onClick={isGenerating ? stopGeneration : undefined}
                  title={isGenerating ? stopControlTitle(stopControlState) : undefined}
                >
                  {isGenerating ? <Square size={13} fill="currentColor" /> : <ArrowUp size={17} />}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div
          className={styles.contextPanel}
          data-visible={showContextPanel ? "true" : "false"}
          aria-hidden={showContextPanel ? undefined : "true"}
        >
          <div className={styles.contextPanelInner}>
            {contextItems.map((item) => (
              <span className={styles.contextItem} key={`${item.label}:${item.value}`}>
                <span className={styles.contextLabel}>{item.label}</span>
                <span className={styles.contextValue}>{item.value}</span>
              </span>
            ))}
            <span className={styles.contextItem}>
              <span className={styles.contextLabel}>Model</span>
              <span className={styles.contextValue}>{modelLabel}</span>
            </span>
          </div>
        </div>
        {isGenerating ? (
          <div className={styles.statusLine} title={streamBatchingDetail}>
            Generating response…
          </div>
        ) : null}
      </form>
      {modelMenu}
    </div>
  );
}

function getTrimmedDraft(textarea: HTMLTextAreaElement | null, draft: string) {
  return (textarea?.value ?? draft).trim();
}

function modelButtonLabel(state?: HermesUiCapabilities["models"], optionCount = 0) {
  if (state?.clientSelectable && optionCount > 1) {
    return "Select Hermes model";
  }
  if (state?.clientSelectable && optionCount === 1) {
    return "One Hermes model available";
  }
  return "Provider and model selector disabled";
}

function modelSelectorTitle(state?: HermesUiCapabilities["models"], optionCount = 0) {
  if (!state) {
    return "Hermes model status is loading; runtime model switching is disabled.";
  }
  if (state.clientSelectable && optionCount > 1) {
    return "Runtime model switching is available through the verified Hermes BFF path.";
  }
  if (state.clientSelectable && optionCount === 1) {
    return "Hermes has one configured model; there is nothing to switch for this session.";
  }
  if (state.selectionStatus === "server-configured") {
    return "Model is server-configured in Hermes. Web UI-safe model switching is not exposed yet; the selector stays read-only.";
  }
  if (state.selectionStatus === "unavailable") {
    return "Hermes is not reachable. Model information is unavailable until Hermes connects.";
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
