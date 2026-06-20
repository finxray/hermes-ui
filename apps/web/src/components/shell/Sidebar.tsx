"use client";

import {
  Archive,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  MessageSquare,
  MessageSquarePlus,
  Pin,
  PinOff,
  Plug,
  RefreshCw,
  RotateCcw,
  Settings
} from "@/components/ui/AppIcons";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session, WorkspaceState } from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { formatSessionUpdatedAt } from "@/lib/workspaceStore";
import { SidebarIconButton, SidebarRow, SidebarStatusDot } from "./SidebarRow";
import styles from "./Sidebar.module.css";

const VISIBLE_CHAT_LIMIT = 5;
const PINNED_SESSION_IDS_STORAGE_KEY = "hermes-ui.sidebar.pinnedSessionIds";
const COLLAPSED_FOLDER_IDS_STORAGE_KEY = "hermes-ui.sidebar.collapsedFolderIds";

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];

type SidebarProps = {
  projects: Project[];
  allSessions: Session[];
  activeProject: Project;
  activeSession: Session | null;
  actions: WorkspaceActions;
  connectionStatus: WorkspaceState["connectionStatus"];
  hermesStatus: NormalizedHermesStatus | null;
  isHermesStatusLoading: boolean;
  isHydrated: boolean;
  activeSection: "workspace" | "plugins";
  onSectionChange: (section: "workspace" | "plugins") => void;
  refreshHermesStatus: () => void;
  runningSessionIds?: string[];
};

