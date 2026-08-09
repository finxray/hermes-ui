"use client";

import { Archive, Folder, MoreHorizontal, Pencil, Plus, X } from "@/components/ui/AppIcons";
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import type { Project, Session } from "@/data/types";
import { getChannelDescriptor } from "@/lib/sessionChannels";
import type { HermesSessionSummary } from "@hermes-ui/hermes-client";
import { createPortal } from "react-dom";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "./ChatPaneTabs.module.css";

export type ChatPaneId = "main" | "side";

export type ChatTabMove = {
  sessionId: string;
  sourcePane: ChatPaneId;
  targetIndex: number;
  targetPane: ChatPaneId;
};

type ChatPaneTabsProps = {
  activeSessionId: string | null;
  availableChannelSessions: HermesSessionSummary[];
  availableSessions: Session[];
  isSingleView: boolean;
  onAdd: () => void;
  onAddChannelSession: (session: HermesSessionSummary) => void;
  onArchive: (sessionId: string) => void;
  onClose: (sessionId: string) => void;
  onMove: (move: ChatTabMove) => void;
  onOpenSide?: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onSelect: (sessionId: string) => void;
  onToggleView: () => void;
  pane: ChatPaneId;
  projects: Project[];
  sessions: Session[];
};

const CHAT_TAB_DRAG_EVENT = "stoix:chat-tab-drag";
const DRAG_THRESHOLD_PX = 5;

type DragBroadcast = {
  active: boolean;
  sessionId?: string;
  sourcePane?: ChatPaneId;
  targetIndex?: number;
  targetPane?: ChatPaneId | null;
  width?: number;
};

type DragCandidate = {
  active: boolean;
  button: HTMLButtonElement;
  lastMoveKey: string | null;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  sessionId: string;
  sourcePane: ChatPaneId;
  startX: number;
  startY: number;
  title: string;
  width: number;
};

type DragPreview = {
  title: string;
  width: number;
  x: number;
  y: number;
};

type ExternalDrop = {
  index: number;
  sessionId: string;
  width: number;
};

type TabTooltip = {
  left: number;
  title: string;
  top: number;
};

type PaneDrop = {
  index: number;
  overTabBar: boolean;
  pane: ChatPaneId;
};

type AddMenuGroup = {
  iconSource?: string;
  id: string;
  label: string;
  sessions: AddMenuItem[];
};

type AddMenuItem = {
  channelSession?: HermesSessionSummary;
  id: string;
  localSessionId?: string;
  title: string;
  updatedAt: string;
};

