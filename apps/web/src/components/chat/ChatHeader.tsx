import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import { Archive, MoreHorizontal, Pencil, X } from "@/components/ui/AppIcons";
import {
  ChatPaneTabs,
  type ChatPaneId,
  type ChatTabMove
} from "@/components/chat/ChatPaneTabs";
import type { Project, Session } from "@/data/types";
import type { HermesSessionSummary } from "@hermes-ui/hermes-client";
import styles from "./ChatView.module.css";
import { WindowBackButton } from "@/components/ui/WindowBackButton";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type ChatHeaderProps = {
  isSplitViewOpen?: boolean;
  onArchive?: () => void;
  onBack?: () => void;
  onCloseMainInSplit?: () => void;
  onRename?: () => void;
  onSplitView?: () => void;
  tabs?: ChatHeaderTabs;
  title: string;
};

export type ChatHeaderTabs = {
  activeSessionId: string | null;
  availableChannelSessions: HermesSessionSummary[];
  availableSessions: Session[];
  isSingleView: boolean;
  onAdd: () => void;
  onAddChannelSession: (session: HermesSessionSummary) => void;
  onArchive: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onMove: (move: ChatTabMove) => void;
  onRename: (sessionId: string, title: string) => void;
  onSelect: (sessionId: string) => void;
  onToggleView: () => void;
  pane: ChatPaneId;
  projects: Project[];
  sessions: Session[];
};

export function ChatHeader({
  isSplitViewOpen = false,
  onArchive,
  onBack,
  onCloseMainInSplit,
  onRename,
  onSplitView,
  tabs,
  title
}: ChatHeaderProps) {
  const headerActionsRef = useRef<HTMLDivElement | null>(null);
  const headerMenuRef = useRef<HTMLDivElement | null>(null);
  const menuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const splitButtonLabel = isSplitViewOpen
    ? "Return to single chat view"
    : "Split chat and context panels evenly";
  const splitTooltipLabel = isSplitViewOpen ? "Single view" : "Split screen";
  const canManageChat = Boolean(onRename || onArchive || onSplitView);

  const cancelMenuClose = useCallback(() => {
    if (menuCloseTimerRef.current) {
      clearTimeout(menuCloseTimerRef.current);
      menuCloseTimerRef.current = null;
    }
  }, []);

  const updateMenuPosition = useCallback(() => {
    const trigger = headerActionsRef.current;
    if (!trigger) {
      return;
    }
    const bounds = trigger.getBoundingClientRect();
    const menuWidth = 190;
    setMenuPosition({
      left: Math.min(Math.max(8, bounds.left), window.innerWidth - menuWidth - 8),
      top: bounds.bottom + 6
    });
  }, []);

  const openMenu = useCallback(() => {
    cancelMenuClose();
    updateMenuPosition();
    setIsMenuOpen(true);
  }, [cancelMenuClose, updateMenuPosition]);

  const scheduleMenuClose = useCallback(() => {
    cancelMenuClose();
    menuCloseTimerRef.current = setTimeout(() => {
      setIsMenuOpen(false);
      menuCloseTimerRef.current = null;
    }, 100);
  }, [cancelMenuClose]);

  useLayoutEffect(() => {
    if (!isMenuOpen) {
      return;
    }
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [isMenuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    function closeMenu(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        !headerActionsRef.current?.contains(event.target) &&
        !headerMenuRef.current?.contains(event.target)
      ) {
        setIsMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen]);

  useEffect(() => () => cancelMenuClose(), [cancelMenuClose]);

  const menu = isMenuOpen && typeof document !== "undefined"
    ? createPortal(
        <div
          aria-label="Chat actions"
          className={`${styles.headerMenu} stoix-portal-menu`}
          data-overlay-context="chat"
          onMouseEnter={cancelMenuClose}
          onMouseLeave={scheduleMenuClose}
          ref={headerMenuRef}
          role="menu"
          style={{ left: menuPosition.left, top: menuPosition.top }}
        >
          {onRename ? (
            <button
              onClick={() => {
                onRename();
                setIsMenuOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              <Pencil size={17} />
              Rename chat
            </button>
          ) : null}
          {onSplitView ? (
            <button
              onClick={() => {
                onSplitView();
                setIsMenuOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              <PanelToggleIcon side="split" />
              Open side chat
            </button>
          ) : null}
          {onArchive ? (
            <button
              onClick={() => {
                onArchive();
                setIsMenuOpen(false);
              }}
              role="menuitem"
              type="button"
            >
              <Archive size={17} />
              Archive chat
            </button>
          ) : null}
        </div>,
        document.body
      )
    : null;

  const actionMenu = canManageChat ? (
    <>
      <div
        className={styles.headerActions}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleMenuClose}
        ref={headerActionsRef}
      >
        <button
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label={`Chat actions for ${title}`}
          className={styles.headerMoreButton}
          onClick={openMenu}
          onFocus={openMenu}
          type="button"
        >
          <MoreHorizontal size={17} />
        </button>
      </div>
      {menu}
    </>
  ) : null;

  return (
    <header className={styles.header} data-split-view={isSplitViewOpen ? "true" : "false"}>
      {tabs ? (
        <ChatPaneTabs
          {...tabs}
          onOpenSide={onSplitView
            ? (sessionId) => {
                tabs.onSelect(sessionId);
                onSplitView();
              }
            : undefined}
        />
      ) : (
        <div className={styles.headerTitle}>
        {onBack ? (
          <WindowBackButton onClick={onBack} />
        ) : onSplitView || onCloseMainInSplit ? (
          <button
            aria-label={isSplitViewOpen && onCloseMainInSplit ? "Close left chat and keep right chat" : splitButtonLabel}
            aria-pressed={isSplitViewOpen && !onCloseMainInSplit ? true : undefined}
            className={styles.headerSplitButton}
            data-active={isSplitViewOpen ? "true" : "false"}
            data-close-main={isSplitViewOpen && onCloseMainInSplit ? "true" : "false"}
            onClick={isSplitViewOpen && onCloseMainInSplit ? onCloseMainInSplit : onSplitView}
            type="button"
          >
            {isSplitViewOpen && onCloseMainInSplit ? <X size={16} /> : <PanelToggleIcon side="split" />}
            <span className={styles.headerSplitTooltip} role="tooltip">
              {isSplitViewOpen && onCloseMainInSplit ? "Close left chat" : splitTooltipLabel}
            </span>
          </button>
        ) : null}
        <h1>{title}</h1>
          {actionMenu}
        </div>
      )}
    </header>
  );
}