export function Sidebar({
  actions,
  allSessions,
  projects,
  activeProject,
  activeSession,
  connectionStatus,
  hermesStatus,
  isHermesStatusLoading,
  isHydrated,
  activeSection,
  onSectionChange,
  refreshHermesStatus,
  runningSessionIds = []
}: SidebarProps) {
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const settingsToggleRef = useRef<HTMLInputElement | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const [scrollFade, setScrollFade] = useState({ top: false, bottom: false });
  const [pinnedSessionIds, setPinnedSessionIds] = useStoredStringSet(PINNED_SESSION_IDS_STORAGE_KEY);
  const [collapsedFolderIds, setCollapsedFolderIds] = useStoredStringSet(
    COLLAPSED_FOLDER_IDS_STORAGE_KEY
  );

  useEffect(() => {
    const scrollBody = scrollBodyRef.current;
    if (!scrollBody) {
      return;
    }

    function updateScrollFade() {
      const element = scrollBodyRef.current;
      if (!element) {
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = element;
      setScrollFade({
        top: scrollTop > 4,
        bottom: scrollTop + clientHeight < scrollHeight - 4
      });
    }

    updateScrollFade();

    scrollBody.addEventListener("scroll", updateScrollFade, { passive: true });
    const resizeObserver = new ResizeObserver(updateScrollFade);
    resizeObserver.observe(scrollBody);

    return () => {
      scrollBody.removeEventListener("scroll", updateScrollFade);
      resizeObserver.disconnect();
    };
  }, []);

  const scrollBodyStyle = {
    "--scroll-fade-top": scrollFade.top ? "var(--sidebar-edge-fade-height)" : "0px",
    "--scroll-fade-bottom": scrollFade.bottom ? "var(--sidebar-edge-fade-height)" : "0px"
  } as CSSProperties;
  const pinnedSessionIdSet = new Set(pinnedSessionIds);
  const runningSessionIdSet = new Set(runningSessionIds);
  const pinnedSessions = allSessions
    .filter((session) => !session.archivedAt && pinnedSessionIdSet.has(session.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  function togglePinnedSession(sessionId: string) {
    setPinnedSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [sessionId, ...current]
    );
  }

  function toggleFolder(folderId: string) {
    setCollapsedFolderIds((current) =>
      current.includes(folderId)
        ? current.filter((id) => id !== folderId)
        : [folderId, ...current]
    );
  }

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (settingsToggleRef.current) {
          settingsToggleRef.current.checked = false;
        }
      }
    }

    function closeOnOutside(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Node && !settingsRef.current?.contains(target)) {
        if (settingsToggleRef.current) {
          settingsToggleRef.current.checked = false;
        }
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("mousedown", closeOnOutside);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("mousedown", closeOnOutside);
    };
  }, []);

  return (
    <aside className={styles.sidebar} data-shell-rail="left" aria-label="Projects and chats">
      <div className={styles.sidebarHeader}>
        <div className={styles.quickActions}>
          <SidebarRow
            icon={<FolderPlus size={15} />}
            label="Project"
            onClick={() => {
              onSectionChange("workspace");
              actions.createProject();
            }}
          />
          <SidebarRow
            icon={<MessageSquarePlus size={15} />}
            label="New chat"
            onClick={() => {
              onSectionChange("workspace");
              actions.createSession();
            }}
          />
          <SidebarRow
            active={activeSection === "plugins"}
            icon={<Plug size={15} />}
            label="Plugins"
            onClick={() => onSectionChange("plugins")}
          />
        </div>
      </div>

      <div className={styles.scrollRegion}>
      <div ref={scrollBodyRef} className={styles.scrollBody} style={scrollBodyStyle}>
      {pinnedSessions.length > 0 ? (
        <section className={styles.section} aria-labelledby="pinned-heading">
          <FolderHeader
            collapsed={collapsedFolderIds.includes("pinned")}
            id="pinned-heading"
            label="Pinned"
            onToggle={() => toggleFolder("pinned")}
            showIcon={false}
          />
          {collapsedFolderIds.includes("pinned") ? null : (
            <CollapsibleSessionList
              activeSessionId={activeSession?.id ?? null}
              isPinned={(sessionId) => pinnedSessionIdSet.has(sessionId)}
              isRunning={(sessionId) => runningSessionIdSet.has(sessionId)}
              listClassName={styles.list}
              onArchive={(sessionId) => actions.archiveSession(sessionId)}
              onSelect={(sessionId) => actions.switchSession(sessionId)}
              onTogglePin={togglePinnedSession}
              sessions={pinnedSessions}
              showOverflowControl={false}
            />
          )}
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="projects-heading">
        <div className={styles.sectionLabel} id="projects-heading">
          <span>Projects</span>
        </div>
        <ul className={styles.list}>
          {projects.map((project) => {
            const projectSessions = getProjectSessions(allSessions, project.id);
            const isActiveProject = project.id === activeProject.id;
            const folderId = `project:${project.id}`;
            const isCollapsed = collapsedFolderIds.includes(folderId);
            return (
              <li className={styles.projectGroup} key={project.id}>
                <FolderHeader
                  active={isActiveProject && !activeSession}
                  collapsed={isCollapsed}
                  label={project.name}
                  onCreateChat={() => {
                    actions.switchProject(project.id);
                    actions.createSessionForProject(project.id);
                  }}
                  onOpenProject={() => actions.switchProject(project.id)}
                  onToggle={() => toggleFolder(folderId)}
                />
                <div className={styles.folderBody} data-expanded={isCollapsed ? "false" : "true"}>
                  <div className={styles.folderBodyInner}>
                    {projectSessions.length === 0 ? (
                      <SidebarRow depth={1} disabled label="No chats" muted />
                    ) : (
                      <CollapsibleSessionList
                        activeSessionId={activeSession?.id ?? null}
                        depth={1}
                        isPinned={(sessionId) => pinnedSessionIdSet.has(sessionId)}
                        isRunning={(sessionId) => runningSessionIdSet.has(sessionId)}
                        onArchive={(sessionId) => actions.archiveSession(sessionId)}
                        onSelect={(sessionId) => actions.switchSession(sessionId)}
                        onTogglePin={togglePinnedSession}
                        sessions={projectSessions}
                      />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="chats-heading">
        <div className={styles.sectionLabel} id="chats-heading">
          <span>Recent chats</span>
        </div>
        <CollapsibleSessionList
          activeSessionId={activeSession?.id ?? null}
          autoExpandActive={false}
          icon={<MessageSquare size={15} />}
          isPinned={(sessionId) => pinnedSessionIdSet.has(sessionId)}
          isRunning={(sessionId) => runningSessionIdSet.has(sessionId)}
          listClassName={styles.list}
          onArchive={(sessionId) => actions.archiveSession(sessionId)}
          onSelect={(sessionId) => actions.switchSession(sessionId)}
          onTogglePin={togglePinnedSession}
          previewCount={3}
          sessions={getRecentChats(allSessions)}
        />
      </section>
      </div>
      </div>

      <div className={styles.footerDock}>
        <div className={styles.footer} ref={settingsRef}>
        <input
          ref={settingsToggleRef}
          className={styles.settingsToggle}
          id="studio-settings-toggle"
          type="checkbox"
          aria-hidden="true"
        />
        <div className={styles.settingsPopover} role="dialog" aria-label="Settings and connection status">
          <div className={styles.accountBlock}>
            <div className={styles.accountAvatar} aria-hidden="true">
              <Folder size={16} />
            </div>
            <div>
              <div className={styles.accountTitle}>Brain Memory Studio</div>
              <div className={styles.accountMeta}>Local profile</div>
            </div>
          </div>
          <div className={styles.popoverRows}>
            <SidebarRow icon={<Settings size={14} />} label="Settings" muted />
          </div>
          <div className={styles.popoverSection}>
            <div className={styles.popoverLabel}>Mock connections</div>
            <div className={styles.popoverRows}>
              <SidebarRow
                icon={<SidebarStatusDot tone={hermesStatusTone(hermesStatus, isHermesStatusLoading)} />}
                label={`Hermes: ${formatHermesStatus(hermesStatus, isHermesStatusLoading)}`}
                muted
              />
              <SidebarRow
                icon={<SidebarStatusDot tone="mock" />}
                label={`Brain Memory: ${connectionStatus.brainMemory}`}
                muted
              />
              <SidebarRow
                icon={<SidebarStatusDot tone="quiet" />}
                label={isHydrated ? "LocalStorage: active" : "LocalStorage: loading"}
                muted
              />
            </div>
          </div>
          <div className={styles.popoverRows}>
            <SidebarRow icon={<RotateCcw size={14} />} label="Reset mock data" onClick={actions.reset} />
            <SidebarRow
              icon={<RefreshCw size={14} />}
              label="Refresh Hermes"
              onClick={refreshHermesStatus}
            />
          </div>
        </div>
        <label
          className={styles.settingsButton}
          htmlFor="studio-settings-toggle"
          aria-label="Open settings and connection status"
          title="Open settings and connection status"
        >
          <span className={styles.settingsIcon} aria-hidden="true">
            <Settings size={15} />
          </span>
          <span className={styles.settingsLabel}>Settings</span>
        </label>
        </div>
      </div>
    </aside>
  );
}

function getProjectSessions(sessions: Session[], projectId: string) {
  return sessions
    .filter((session) => session.projectId === projectId && !session.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getRecentChats(sessions: Session[]) {
  return sessions
    .filter((session) => !session.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function FolderHeader({
  active = false,
  collapsed,
  id,
  label,
  muted = false,
  onCreateChat,
  onOpenProject,
  showIcon = true,
  onToggle
}: {
  active?: boolean;
  collapsed: boolean;
  id?: string;
  label: string;
  muted?: boolean;
  onCreateChat?: () => void;
  onOpenProject?: () => void;
  showIcon?: boolean;
  onToggle: () => void;
}) {
  const ChevronIcon = collapsed ? ChevronRight : ChevronDown;

  return (
    <div
      className={[
        styles.folderHeader,
        active ? styles.folderHeaderActive : "",
        muted ? styles.folderHeaderMuted : "",
        showIcon ? "" : styles.folderHeaderNoIcon
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        className={styles.folderMainButton}
        type="button"
        onClick={onOpenProject ?? onToggle}
        aria-current={active ? "page" : undefined}
      >
        {showIcon ? <Folder size={15} /> : null}
        <span className={styles.folderTitle} id={id}>
          {label}
        </span>
      </button>
      <button
        className={styles.folderChevronButton}
        type="button"
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
        aria-expanded={!collapsed}
        onClick={onToggle}
      >
        <ChevronIcon size={15} />
      </button>
      <span className={styles.folderMeta} />
      <span className={styles.folderActions}>
        {onCreateChat ? (
          <SidebarIconButton label={`New chat in ${label}`} onClick={onCreateChat}>
            <MessageSquarePlus size={14} />
          </SidebarIconButton>
        ) : null}
      </span>
    </div>
  );
}

function CollapsibleSessionList({
  activeSessionId,
  autoExpandActive = true,
  depth = 0,
  icon,
  isPinned,
  isRunning,
  listClassName = styles.childList,
  onSelect,
  onArchive,
  onTogglePin,
  previewCount = VISIBLE_CHAT_LIMIT,
  showOverflowControl = true,
  sessions
}: {
  activeSessionId: string | null;
  autoExpandActive?: boolean;
  depth?: 0 | 1;
  icon?: ReactNode;
  isPinned: (sessionId: string) => boolean;
  isRunning: (sessionId: string) => boolean;
  listClassName?: string;
  onArchive: (sessionId: string) => void;
  onSelect: (sessionId: string) => void;
  onTogglePin: (sessionId: string) => void;
  previewCount?: number;
  showOverflowControl?: boolean;
  sessions: Session[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visibleSessions = showOverflowControl ? sessions.slice(0, previewCount) : sessions;
  const overflowSessions = showOverflowControl ? sessions.slice(previewCount) : [];
  const hasOverflow = overflowSessions.length > 0;

  useEffect(() => {
    if (!autoExpandActive || !activeSessionId || !hasOverflow) {
      return;
    }
    const activeIndex = sessions.findIndex((session) => session.id === activeSessionId);
    if (activeIndex >= previewCount) {
      setExpanded(true);
    }
  }, [activeSessionId, autoExpandActive, hasOverflow, previewCount, sessions]);

  function renderSession(session: Session) {
    const pinned = isPinned(session.id);
    const running = isRunning(session.id);
    return (
      <li key={session.id}>
        <SidebarRow
          active={session.id === activeSessionId}
          actions={
            <>
              <SidebarIconButton
                label={pinned ? `Unpin ${session.title}` : `Pin ${session.title}`}
                onClick={() => onTogglePin(session.id)}
              >
                {pinned ? <PinOff size={15} /> : <Pin size={15} />}
              </SidebarIconButton>
              <SidebarIconButton
                label={`Archive ${session.title}`}
                onClick={() => onArchive(session.id)}
              >
                <Archive size={15} />
              </SidebarIconButton>
            </>
          }
          depth={depth}
          icon={icon}
          label={session.title?.trim() || "New chat"}
          meta={running ? <RunningSessionSpinner /> : formatSessionUpdatedAt(session.updatedAt)}
          onClick={() => onSelect(session.id)}
        />
      </li>
    );
  }

  return (
    <>
      <ul className={listClassName}>{visibleSessions.map(renderSession)}</ul>
      {hasOverflow ? (
        <>
          <div className={styles.collapsibleChatList} data-expanded={expanded ? "true" : "false"}>
            <ul className={`${listClassName} ${styles.collapsibleChatListInner}`}>
              {overflowSessions.map(renderSession)}
            </ul>
          </div>
          <button
            type="button"
            className={styles.showMoreButton}
            data-depth={depth}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        </>
      ) : null}
    </>
  );
}

function RunningSessionSpinner() {
  return <span className={styles.runningSpinner} aria-label="Chat running" role="status" />;
}

function useStoredStringSet(key: string) {
  const [values, setValues] = useState<string[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) {
        setHasLoaded(true);
        return;
      }
      const parsedValue = JSON.parse(rawValue);
      if (Array.isArray(parsedValue)) {
        setValues(parsedValue.filter((value): value is string => typeof value === "string"));
      }
    } catch {
      setValues([]);
    } finally {
      setHasLoaded(true);
    }
  }, [key]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(values));
    } catch {
      // Sidebar UI state is non-critical; ignore storage failures.
    }
  }, [hasLoaded, key, values]);

  return [values, setValues] as const;
}

function formatHermesStatus(status: NormalizedHermesStatus | null, isLoading: boolean) {
  if (isLoading && !status) {
    return "checking";
  }
  if (!status) {
    return "unknown";
  }
  if (status.mode === "real" && status.reachable) {
    return "connected";
  }
  if (status.mode === "unconfigured") {
    return "unconfigured";
  }
  if (status.mode === "mock") {
    return "mock";
  }
  return "unreachable";
}

function hermesStatusTone(
  status: NormalizedHermesStatus | null,
  isLoading: boolean
): "error" | "mock" | "quiet" | "success" {
  if (isLoading && !status) {
    return "quiet";
  }
  if (status?.mode === "real" && status.reachable) {
    return "success";
  }
  if (status?.mode === "error") {
    return "error";
  }
  return "mock";
}