export function ChatPaneTabs({
  activeSessionId,
  availableChannelSessions,
  availableSessions,
  isSingleView,
  onAdd,
  onAddChannelSession,
  onArchive,
  onClose,
  onMove,
  onOpenSide,
  onRename,
  onSelect,
  onToggleView,
  pane,
  projects,
  sessions
}: ChatPaneTabsProps) {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [addMenuPosition, setAddMenuPosition] = useState({ left: 0, top: 0 });
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [externalDrop, setExternalDrop] = useState<ExternalDrop | null>(null);
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  const [tabTooltip, setTabTooltip] = useState<TabTooltip | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const addMenuRef = useRef<HTMLDivElement | null>(null);
  const addButtonRef = useRef<HTMLButtonElement | null>(null);
  const actionMenuTimerRef = useRef<number | null>(null);
  const dragCandidateRef = useRef<DragCandidate | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const suppressClickTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const tabElementsRef = useRef(new Map<string, HTMLDivElement>());
  const titleElementsRef = useRef(new Map<string, HTMLSpanElement>());
  const tooltipTimerRef = useRef<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [overflowedTitles, setOverflowedTitles] = useState<Set<string>>(() => new Set());
  const [density, setDensity] = useState<"compact" | "relaxed">("relaxed");
  const addMenuGroups = useMemo<AddMenuGroup[]>(() => {
    const liveSessions = availableSessions.filter((session) => !session.archivedAt);
    const channelGroups = new Map<string, AddMenuGroup>();
    const localHermesIds = new Set(
      liveSessions
        .filter((session) => session.channel?.external)
        .map((session) => session.hermesSessionId)
    );

    for (const session of liveSessions.filter((item) => item.channel?.external)) {
      const source = session.channel?.source ?? "channel";
      const current = channelGroups.get(source);
      if (current) {
        current.sessions.push({
          id: `local:${session.id}`,
          localSessionId: session.id,
          title: session.title,
          updatedAt: session.updatedAt
        });
      } else {
        channelGroups.set(source, {
          iconSource: source,
          id: `channel:${source}`,
          label: session.channel?.label ?? "Channel",
          sessions: [{
            id: `local:${session.id}`,
            localSessionId: session.id,
            title: session.title,
            updatedAt: session.updatedAt
          }]
        });
      }
    }

    for (const session of availableChannelSessions) {
      const descriptor = getChannelDescriptor(session.source);
      if (!descriptor.external || localHermesIds.has(session.id)) {
        continue;
      }
      const current = channelGroups.get(descriptor.source);
      const item: AddMenuItem = {
        channelSession: session,
        id: `hermes:${session.id}`,
        title: session.title || "Untitled session",
        updatedAt: session.lastActiveAt ?? session.endedAt ?? session.startedAt
      };
      if (current) {
        current.sessions.push(item);
      } else {
        channelGroups.set(descriptor.source, {
          iconSource: descriptor.source,
          id: `channel:${descriptor.source}`,
          label: descriptor.label,
          sessions: [item]
        });
      }
    }

    const projectGroups = projects
      .map((project) => ({
        id: `project:${project.id}`,
        label: project.name,
        sessions: liveSessions.filter(
          (session) => session.projectId === project.id && !session.channel?.external
        ).map((session) => ({
          id: `local:${session.id}`,
          localSessionId: session.id,
          title: session.title,
          updatedAt: session.updatedAt
        }))
      }))
      .filter((group) => group.sessions.length > 0);

    return [...channelGroups.values(), ...projectGroups].map((group) => ({
      ...group,
      sessions: [...group.sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }));
  }, [availableChannelSessions, availableSessions, projects]);

  useLayoutEffect(() => {
    function measureTitles() {
      const viewport = viewportRef.current;
      const tabBar = viewport?.parentElement;
      if (viewport && tabBar) {
        const preferredTabsWidth = sessions.reduce((total, session) => {
          const titleElement = titleElementsRef.current.get(session.id);
          const naturalTitleWidth = titleElement?.scrollWidth ?? 0;
          return total + Math.min(320, naturalTitleWidth + 65);
        }, Math.max(0, sessions.length - 1) * 5);
        const availableTabsWidth = Math.max(0, tabBar.clientWidth - 102);
        const nextDensity = preferredTabsWidth <= availableTabsWidth + 1 ? "relaxed" : "compact";
        setDensity((current) => (current === nextDensity ? current : nextDensity));
      }

      setOverflowedTitles((current) => {
        const next = new Set<string>();
        for (const session of sessions) {
          const titleElement = titleElementsRef.current.get(session.id);
          if (titleElement && titleElement.scrollWidth > titleElement.clientWidth + 1) {
            next.add(session.id);
          }
        }
        if (next.size === current.size && [...next].every((id) => current.has(id))) {
          return current;
        }
        return next;
      });
    }

    measureTitles();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measureTitles) : null;
    if (observer) {
      if (viewportRef.current) {
        observer.observe(viewportRef.current);
      }
      for (const titleElement of titleElementsRef.current.values()) {
        observer.observe(titleElement);
      }
    }
    return () => observer?.disconnect();
  }, [density, sessions]);

  useEffect(() => {
    function syncExternalDrop(event: Event) {
      const detail = (event as CustomEvent<DragBroadcast>).detail;
      if (
        !detail.active ||
        detail.sourcePane === pane ||
        detail.targetPane !== pane ||
        !detail.sessionId
      ) {
        setExternalDrop(null);
        return;
      }
      const next = {
        index: detail.targetIndex ?? 0,
        sessionId: detail.sessionId,
        width: detail.width ?? 116
      };
      setExternalDrop((current) =>
        current?.index === next.index &&
        current.sessionId === next.sessionId &&
        current.width === next.width
          ? current
          : next
      );
    }

    window.addEventListener(CHAT_TAB_DRAG_EVENT, syncExternalDrop);
    return () => window.removeEventListener(CHAT_TAB_DRAG_EVENT, syncExternalDrop);
  }, [pane]);

  useEffect(() => {
    return () => {
      if (actionMenuTimerRef.current !== null) {
        window.clearTimeout(actionMenuTimerRef.current);
      }
      if (tooltipTimerRef.current !== null) {
        window.clearTimeout(tooltipTimerRef.current);
      }
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
      }
      dragCleanupRef.current?.();
      restorePointerDocumentState();
      broadcastDrag({ active: false });
    };
  }, []);

  useEffect(() => {
    if (!menuSessionId) {
      return;
    }

    function closeMenu(event: MouseEvent) {
      if (event.target instanceof Node && !actionMenuRef.current?.contains(event.target)) {
        setMenuSessionId(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuSessionId(null);
      }
    }

    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuSessionId]);

  useEffect(() => {
    if (!isAddMenuOpen) {
      return;
    }

    function closeMenu(event: MouseEvent) {
      if (
        event.target instanceof Node &&
        !addButtonRef.current?.contains(event.target) &&
        !addMenuRef.current?.contains(event.target)
      ) {
        setIsAddMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsAddMenuOpen(false);
        addButtonRef.current?.focus();
      }
    }

    window.addEventListener("mousedown", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isAddMenuOpen]);

  function toggleAddMenu() {
    const trigger = addButtonRef.current;
    if (!trigger) {
      return;
    }
    if (!isAddMenuOpen) {
      const bounds = trigger.getBoundingClientRect();
      const menuWidth = 280;
      setAddMenuPosition({
        left: Math.min(Math.max(8, bounds.left), window.innerWidth - menuWidth - 8),
        top: bounds.bottom + 6
      });
    }
    setIsAddMenuOpen((open) => !open);
  }

  function chooseSession(sessionId: string) {
    onSelect(sessionId);
    setIsAddMenuOpen(false);
  }

  function cancelMenuClose() {
    if (actionMenuTimerRef.current !== null) {
      window.clearTimeout(actionMenuTimerRef.current);
      actionMenuTimerRef.current = null;
    }
  }

  function openActionMenu(trigger: HTMLElement, sessionId: string) {
    cancelMenuClose();
    hideTabTooltip();
    const bounds = trigger.getBoundingClientRect();
    const menuWidth = 190;
    setMenuPosition({
      left: Math.min(Math.max(8, bounds.left), window.innerWidth - menuWidth - 8),
      top: bounds.bottom + 6
    });
    setMenuSessionId(sessionId);
  }

  function scheduleMenuClose() {
    cancelMenuClose();
    actionMenuTimerRef.current = window.setTimeout(() => {
      setMenuSessionId(null);
      actionMenuTimerRef.current = null;
    }, 100);
  }

  const menuSession = menuSessionId
    ? sessions.find((session) => session.id === menuSessionId) ?? null
    : null;

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const activeTab = activeSessionId ? tabElementsRef.current.get(activeSessionId) : null;
    if (!viewport || !activeTab) {
      return;
    }

    const viewportBounds = viewport.getBoundingClientRect();
    const tabBounds = activeTab.getBoundingClientRect();
    const leftOverflow = tabBounds.left - viewportBounds.left;
    const rightOverflow = tabBounds.right - viewportBounds.right;
    if (leftOverflow >= 0 && rightOverflow <= 0) {
      return;
    }

    viewport.scrollTo({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      left: viewport.scrollLeft + (leftOverflow < 0 ? leftOverflow - 5 : rightOverflow + 5)
    });
  }, [activeSessionId, sessions]);

  function beginPointerDrag(event: ReactPointerEvent<HTMLButtonElement>, session: Session) {
    if (event.button !== 0) {
      return;
    }

    hideTabTooltip();
    dragCleanupRef.current?.();
    const button = event.currentTarget;
    const tab = button.closest<HTMLElement>("[data-chat-tab-id]");
    const tabBounds = tab?.getBoundingClientRect();
    const width = tabBounds?.width ?? 116;
    const candidate: DragCandidate = {
      active: false,
      button,
      lastMoveKey: null,
      offsetX: tabBounds ? event.clientX - tabBounds.left : width / 2,
      offsetY: tabBounds ? event.clientY - tabBounds.top : 14,
      pointerId: event.pointerId,
      sessionId: session.id,
      sourcePane: pane,
      startX: event.clientX,
      startY: event.clientY,
      title: session.title,
      width
    };
    dragCandidateRef.current = candidate;
    button.setPointerCapture(event.pointerId);
    button.focus({ preventScroll: true });
    event.preventDefault();

    function movePointer(pointerEvent: PointerEvent) {
      const current = dragCandidateRef.current;
      if (!current || pointerEvent.pointerId !== current.pointerId) {
        return;
      }

      const travel = Math.hypot(
        pointerEvent.clientX - current.startX,
        pointerEvent.clientY - current.startY
      );
      if (!current.active && travel < DRAG_THRESHOLD_PX) {
        return;
      }

      if (!current.active) {
        current.active = true;
        suppressClickRef.current = true;
        setDraggingSessionId(current.sessionId);
        setPointerDocumentState();
      }

      pointerEvent.preventDefault();
      setDragPreview({
        title: current.title,
        width: current.width,
        x: pointerEvent.clientX - current.offsetX,
        y: pointerEvent.clientY - current.offsetY
      });

      const target = resolvePaneDrop(pointerEvent.clientX, pointerEvent.clientY);
      if (!target) {
        broadcastDrag({
          active: true,
          sessionId: current.sessionId,
          sourcePane: current.sourcePane,
          targetPane: null,
          width: current.width
        });
        return;
      }

      if (target.pane === current.sourcePane) {
        broadcastDrag({
          active: true,
          sessionId: current.sessionId,
          sourcePane: current.sourcePane,
          targetPane: null,
          width: current.width
        });
        if (!target.overTabBar) {
          return;
        }
        const moveKey = `${target.pane}:${target.index}`;
        if (current.lastMoveKey !== moveKey) {
          current.lastMoveKey = moveKey;
          onMove({
            sessionId: current.sessionId,
            sourcePane: current.sourcePane,
            targetIndex: target.index,
            targetPane: target.pane
          });
        }
        return;
      }

      current.lastMoveKey = null;
      broadcastDrag({
        active: true,
        sessionId: current.sessionId,
        sourcePane: current.sourcePane,
        targetIndex: target.index,
        targetPane: target.pane,
        width: current.width
      });
    }

    function finishPointer(pointerEvent: PointerEvent, cancelled = false) {
      const current = dragCandidateRef.current;
      if (!current || pointerEvent.pointerId !== current.pointerId) {
        return;
      }

      if (current.active && !cancelled) {
        const target = resolvePaneDrop(pointerEvent.clientX, pointerEvent.clientY);
        if (target && target.pane !== current.sourcePane) {
          onMove({
            sessionId: current.sessionId,
            sourcePane: current.sourcePane,
            targetIndex: target.index,
            targetPane: target.pane
          });
        } else if (target?.overTabBar) {
          const moveKey = `${target.pane}:${target.index}`;
          if (current.lastMoveKey !== moveKey) {
            onMove({
              sessionId: current.sessionId,
              sourcePane: current.sourcePane,
              targetIndex: target.index,
              targetPane: current.sourcePane
            });
          }
        }
        pointerEvent.preventDefault();
      }

      dragCleanupRef.current?.();
      setDraggingSessionId(null);
      setDragPreview(null);
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
      }
      suppressClickTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false;
        suppressClickTimerRef.current = null;
      }, 0);
    }

    function cancelPointer(pointerEvent: PointerEvent) {
      finishPointer(pointerEvent, true);
    }

    window.addEventListener("pointermove", movePointer, { passive: false });
    window.addEventListener("pointerup", finishPointer, { passive: false });
    window.addEventListener("pointercancel", cancelPointer, { passive: false });
    dragCleanupRef.current = () => {
      const current = dragCandidateRef.current;
      if (current?.button.hasPointerCapture(current.pointerId)) {
        current.button.releasePointerCapture(current.pointerId);
      }
      window.removeEventListener("pointermove", movePointer);
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", cancelPointer);
      dragCandidateRef.current = null;
      dragCleanupRef.current = null;
      restorePointerDocumentState();
      broadcastDrag({ active: false });
    };
  }

  function showTabTooltip(element: HTMLElement, title: string) {
    hideTabTooltip();
    const titleElement = element.querySelector<HTMLElement>("[data-chat-tab-title]");
    if (!isTitleTruncated(titleElement)) {
      return;
    }

    tooltipTimerRef.current = window.setTimeout(() => {
      if (!isTitleTruncated(titleElement)) {
        tooltipTimerRef.current = null;
        return;
      }
      const bounds = element.getBoundingClientRect();
      const estimatedWidth = Math.min(320, Math.max(82, title.length * 7 + 22));
      const unclampedLeft = bounds.left + bounds.width / 2;
      const left = Math.min(
        window.innerWidth - estimatedWidth / 2 - 8,
        Math.max(estimatedWidth / 2 + 8, unclampedLeft)
      );
      setTabTooltip({ left, title, top: bounds.bottom + 7 });
      tooltipTimerRef.current = null;
    }, 2000);
  }

  function hideTabTooltip() {
    if (tooltipTimerRef.current !== null) {
      window.clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
    setTabTooltip(null);
  }

  return (
    <div className={styles.bar} data-chat-tab-bar="true" data-density={density} data-pane={pane}>
      <div
        aria-label={`${pane === "main" ? "Left" : "Right"} chat tabs`}
        className={styles.viewport}
        data-chat-tab-viewport="true"
        ref={viewportRef}
        role="tablist"
      >
        {externalDrop?.index === 0 ? (
          <DropSlot key={`drop:${externalDrop.sessionId}`} width={externalDrop.width} />
        ) : null}
        {sessions.map((session, index) => {
          const active = session.id === activeSessionId;
          const tabTitle = titleWithoutOverflowDots(session.title);
          const hadLegacyOverflowDots = tabTitle !== session.title;
          return (
            <div key={session.id} className={styles.tabSequence}>
              <div
                className={styles.tabWrap}
                data-active={active ? "true" : "false"}
                data-has-background={active && sessions.length > 1 ? "true" : "false"}
                data-chat-tab-id={session.id}
                data-dragging={draggingSessionId === session.id ? "true" : "false"}
                ref={(element) => {
                  if (element) {
                    tabElementsRef.current.set(session.id, element);
                  } else {
                    tabElementsRef.current.delete(session.id);
                  }
                }}
              >
                <button
                  aria-selected={active}
                  className={styles.tabButton}
                  onBlur={hideTabTooltip}
                  onClick={() => {
                    if (!suppressClickRef.current) {
                      onSelect(session.id);
                    }
                  }}
                  onPointerDown={(event) => beginPointerDrag(event, session)}
                  onPointerEnter={(event) => showTabTooltip(event.currentTarget, tabTitle)}
                  onPointerLeave={hideTabTooltip}
                  role="tab"
                  type="button"
                >
                  <span
                    className={styles.tabTitle}
                    data-chat-tab-title="true"
                    data-overflow={overflowedTitles.has(session.id) || hadLegacyOverflowDots ? "true" : "false"}
                    ref={(element) => {
                      if (element) {
                        titleElementsRef.current.set(session.id, element);
                      } else {
                        titleElementsRef.current.delete(session.id);
                      }
                    }}
                  >
                    {tabTitle}
                  </span>
                </button>
                <button
                  aria-label={`Close tab ${session.title}`}
                  className={styles.closeButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    onClose(session.id);
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                >
                  <X size={14} />
                </button>
                <button
                  aria-expanded={menuSessionId === session.id}
                  aria-haspopup="menu"
                  aria-label={`Chat actions for ${session.title}`}
                  className={styles.moreButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    openActionMenu(event.currentTarget, session.id);
                  }}
                  onFocus={(event) => openActionMenu(event.currentTarget, session.id)}
                  onMouseEnter={(event) => openActionMenu(event.currentTarget, session.id)}
                  onMouseLeave={scheduleMenuClose}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                >
                  <MoreHorizontal fill="currentColor" size={15} />
                </button>
              </div>
              {externalDrop?.index === index + 1 ? (
                <DropSlot key={`drop:${externalDrop.sessionId}`} width={externalDrop.width} />
              ) : null}
            </div>
          );
        })}
      </div>
      <button
        aria-expanded={isAddMenuOpen}
        aria-haspopup="menu"
        aria-label={`Add chat tab in ${pane === "main" ? "left" : "right"} pane`}
        className={styles.iconButton}
        data-menu-open={isAddMenuOpen ? "true" : "false"}
        onClick={toggleAddMenu}
        ref={addButtonRef}
        type="button"
      >
        <Plus size={18} />
        <span className={styles.controlTooltip} role="tooltip">Add chat</span>
      </button>
      <button
        aria-label={isSingleView ? "Restore split view" : `Show ${pane === "main" ? "left" : "right"} chat only`}
        className={styles.iconButton}
        onClick={onToggleView}
        type="button"
      >
        <PanelToggleIcon side={isSingleView ? "split" : "single"} />
        <span className={styles.controlTooltip} role="tooltip">{isSingleView ? "Split screen" : "Single view"}</span>
      </button>
      {dragPreview && typeof document !== "undefined"
        ? createPortal(
            <div
              className={styles.dragPreview}
              style={
                {
                  "--drag-preview-width": `${dragPreview.width}px`,
                  left: dragPreview.x,
                  top: dragPreview.y
                } as CSSProperties
              }
            >
              <X aria-hidden="true" className={styles.dragPreviewClose} size={14} />
              <span className={styles.dragPreviewTitle}>{dragPreview.title}</span>
              <MoreHorizontal
                aria-hidden="true"
                className={styles.dragPreviewMore}
                fill="currentColor"
                size={15}
              />
            </div>,
            document.body
          )
        : null}
      {tabTooltip && !dragPreview && typeof document !== "undefined"
        ? createPortal(
            <div
              className={styles.tabTooltip}
              role="tooltip"
              style={{ left: tabTooltip.left, top: tabTooltip.top }}
            >
              {tabTooltip.title}
            </div>,
            document.body
          )
        : null}
      {menuSession && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-label="Chat actions"
              className={`${styles.actionMenu} stoix-portal-menu`}
              data-overlay-context="chat"
              onMouseEnter={cancelMenuClose}
              onMouseLeave={scheduleMenuClose}
              ref={actionMenuRef}
              role="menu"
              style={{ left: menuPosition.left, top: menuPosition.top }}
            >
              <button
                onClick={() => {
                  const nextTitle = window.prompt("Rename chat", menuSession.title);
                  if (nextTitle?.trim()) {
                    onRename(menuSession.id, nextTitle.trim());
                  }
                  setMenuSessionId(null);
                }}
                role="menuitem"
                type="button"
              >
                <Pencil size={17} />
                Rename chat
              </button>
              {onOpenSide ? (
                <button
                  onClick={() => {
                    onOpenSide(menuSession.id);
                    setMenuSessionId(null);
                  }}
                  role="menuitem"
                  type="button"
                >
                  <PanelToggleIcon side="split" />
                  Split screen
                </button>
              ) : null}
              <button
                onClick={() => {
                  onArchive(menuSession.id);
                  setMenuSessionId(null);
                }}
                role="menuitem"
                type="button"
              >
                <Archive size={17} />
                Archive chat
              </button>
            </div>,
            document.body
          )
        : null}
      {isAddMenuOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              aria-label={`Add chat to ${pane === "main" ? "left" : "right"} pane`}
              className={`${styles.addMenu} stoix-portal-menu`}
              data-overlay-context="chat"
              ref={addMenuRef}
              role="menu"
              style={{ left: addMenuPosition.left, top: addMenuPosition.top }}
            >
              <button
                className={styles.addMenuNew}
                onClick={() => {
                  onAdd();
                  setIsAddMenuOpen(false);
                }}
                role="menuitem"
                type="button"
              >
                <Plus size={17} />
                <span>New chat</span>
              </button>
              {addMenuGroups.map((group) => (
                <section className={styles.addMenuGroup} key={group.id}>
                  <div className={styles.addMenuHeading}>
                    {group.iconSource ? (
                      <ChannelIcon size={16} source={group.iconSource} />
                    ) : (
                      <Folder size={16} />
                    )}
                    <span>{group.label}</span>
                  </div>
                  {group.sessions.map((session) => (
                    <button
                      aria-current={session.localSessionId === activeSessionId ? "true" : undefined}
                      className={styles.addMenuSession}
                      key={session.id}
                      onClick={() => {
                        if (session.localSessionId) {
                          chooseSession(session.localSessionId);
                        } else if (session.channelSession) {
                          onAddChannelSession(session.channelSession);
                          setIsAddMenuOpen(false);
                        }
                      }}
                      role="menuitem"
                      type="button"
                    >
                      <span>{session.title}</span>
                    </button>
                  ))}
                </section>
              ))}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

function DropSlot({ width }: { width: number }) {
  return (
    <span
      aria-hidden="true"
      className={styles.dropSlot}
      style={{ "--drop-slot-width": `${width}px` } as CSSProperties}
    />
  );
}

function broadcastDrag(detail: DragBroadcast) {
  window.dispatchEvent(new CustomEvent<DragBroadcast>(CHAT_TAB_DRAG_EVENT, { detail }));
}

function isTitleTruncated(element: HTMLElement | null) {
  return Boolean(element && element.scrollWidth > element.clientWidth + 1);
}

function titleWithoutOverflowDots(title: string) {
  return title.replace(/\s*(?:\.{3,}|…+)\s*$/, "").trimEnd() || title;
}

function resolvePaneDrop(clientX: number, clientY: number): PaneDrop | null {
  const hit = document.elementFromPoint(clientX, clientY);
  const paneElement = hit?.closest<HTMLElement>("[data-chat-pane]");
  const paneValue = paneElement?.dataset.chatPane;
  if (!paneElement || (paneValue !== "main" && paneValue !== "side")) {
    return null;
  }

  const pane: ChatPaneId = paneValue;

  const tabBar = paneElement.querySelector<HTMLElement>("[data-chat-tab-bar]");
  const viewport = paneElement.querySelector<HTMLElement>("[data-chat-tab-viewport]");
  const tabBarBounds = tabBar?.getBoundingClientRect();
  const overTabBar = Boolean(
    tabBarBounds && clientY >= tabBarBounds.top - 5 && clientY <= tabBarBounds.bottom + 5
  );
  const index = overTabBar && viewport ? insertionIndexAtPoint(viewport, clientX) : 0;
  return { index, overTabBar, pane };
}

function insertionIndexAtPoint(viewport: HTMLElement, clientX: number) {
  const tabs = Array.from(viewport.querySelectorAll<HTMLElement>("[data-chat-tab-id]"));
  const nextIndex = tabs.findIndex((tab) => {
    const bounds = tab.getBoundingClientRect();
    return clientX < bounds.left + bounds.width / 2;
  });
  return nextIndex < 0 ? tabs.length : nextIndex;
}

function setPointerDocumentState() {
  document.documentElement.dataset.chatTabDragging = "true";
}

function restorePointerDocumentState() {
  delete document.documentElement.dataset.chatTabDragging;
}
