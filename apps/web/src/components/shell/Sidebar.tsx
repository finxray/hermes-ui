"use client";

import {
  Archive,
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  MessageSquarePlus,
  MoreHorizontal,
  NewChat,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
  X
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
import { OverflowFadeText } from "./OverflowFadeText";
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
const PINNED_PROJECT_IDS_STORAGE_KEY = "hermes-ui.sidebar.pinnedProjectIds";
const COLLAPSED_FOLDER_IDS_STORAGE_KEY = "hermes-ui.sidebar.collapsedFolderIds";
const SIDEBAR_ORGANIZATION_STORAGE_KEY = "stoix.sidebar.organization";
const SIDEBAR_SORT_STORAGE_KEY = "stoix.sidebar.sort";

type SidebarOrganization = "project" | "list";
type SidebarSort = "priority" | "updated" | "manual";
const SIDEBAR_ORGANIZATION_CHOICES: readonly SidebarOrganization[] = ["project", "list"];
const SIDEBAR_SORT_CHOICES: readonly SidebarSort[] = ["priority", "updated", "manual"];

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];

type OneListEntry =
  | {
      key: string;
      kind: "workspace";
      manualIndex: number;
      pinned: boolean;
      session: Session;
      updatedAt: string;
    }
  | {
      groupLabel: string;
      key: string;
      kind: "channel";
      localSession: Session | null;
      manualIndex: number;
      pinned: boolean;
      summary: HermesSessionSummary;
      updatedAt: string;
    };

type SidebarProps = {
  projects: Project[];
  allSessions: Session[];
  activeProject: Project;
  activeSession: Session | null;
  selectedSessionIds?: string[];
  visibleSessionIds?: string[];
  actions: WorkspaceActions;
  hermesStatus: NormalizedHermesStatus | null;
  hermesSessions?: HermesSessionSummary[];
  hasUnseenUpdate?: boolean;
  isHermesStatusLoading: boolean;
  activeSection: ShellSection;
  onSectionChange: (section: ShellSection) => void;
  onCreateWorkspaceSession?: (projectId?: string) => void;
  onWorkspaceSessionSelect?: (sessionId: string) => void;
  onHermesSessionSelect?: (session: HermesSessionSummary) => void;
  onEnsureHermesSession?: (session: HermesSessionSummary) => Promise<string | null>;
  onWorkspaceSessionAdd?: (sessionId: string) => void;
  refreshHermesStatus: () => void;
  runningSessionIds?: string[];
};

