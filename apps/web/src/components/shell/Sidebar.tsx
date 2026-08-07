"use client";

import {
  Archive,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  MessageSquarePlus,
  MoreHorizontal,
  NewChat,
  Pencil,
  Pin,
  PinOff
} from "@/components/ui/AppIcons";
import { Cog } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { HermesSessionSummary, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session } from "@/data/types";
import { ChannelIcon } from "@/components/ui/ChannelIcon";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { getChannelDescriptor, isExternalChannelSource } from "@/lib/sessionChannels";
import { formatSessionUpdatedAt } from "@/lib/workspaceStore";
import { SidebarIconButton, SidebarRow } from "./SidebarRow";
import { useSectionNav } from "./SectionNavContext";
import type { ShellSection } from "./TopBar";
import { useScrollOverflowTarget } from "@/hooks/useScrollOverflowTarget";
import styles from "./Sidebar.module.css";

const SECTION_RAIL_LABELS: Partial<Record<ShellSection, string>> = {
  plugins: "Categories",
  config: "Sections",
  keys: "Categories",
  logs: "Sources",
  settings: "Settings"
};

const SECTION_EMPTY_LABELS: Partial<Record<ShellSection, string>> = {
  plugins: "No categories",
  config: "No sections",
  keys: "No categories",
  logs: "No sources",
  settings: "No settings"
};

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
  hermesStatus: NormalizedHermesStatus | null;
  hermesSessions?: HermesSessionSummary[];
  hasUnseenUpdate?: boolean;
  isHermesStatusLoading: boolean;
  activeSection: ShellSection;
  onSectionChange: (section: ShellSection) => void;
  onWorkspaceSessionSelect?: () => void;
  onHermesSessionSelect?: (session: HermesSessionSummary) => void;
  onEnsureHermesSession?: (session: HermesSessionSummary) => Promise<string | null>;
  refreshHermesStatus: () => void;
  runningSessionIds?: string[];
};

