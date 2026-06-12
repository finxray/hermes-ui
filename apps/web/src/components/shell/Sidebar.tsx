"use client";

import {
  Brain,
  Clock,
  Cpu,
  Folder,
  FolderPlus,
  MessageSquare,
  MessageSquarePlus,
  RefreshCw,
  RotateCcw,
  Server,
  Settings,
  Trash2
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HermesSessionMessage, HermesSessionSummary, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { ChatMessage, Project, Session, WorkspaceState } from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { formatSessionUpdatedAt } from "@/lib/workspaceStore";
import { fetchHermesSessionMessages, deleteHermesSessionBff } from "@/lib/hermesSessionsClient";
import { SidebarRow, SidebarStatusDot } from "./SidebarRow";
import styles from "./Sidebar.module.css";

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];

type SidebarProps = {
  projects: Project[];
  allSessions: Session[];
  activeProject: Project;
  activeSession: Session | null;
  actions: WorkspaceActions;
  connectionStatus: WorkspaceState["connectionStatus"];
  hermesStatus: NormalizedHermesStatus | null;
  hermesSessions: HermesSessionSummary[];
  isHermesSessionsLoading: boolean;
  isHermesStatusLoading: boolean;
  isHydrated: boolean;
  refreshHermesStatus: () => void;
  refreshHermesSessions: () => void;
};

