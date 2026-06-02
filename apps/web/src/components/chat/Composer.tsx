import { ArrowUp, Check, ChevronDown, LoaderCircle, Mic, Plus, Square } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
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
  const [displacementMapHref, setDisplacementMapHref] = useState(NEUTRAL_DISPLACEMENT_MAP);
  const [displacementScale, setDisplacementScale] = useState(-86);
  const boxRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === "undefined") {
      return;
    }

    function updateDisplacementMap() {
      if (!box) {
        return;
      }
      const rect = box.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const radius = Math.min(30, Math.round(Math.min(width, height) / 2));
      setDisplacementMapHref(buildComposerDisplacementMap({ height, radius, width }));
      setDisplacementScale(getComposerDisplacementScale({ height, width }));
    }

    updateDisplacementMap();
    const observer = new ResizeObserver(updateDisplacementMap);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

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

  return (
    <div className={styles.wrap} data-start-state={isStartState ? "true" : "false"}>
      <svg className={styles.filterDefs} aria-hidden="true" focusable="false">
        <defs>
          <filter id="composerGlassFilter" colorInterpolationFilters="sRGB">
            <feImage
              x="0"
              y="0"
              width="100%"
              height="100%"
              href={displacementMapHref}
              preserveAspectRatio="none"
              result="map"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="map"
              scale={displacementScale}
              xChannelSelector="R"
              yChannelSelector="B"
              result="displaced"
            />
            <feGaussianBlur in="displaced" stdDeviation="1.15" />
          </filter>
        </defs>
      </svg>
      <form className={styles.composer} aria-label="Message composer" onSubmit={submit}>
        <div className={styles.box} ref={boxRef}>
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
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setIsModelMenuOpen(false);
                    }
                  }}
                >
                  {isModelMenuOpen ? (
                    <div className={styles.modelMenu} role="listbox" aria-label="Hermes model selector">
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
                    </div>
                  ) : null}
                  <button
                    className={styles.modelButton}
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
    </div>
  );
}

function getTrimmedDraft(textarea: HTMLTextAreaElement | null, draft: string) {
  return (textarea?.value ?? draft).trim();
}

const NEUTRAL_DISPLACEMENT_MAP =
  "data:image/svg+xml,%3Csvg%20viewBox%3D%220%200%201%201%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%3Crect%20width%3D%221%22%20height%3D%221%22%20fill%3D%22rgb(128%20128%20128)%22%2F%3E%3C%2Fsvg%3E";

function buildComposerDisplacementMap({
  height,
  radius,
  width
}: {
  height: number;
  radius: number;
  width: number;
}) {
  const border = Math.min(width, height) * 0.035;
  const innerWidth = Math.max(1, width - border * 2);
  const innerHeight = Math.max(1, height - border * 2);
  const svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<defs>
<linearGradient id="red" x1="100%" y1="0%" x2="0%" y2="0%">
<stop offset="0%" stop-color="#000"/>
<stop offset="100%" stop-color="red"/>
</linearGradient>
<linearGradient id="blue" x1="0%" y1="0%" x2="0%" y2="100%">
<stop offset="0%" stop-color="#000"/>
<stop offset="100%" stop-color="blue"/>
</linearGradient>
</defs>
<rect x="0" y="0" width="${width}" height="${height}" fill="black"/>
<rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="url(#red)"/>
<rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" fill="url(#blue)" style="mix-blend-mode:difference"/>
<rect x="${border}" y="${border}" width="${innerWidth}" height="${innerHeight}" rx="${radius}" fill="hsl(0 0% 50% / 0.93)" style="filter:blur(11px)"/>
</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function getComposerDisplacementScale({ height, width }: { height: number; width: number }) {
  const demoWidth = 336;
  const demoScale = -58;
  const widthRatio = Math.min(2.8, Math.max(1, width / demoWidth));
  const aspectBoost = Math.min(1.25, Math.max(1, width / Math.max(height * 4, 1)));
  return Math.round(demoScale * widthRatio * aspectBoost);
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
