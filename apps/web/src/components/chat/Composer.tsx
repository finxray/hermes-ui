import {
  ArrowUp,
  Check,
  ChevronDown,
  CornerDownRight,
  FileText,
  FolderPlus,
  GripVertical,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  Search,
  Square,
  Trash2,
  X
} from "@/components/ui/AppIcons";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { HermesCapabilityState, HermesUiCapabilities } from "@hermes-ui/hermes-client";
import { LiveTokenUsageTicker, type LiveTokenUsageSnapshot } from "@/components/chat/LiveTokenUsageTicker";
import type { ChatAttachment, ChatAttachmentKind } from "@/data/types";
import styles from "./Composer.module.css";

const PRIMARY_MENU_WIDTH_PX = Math.round(260 * 1.3 * 1.25);
const PRIMARY_MENU_GAP_PX = 8;
const MAX_FILE_BYTES = 512 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const ATTACHMENT_ACCEPT =
  "image/*,application/pdf,text/*,.txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.xml,.yaml,.yml,.log,.rtf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.go,.rs,.c,.cpp,.h,.hpp,.sh,.ps1,.sql,.zip,.tar,.gz";

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
  onDeferQueuedMessage?: (id: string) => void;
  onPrioritizeQueuedMessage?: (id: string) => void;
  onRemoveQueuedMessage?: (id: string) => void;
  onSend: (message: string, attachments: ChatAttachment[]) => void;
  onStop?: () => void;
  projectControls?: ProjectComposerControls;
  queuedMessages?: QueuedComposerMessage[];
  showContextPanel?: boolean;
  stopControlState?: HermesCapabilityState;
};

export type QueuedComposerMessage = {
  attachments?: ChatAttachment[];
  id: string;
  content: string;
};