export function Sidebar({
  actions,
  allSessions,
  projects,
  activeProject,
  activeSession,
  connectionStatus,
  hermesStatus,
  hermesSessions,
  isHermesSessionsLoading,
  isHermesStatusLoading,
  isHydrated,
  refreshHermesStatus,
  refreshHermesSessions
}: SidebarProps) {
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const settingsToggleRef = useRef<HTMLInputElement | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const pendingRestoreRef = useRef<{
    hermesSessionId: string;
    title: string;
    messages: ChatMessage[];
  } | null>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (settingsToggleRef.current) {
          settingsToggleRef.current.checked = false;
        }
        setDeleteConfirmId(null);
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

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending) {
      return;
    }
    const newSession = allSessions.find(
      (s) => !s.archivedAt && s.messages.length === 0 && s.hermesSessionId !== pending.hermesSessionId
    );
    if (!newSession) {
      return;
    }
    pendingRestoreRef.current = null;
    actions.renameSession(newSession.id, pending.title || "Restored session");
    if (pending.messages.length > 0) {
      actions.loadHermesMessages(newSession.id, pending.messages);
    }
  }, [allSessions, actions]);

  const handleRestoreSession = useCallback(
    async (summary: HermesSessionSummary) => {
      if (restoringId === summary.id) {
        return;
      }

      const existingSession = allSessions.find(
        (session) => session.hermesSessionId === summary.id && !session.archivedAt
      );

      if (existingSession) {
        actions.switchSession(existingSession.id);
        if (existingSession.messages.length === 0) {
          setRestoringId(summary.id);
          const result = await fetchHermesSessionMessages(summary.id);
          setRestoringId(null);
          if (result.ok && result.messages.length > 0) {
            actions.loadHermesMessages(existingSession.id, normalizeMessages(result.messages));
          }
        }
        return;
      }

      setRestoringId(summary.id);
      const result = await fetchHermesSessionMessages(summary.id);
      setRestoringId(null);

      const chatMessages = result.ok ? normalizeMessages(result.messages) : [];
      pendingRestoreRef.current = {
        hermesSessionId: summary.id,
        title: summary.title || "Restored session",
        messages: chatMessages
      };
      actions.createSession();
    },
    [allSessions, actions, restoringId]
  );

  const handleDeleteHermesSession = useCallback(
    async (sessionId: string) => {
      setDeleteConfirmId(null);
      await deleteHermesSessionBff(sessionId);
      refreshHermesSessions();
    },
    [refreshHermesSessions]
  );

  const knownHermesIds = new Set(allSessions.map((s) => s.hermesSessionId).filter(Boolean));
  const unmappedHermesSessions = hermesSessions.filter((s) => !knownHermesIds.has(s.id));

  return (
    <aside className={styles.sidebar} data-shell-rail="left" aria-label="Projects and chats">
      <div className={styles.sidebarHeader}>
        <div className={styles.brand}>
          <div className={styles.brandIcon} aria-hidden="true">
            <Brain size={17} />
          </div>
          <p className={styles.brandTitle}>Brain Memory Studio</p>
        </div>

        <div className={styles.quickActions}>
          <SidebarRow icon={<FolderPlus size={15} />} label="Project" onClick={actions.createProject} />
          <SidebarRow
            icon={<MessageSquarePlus size={15} />}
            label="Chat"
            onClick={actions.createSession}
          />
        </div>
      </div>

      <div className={styles.scrollBody}>
      <section className={styles.section} aria-labelledby="projects-heading">
        <div className={styles.sectionLabel} id="projects-heading">
          <span>Projects</span>
        </div>
        <ul className={styles.list}>
          {projects.map((project) => {
            const projectSessions = getProjectSessions(allSessions, project.id);
            const isActiveProject = project.id === activeProject.id;
            return (
              <li className={styles.projectGroup} key={project.id}>
                <SidebarRow
                  active={isActiveProject && !activeSession}
                  icon={<Folder size={15} />}
                  label={project.name}
                  meta={projectSessions.length > 0 ? projectSessions.length : undefined}
                  muted={!isActiveProject}
                  onClick={() => actions.switchProject(project.id)}
                />
                {projectSessions.length === 0 ? (
                  <SidebarRow depth={1} disabled label="No chats" muted />
                ) : (
                  <ul className={styles.childList}>
                    {projectSessions.map((session) => {
                      return (
                        <li key={session.id}>
                          <SidebarRow
                            active={session.id === activeSession?.id}
                            depth={1}
                            label={session.title}
                            meta={formatSessionUpdatedAt(session.updatedAt)}
                            onClick={() => actions.switchSession(session.id)}
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="chats-heading">
        <div className={styles.sectionLabel} id="chats-heading">
          <span>Recent chats</span>
        </div>
        <ul className={styles.list}>
          {getRecentChats(allSessions).map((session) => (
            <li key={`chat-${session.id}`}>
              <SidebarRow
                active={session.id === activeSession?.id}
                icon={<MessageSquare size={15} />}
                label={session.title}
                meta={formatSessionUpdatedAt(session.updatedAt)}
                onClick={() => actions.switchSession(session.id)}
              />
            </li>
          ))}
        </ul>
      </section>

      {(hermesSessions.length > 0 || isHermesSessionsLoading) && (
        <section className={styles.section} aria-labelledby="hermes-sessions-heading">
          <div className={styles.sectionLabel} id="hermes-sessions-heading">
            <span>
              <Server size={11} style={{ verticalAlign: "middle", marginRight: 4 }} aria-hidden="true" />
              Hermes history
            </span>
            <button
              aria-label="Refresh Hermes sessions"
              className={styles.sectionRefresh}
              disabled={isHermesSessionsLoading}
              onClick={() => refreshHermesSessions()}
              title="Refresh"
              type="button"
            >
              <RefreshCw size={11} />
            </button>
          </div>
          {isHermesSessionsLoading && hermesSessions.length === 0 ? (
            <ul className={styles.list}>
              <li>
                <SidebarRow depth={0} disabled label="Loading…" muted />
              </li>
            </ul>
          ) : (
            <ul className={styles.list}>
              {unmappedHermesSessions.slice(0, 12).map((summary) => {
                const isRestoring = restoringId === summary.id;
                const isConfirming = deleteConfirmId === summary.id;
                return (
                  <li key={`hermes-${summary.id}`} className={styles.hermesSessionRow}>
                    {isConfirming ? (
                      <div className={styles.deleteConfirm}>
                        <span className={styles.deleteConfirmLabel}>Delete session?</span>
                        <button
                          className={styles.deleteConfirmYes}
                          onClick={() => void handleDeleteHermesSession(summary.id)}
                          type="button"
                        >
                          Delete
                        </button>
                        <button
                          className={styles.deleteConfirmNo}
                          onClick={() => setDeleteConfirmId(null)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className={styles.hermesSessionItem}>
                        <button
                          className={styles.hermesSessionButton}
                          disabled={isRestoring}
                          onClick={() => void handleRestoreSession(summary)}
                          title={`Restore: ${summary.title}`}
                          type="button"
                        >
                          <span className={styles.hermesSessionTitle}>
                            {isRestoring ? "Restoring…" : summary.title}
                          </span>
                          <span className={styles.hermesSessionMeta}>
                            {summary.model && (
                              <span title={`Model: ${summary.model}`}>
                                <Cpu size={10} aria-hidden="true" />
                              </span>
                            )}
                            {summary.startedAt && (
                              <span title={new Date(summary.startedAt).toLocaleString()}>
                                <Clock size={10} aria-hidden="true" />
                                {formatSessionUpdatedAt(summary.startedAt)}
                              </span>
                            )}
                            {typeof summary.messageCount === "number" && (
                              <span title={`${summary.messageCount} messages`}>
                                {summary.messageCount}msg
                              </span>
                            )}
                          </span>
                        </button>
                        <button
                          aria-label={`Delete Hermes session ${summary.title}`}
                          className={styles.hermesSessionDelete}
                          onClick={() => setDeleteConfirmId(summary.id)}
                          title="Delete session"
                          type="button"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
              {unmappedHermesSessions.length === 0 && hermesSessions.length > 0 && (
                <li>
                  <SidebarRow depth={0} disabled label="All sessions loaded" muted />
                </li>
              )}
            </ul>
          )}
        </section>
      )}
      </div>

      <div className={styles.footerDock}>
        <div className={styles.scrollFade} aria-hidden="true" />
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
              <Brain size={16} />
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

function normalizeMessages(messages: HermesSessionMessage[]): ChatMessage[] {
  return messages
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant",
      author: msg.role === "user" ? "You" : "Hermes",
      content: msg.content,
      createdAt: msg.createdAt ?? new Date().toISOString(),
      status: "complete" as const
    }));
}

function getProjectSessions(sessions: Session[], projectId: string) {
  return sessions
    .filter((session) => session.projectId === projectId && !session.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getRecentChats(sessions: Session[]) {
  return sessions
    .filter((session) => !session.archivedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 2);
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