export function Sidebar({
  actions,
  allSessions,
  projects,
  activeProject,
  activeSession,
  activeSection,
  hermesSessions = [],
  hasUnseenUpdate = false,
  onSectionChange,
  onEnsureHermesSession,
  onHermesSessionSelect,
  onWorkspaceSessionSelect,
  runningSessionIds = []
}: SidebarProps) {
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const sectionNav = useSectionNav();
  const [scrollFade, setScrollFade] = useState({ top: false, bottom: false });
  const [pinnedSessionIds, setPinnedSessionIds] = useStoredStringSet(PINNED_SESSION_IDS_STORAGE_KEY);
  const [collapsedFolderIds, setCollapsedFolderIds] = useStoredStringSet(
    COLLAPSED_FOLDER_IDS_STORAGE_KEY
  );
  const [expandedChannelSources, setExpandedChannelSources] = useState<string[]>([]);

  useScrollOverflowTarget(scrollBodyRef);

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
  const visibleProjects = projects
    .map((project) => ({
      project,
      sessions: getProjectSessions(allSessions, project.id).filter(
        (session) => !session.channel?.external
      )
    }))
    .filter(({ project, sessions }) => !isEmptyUntitledProject(project, sessions));
  const localSessionsByHermesId = new Map(
    allSessions
      .filter((session) => session.channel?.external)
      .map((session) => [session.hermesSessionId, session])
  );
  const archivedHermesIds = new Set(
    allSessions
      .filter((session) => session.archivedAt && session.channel?.external)
      .map((session) => session.hermesSessionId)
  );
  const liveHermesIds = new Set(hermesSessions.map((session) => session.id));
  const persistedChannelSessions: HermesSessionSummary[] = allSessions
    .filter(
      (session) =>
        !session.archivedAt &&
        session.channel?.external &&
        !liveHermesIds.has(session.hermesSessionId)
    )
    .map((session) => ({
      id: session.hermesSessionId,
      title: session.title,
      model: session.modelPreference?.selectModelId ?? null,
      source: session.channel?.source ?? null,
      startedAt: session.createdAt,
      endedAt: null,
      lastActiveAt: session.channel?.lastActiveAt ?? session.updatedAt,
      parentSessionId: session.channel?.parentSessionId ?? null,
      preview: session.summary || null,
      messageCount: session.messages.length
    }));
  const channelGroups = groupChannelSessions(
    [...hermesSessions, ...persistedChannelSessions]
      .filter((session) => isExternalChannelSource(session.source))
      .filter((session) => !archivedHermesIds.has(session.id))
      .map((session) => {
        const localSession = localSessionsByHermesId.get(session.id);
        return localSession
          ? {
              ...session,
              title: localSession.title,
              lastActiveAt: localSession.updatedAt
            }
          : session;
      })
      .sort((a, b) => (b.lastActiveAt ?? b.startedAt).localeCompare(a.lastActiveAt ?? a.startedAt))
  );

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

  return (
    <aside className={styles.sidebar} data-shell-rail="left" aria-label="Projects and chats">
      <div className={styles.brandRow}>
        <img
          alt="Stoix"
          className={styles.brandLogo}
          height="484"
          src="/assets/stoix-logo-spaced.png"
          width="1203"
        />
      </div>
      {activeSection === "workspace" ? (
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
              icon={<NewChat size={17} />}
              label="New chat"
              onClick={() => {
                onSectionChange("workspace");
                actions.createSession();
              }}
            />
          </div>
        </div>
      ) : null}

      <div className={styles.scrollRegion}>
      <div ref={scrollBodyRef} className={styles.scrollBody} style={scrollBodyStyle}>
      {activeSection !== "workspace" ? (
        <CategoryRail
          activeCategoryId={sectionNav.activeCategoryId}
          categories={sectionNav.categoriesForSection(activeSection)}
          emptyLabel={SECTION_EMPTY_LABELS[activeSection] ?? "No categories"}
          isPublished={sectionNav.hasPublishedCategories(activeSection)}
          label={SECTION_RAIL_LABELS[activeSection] ?? "Categories"}
          onSelect={sectionNav.requestScroll}
        />
      ) : (
      <>
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
              getSessionProjectLabel={(session) =>
                projects.find((project) => project.id === session.projectId)?.name ?? "Project"
              }
              isPinned={(sessionId) => pinnedSessionIdSet.has(sessionId)}
              isRunning={(sessionId) => runningSessionIdSet.has(sessionId)}
              listClassName={styles.list}
              onArchive={(sessionId) => actions.archiveSession(sessionId)}
              onRename={actions.renameSession}
              onSelect={(sessionId) => {
                onWorkspaceSessionSelect?.();
                actions.switchSession(sessionId);
              }}
              onTogglePin={togglePinnedSession}
              sessions={pinnedSessions}
              showOverflowControl={false}
            />
          )}
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="projects-heading">
        <div className={`${styles.sectionLabel} ${styles.workspaceSectionLabel}`} id="projects-heading">
          <span>Projects</span>
        </div>
        <ul className={styles.list}>
          {channelGroups.map((group) => {
            const folderId = `channel:${group.key}`;
            const isCollapsed = collapsedFolderIds.includes(folderId);
            const showAll = expandedChannelSources.includes(group.key);
            const visibleSessions = showAll
              ? group.sessions
              : group.sessions.slice(0, VISIBLE_CHAT_LIMIT);
            return (
              <li className={styles.projectGroup} key={folderId}>
                <FolderHeader
                  collapsed={isCollapsed}
                  icon={<ChannelIcon source={group.source} size={15} />}
                  label={group.label}
                  onToggle={() => toggleFolder(folderId)}
                />
                <div className={styles.folderBody} data-expanded={isCollapsed ? "false" : "true"}>
                  <div className={styles.folderBodyInner}>
                    <ul className={styles.childList}>
                      {visibleSessions.map((summary) => {
                        const localSession = localSessionsByHermesId.get(summary.id);
                        const displaySession: SessionRowData = localSession ?? {
                          id: summary.id,
                          title: summary.title || "Untitled session",
                          updatedAt: summary.lastActiveAt ?? summary.startedAt,
                          channel: makeDisplayChannel(summary)
                        };

                        async function withLocalSession(action: (sessionId: string) => void) {
                          const sessionId = localSession?.id ?? await onEnsureHermesSession?.(summary);
                          if (sessionId) {
                            action(sessionId);
                          }
                        }

                        return (
                          <li key={`channel-${summary.id}`}>
                            <SessionSidebarRow
                              active={activeSession?.hermesSessionId === summary.id}
                              depth={1}
                              isPinned={Boolean(localSession && pinnedSessionIdSet.has(localSession.id))}
                              onArchive={() => void withLocalSession(actions.archiveSession)}
                              onRename={(title) => void withLocalSession((sessionId) =>
                                actions.renameSession(sessionId, title)
                              )}
                              onSelect={() => {
                                onSectionChange("workspace");
                                onWorkspaceSessionSelect?.();
                                onHermesSessionSelect?.(summary);
                              }}
                              onTogglePin={() => void withLocalSession(togglePinnedSession)}
                              projectLabel={group.label}
                              session={displaySession}
                            />
                          </li>
                        );
                      })}
                    </ul>
                    {group.sessions.length > VISIBLE_CHAT_LIMIT ? (
                      <button
                        className={styles.showMoreButton}
                        data-depth="1"
                        onClick={() => setExpandedChannelSources((current) =>
                          current.includes(group.key)
                            ? current.filter((source) => source !== group.key)
                            : [...current, group.key]
                        )}
                        type="button"
                      >
                        {showAll ? "Show less" : "Show more"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
          {visibleProjects.map(({ project, sessions: projectSessions }) => {
            const isActiveProject = project.id === activeProject.id;
            return (
              <li className={styles.projectGroup} key={project.id}>
                <ProjectHeader
                  active={isActiveProject && !activeSession}
                  label={project.name}
                  onCreateChat={() => {
                    onSectionChange("workspace");
                    actions.switchProject(project.id);
                    actions.createSessionForProject(project.id);
                  }}
                  onOpenProject={() => {
                    onSectionChange("workspace");
                    actions.switchProject(project.id);
                  }}
                  onRename={(name) => actions.renameProject(project.id, name)}
                />
                {projectSessions.length === 0 ? (
                  <SidebarRow depth={1} disabled label="No chats" muted />
                ) : (
                  <CollapsibleSessionList
                    activeSessionId={activeSession?.id ?? null}
                    depth={1}
                    getSessionProjectLabel={() => project.name}
                    isPinned={(sessionId) => pinnedSessionIdSet.has(sessionId)}
                    isRunning={(sessionId) => runningSessionIdSet.has(sessionId)}
                    onArchive={(sessionId) => actions.archiveSession(sessionId)}
                    onRename={actions.renameSession}
                    onSelect={(sessionId) => {
                      onSectionChange("workspace");
                      onWorkspaceSessionSelect?.();
                      actions.switchSession(sessionId);
                    }}
                    onTogglePin={togglePinnedSession}
                    sessions={projectSessions}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="chats-heading">
        <ChatsFolderRow
          id="chats-heading"
          onCreateChat={() => {
            onSectionChange("workspace");
            actions.createSession();
          }}
        />
      </section>
      </>
      )}
      </div>
      </div>

      <div className={styles.footerDock}>
        <div className={styles.footer}>
        <button
          aria-current={activeSection === "settings" ? "page" : undefined}
          aria-label={hasUnseenUpdate ? "Open settings, software update available" : "Open settings"}
          className={styles.settingsButton}
          onClick={() => onSectionChange("settings")}
          type="button"
        >
          <span className={styles.settingsIcon} aria-hidden="true">
            <Cog size={20} strokeWidth={1.8} />
          </span>
          <span className={styles.settingsLabel}>
            Settings
            {hasUnseenUpdate ? (
              <span aria-label="Software update available" className={styles.settingsUpdateDot} role="status" />
            ) : null}
          </span>
        </button>
        </div>
      </div>
    </aside>
  );
}

type ChannelSessionGroup = {
  key: string;
  label: string;
  source: string;
  sessions: HermesSessionSummary[];
};

function groupChannelSessions(sessions: HermesSessionSummary[]): ChannelSessionGroup[] {
  const groups = new Map<string, ChannelSessionGroup>();
  for (const session of sessions) {
    const descriptor = getChannelDescriptor(session.source);
    const key = descriptor.label.toLowerCase();
    const current = groups.get(key);
    if (current) {
      current.sessions.push(session);
      continue;
    }
    groups.set(key, {
      key,
      label: descriptor.label,
      source: descriptor.source,
      sessions: [session]
    });
  }
  return [...groups.values()];
}

function CategoryRail({
  activeCategoryId,
  categories,
  emptyLabel,
  isPublished,
  label,
  onSelect
}: {
  activeCategoryId: string | null;
  categories: { id: string; label: string; count: number }[];
  emptyLabel: string;
  isPublished: boolean;
  label: string;
  onSelect: (id: string) => void;
}) {
  return (
    <section className={styles.section} aria-label={label}>
      <div className={styles.sectionLabel}>
        <span>{label}</span>
      </div>
      {categories.length === 0 ? (
        <SidebarRow depth={1} disabled label={isPublished ? emptyLabel : "Loading..."} muted />
      ) : (
        <ul className={styles.list}>
          {categories.map((category) => (
            <li key={category.id}>
              <SidebarRow
                active={category.id === activeCategoryId}
                label={category.label}
                meta={category.count > 0 ? category.count : undefined}
                onClick={() => onSelect(category.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function getProjectSessions(sessions: Session[], projectId: string) {
  return sessions
    .filter((session) => session.projectId === projectId && !session.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function isEmptyUntitledProject(project: Project, sessions: Session[]) {
  return /^Untitled project(?: \d+)?$/i.test(project.name.trim()) && sessions.length === 0;
}

function ProjectHeader({
  active,
  label,
  onCreateChat,
  onOpenProject,
  onRename
}: {
  active: boolean;
  label: string;
  onCreateChat: () => void;
  onOpenProject: () => void;
  onRename: (name: string) => void;
}) {
  function renameProject() {
    const nextName = window.prompt("Rename project", label);
    if (nextName?.trim()) {
      onRename(nextName.trim());
    }
  }

  return (
    <div className={`${styles.projectHeader} ${active ? styles.projectHeaderActive : ""}`}>
      <button
        aria-current={active ? "page" : undefined}
        className={styles.projectMainButton}
        onClick={onOpenProject}
        type="button"
      >
        <Folder size={19} />
        <span className={styles.projectTitle}>{label}</span>
      </button>
      <span className={styles.projectActions}>
        <button
          aria-label={`Rename ${label}`}
          className={styles.projectActionButton}
          onClick={renameProject}
          type="button"
        >
          <MoreHorizontal size={18} />
        </button>
        <button
          aria-label={`New chat in ${label}`}
          className={styles.projectActionButton}
          onClick={onCreateChat}
          type="button"
        >
          <NewChat size={19} />
        </button>
      </span>
    </div>
  );
}

function FolderHeader({
  active = false,
  collapsed,
  id,
  icon,
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
  icon?: ReactNode;
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
        {showIcon ? (icon ?? <Folder size={15} />) : null}
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
            <MessageSquarePlus size={10} />
          </SidebarIconButton>
        ) : null}
      </span>
    </div>
  );
}

function ChatsFolderRow({
  id,
  onCreateChat
}: {
  id: string;
  onCreateChat: () => void;
}) {
  return (
    <div className={styles.chatsFolderRow}>
      <div className={styles.chatsFolderMain}>
        <span className={styles.chatsFolderTitle} id={id}>
          Chats
        </span>
        <ChevronRight aria-hidden="true" size={15} />
      </div>
      <span className={styles.chatsFolderActions}>
        <SidebarIconButton label="New chat" onClick={onCreateChat}>
          <MessageSquarePlus size={11} />
        </SidebarIconButton>
      </span>
    </div>
  );
}

function CollapsibleSessionList({
  activeSessionId,
  autoExpandActive = true,
  depth = 0,
  getSessionProjectLabel,
  icon,
  isPinned,
  isRunning,
  listClassName = styles.childList,
  onSelect,
  onArchive,
  onRename,
  onTogglePin,
  previewCount = VISIBLE_CHAT_LIMIT,
  showOverflowControl = true,
  sessions
}: {
  activeSessionId: string | null;
  autoExpandActive?: boolean;
  depth?: 0 | 1;
  getSessionProjectLabel?: (session: Session) => string;
  icon?: ReactNode;
  isPinned: (sessionId: string) => boolean;
  isRunning: (sessionId: string) => boolean;
  listClassName?: string;
  onArchive: (sessionId: string) => void;
  onRename: (sessionId: string, title: string) => void;
  onSelect: (sessionId: string) => void;
  onTogglePin: (sessionId: string) => void;
  previewCount?: number;
  showOverflowControl?: boolean;
  sessions: Session[];
}) {
  const [visibleCount, setVisibleCount] = useState(previewCount);
  const [isCollapsing, setIsCollapsing] = useState(false);
  const lastAutoExpandedSessionIdRef = useRef<string | null>(null);
  const visibleSessions = showOverflowControl ? sessions.slice(0, visibleCount) : sessions;
  const hasOverflow = showOverflowControl && sessions.length > previewCount;

  useEffect(() => {
    if (
      !autoExpandActive ||
      !activeSessionId ||
      !hasOverflow ||
      lastAutoExpandedSessionIdRef.current === activeSessionId
    ) {
      return;
    }
    lastAutoExpandedSessionIdRef.current = activeSessionId;
    const activeIndex = sessions.findIndex((session) => session.id === activeSessionId);
    if (activeIndex >= visibleCount) {
      setVisibleCount(nextDoubledVisibleCount(previewCount, activeIndex + 1, sessions.length));
    }
  }, [activeSessionId, autoExpandActive, hasOverflow, previewCount, sessions, visibleCount]);

  useEffect(() => {
    setVisibleCount((current) => Math.max(previewCount, Math.min(current, sessions.length)));
    setIsCollapsing((current) => current && sessions.length > previewCount);
  }, [previewCount, sessions.length]);

  function changeVisibleCount() {
    if (isCollapsing) {
      const nextCount = previousDoubledVisibleCount(previewCount, visibleCount);
      setVisibleCount(nextCount);
      if (nextCount <= previewCount) {
        setIsCollapsing(false);
      }
      return;
    }

    const nextCount = Math.min(sessions.length, visibleCount * 2);
    setVisibleCount(nextCount);
    if (nextCount >= sessions.length) {
      setIsCollapsing(true);
    }
  }

  function renderSession(session: Session) {
    const running = isRunning(session.id);
    const hasUnseenResult = session.id !== activeSessionId && hasUnseenTerminalRun(session);
    return (
      <li key={session.id}>
        <SessionSidebarRow
          active={session.id === activeSessionId}
          depth={depth}
          isPinned={isPinned(session.id)}
          meta={
            running ? (
              <RunningSessionSpinner />
            ) : hasUnseenResult ? (
              <UnseenResultDot />
            ) : undefined
          }
          onArchive={() => onArchive(session.id)}
          onRename={(title) => onRename(session.id, title)}
          onSelect={() => onSelect(session.id)}
          onTogglePin={() => onTogglePin(session.id)}
          projectLabel={getSessionProjectLabel?.(session) ?? "Project"}
          rowIcon={session.channel ? <ChannelIcon source={session.channel.source} size={14} /> : icon}
          session={session}
        />
      </li>
    );
  }

  return (
    <>
      <ul className={`${listClassName} ${styles.pagedSessionList}`}>
        {visibleSessions.map(renderSession)}
      </ul>
      {hasOverflow ? (
        <button
          type="button"
          className={styles.showMoreButton}
          data-depth={depth}
          aria-expanded={visibleCount > previewCount}
          onClick={changeVisibleCount}
        >
          {isCollapsing ? "Show less" : "Show more"}
        </button>
      ) : null}
    </>
  );
}

function nextDoubledVisibleCount(initialCount: number, minimumCount: number, totalCount: number) {
  let count = initialCount;
  while (count < minimumCount && count < totalCount) {
    count *= 2;
  }
  return Math.min(count, totalCount);
}

function previousDoubledVisibleCount(initialCount: number, currentCount: number) {
  let previousCount = initialCount;
  while (previousCount * 2 < currentCount) {
    previousCount *= 2;
  }
  return previousCount;
}

function SessionSidebarRow({
  active,
  depth,
  isPinned,
  meta,
  onArchive,
  onRename,
  onSelect,
  onTogglePin,
  projectLabel,
  rowIcon,
  session
}: {
  active: boolean;
  depth: 0 | 1;
  isPinned: boolean;
  meta?: ReactNode;
  onArchive: () => void;
  onRename: (title: string) => void;
  onSelect: () => void;
  onTogglePin: () => void;
  projectLabel: string;
  rowIcon?: ReactNode;
  session: SessionRowData;
}) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuPopupRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<CSSProperties>({});
  const [hoverCardOpen, setHoverCardOpen] = useState(false);
  const [hoverCardPosition, setHoverCardPosition] = useState<CSSProperties>({});
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionTitle = session.title?.trim() || "New chat";

  function openHoverCard(delayMs = 420) {
    if (menuOpen) {
      return;
    }
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      const row = menuRef.current;
      if (!row) {
        return;
      }
      const rect = row.getBoundingClientRect();
      const width = Math.min(225, Math.max(210, window.innerWidth - 32));
      setHoverCardPosition({
        left: Math.min(rect.right + 3, window.innerWidth - width - 12),
        top: Math.max(12, Math.min(rect.top, window.innerHeight - 106)),
        width
      });
      setHoverCardOpen(true);
    }, delayMs);
  }

  function closeHoverCard() {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverCardOpen(false);
  }

  useEffect(() => closeHoverCard, []);

  useEffect(() => {
    if (menuOpen) {
      closeHoverCard();
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function updateMenuPosition() {
      const row = menuRef.current;
      if (!row) {
        return;
      }
      const rect = row.getBoundingClientRect();
      const menuWidth = Math.min(270, Math.max(230, window.innerWidth - 36));
      setMenuPosition({
        left: Math.max(12, Math.min(rect.left + 18, window.innerWidth - menuWidth - 12)),
        top: Math.max(12, Math.min(rect.bottom + 6, window.innerHeight - 284)),
        width: menuWidth
      });
    }

    function closeOnOutside(event: MouseEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        !menuRef.current?.contains(target) &&
        !menuPopupRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    updateMenuPosition();
    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [menuOpen]);

  function renameSession() {
    const nextTitle = window.prompt("Rename chat", sessionTitle);
    if (nextTitle?.trim()) {
      onRename(nextTitle);
    }
    setMenuOpen(false);
  }

  const menu = menuOpen
    ? createPortal(
        <div
          className={styles.sessionMenu}
          ref={menuPopupRef}
          role="menu"
          aria-label={`${sessionTitle} options`}
          style={menuPosition}
        >
          <SessionMenuItem icon={<Pencil size={21} />} label="Rename" onClick={renameSession} />
          <div className={styles.sessionMenuDivider} />
          <SessionMenuItem
            icon={isPinned ? <PinOff size={21} /> : <Pin size={21} />}
            label={isPinned ? "Unpin chat" : "Pin chat"}
            onClick={() => {
              onTogglePin();
              setMenuOpen(false);
            }}
          />
          <SessionMenuItem
            icon={<Archive size={21} />}
            label="Archive"
            onClick={() => {
              onArchive();
              setMenuOpen(false);
            }}
          />
        </div>,
        document.body
      )
    : null;
  const hoverCard = hoverCardOpen
    ? createPortal(
        <div className={styles.sessionHoverCard} role="tooltip" style={hoverCardPosition}>
          <div className={styles.sessionHoverHeader}>
            <strong>{sessionTitle}</strong>
            <span>{formatSessionUpdatedAt(session.updatedAt)}</span>
          </div>
          <div className={styles.sessionHoverDetail}>
            {session.channel ? (
              <ChannelIcon source={session.channel.source} size={16} />
            ) : (
              <Folder size={17} />
            )}
            <span>{session.channel?.label ?? projectLabel}</span>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div
      className={styles.sessionRowWrap}
      data-menu-open={menuOpen ? "true" : "false"}
      onMouseEnter={() => openHoverCard()}
      onMouseLeave={closeHoverCard}
      ref={menuRef}
    >
      <SidebarRow
        active={active}
        actions={
          <>
            <SidebarIconButton
              label={isPinned ? `Unpin ${sessionTitle}` : `Pin ${sessionTitle}`}
              onClick={onTogglePin}
              size="compact"
            >
              {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
            </SidebarIconButton>
            <SidebarIconButton
              label={`Open menu for ${sessionTitle}`}
              onClick={() => setMenuOpen((current) => !current)}
            >
              <MoreHorizontal size={12} />
            </SidebarIconButton>
          </>
        }
        depth={depth}
        icon={rowIcon}
        label={sessionTitle}
        meta={meta}
        onClick={onSelect}
      />
      {menu}
      {hoverCard}
    </div>
  );
}

type SessionRowData = Pick<Session, "id" | "title" | "updatedAt" | "channel">;

function makeDisplayChannel(summary: HermesSessionSummary): Session["channel"] {
  const descriptor = getChannelDescriptor(summary.source);
  return {
    source: descriptor.source,
    label: descriptor.label,
    external: descriptor.external,
    lastActiveAt: summary.lastActiveAt ?? undefined,
    parentSessionId: summary.parentSessionId ?? undefined
  };
}

function SessionMenuItem({
  danger = false,
  disabled = false,
  icon,
  label,
  onClick
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      className={styles.sessionMenuItem}
      data-danger={danger ? "true" : "false"}
      disabled={disabled}
      onClick={onClick}
      role="menuitem"
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function RunningSessionSpinner() {
  return <span className={styles.runningSpinner} aria-label="Chat running" role="status" />;
}

function UnseenResultDot() {
  return <span className={styles.unseenResultDot} aria-label="Finished result not seen" role="status" />;
}

function hasUnseenTerminalRun(session: Session) {
  const lastViewedMs = Date.parse(session.lastViewedAt ?? session.updatedAt);
  if (!Number.isFinite(lastViewedMs)) {
    return false;
  }

  return (session.runRecords ?? []).some((run) => {
    if (!isTerminalRunStatus(run.status) || !run.completedAt) {
      return false;
    }
    const completedMs = Date.parse(run.completedAt);
    return Number.isFinite(completedMs) && completedMs > lastViewedMs;
  });
}

function isTerminalRunStatus(status: Session["runRecords"][number]["status"]) {
  return status === "completed" || status === "stopped" || status === "failed" || status === "cancelled";
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