export type ProjectComposerControls = {
  activeProjectId: string;
  activeProjectName: string;
  onCreateProject: () => void;
  onSelectProject: (projectId: string) => void;
  onUseChats: () => void;
  projects: Array<{ id: string; name: string }>;
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
  onDeferQueuedMessage,
  onPrioritizeQueuedMessage,
  onRemoveQueuedMessage,
  onSend,
  onStop,
  projectControls,
  queuedMessages = [],
  showContextPanel = false,
  stopControlState = "deferred"
}: ComposerProps) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [modelSearch, setModelSearch] = useState("");
  const [modelMenuStyle, setModelMenuStyle] = useState<CSSProperties | null>(null);
  const modelControlRef = useRef<HTMLDivElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const modelButtonTextRef = useRef<HTMLSpanElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const modelSearchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<ChatAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const projectCardRef = useRef<HTMLDivElement>(null);
  const shouldRefocusAfterSendRef = useRef(false);
  const hasDraft = getTrimmedDraft(textareaRef.current, draft).length > 0;
  const sendableAttachments = attachments.filter((attachment) => attachment.status !== "too-large");
  const canSend = (hasDraft || sendableAttachments.length > 0) && !disabled && !modelSelectInProgress;
  const willQueue = canSend && isGenerating;
  const hasQueuedMessages = queuedMessages.length > 0;
  const modelOptions = modelState?.availableModels ?? [];
  const canSelectModel =
    Boolean(modelState?.clientSelectable) &&
    modelOptions.length > 1 &&
    Boolean(onModelSelect) &&
    !modelSelectInProgress;
  const canOpenModelMenu =
    modelOptions.length > 1 &&
    Boolean(onModelSelect) &&
    !modelSelectInProgress;
  const showLiveTokenUsage =
    typeof liveTokenUsage?.promptTokens === "number" ||
    typeof liveTokenUsage?.completionTokens === "number";
  const activeProjectName = projectControls?.activeProjectName?.trim();
  const projectButtonLabel =
    activeProjectName && activeProjectName.toLowerCase() !== "chats"
      ? activeProjectName
      : "Work in a project";

  useLayoutEffect(() => {
    if (!isModelMenuOpen) {
      setModelMenuStyle(null);
      return;
    }

    function updateModelMenuPosition() {
      const nextStyle = getModelMenuPosition();
      if (nextStyle) {
        setModelMenuStyle(nextStyle);
      }
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
    const frame = window.requestAnimationFrame(() => {
      modelSearchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
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
  }, [isModelMenuOpen]);

  useEffect(() => {
    if (!isProjectMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && projectCardRef.current?.contains(target)) {
        return;
      }
      setIsProjectMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsProjectMenuOpen(false);
        focusComposerInput();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProjectMenuOpen]);

  useEffect(() => {
    if (!shouldRefocusAfterSendRef.current || disabled) {
      return;
    }
    queueComposerFocus();
  }, [disabled, isGenerating, queuedMessages.length]);

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

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      attachmentsRef.current.forEach(revokeAttachmentPreview);
    };
  }, []);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    const syncFromDom = () => {
      const next = textarea.value;
      resizeComposerTextarea(textarea);
      setDraft((current) => (current === next ? current : next));
    };

    syncFromDom();
    textarea.addEventListener("input", syncFromDom);
    return () => textarea.removeEventListener("input", syncFromDom);
  }, []);

  useLayoutEffect(() => {
    resizeComposerTextarea(textareaRef.current);
  }, [draft, attachments.length]);

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

  function clearAttachmentsForSend(sentAttachments: ChatAttachment[]) {
    setAttachments((current) =>
      current.filter((attachment) => !sentAttachments.some((sent) => sent.id === attachment.id))
    );
  }

  function focusComposerInput() {
    const textarea = textareaRef.current;
    if (!textarea || disabled) {
      return;
    }
    textarea.focus({ preventScroll: true });
  }

  function queueComposerFocus() {
    shouldRefocusAfterSendRef.current = true;
    focusComposerInput();
    window.requestAnimationFrame(() => {
      focusComposerInput();
      window.setTimeout(() => {
        focusComposerInput();
        shouldRefocusAfterSendRef.current = false;
      }, 0);
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = getTrimmedDraft(textareaRef.current, draft);
    const currentSendableAttachments = attachments.filter((attachment) => attachment.status !== "too-large");
    const canSubmit =
      (message.length > 0 || currentSendableAttachments.length > 0) &&
      !disabled &&
      !modelSelectInProgress;
    if (!canSubmit) {
      return;
    }
    clearDraft();
    clearAttachmentsForSend(currentSendableAttachments);
    shouldRefocusAfterSendRef.current = true;
    onSend(message || "Please review the attached files.", currentSendableAttachments);
    queueComposerFocus();
  }

  function openFilePicker() {
    if (disabled) {
      return;
    }
    fileInputRef.current?.click();
  }

  function addFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) {
      return;
    }
    setAttachments((current) => [...current, ...files.map(fileToAttachment)]);
    focusComposerInput();
  }

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === id);
      if (target) {
        revokeAttachmentPreview(target);
      }
      return current.filter((attachment) => attachment.id !== id);
    });
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingOver(false);
    if (disabled || event.dataTransfer.files.length === 0) {
      return;
    }
    addFiles(event.dataTransfer.files);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.clipboardData.files).filter((file) => file.size > 0);
    if (files.length === 0) {
      return;
    }
    addFiles(files);
  }

  function stopGeneration() {
    if (!isGenerating || isStopRequested) {
      return;
    }
    onStop?.();
  }

  function getModelMenuPosition(): ModelMenuStyle | null {
    const trigger = modelButtonRef.current ?? modelControlRef.current;
    if (!trigger) {
      return null;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const labelRect = modelButtonTextRef.current?.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const edgeInset = 12;
    const menuContentInset = 14;
    const anchorLeft = (labelRect?.left ?? triggerRect.left) - menuContentInset;
    const left = Math.max(edgeInset, anchorLeft);
    const width = Math.min(PRIMARY_MENU_WIDTH_PX, window.innerWidth - left - edgeInset);
    const availableAbove = Math.max(160, triggerRect.top - edgeInset - PRIMARY_MENU_GAP_PX);
    const maxHeight = Math.min(Math.round(viewportHeight * 0.62), availableAbove);

    return {
      bottom: viewportHeight - triggerRect.top + PRIMARY_MENU_GAP_PX,
      left,
      width,
      maxHeight,
      "--model-menu-max-height": `${maxHeight}px`
    };
  }

  function openModelMenu() {
    const nextStyle = getModelMenuPosition();
    if (!nextStyle) {
      return;
    }
    setModelMenuStyle(nextStyle);
    setIsModelMenuOpen(true);
  }

  function closeModelMenu() {
    setIsModelMenuOpen(false);
  }

  function toggleModelMenu() {
    if (!canOpenModelMenu) {
      return;
    }
    if (isModelMenuOpen) {
      closeModelMenu();
      return;
    }
    openModelMenu();
  }

  function selectModel(modelId: string) {
    closeModelMenu();
    setModelSearch("");
    onModelSelect?.(modelId);
  }

  function chooseProject(projectId: string) {
    setIsProjectMenuOpen(false);
    projectControls?.onSelectProject(projectId);
    queueComposerFocus();
  }

  function useChatsFolder() {
    setIsProjectMenuOpen(false);
    projectControls?.onUseChats();
    queueComposerFocus();
  }

  function createProjectFromComposer() {
    setIsProjectMenuOpen(false);
    projectControls?.onCreateProject();
    queueComposerFocus();
  }

  const modelGroups = groupModelOptions(modelOptions, modelSearch);

  const modelMenu =
    isModelMenuOpen && modelMenuStyle ? (
      <div
        className={styles.modelMenu}
        ref={modelMenuRef}
        role="dialog"
        aria-label="Model browser"
        style={modelMenuStyle}
      >
        <div className={styles.modelSearchWrap}>
          <Search size={14} aria-hidden="true" />
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
    ) : null;

  return (
    <div
      className={styles.wrap}
      data-start-state={isStartState ? "true" : "false"}
      data-model-menu-open={isModelMenuOpen ? "true" : "false"}
      data-project-card={projectControls ? "true" : "false"}
      data-project-menu-open={isProjectMenuOpen ? "true" : "false"}
    >
      {modelMenu && typeof document !== "undefined" ? createPortal(modelMenu, document.body) : null}
      <form className={styles.composer} aria-label="Message composer" onSubmit={submit}>
        {hasQueuedMessages ? (
          <ol className={styles.followUpQueue} aria-label="Queued follow-up messages">
            {queuedMessages.map((message, index) => (
              <li className={styles.followUpRow} key={message.id}>
                <span className={styles.followUpLead} aria-hidden="true">
                  {index === 0 ? <CornerDownRight size={20} /> : <GripVertical size={20} />}
                </span>
                <span className={styles.followUpText}>{message.content}</span>
                {message.attachments && message.attachments.length > 0 ? (
                  <span className={styles.followUpAttachmentCount}>
                    {message.attachments.length} file{message.attachments.length === 1 ? "" : "s"}
                  </span>
                ) : null}
                <span className={styles.followUpActions}>
                  <button
                    className={`${styles.followUpAction} ${styles.steerAction}`}
                    type="button"
                    onClick={() => onPrioritizeQueuedMessage?.(message.id)}
                    title={index === 0 ? "This follow-up is next." : "Send this follow-up next."}
                  >
                    <CornerDownRight size={18} aria-hidden="true" />
                    <span>Steer</span>
                  </button>
                  <button
                    className={styles.followUpIconAction}
                    type="button"
                    aria-label="Remove queued follow-up"
                    onClick={() => onRemoveQueuedMessage?.(message.id)}
                    title="Remove"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    className={styles.followUpIconAction}
                    type="button"
                    aria-label="Move queued follow-up later"
                    onClick={() => onDeferQueuedMessage?.(message.id)}
                    title="Send later"
                  >
                    <MoreHorizontal size={18} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        ) : null}
        <div
          className={styles.box}
          data-composer-box
          data-drag-over={isDraggingOver ? "true" : "false"}
          onDragEnter={(event) => {
            if (!disabled && event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
              setIsDraggingOver(true);
            }
          }}
          onDragOver={(event) => {
            if (!disabled && event.dataTransfer.types.includes("Files")) {
              event.preventDefault();
            }
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsDraggingOver(false);
            }
          }}
          onDrop={handleDrop}
        >
          <div className={styles.boxContent}>
            {attachments.length > 0 ? (
              <AttachmentTray attachments={attachments} onRemove={removeAttachment} />
            ) : null}
            <input
              ref={fileInputRef}
              aria-label="Browse files"
              className={styles.fileInput}
              multiple
              type="file"
              accept={ATTACHMENT_ACCEPT}
              onChange={(event) => {
                addFiles(event.currentTarget.files ?? []);
                event.currentTarget.value = "";
              }}
            />
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
              onPaste={handlePaste}
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
                  aria-label="Add photos, PDFs, documents, text, screenshots, and other files"
                  title="Add photos, PDFs, documents, text, screenshots, and other files."
                  disabled={disabled}
                  onClick={openFilePicker}
                >
                  <Plus size={20} />
                </button>
                <div className={styles.modelRow}>
                  <div className={styles.modelControl} ref={modelControlRef}>
                    <button
                      className={styles.modelButton}
                      ref={modelButtonRef}
                      type="button"
                      aria-expanded={canOpenModelMenu ? isModelMenuOpen : undefined}
                      aria-haspopup={canOpenModelMenu ? "listbox" : undefined}
                      aria-label={modelButtonLabel(modelState, modelOptions.length)}
                      title={modelSelectorTitle(modelState, modelOptions.length)}
                      disabled={!canOpenModelMenu}
                      onClick={toggleModelMenu}
                    >
                      <span className={styles.modelButtonText} ref={modelButtonTextRef}>
                        {modelSelectInProgress ? "Selecting..." : modelLabel}
                      </span>
                      {modelSelectInProgress ? (
                        <LoaderCircle className={styles.modelSpinner} size={14} />
                      ) : canOpenModelMenu ? (
                        <ChevronDown size={12} />
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
                    willQueue ? styles.queueButton : "",
                    isGenerating ? styles.stopButton : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  data-ready={canSend ? "true" : "false"}
                  type={willQueue ? "submit" : isGenerating ? "button" : "submit"}
                  disabled={willQueue ? false : isGenerating ? disabled || isStopRequested : !canSend}
                  aria-label={willQueue ? "Queue next message" : isGenerating ? "Stop generation" : "Send message"}
                  onClick={willQueue ? undefined : isGenerating ? stopGeneration : undefined}
                  title={
                    willQueue
                      ? "Queue this message to send after the current response."
                      : isGenerating
                        ? stopControlTitle(stopControlState)
                        : undefined
                  }
                >
                  {willQueue ? <ArrowUp size={17} /> : isGenerating ? <Square size={13} fill="currentColor" /> : <ArrowUp size={17} />}
                </button>
              </div>
            </div>
          </div>
        </div>
        {projectControls ? (
          <div className={styles.projectCard} ref={projectCardRef}>
            <button
              className={styles.projectButton}
              type="button"
              aria-expanded={isProjectMenuOpen}
              aria-haspopup="menu"
              onClick={() => setIsProjectMenuOpen((current) => !current)}
            >
              <FolderPlus size={17} aria-hidden="true" />
              <span>{projectButtonLabel}</span>
              <ChevronDown size={14} aria-hidden="true" />
            </button>
            {isProjectMenuOpen ? (
              <div className={styles.projectMenu} role="menu">
                <button className={styles.projectMenuItem} type="button" role="menuitem" onClick={useChatsFolder}>
                  <span>Continue in Chats</span>
                </button>
                <button className={styles.projectMenuItem} type="button" role="menuitem" onClick={createProjectFromComposer}>
                  <span>New project</span>
                </button>
                {projectControls.projects.length > 0 ? (
                  <>
                    <div className={styles.projectMenuDivider} />
                    {projectControls.projects.map((project) => (
                      <button
                        className={styles.projectMenuItem}
                        data-active={project.id === projectControls.activeProjectId ? "true" : "false"}
                        key={project.id}
                        type="button"
                        role="menuitem"
                        onClick={() => chooseProject(project.id)}
                      >
                        <span>{project.name}</span>
                      </button>
                    ))}
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
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
      </form>
      {modelSelectError ? (
        <p className={styles.modelSelectError} role="alert">
          {modelSelectError}
        </p>
      ) : null}
    </div>
  );
}

function AttachmentTray({
  attachments,
  onRemove
}: {
  attachments: ChatAttachment[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className={styles.attachmentTray} aria-label="Attached files">
      {attachments.map((attachment) => (
        <AttachmentTile
          attachment={attachment}
          key={attachment.id}
          onRemove={() => onRemove(attachment.id)}
        />
      ))}
    </div>
  );
}

function AttachmentTile({
  attachment,
  onRemove
}: {
  attachment: ChatAttachment;
  onRemove: () => void;
}) {
  const isImage = attachment.kind === "image" && attachment.previewUrl;
  return (
    <div
      className={styles.attachmentTile}
      data-kind={attachment.kind}
      data-status={attachment.status}
      draggable={Boolean(attachment.previewUrl)}
      onDragStart={(event) => {
        if (!attachment.previewUrl) {
          return;
        }
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/plain", attachment.fileName);
        event.dataTransfer.setData(
          "DownloadURL",
          `${attachment.mimeType || "application/octet-stream"}:${attachment.fileName}:${attachment.previewUrl}`
        );
      }}
      title={`${attachment.fileName} - ${formatFileSize(attachment.sizeBytes)}`}
    >
      <div className={styles.attachmentPreview} aria-hidden="true">
        {isImage ? (
          <img alt="" src={attachment.previewUrl} />
        ) : (
          <span className={styles.attachmentGlyph}>
            <FileText size={24} />
          </span>
        )}
      </div>
      <div className={styles.attachmentMeta}>
        <span className={styles.attachmentName}>{attachment.fileName}</span>
        <span className={styles.attachmentDetail}>
          {attachment.status === "too-large"
            ? "Too large"
            : `${attachmentKindLabel(attachment.kind)} · ${formatFileSize(attachment.sizeBytes)}`}
        </span>
      </div>
      <button
        className={styles.attachmentRemove}
        type="button"
        aria-label={`Remove ${attachment.fileName}`}
        onClick={onRemove}
      >
        <X size={14} />
      </button>
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
                <span className={styles.modelOptionLabel}>{model.label}</span>
                <span className={styles.modelOptionProvider}>
                  {notLoaded
                    ? "Not loaded in LM Studio"
                    : isLocalManaged
                      ? "LM Studio"
                      : modelProviderSummary(model)}
                </span>
                {isSelected ? <Check size={14} aria-hidden="true" /> : null}
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

function resizeComposerTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) {
    return;
  }

  textarea.style.height = "auto";
  const computed = window.getComputedStyle(textarea);
  const maxHeight = Number.parseFloat(computed.maxHeight);
  const nextHeight = Math.ceil(textarea.scrollHeight);
  const clampedHeight = Number.isFinite(maxHeight) ? Math.min(nextHeight, maxHeight) : nextHeight;
  textarea.style.height = `${clampedHeight}px`;
  textarea.style.overflowY = nextHeight > clampedHeight + 1 ? "auto" : "hidden";
}

function fileToAttachment(file: File): ChatAttachment {
  const kind = classifyAttachment(file);
  const imageTooLarge = kind === "image" && file.size > MAX_IMAGE_BYTES;
  const tooLarge = file.size > MAX_FILE_BYTES || imageTooLarge;
  const previewUrl = kind === "image" || kind === "pdf" ? URL.createObjectURL(file) : undefined;
  return {
    id: `att-${crypto.randomUUID()}`,
    fileName: file.name || fallbackAttachmentName(kind),
    kind,
    mimeType: file.type || fallbackMimeType(kind),
    previewUrl,
    sizeBytes: file.size,
    source: "local",
    status: tooLarge ? "too-large" : "needs-upload"
  };
}

function revokeAttachmentPreview(attachment: ChatAttachment) {
  if (attachment.previewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(attachment.previewUrl);
  }
}

function classifyAttachment(file: File): ChatAttachmentKind {
  const type = file.type.toLowerCase();
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  if (type.startsWith("image/")) {
    return "image";
  }
  if (type === "application/pdf" || extension === "pdf") {
    return "pdf";
  }
  if (type.startsWith("text/") || ["txt", "md", "markdown", "log", "rtf"].includes(extension)) {
    return "text";
  }
  if (["js", "jsx", "ts", "tsx", "py", "java", "go", "rs", "c", "cpp", "h", "hpp", "sh", "ps1", "sql", "json", "jsonl", "xml", "yaml", "yml", "html", "css"].includes(extension)) {
    return "code";
  }
  if (["csv", "tsv", "xls", "xlsx"].includes(extension)) {
    return "spreadsheet";
  }
  if (["ppt", "pptx", "key"].includes(extension)) {
    return "presentation";
  }
  if (["doc", "docx", "odt"].includes(extension)) {
    return "document";
  }
  if (["zip", "tar", "gz", "rar", "7z"].includes(extension)) {
    return "archive";
  }
  return "unknown";
}

function fallbackAttachmentName(kind: ChatAttachmentKind) {
  return kind === "image" ? "pasted-image.png" : "attached-file";
}

function fallbackMimeType(kind: ChatAttachmentKind) {
  if (kind === "image") {
    return "image/png";
  }
  if (kind === "pdf") {
    return "application/pdf";
  }
  if (kind === "text" || kind === "code") {
    return "text/plain";
  }
  return "application/octet-stream";
}

function attachmentKindLabel(kind: ChatAttachmentKind) {
  switch (kind) {
    case "image":
      return "Image";
    case "pdf":
      return "PDF";
    case "text":
      return "Text";
    case "spreadsheet":
      return "Sheet";
    case "presentation":
      return "Slides";
    case "document":
      return "Document";
    case "archive":
      return "Archive";
    case "code":
      return "Code";
    default:
      return "File";
  }
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
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
  if (optionCount > 1) {
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
  if (optionCount > 1) {
    return state.reason || "Browse configured Hermes models; runtime selection is verified by the Hermes BFF path.";
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
