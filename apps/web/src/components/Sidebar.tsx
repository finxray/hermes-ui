"use client";

import {
  Brain,
  Edit3,
  FileText,
  FolderPlus,
  MessageSquarePlus,
  RotateCcw,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session, WorkspaceState } from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];

type SidebarProps = {
  projects: Project[];
  allSessions: Session[];
  sessions: Session[];
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
  sessions,
  activeProject,
  activeSession,
  connectionStatus,
  hermesStatus,
  isHermesStatusLoading,
  isHydrated,
  refreshHermesStatus
}: SidebarProps) {
  const [editing, setEditing] = useState<
    | { kind: "project"; id: string; value: string }
    | { kind: "session"; id: string; value: string }
    | null
  >(null);

  function startRenameProject(project: Project) {
    setEditing({ kind: "project", id: project.id, value: project.name });
  }

  function startRenameSession(session: Session) {
    setEditing({ kind: "session", id: session.id, value: session.title });
  }

  function commitRename() {
    if (!editing) {
      return;
    }
    const value = editing.value.trim();
    if (!value) {
      return;
    }
    if (editing.kind === "project") {
      actions.renameProject(editing.id, value);
    } else {
      actions.renameSession(editing.id, value);
    }
    setEditing(null);
  }

  function archiveSession(session: Session) {
    const confirmed = window.confirm(`Archive "${session.title}"?`);
    if (confirmed) {
      actions.archiveSession(session.id);
    }
  }

  return (
    <aside className="sidebar" aria-label="Projects and sessions">
      <div className="brand">
        <div className="brand-mark">
          <div className="brand-icon" aria-hidden="true">
            <Brain size={17} />
          </div>
          <div>
            <p className="brand-title">Brain Memory Studio</p>
          </div>
        </div>
      </div>

      <div className="sidebar-actions">
        <button className="text-button" type="button" onClick={actions.createProject}>
          <FolderPlus size={15} aria-hidden="true" />
          Project
        </button>
        <button className="text-button" type="button" onClick={actions.createSession}>
          <MessageSquarePlus size={15} aria-hidden="true" />
          Chat
        </button>
      </div>

      <section className="sidebar-section" aria-labelledby="projects-heading">
        <div className="section-label" id="projects-heading">
          <span>Projects</span>
          <span>{projects.length}</span>
        </div>
        <ul className="project-list">
          {projects.map((project) => (
            <li key={project.id}>
              <div className="row-with-actions">
                {editing?.kind === "project" && editing.id === project.id ? (
                  <div className="project-button is-active">
                    <span>
                      <input
                        autoFocus
                        className="rename-input"
                        aria-label={`Rename project ${project.name}`}
                        value={editing.value}
                        onChange={(event) =>
                          setEditing({ ...editing, value: event.currentTarget.value })
                        }
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            commitRename();
                          }
                          if (event.key === "Escape") {
                            setEditing(null);
                          }
                        }}
                      />
                      <span className="project-description">{project.description}</span>
                    </span>
                    <span className="project-count">
                      {allSessions.filter(
                        (session) => session.projectId === project.id && !session.archivedAt
                      ).length}
                    </span>
                  </div>
                ) : (
                  <button
                    className={`project-button ${
                      project.id === activeProject.id ? "is-active" : ""
                    }`}
                    type="button"
                    aria-current={project.id === activeProject.id ? "page" : undefined}
                    onClick={() => actions.switchProject(project.id)}
                  >
                    <span>
                      <span className="project-name">{project.name}</span>
                    </span>
                    <span className="project-count">
                      {allSessions.filter(
                        (session) => session.projectId === project.id && !session.archivedAt
                      ).length}
                    </span>
                  </button>
                )}
                <button
                  className="mini-action"
                  type="button"
                  aria-label={`Rename project ${project.name}`}
                  onClick={() => startRenameProject(project)}
                >
                  <Edit3 size={13} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="sidebar-section" aria-labelledby="sessions-heading">
        <div className="section-label" id="sessions-heading">
          <span>Sessions</span>
        </div>
        {sessions.length === 0 ? (
          <EmptyState
            title="No chats yet"
            body="Create a local mock chat for this project. It will stay in browser localStorage."
            actionLabel="New chat"
            onAction={actions.createSession}
          />
        ) : (
          <ul className="session-list">
            {sessions.map((session) => (
              <li key={session.id}>
                <div className="row-with-actions">
                  {editing?.kind === "session" && editing.id === session.id ? (
                    <div className="session-button is-active">
                      <span>
                        <input
                          autoFocus
                          className="rename-input"
                          aria-label={`Rename session ${session.title}`}
                          value={editing.value}
                          onChange={(event) =>
                            setEditing({ ...editing, value: event.currentTarget.value })
                          }
                          onBlur={commitRename}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              commitRename();
                            }
                            if (event.key === "Escape") {
                              setEditing(null);
                            }
                          }}
                        />
                      </span>
                    </div>
                  ) : (
                    <button
                      className={`session-button ${
                        session.id === activeSession?.id ? "is-active" : ""
                      }`}
                      type="button"
                      aria-current={session.id === activeSession?.id ? "page" : undefined}
                      onClick={() => actions.switchSession(session.id)}
                    >
                      <span>
                        <span className="session-title">{session.title}</span>
                      </span>
                    </button>
                  )}
                  <span className="inline-actions">
                    <button
                      className="mini-action"
                      type="button"
                      aria-label={`Rename session ${session.title}`}
                      onClick={() => startRenameSession(session)}
                    >
                      <Edit3 size={13} aria-hidden="true" />
                    </button>
                    <button
                      className="mini-action"
                      type="button"
                      aria-label={`Archive session ${session.title}`}
                      onClick={() => archiveSession(session)}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="sidebar-foot">
        <div className="section-label">
          <span>Mock connections</span>
          <FileText size={13} aria-hidden="true" />
        </div>
        <div className="status-stack">
          <StatusBadge
            label={`Hermes: ${formatHermesStatus(hermesStatus, isHermesStatusLoading)}`}
            tone={hermesStatusTone(hermesStatus, isHermesStatusLoading)}
          />
          <StatusBadge label={`Brain Memory: ${connectionStatus.brainMemory}`} tone="mock" />
          <StatusBadge
            label={isHydrated ? "LocalStorage: active" : "LocalStorage: loading"}
            tone="quiet"
          />
          <button className="text-button full-width" type="button" onClick={actions.reset}>
            <RotateCcw size={14} aria-hidden="true" />
            Reset mock data
          </button>
          <button className="text-button full-width" type="button" onClick={refreshHermesStatus}>
            Refresh Hermes
          </button>
        </div>
      </div>
    </aside>
  );
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

function formatRelativeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}
