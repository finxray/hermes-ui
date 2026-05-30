"use client";

import {
  Brain,
  Folder,
  FolderPlus,
  MessageSquare,
  MessageSquarePlus,
  RefreshCw,
  RotateCcw,
  Settings
} from "lucide-react";
import { useEffect, useRef } from "react";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session, WorkspaceState } from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
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
  isHermesStatusLoading: boolean;
  isHydrated: boolean;
  refreshHermesStatus: () => void;
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
  refreshHermesStatus
}: SidebarProps) {
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const settingsToggleRef = useRef<HTMLInputElement | null>(null);

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
          <span>Chats</span>
        </div>
        <ul className={styles.list}>
          {getRecentChats(allSessions).map((session) => (
            <li key={`chat-${session.id}`}>
              <SidebarRow
                active={session.id === activeSession?.id}
                icon={<MessageSquare size={15} />}
                label={session.title}
                onClick={() => actions.switchSession(session.id)}
              />
            </li>
          ))}
        </ul>
      </section>

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
        <label className={styles.settingsButton} htmlFor="studio-settings-toggle">
          <span className={styles.settingsIcon} aria-hidden="true">
            <Settings size={15} />
          </span>
          <span className={styles.settingsLabel}>Settings</span>
        </label>
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