export function Sidebar({
  actions,
  allSessions,
  projects,
  activeProject,
  activeSession,
  selectedSessionIds = [],
  visibleSessionIds = [],
  activeSection,
  hermesSessions = [],
  hasUnseenUpdate = false,
  onSectionChange,
  onCreateWorkspaceSession,
  onEnsureHermesSession,
  onHermesSessionSelect,
  onWorkspaceSessionAdd,
  onWorkspaceSessionSelect,
  runningSessionIds = []
}: SidebarProps) {
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const organizeAnchorRef = useRef<HTMLSpanElement | null>(null);
  const organizeMenuRef = useRef<HTMLDivElement | null>(null);
  const organizeCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionNav = useSectionNav();
  const [scrollFade, setScrollFade] = useState({ top: false, bottom: false });
  const [pinnedSessionIds, setPinnedSessionIds] = useStoredStringSet(PINNED_SESSION_IDS_STORAGE_KEY);
  const [pinnedProjectIds, setPinnedProjectIds] = useStoredStringSet(PINNED_PROJECT_IDS_STORAGE_KEY);
  const [collapsedFolderIds, setCollapsedFolderIds] = useStoredStringSet(
    COLLAPSED_FOLDER_IDS_STORAGE_KEY
  );
  const [expandedChannelSources, setExpandedChannelSources] = useState<string[]>([]);
  const [oneListExpanded, setOneListExpanded] = useState(false);
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [organizeMenuOpen, setOrganizeMenuOpen] = useState(false);
  const [organizeMenuPosition, setOrganizeMenuPosition] = useState<CSSProperties>({});
  const [sidebarOrganization, setSidebarOrganization] = useStoredChoice<SidebarOrganization>(
    SIDEBAR_ORGANIZATION_STORAGE_KEY,
    "project",
    SIDEBAR_ORGANIZATION_CHOICES
  );
  const [sidebarSort, setSidebarSort] = useStoredChoice<SidebarSort>(
    SIDEBAR_SORT_STORAGE_KEY,
    "priority",
    SIDEBAR_SORT_CHOICES
  );

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
  const pinnedProjectIdSet = new Set(pinnedProjectIds);
  const runningSessionIdSet = new Set(runningSessionIds);
  const selectedSessionIdSet = new Set(selectedSessionIds);
  const pinnedSessions = allSessions
    .filter((session) => !session.archivedAt && pinnedSessionIdSet.has(session.id))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const projectEntries = projects
    .map((project) => ({
      project,
      sessions: sortSidebarSessions(
        getProjectSessions(allSessions, project.id).filter((session) => !session.channel?.external),
        sidebarSort,
        pinnedSessionIdSet,
        allSessions
      )
    }))
    .filter(({ project, sessions }) => !isEmptyUntitledProject(project, sessions));
  const visibleProjects = sortSidebarProjects(
    projectEntries,
    sidebarSort,
    pinnedSessionIdSet,
    pinnedProjectIdSet,
    projects
  );
  const oneListSessions = sortSidebarSessions(
    visibleProjects.flatMap(({ sessions }) => sessions),
    sidebarSort,
    pinnedSessionIdSet,
    allSessions
  );
  const projectNameById = new Map(projects.map((project) => [project.id, project.name]));
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
  const manualSessionIndex = new Map(allSessions.map((session, index) => [session.id, index]));
  const oneListEntries: OneListEntry[] = [
    ...oneListSessions.map((session): OneListEntry => ({
      key: `workspace:${session.id}`,
      kind: "workspace",
      manualIndex: manualSessionIndex.get(session.id) ?? Number.MAX_SAFE_INTEGER,
      pinned: pinnedSessionIdSet.has(session.id),
      session,
      updatedAt: session.updatedAt
    })),
    ...channelGroups.flatMap((group) =>
      group.sessions.map((summary): OneListEntry => {
        const localSession = localSessionsByHermesId.get(summary.id) ?? null;
        return {
          groupLabel: group.label,
          key: `channel:${summary.id}`,
          kind: "channel",
          localSession,
          manualIndex: localSession
            ? manualSessionIndex.get(localSession.id) ?? Number.MAX_SAFE_INTEGER
            : Number.MAX_SAFE_INTEGER,
          pinned: Boolean(localSession && pinnedSessionIdSet.has(localSession.id)),
          summary,
          updatedAt: localSession?.updatedAt ?? summary.lastActiveAt ?? summary.startedAt
        };
      })
    )
  ].sort((a, b) => {
    if (sidebarSort === "priority" && a.pinned !== b.pinned) {
      return Number(b.pinned) - Number(a.pinned);
    }
    if (sidebarSort === "manual" && a.manualIndex !== b.manualIndex) {
      return a.manualIndex - b.manualIndex;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
  const visibleOneListEntries = oneListExpanded
    ? oneListEntries
    : oneListEntries.slice(0, Math.max(VISIBLE_CHAT_LIMIT, 10));

  function togglePinnedSession(sessionId: string) {
    setPinnedSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((id) => id !== sessionId)
        : [sessionId, ...current]
    );
  }

  function togglePinnedProject(projectId: string) {
    setPinnedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((id) => id !== projectId)
        : [projectId, ...current]
    );
  }

  function toggleFolder(folderId: string) {
    setCollapsedFolderIds((current) =>
      current.includes(folderId)
        ? current.filter((id) => id !== folderId)
        : [folderId, ...current]
    );
  }

  function renderChannelSessionRow(
    summary: HermesSessionSummary,
    groupLabel: string,
    depth: 0 | 1
  ) {
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
      <SessionSidebarRow
        active={Boolean(
          (localSession && selectedSessionIdSet.has(localSession.id)) ||
            activeSession?.hermesSessionId === summary.id && selectedSessionIdSet.has(activeSession.id)
        )}
        depth={depth}
        isPinned={Boolean(localSession && pinnedSessionIdSet.has(localSession.id))}
        onAddToView={onWorkspaceSessionAdd
          ? () => void withLocalSession(onWorkspaceSessionAdd)
          : undefined}
        onArchive={() => void withLocalSession(actions.archiveSession)}
        onRename={(title) => void withLocalSession((sessionId) =>
          actions.renameSession(sessionId, title)
        )}
        onSelect={() => {
          onSectionChange("workspace");
          onHermesSessionSelect?.(summary);
        }}
        onTogglePin={() => void withLocalSession(togglePinnedSession)}
        projectLabel={groupLabel}
        session={displaySession}
      />
    );
  }

  function openCreateProject() {
    setIsCreateProjectOpen(true);
  }

  function cancelOrganizeMenuClose() {
    if (organizeCloseTimerRef.current) {
      clearTimeout(organizeCloseTimerRef.current);
      organizeCloseTimerRef.current = null;
    }
  }

  function openOrganizeMenu() {
    cancelOrganizeMenuClose();
    setOrganizeMenuOpen(true);
  }

  function scheduleOrganizeMenuClose() {
    cancelOrganizeMenuClose();
    organizeCloseTimerRef.current = setTimeout(() => setOrganizeMenuOpen(false), 180);
  }

  useEffect(() => {
    if (!organizeMenuOpen) {
      return;
    }

    function updatePosition() {
      const anchor = organizeAnchorRef.current;
      if (!anchor) {
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(224, window.innerWidth - 24);
      setOrganizeMenuPosition({
        left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        top: Math.max(12, Math.min(rect.bottom + 5, window.innerHeight - 286)),
        width
      });
    }

    function closeOnOutside(event: MouseEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        !organizeAnchorRef.current?.contains(target) &&
        !organizeMenuRef.current?.contains(target)
      ) {
        setOrganizeMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOrganizeMenuOpen(false);
      }
    }

    updatePosition();
    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [organizeMenuOpen]);

  useEffect(() => () => cancelOrganizeMenuClose(), []);

  const organizeMenu = organizeMenuOpen && typeof document !== "undefined"
    ? createPortal(
        <div
          aria-label="Organize sidebar"
          className={`${styles.organizeMenu} stoix-portal-menu`}
          data-overlay-context="sidebar"
          onMouseEnter={cancelOrganizeMenuClose}
          onMouseLeave={scheduleOrganizeMenuClose}
          ref={organizeMenuRef}
          role="menu"
          style={organizeMenuPosition}
        >
          <span className={styles.organizeMenuHeading}>Organize sidebar</span>
          <OrganizeMenuItem
            active={sidebarOrganization === "project"}
            label="By project"
            onSelect={() => setSidebarOrganization("project")}
          />
          <OrganizeMenuItem
            active={sidebarOrganization === "list"}
            label="In one list"
            onSelect={() => setSidebarOrganization("list")}
          />
          <span className={styles.organizeMenuHeading}>Sort chats by</span>
          <OrganizeMenuItem
            active={sidebarSort === "priority"}
            label="Priority"
            onSelect={() => setSidebarSort("priority")}
          />
          <OrganizeMenuItem
            active={sidebarSort === "updated"}
            label="Last updated"
            onSelect={() => setSidebarSort("updated")}
          />
          <OrganizeMenuItem
            active={sidebarSort === "manual"}
            label="Manual order"
            onSelect={() => setSidebarSort("manual")}
          />
        </div>,
        document.body
      )
    : null;

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
              icon={<NewChat size={17} />}
              label="New chat"
              onClick={() => {
                onSectionChange("workspace");
                if (onCreateWorkspaceSession) {
                  onCreateWorkspaceSession();
                } else {
                  actions.createSession();
                }
              }}
            />
            <SidebarRow
              icon={<FolderPlus size={15} />}
              label="Project"
              onClick={() => {
                onSectionChange("workspace");
                openCreateProject();
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
              selectedSessionIds={selectedSessionIds}
              visibleSessionIds={visibleSessionIds}
              getSessionProjectLabel={(session) =>
                projects.find((project) => project.id === session.projectId)?.name ?? "Project"
              }
              isPinned={(sessionId) => pinnedSessionIdSet.has(sessionId)}
              isRunning={(sessionId) => runningSessionIdSet.has(sessionId)}
              listClassName={styles.list}
              onAddToView={onWorkspaceSessionAdd}
              onArchive={(sessionId) => actions.archiveSession(sessionId)}
              onRename={actions.renameSession}
              onSelect={(sessionId) => {
                if (onWorkspaceSessionSelect) {
                  onWorkspaceSessionSelect(sessionId);
                } else {
                  actions.switchSession(sessionId);
                }
              }}
              onTogglePin={togglePinnedSession}
              sessions={pinnedSessions}
              showOverflowControl={false}
            />
          )}
        </section>
      ) : null}

      <section className={styles.section} aria-labelledby="projects-heading">
        <div className={`${styles.sectionLabel} ${styles.workspaceSectionLabel} ${styles.projectsHeader}`}>
          <span className={styles.projectsTitle} id="projects-heading">Projects</span>
          <button
            aria-controls="projects-list"
            aria-expanded={!projectsCollapsed}
            aria-label={`${projectsCollapsed ? "Expand" : "Collapse"} projects`}
            className={styles.projectsChevron}
            onClick={() => setProjectsCollapsed((collapsed) => !collapsed)}
            type="button"
          >
            {projectsCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
          </button>
          <span className={styles.projectsHeaderActions}>
            <span
              className={styles.organizeMenuAnchor}
              onMouseEnter={openOrganizeMenu}
              onMouseLeave={scheduleOrganizeMenuClose}
              ref={organizeAnchorRef}
            >
                <SidebarIconButton
                  label="Organize projects"
                  onClick={openOrganizeMenu}
                >
                <MoreHorizontal size={15} />
              </SidebarIconButton>
            </span>
            <SidebarIconButton label="New project" onClick={openCreateProject}>
              <Plus size={15} />
            </SidebarIconButton>
          </span>
        </div>
        <div
          aria-hidden={projectsCollapsed}
          className={styles.folderBody}
          data-expanded={projectsCollapsed ? "false" : "true"}
          inert={projectsCollapsed ? true : undefined}
        >
          <div className={styles.folderBodyInner}>
        <ul className={styles.list} id="projects-list">
          {sidebarOrganization === "project" ? channelGroups.map((group) => {
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
                  inlineChevron
                  label={group.label}
                  onToggle={() => toggleFolder(folderId)}
                />
                <div
                  aria-hidden={isCollapsed}
                  className={styles.folderBody}
                  data-expanded={isCollapsed ? "false" : "true"}
                  inert={isCollapsed ? true : undefined}
                >
                  <div className={styles.folderBodyInner}>
                    <ul className={styles.childList}>
                      {visibleSessions.map((summary) => (
                        <li key={`channel-${summary.id}`}>
                          {renderChannelSessionRow(summary, group.label, 1)}
                        </li>
                      ))}
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
          }) : null}
          {sidebarOrganization === "list" ? (
            <li className={styles.oneListGroup}>
              <ul className={styles.childList}>
                {visibleOneListEntries.map((entry) => (
                  <li key={entry.key}>
                    {entry.kind === "channel" ? (
                      renderChannelSessionRow(entry.summary, entry.groupLabel, 0)
                    ) : (
                      <SessionSidebarRow
                        active={selectedSessionIdSet.has(entry.session.id)}
                        depth={0}
                        isPinned={pinnedSessionIdSet.has(entry.session.id)}
                        meta={
                          runningSessionIdSet.has(entry.session.id) ? (
                            <RunningSessionSpinner />
                          ) : !visibleSessionIds.includes(entry.session.id) &&
                            hasUnseenTerminalRun(entry.session) ? (
                            <UnseenResultDot />
                          ) : undefined
                        }
                        onAddToView={onWorkspaceSessionAdd
                          ? () => onWorkspaceSessionAdd(entry.session.id)
                          : undefined}
                        onArchive={() => actions.archiveSession(entry.session.id)}
                        onRename={(title) => actions.renameSession(entry.session.id, title)}
                        onSelect={() => {
                          onSectionChange("workspace");
                          if (onWorkspaceSessionSelect) {
                            onWorkspaceSessionSelect(entry.session.id);
                          } else {
                            actions.switchSession(entry.session.id);
                          }
                        }}
                        onTogglePin={() => togglePinnedSession(entry.session.id)}
                        projectLabel={projectNameById.get(entry.session.projectId) ?? "Project"}
                        rowIcon={entry.session.channel ? (
                          <ChannelIcon source={entry.session.channel.source} size={14} />
                        ) : undefined}
                        session={entry.session}
                      />
                    )}
                  </li>
                ))}
              </ul>
              {oneListEntries.length > Math.max(VISIBLE_CHAT_LIMIT, 10) ? (
                <button
                  className={styles.showMoreButton}
                  onClick={() => setOneListExpanded((expanded) => !expanded)}
                  type="button"
                >
                  {oneListExpanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </li>
          ) : visibleProjects.map(({ project, sessions: projectSessions }) => {
            const isActiveProject = project.id === activeProject.id;
            const projectFolderId = `project:${project.id}`;
            const isProjectCollapsed = collapsedFolderIds.includes(projectFolderId);
            return (
              <li className={styles.projectGroup} key={project.id}>
                <ProjectHeader
                  active={isActiveProject && !activeSession}
                  canRemove={projects.length > 1}
                  collapsed={isProjectCollapsed}
                  isPinned={pinnedProjectIdSet.has(project.id)}
                  label={project.name}
                  onArchiveChats={() => actions.archiveProjectSessions(project.id)}
                  onCreateChat={() => {
                    onSectionChange("workspace");
                    if (onCreateWorkspaceSession) {
                      onCreateWorkspaceSession(project.id);
                    } else {
                      actions.switchProject(project.id);
                      actions.createSessionForProject(project.id);
                    }
                  }}
                  onOpenProject={() => {
                    onSectionChange("workspace");
                    actions.switchProject(project.id);
                  }}
                  onRename={(name) => actions.renameProject(project.id, name)}
                  onRemove={() => actions.removeProject(project.id)}
                  onToggle={() => toggleFolder(projectFolderId)}
                  onTogglePin={() => togglePinnedProject(project.id)}
                />
                <div
                  aria-hidden={isProjectCollapsed}
                  className={styles.folderBody}
                  data-expanded={isProjectCollapsed ? "false" : "true"}
                  inert={isProjectCollapsed ? true : undefined}
                >
                  <div className={styles.folderBodyInner}>
                    {projectSessions.length === 0 ? (
                      <SidebarRow depth={1} disabled label="No chats" muted />
                    ) : (
                      <CollapsibleSessionList
                        activeSessionId={activeSession?.id ?? null}
                        selectedSessionIds={selectedSessionIds}
                        visibleSessionIds={visibleSessionIds}
                        depth={1}
                        getSessionProjectLabel={() => project.name}
                        isPinned={(sessionId) => pinnedSessionIdSet.has(sessionId)}
                        isRunning={(sessionId) => runningSessionIdSet.has(sessionId)}
                        onAddToView={onWorkspaceSessionAdd}
                        onArchive={(sessionId) => actions.archiveSession(sessionId)}
                        onRename={actions.renameSession}
                        onSelect={(sessionId) => {
                          onSectionChange("workspace");
                          if (onWorkspaceSessionSelect) {
                            onWorkspaceSessionSelect(sessionId);
                          } else {
                            actions.switchSession(sessionId);
                          }
                        }}
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
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="chats-heading">
        <ChatsFolderRow
          id="chats-heading"
          onCreateChat={() => {
            onSectionChange("workspace");
            if (onCreateWorkspaceSession) {
              onCreateWorkspaceSession();
            } else {
              actions.createSession();
            }
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
      {isCreateProjectOpen ? (
        <CreateProjectDialog
          onClose={() => setIsCreateProjectOpen(false)}
          onCreate={(name) => {
            actions.createProject({ name });
            setIsCreateProjectOpen(false);
          }}
        />
      ) : null}
      {organizeMenu}
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

function OrganizeMenuItem({
  active,
  label,
  onSelect
}: {
  active: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-checked={active}
      className={styles.organizeMenuItem}
      onClick={onSelect}
      role="menuitemradio"
      type="button"
    >
      <span className={styles.organizeMenuCheck}>{active ? <Check size={16} /> : null}</span>
      <span>{label}</span>
    </button>
  );
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
  return sessions.filter((session) => session.projectId === projectId && !session.archivedAt);
}

function sortSidebarSessions(
  sessions: Session[],
  sort: SidebarSort,
  pinnedIds: Set<string>,
  manualOrder: Session[]
) {
  const manualIndex = new Map(manualOrder.map((session, index) => [session.id, index]));
  return [...sessions].sort((a, b) => {
    if (sort === "priority") {
      const priorityDifference = Number(pinnedIds.has(b.id)) - Number(pinnedIds.has(a.id));
      if (priorityDifference !== 0) {
        return priorityDifference;
      }
    }
    if (sort === "manual") {
      return (manualIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (manualIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

function sortSidebarProjects(
  entries: { project: Project; sessions: Session[] }[],
  sort: SidebarSort,
  pinnedIds: Set<string>,
  pinnedProjectIds: Set<string>,
  manualOrder: Project[]
) {
  const manualIndex = new Map(manualOrder.map((project, index) => [project.id, index]));
  return [...entries].sort((a, b) => {
    if (sort === "priority") {
      const aPriority = pinnedProjectIds.has(a.project.id) ||
        a.sessions.some((session) => pinnedIds.has(session.id));
      const bPriority = pinnedProjectIds.has(b.project.id) ||
        b.sessions.some((session) => pinnedIds.has(session.id));
      const priorityDifference = Number(bPriority) - Number(aPriority);
      if (priorityDifference !== 0) {
        return priorityDifference;
      }
    }
    if (sort === "manual") {
      return (manualIndex.get(a.project.id) ?? Number.MAX_SAFE_INTEGER) -
        (manualIndex.get(b.project.id) ?? Number.MAX_SAFE_INTEGER);
    }
    return b.project.updatedAt.localeCompare(a.project.updatedAt);
  });
}

function isEmptyUntitledProject(project: Project, sessions: Session[]) {
  return /^Untitled project(?: \d+)?$/i.test(project.name.trim()) && sessions.length === 0;
}

function ProjectHeader({
  active,
  canRemove,
  collapsed,
  isPinned,
  label,
  onArchiveChats,
  onCreateChat,
  onOpenProject,
  onRename,
  onRemove,
  onTogglePin,
  onToggle
}: {
  active: boolean;
  canRemove: boolean;
  collapsed: boolean;
  isPinned: boolean;
  label: string;
  onArchiveChats: () => void;
  onCreateChat: () => void;
  onOpenProject: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onTogglePin: () => void;
  onToggle: () => void;
}) {
  const menuAnchorRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<CSSProperties>({});
  const [dialog, setDialog] = useState<"edit" | "archive" | "remove" | null>(null);

  function cancelMenuClose() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function openMenu() {
    cancelMenuClose();
    setMenuOpen(true);
  }

  function scheduleMenuClose() {
    cancelMenuClose();
    closeTimerRef.current = setTimeout(() => setMenuOpen(false), 180);
  }

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function updatePosition() {
      const anchor = menuAnchorRef.current;
      if (!anchor) {
        return;
      }
      const rect = anchor.getBoundingClientRect();
      const menuWidth = 190;
      const left = Math.min(rect.right + 6, window.innerWidth - menuWidth - 10);
      setMenuPosition({ left: Math.max(10, left), top: Math.max(10, rect.top - 4), width: menuWidth });
    }

    function closeOnOutside(event: MouseEvent) {
      const target = event.target;
      if (
        target instanceof Node &&
        !menuAnchorRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    updatePosition();
    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [menuOpen]);

  useEffect(() => () => cancelMenuClose(), []);

  function openDialog(nextDialog: "edit" | "archive" | "remove") {
    setMenuOpen(false);
    setDialog(nextDialog);
  }

  const projectMenu = menuOpen && typeof document !== "undefined"
    ? createPortal(
        <div
          aria-label={`Project actions for ${label}`}
          className={`${styles.projectActionMenu} stoix-portal-menu`}
          data-overlay-context="sidebar"
          onMouseEnter={cancelMenuClose}
          onMouseLeave={scheduleMenuClose}
          ref={menuRef}
          role="menu"
          style={menuPosition}
        >
          <ProjectMenuItem
            icon={isPinned ? <PinOff size={13} /> : <Pin size={13} />}
            label={isPinned ? "Unpin project" : "Pin project"}
            onSelect={() => {
              onTogglePin();
              setMenuOpen(false);
            }}
          />
          <ProjectMenuItem icon={<Pencil size={13} />} label="Edit project" onSelect={() => openDialog("edit")} />
          <ProjectMenuItem icon={<Archive size={13} />} label="Archive chats" onSelect={() => openDialog("archive")} />
          <ProjectMenuItem
            danger
            disabled={!canRemove}
            icon={<Trash2 size={13} />}
            label="Remove project"
            onSelect={() => openDialog("remove")}
          />
        </div>,
        document.body
      )
    : null;

  return (
    <div className={`${styles.projectHeader} ${active ? styles.projectHeaderActive : ""}`}>
      <button
        aria-current={active ? "page" : undefined}
        className={styles.projectMainButton}
        onClick={onOpenProject}
        type="button"
      >
        <Folder size={19} />
        <OverflowFadeText className={styles.projectTitle}>{label}</OverflowFadeText>
      </button>
      <button
        aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
        aria-expanded={!collapsed}
        className={styles.projectChevronButton}
        onClick={onToggle}
        type="button"
      >
        {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
      </button>
      <span className={styles.projectActions}>
        <span
          className={styles.projectMenuAnchor}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleMenuClose}
          ref={menuAnchorRef}
        >
          <button
            aria-label={`Project actions for ${label}`}
            aria-expanded={menuOpen}
            className={styles.projectActionButton}
            onClick={openMenu}
            type="button"
          >
            <MoreHorizontal size={18} />
          </button>
        </span>
        <button
          aria-label={`New chat in ${label}`}
          className={styles.projectActionButton}
          onClick={onCreateChat}
          type="button"
        >
          <NewChat size={19} />
        </button>
      </span>
      {projectMenu}
      {dialog === "edit" ? (
        <RenameProjectDialog
          initialName={label}
          onClose={() => setDialog(null)}
          onRename={(name) => {
            onRename(name);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === "archive" ? (
        <ProjectConfirmationDialog
          confirmLabel="Archive chats"
          description={`Archive every chat in ${label}. The project will remain available.`}
          onClose={() => setDialog(null)}
          onConfirm={() => {
            onArchiveChats();
            setDialog(null);
          }}
          title="Archive project chats?"
        />
      ) : null}
      {dialog === "remove" ? (
        <ProjectConfirmationDialog
          confirmLabel="Remove"
          danger
          description={`Remove ${label} and all of its local chats from Stoix.`}
          onClose={() => setDialog(null)}
          onConfirm={() => {
            onRemove();
            setDialog(null);
          }}
          title="Remove project?"
        />
      ) : null}
    </div>
  );
}

function ProjectMenuItem({
  danger = false,
  disabled = false,
  icon,
  label,
  onSelect
}: {
  danger?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      className={styles.projectActionMenuItem}
      data-danger={danger ? "true" : undefined}
      disabled={disabled}
      onClick={onSelect}
      role="menuitem"
      type="button"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function RenameProjectDialog({
  initialName,
  onClose,
  onRename
}: {
  initialName: string;
  onClose: () => void;
  onRename: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(initialName);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className={styles.projectDialogBackdrop} role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="rename-project-title"
        className={styles.projectDialog}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const trimmedName = name.trim();
          if (trimmedName) {
            onRename(trimmedName);
          }
        }}
      >
        <div className={styles.projectDialogHeader}>
          <h2 id="rename-project-title">Edit project</h2>
          <button aria-label="Close edit project" className={styles.projectDialogClose} onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
        <label className={styles.projectNameField}>
          <Folder size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            aria-label="Project name"
            onChange={(event) => setName(event.currentTarget.value)}
            value={name}
          />
        </label>
        <div className={styles.projectDialogActions}>
          <button className={styles.projectDialogCancel} onClick={onClose} type="button">Cancel</button>
          <button className={styles.projectDialogSubmit} disabled={!name.trim()} type="submit">Save</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function ProjectConfirmationDialog({
  confirmLabel,
  danger = false,
  description,
  onClose,
  onConfirm,
  title
}: {
  confirmLabel: string;
  danger?: boolean;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
}) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className={styles.projectDialogBackdrop} role="presentation" onMouseDown={onClose}>
      <div
        aria-labelledby="project-confirmation-title"
        aria-modal="true"
        className={styles.projectDialog}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className={styles.projectDialogHeader}>
          <h2 id="project-confirmation-title">{title}</h2>
          <button aria-label="Close confirmation" className={styles.projectDialogClose} onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
        <p className={styles.projectDialogDescription}>{description}</p>
        <div className={styles.projectDialogActions}>
          <button className={styles.projectDialogCancel} onClick={onClose} type="button">Cancel</button>
          <button
            className={styles.projectDialogSubmit}
            data-danger={danger ? "true" : undefined}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CreateProjectDialog({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return createPortal(
    <div className={styles.projectDialogBackdrop} role="presentation" onMouseDown={onClose}>
      <form
        aria-labelledby="create-project-title"
        className={styles.projectDialog}
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const trimmedName = name.trim();
          if (trimmedName) {
            onCreate(trimmedName);
          }
        }}
      >
        <div className={styles.projectDialogHeader}>
          <h2 id="create-project-title">Create project</h2>
          <button aria-label="Close create project" className={styles.projectDialogClose} onClick={onClose} type="button">
            <X size={16} />
          </button>
        </div>
        <label className={styles.projectNameField}>
          <Folder size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            aria-label="Project name"
            onChange={(event) => setName(event.currentTarget.value)}
            placeholder="Project name"
            value={name}
          />
        </label>
        <div className={styles.projectDialogActions}>
          <button className={styles.projectDialogCancel} onClick={onClose} type="button">Cancel</button>
          <button className={styles.projectDialogSubmit} disabled={!name.trim()} type="submit">Create project</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function FolderHeader({
  active = false,
  collapsed,
  id,
  icon,
  inlineChevron = false,
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
  inlineChevron?: boolean;
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
        inlineChevron ? styles.folderHeaderInlineChevron : "",
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
        <OverflowFadeText className={styles.chatsFolderTitle} id={id}>
          Chats
        </OverflowFadeText>
        <span className={styles.chatsFolderChevron} aria-hidden="true">
          <ChevronRight aria-hidden="true" size={15} />
        </span>
      </div>
      <span className={styles.chatsFolderActions}>
        <SidebarIconButton label="New chat" onClick={onCreateChat}>
          <NewChat size={19} />
        </SidebarIconButton>
      </span>
    </div>
  );
}

function CollapsibleSessionList({
  activeSessionId,
  selectedSessionIds = [],
  visibleSessionIds,
  autoExpandActive = true,
  depth = 0,
  getSessionProjectLabel,
  icon,
  isPinned,
  isRunning,
  listClassName = styles.childList,
  onAddToView,
  onSelect,
  onArchive,
  onRename,
  onTogglePin,
  previewCount = VISIBLE_CHAT_LIMIT,
  showOverflowControl = true,
  sessions
}: {
  activeSessionId: string | null;
  selectedSessionIds?: string[];
  visibleSessionIds?: string[];
  autoExpandActive?: boolean;
  depth?: 0 | 1;
  getSessionProjectLabel?: (session: Session) => string;
  icon?: ReactNode;
  isPinned: (sessionId: string) => boolean;
  isRunning: (sessionId: string) => boolean;
  listClassName?: string;
  onAddToView?: (sessionId: string) => void;
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
  const lastAutoExpandedSelectionRef = useRef<string | null>(null);
  const visibleSessions = showOverflowControl ? sessions.slice(0, visibleCount) : sessions;
  const hasOverflow = showOverflowControl && sessions.length > previewCount;
  const selectedSessionIdSet = new Set(selectedSessionIds);
  const sessionsToReveal = selectedSessionIds.length > 0
    ? selectedSessionIds
    : activeSessionId
      ? [activeSessionId]
      : [];
  const selectedSessionKey = sessionsToReveal.join("\u0001");

  useEffect(() => {
    const selectedIds = selectedSessionKey ? selectedSessionKey.split("\u0001") : [];
    if (
      !autoExpandActive ||
      selectedIds.length === 0 ||
      !hasOverflow ||
      lastAutoExpandedSelectionRef.current === selectedSessionKey
    ) {
      return;
    }
    lastAutoExpandedSelectionRef.current = selectedSessionKey;
    const furthestSelectedIndex = Math.max(
      ...selectedIds.map((sessionId) => sessions.findIndex((session) => session.id === sessionId))
    );
    if (furthestSelectedIndex >= visibleCount) {
      setVisibleCount(nextDoubledVisibleCount(previewCount, furthestSelectedIndex + 1, sessions.length));
    }
  }, [
    autoExpandActive,
    hasOverflow,
    previewCount,
    selectedSessionKey,
    sessions,
    visibleCount
  ]);

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
    const hasUnseenResult = !visibleSessionIds?.includes(session.id) && hasUnseenTerminalRun(session);
    return (
      <li key={session.id}>
        <SessionSidebarRow
          active={selectedSessionIdSet.has(session.id) || session.id === activeSessionId}
          depth={depth}
          isPinned={isPinned(session.id)}
          meta={
            running ? (
              <RunningSessionSpinner />
            ) : hasUnseenResult ? (
              <UnseenResultDot />
            ) : undefined
          }
          onAddToView={onAddToView ? () => onAddToView(session.id) : undefined}
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
  onAddToView,
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
  onAddToView?: () => void;
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
  const hoverDismissCleanupRef = useRef<(() => void) | null>(null);
  const rowHoveredRef = useRef(false);
  const sessionTitle = session.title?.trim() || "New chat";

  function detachHoverDismissListeners() {
    hoverDismissCleanupRef.current?.();
    hoverDismissCleanupRef.current = null;
  }

  function attachHoverDismissListeners() {
    if (hoverDismissCleanupRef.current) {
      return;
    }
    const dismiss = () => closeHoverCard();
    window.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("blur", dismiss);
    hoverDismissCleanupRef.current = () => {
      window.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("blur", dismiss);
    };
  }

  function openHoverCard(delayMs = 420) {
    rowHoveredRef.current = true;
    if (menuOpen) {
      return;
    }
    attachHoverDismissListeners();
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = setTimeout(() => {
      const row = menuRef.current;
      hoverTimerRef.current = null;
      if (!row || !rowHoveredRef.current || !row.matches(":hover")) {
        detachHoverDismissListeners();
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
    rowHoveredRef.current = false;
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverCardOpen(false);
    detachHoverDismissListeners();
  }

  useEffect(() => {
    return () => {
      detachHoverDismissListeners();
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (active) {
      closeHoverCard();
    }
  }, [active]);

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
          className={`${styles.sessionMenu} stoix-portal-menu`}
          data-overlay-context="sidebar"
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
            {onAddToView ? (
              <SidebarIconButton
                label={`Add ${sessionTitle} to view`}
                onMouseEnter={closeHoverCard}
                onClick={onAddToView}
                size="compact"
                tooltip="Add chat to view"
              >
                <Plus size={13} />
              </SidebarIconButton>
            ) : null}
            <SidebarIconButton
              label={isPinned ? `Unpin ${sessionTitle}` : `Pin ${sessionTitle}`}
              onMouseEnter={closeHoverCard}
              onClick={onTogglePin}
              size="compact"
              tooltip={isPinned ? "Unpin chat" : "Pin chat"}
            >
              {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
            </SidebarIconButton>
            <SidebarIconButton
              label={`Archive ${sessionTitle}`}
              onMouseEnter={closeHoverCard}
              onClick={onArchive}
              size="compact"
              tooltip="Archive chat"
            >
              <Archive size={13} />
            </SidebarIconButton>
          </>
        }
        depth={depth}
        icon={rowIcon}
        label={sessionTitle}
        meta={meta}
        onClick={() => {
          closeHoverCard();
          onSelect();
        }}
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

function useStoredChoice<T extends string>(key: string, fallback: T, choices: readonly T[]) {
  const [value, setValue] = useState<T>(fallback);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(key);
      if (storedValue && choices.includes(storedValue as T)) {
        setValue(storedValue as T);
      }
    } catch {
      setValue(fallback);
    } finally {
      setHasLoaded(true);
    }
  }, [choices, fallback, key]);

  useEffect(() => {
    if (!hasLoaded) {
      return;
    }
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Sidebar preferences are non-critical; ignore storage failures.
    }
  }, [hasLoaded, key, value]);

  return [value, setValue] as const;
}
