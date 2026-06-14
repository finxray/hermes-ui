import { ArrowUp, Check, ChevronDown, LoaderCircle, Plus, Search, Square } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { CSSProperties } from "react";
import type { HermesCapabilityState, HermesUiCapabilities } from "@hermes-ui/hermes-client";
import { LiveTokenUsageTicker, type LiveTokenUsageSnapshot } from "@/components/chat/LiveTokenUsageTicker";
import styles from "./Composer.module.css";

const COMPOSER_CONTENT_INSET_X = 15;
const MODEL_MENU_EMERGE_OFFSET = 50;
const MODEL_MENU_ANIMATION_MS = 500;

type ModelMenuStyle = CSSProperties & {
  "--model-menu-max-height": string;
};

type ComposerProps = {
  contextItems?: Array<{
    label: string;
    value: string;
  }>;
  disabled?: boolean;
  draftStorageKey?: string;
  isGenerating?: boolean;
  isStopRequested?: boolean;
  isStartState?: boolean;
  liveTokenUsage?: LiveTokenUsageSnapshot | null;
  modelLabel?: string;
  modelSelectError?: string | null;
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
  draftStorageKey,
  isGenerating = false,
  isStopRequested = false,
  isStartState = false,
  liveTokenUsage = null,
  modelLabel = "Hermes default",
  modelSelectError = null,
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
  const [modelMenuClosing, setModelMenuClosing] = useState(false);
  const [modelMenuReady, setModelMenuReady] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [modelMenuStyle, setModelMenuStyle] = useState<CSSProperties | null>(null);
  const [prefersReducedTransparency, setPrefersReducedTransparency] = useState(false);
  const modelMenuMounted = isModelMenuOpen || modelMenuClosing;
  const modelMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composerBoxRef = useRef<HTMLDivElement>(null);
  const modelControlRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const modelSearchRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const hasDraft = getTrimmedDraft(textareaRef.current, draft).length > 0;
  const canSend = hasDraft && !disabled && !isGenerating && !modelSelectInProgress;
  const modelOptions = modelState?.availableModels ?? [];
  const canSelectModel =
    Boolean(modelState?.clientSelectable) &&
    modelOptions.length > 1 &&
    Boolean(onModelSelect) &&
    !modelSelectInProgress;
  const streamBatchingDetail = "Streaming batches deltas with an animation-frame flush, not one React update per token.";
  const showLiveTokenUsage =
    typeof liveTokenUsage?.promptTokens === "number" ||
    typeof liveTokenUsage?.completionTokens === "number";

  useLayoutEffect(() => {
    if (!modelMenuMounted) {
      setModelMenuStyle(null);
      return;
    }

    function updateModelMenuPosition() {
      const box = composerBoxRef.current;
      if (!box) {
        return;
      }

      const rect = box.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const edgeInset = 12;
      const contentInsetX = COMPOSER_CONTENT_INSET_X;
      const width = rect.width - contentInsetX * 2;
      const left = Math.min(
        Math.max(edgeInset, rect.left + contentInsetX),
        viewportWidth - width - edgeInset
      );
      const bottom = viewportHeight - rect.top - MODEL_MENU_EMERGE_OFFSET;
      const availableAbove = Math.max(180, rect.top + MODEL_MENU_EMERGE_OFFSET - edgeInset);
      const maxHeight = Math.min(Math.round(viewportHeight * 0.5), availableAbove);
      const transparencyStyle = prefersReducedTransparency
        ? {}
        : {
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)"
          };

      const nextStyle: ModelMenuStyle = {
        bottom,
        left,
        width,
        maxHeight,
        ...transparencyStyle,
        "--model-menu-max-height": `${maxHeight}px`
      };

      setModelMenuStyle(nextStyle);
    }

    updateModelMenuPosition();
    window.addEventListener("resize", updateModelMenuPosition);
    window.addEventListener("scroll", updateModelMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateModelMenuPosition);
      window.removeEventListener("scroll", updateModelMenuPosition, true);
    };
  }, [modelMenuMounted, prefersReducedTransparency]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-transparency: reduce)");
    const updatePreference = () => setPrefersReducedTransparency(media.matches);

    updatePreference();
    media.addEventListener("change", updatePreference);
    return () => media.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    if (!isModelMenuOpen || modelMenuClosing) {
      setModelMenuReady(false);
      return;
    }

    setModelMenuReady(false);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setModelMenuReady(true));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isModelMenuOpen, modelMenuClosing]);

  useEffect(() => {
    if (!isModelMenuOpen || modelMenuClosing) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      modelSearchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [isModelMenuOpen, modelMenuClosing]);

  useEffect(() => {
    if (!modelMenuMounted) {
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
      closeModelMenu();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeModelMenu();
        modelButtonRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modelMenuMounted]);

  useEffect(() => {
    return () => {
      if (modelMenuCloseTimerRef.current) {
        clearTimeout(modelMenuCloseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!draftStorageKey) {
      return;
    }
    const savedDraft = readComposerDraft(draftStorageKey);
    setDraft(savedDraft);
    if (textareaRef.current) {
      textareaRef.current.value = savedDraft;
    }
  }, [draftStorageKey]);

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
    if (draftStorageKey) {
      writeComposerDraft(draftStorageKey, value);
    }
  }

  function clearDraft() {
    setDraft("");
    if (textareaRef.current) {
      textareaRef.current.value = "";
    }
    if (draftStorageKey) {
      clearComposerDraft(draftStorageKey);
    }
  }

  function focusComposerInput() {
    const textarea = textareaRef.current;
    if (!textarea || disabled) {
      return;
    }
    textarea.focus({ preventScroll: true });
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
    focusComposerInput();
    window.requestAnimationFrame(focusComposerInput);
  }

  function stopGeneration() {
    if (!isGenerating || isStopRequested) {
      return;
    }
    onStop?.();
  }

  function openModelMenu() {
    if (modelMenuCloseTimerRef.current) {
      clearTimeout(modelMenuCloseTimerRef.current);
      modelMenuCloseTimerRef.current = null;
    }
    setModelMenuClosing(false);
    setIsModelMenuOpen(true);
  }

  function closeModelMenu() {
    if (!isModelMenuOpen || modelMenuClosing) {
      return;
    }
    setModelMenuClosing(true);
    setModelMenuReady(false);
    modelMenuCloseTimerRef.current = setTimeout(() => {
      setIsModelMenuOpen(false);
      setModelMenuClosing(false);
      modelMenuCloseTimerRef.current = null;
    }, MODEL_MENU_ANIMATION_MS);
  }

  function toggleModelMenu() {
    if (!canSelectModel) {
      return;
    }
    if (isModelMenuOpen && !modelMenuClosing) {
      closeModelMenu();
      return;
    }
    if (!isModelMenuOpen) {
      openModelMenu();
    }
  }

  function selectModel(modelId: string) {
    closeModelMenu();
    setModelSearch("");
    onModelSelect?.(modelId);
  }

  const modelGroups = groupModelOptions(modelOptions, modelSearch);

  const modelMenuState = modelMenuClosing ? "closing" : modelMenuReady ? "open" : "entering";

  const modelMenu =
    modelMenuMounted && modelMenuStyle ? (
      <div
        className={styles.modelMenu}
        ref={modelMenuRef}
        role="dialog"
        aria-label="Model browser"
        data-state={modelMenuState}
        style={modelMenuStyle}
      >
        <div className={styles.modelMenuContent}>
          <div className={styles.modelSearchWrap}>
            <Search size={16} aria-hidden="true" />
            <input
              ref={modelSearchRef}
              aria-label="Search models"
              value={modelSearch}
              onChange={(event) => setModelSearch(event.currentTarget.value)}
              placeholder="Search models"
            />
          </div>
          <div className={styles.modelSections} role="listbox" aria-label="Available models">
            <ModelSection
              title="Hermes Configured"
              count={modelGroups.hermes.length}
              models={modelGroups.hermes}
              selectedModelId={modelState?.selectedModelId ?? null}
              onSelect={selectModel}
              headerTone="configured"
            />
            <ModelSection
              title="OpenRouter"
              count={modelGroups.openRouter.length}
              models={modelGroups.openRouter}
              selectedModelId={modelState?.selectedModelId ?? null}
              onSelect={selectModel}
              headerTone="configured"
            />
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div
      className={styles.wrap}
      data-start-state={isStartState ? "true" : "false"}
      data-model-menu-open={modelMenuMounted ? "true" : "false"}
    >
      {modelMenu}
      <form className={styles.composer} aria-label="Message composer" onSubmit={submit}>
        <div className={styles.box} data-composer-box ref={composerBoxRef}>
          <div className={styles.boxContent}>
            <textarea
              ref={textareaRef}
              aria-label="Message"
              disabled={disabled}
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
                <div className={styles.modelRow}>
                  <div className={styles.modelControl} ref={modelControlRef}>
                    <button
                      className={styles.modelButton}
                      ref={modelButtonRef}
                      type="button"
                      aria-expanded={canSelectModel ? modelMenuMounted : undefined}
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
                  {showLiveTokenUsage ? (
                    <div className={styles.liveTokenSlot} aria-live="polite">
                      <LiveTokenUsageTicker
                        completionTokens={liveTokenUsage?.completionTokens}
                        promptTokens={liveTokenUsage?.promptTokens}
                        variant="composer"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              <div className={styles.controlsRight}>
                <button
                  className={`${styles.toolButton} ${styles.micButton}`}
                  type="button"
                  aria-label="Voice input coming soon"
                  title="Voice input is coming soon."
                  disabled
                >
                  <span className={styles.micIcon} aria-hidden="true">
                    <span className={styles.micCapsule} />
                    <span className={styles.micYoke} />
                    <span className={styles.micStem} />
                  </span>
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
            {contextItems.map((item, index) => (
              <span
                className={styles.contextItem}
                key={`${item.label}:${item.value}`}
                style={{ "--context-item-index": index } as CSSProperties}
              >
                <span className={styles.contextLabel}>{item.label}</span>
                <span className={styles.contextValue}>{item.value}</span>
              </span>
            ))}
            <span
              className={styles.contextItem}
              style={{ "--context-item-index": contextItems.length } as CSSProperties}
            >
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
      {modelSelectError ? (
        <p className={styles.modelSelectError} role="alert">
          {modelSelectError}
        </p>
      ) : null}
    </div>
  );
}

function ModelSection({
  count,
  headerTone = "default",
  models,
  onSelect,
  selectedModelId,
  title
}: {
  count: number;
  headerTone?: "default" | "configured";
  models: NonNullable<HermesUiCapabilities["models"]["availableModels"]>;
  onSelect: (modelId: string) => void;
  selectedModelId: string | null;
  title: string;
}) {
  return (
    <section className={styles.modelSection} aria-label={title}>
      <div
        className={[
          styles.modelSectionHeader,
          headerTone === "configured" ? styles.modelSectionHeaderConfigured : ""
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={styles.modelSectionTitle}>{title}</span>
        <span className={styles.modelSectionCount}>{count}</span>
      </div>
      <div className={styles.modelOptionGrid}>
        {models.length > 0 ? (
          models.map((model) => {
            const isSelected = model.id === selectedModelId;
            const isLocalManaged = model.catalogSource === "ui-lmstudio";
            const notLoaded = model.availability === "not-loaded";
            const disabled = notLoaded;
            return (
              <button
                className={[styles.modelOption, disabled ? styles.modelOptionDisabled : ""]
                  .filter(Boolean)
                  .join(" ")}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={disabled || undefined}
                disabled={disabled}
                key={`${model.catalogSource ?? "model"}:${model.id}`}
                onClick={disabled ? undefined : () => onSelect(model.id)}
                title={
                  disabled
                    ? `${model.id} - not loaded in LM Studio`
                    : model.provider
                      ? `${model.id} (${model.provider})`
                      : model.id
                }
              >
                <span className={styles.modelOptionText}>
                  <span className={styles.modelOptionLabel}>{model.label}</span>
                  <span className={styles.modelOptionProvider}>
                    {notLoaded
                      ? "Not loaded in LM Studio"
                      : isLocalManaged
                        ? "LM Studio"
                        : modelProviderSummary(model)}
                  </span>
                </span>
                {isSelected ? <Check size={15} /> : null}
              </button>
            );
          })
        ) : (
          <div className={styles.modelEmptyState}>No matching models</div>
        )}
      </div>
    </section>
  );
}

function groupModelOptions(
  options: HermesUiCapabilities["models"]["availableModels"],
  query: string
) {
  const cleanQuery = query.trim().toLowerCase();
  const matches = (model: HermesUiCapabilities["models"]["availableModels"][number]) => {
    if (!cleanQuery) {
      return true;
    }
    return [
      model.label,
      model.id,
      model.provider,
      model.description,
      model.runtime?.architecture,
      model.runtime?.format,
      model.runtime?.params,
      model.runtime?.quantization,
      model.runtime?.selectedVariant,
      model.runtime?.runtimeConfig?.kCacheQuantizationType,
      model.runtime?.runtimeConfig?.vCacheQuantizationType,
      ...(model.supportedParameters ?? [])
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(cleanQuery);
  };

  return {
    hermes: options.filter((model) => model.catalogSource !== "ui-openrouter" && matches(model)),
    openRouter: options.filter((model) => model.catalogSource === "ui-openrouter" && matches(model))
  };
}

function formatContextLength(value: number) {
  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}M context`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K context`;
  }
  return `${value} context`;
}

function modelProviderSummary(model: HermesUiCapabilities["models"]["availableModels"][number]) {
  const parts = [model.provider ?? "Provider inherited"];
  const runtime = model.runtime;
  if (runtime?.loadedContextLength && runtime.maxContextLength && runtime.loadedContextLength !== runtime.maxContextLength) {
    parts.push(`${formatContextWindow(runtime.loadedContextLength)} active / ${formatContextWindow(runtime.maxContextLength)} max`);
  } else if (model.contextLength) {
    parts.push(formatContextLength(model.contextLength));
  }
  if (runtime?.quantization) {
    parts.push(runtime.quantization);
  }
  if (runtime?.runtimeConfig?.offloadKvCacheToGpu) {
    parts.push("GPU KV");
  }
  if (runtime?.runtimeConfig?.flashAttention) {
    parts.push("Flash");
  }
  return parts.join(" · ");
}

function formatContextWindow(value: number) {
  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return `${value}`;
}

function getTrimmedDraft(textarea: HTMLTextAreaElement | null, draft: string) {
  return (textarea?.value ?? draft).trim();
}

function readComposerDraft(key: string) {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeComposerDraft(key: string, value: string) {
  try {
    if (value.length === 0) {
      window.localStorage.removeItem(key);
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Composer drafts are best-effort UI state only.
  }
}

function clearComposerDraft(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Composer drafts are best-effort UI state only.
  }
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
