"use client";

import {
  Brain,
  Edit3,
  FileText,
  Folder,
  FolderPlus,
  MessageSquare,
  MessageSquarePlus,
  RefreshCw,
  RotateCcw,
  Trash2
} from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session, WorkspaceState } from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { SidebarIconButton, SidebarRow, SidebarStatusDot } from "./SidebarRow";
import styles from "./Sidebar.module.css";

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
    <aside className={styles.sidebar} data-shell-rail="left" aria-label="Projects and sessions">
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
            const isEditing = editing?.kind === "project" && editing.id === project.id;
            const sessionCount = allSessions.filter(
              (session) => session.projectId === project.id && !session.archivedAt
            ).length;
            return (
              <li key={project.id}>
                <SidebarRow
                  active={project.id === activeProject.id}
                  actions={
                    <SidebarIconButton
                      label={`Rename project ${project.name}`}
                      onClick={() => startRenameProject(project)}
                    >
                      <Edit3 size={13} />
                    </SidebarIconButton>
                  }
                  icon={<Folder size={15} />}
                  label={
                    isEditing ? (
                      <RenameInput
                        ariaLabel={`Rename project ${project.name}`}
                        onCancel={() => setEditing(null)}
                        onCommit={commitRename}
                        setValue={(value) => setEditing({ ...editing, value })}
                        value={editing.value}
                      />
                    ) : (
                      project.name
                    )
                  }
                  meta={sessionCount}
                  onClick={isEditing ? undefined : () => actions.switchProject(project.id)}
                  secondary={isEditing ? project.description : undefined}
                />
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="sessions-heading">
        <div className={styles.sectionLabel} id="sessions-heading">
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
          <ul className={styles.list}>
            {sessions.map((session) => {
              const isEditing = editing?.kind === "session" && editing.id === session.id;
              return (
                <li key={session.id}>
                  <SidebarRow
                    active={session.id === activeSession?.id}
                    actions={
                      <>
                        <SidebarIconButton
                          label={`Rename session ${session.title}`}
                          onClick={() => startRenameSession(session)}
                        >
                          <Edit3 size={13} />
                        </SidebarIconButton>
                        <SidebarIconButton
                          label={`Archive session ${session.title}`}
                          onClick={() => archiveSession(session)}
                        >
                          <Trash2 size={13} />
                        </SidebarIconButton>
                      </>
                    }
                    icon={<MessageSquare size={15} />}
                    label={
                      isEditing ? (
                        <RenameInput
                          ariaLabel={`Rename session ${session.title}`}
                          onCancel={() => setEditing(null)}
                          onCommit={commitRename}
                          setValue={(value) => setEditing({ ...editing, value })}
                          value={editing.value}
                        />
                      ) : (
                        session.title
                      )
                    }
                    onClick={isEditing ? undefined : () => actions.switchSession(session.id)}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className={styles.footer}>
        <div className={styles.sectionLabel}>
          <span>Mock connections</span>
          <FileText size={13} aria-hidden="true" />
        </div>
        <div className={styles.statusStack}>
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
          <SidebarRow icon={<RotateCcw size={14} />} label="Reset mock data" onClick={actions.reset} />
          <SidebarRow
            icon={<RefreshCw size={14} />}
            label="Refresh Hermes"
            onClick={refreshHermesStatus}
          />
        </div>
      </div>
    </aside>
  );
}

function RenameInput({
  ariaLabel,
  onCancel,
  onCommit,
  setValue,
  value
}: {
  ariaLabel: string;
  onCancel: () => void;
  onCommit: () => void;
  setValue: (value: string) => void;
  value: string;
}) {
  return (
    <input
      autoFocus
      aria-label={ariaLabel}
      className={styles.renameInput}
      value={value}
      onBlur={onCommit}
      onChange={(event) => setValue(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          onCommit();
        }
        if (event.key === "Escape") {
          onCancel();
        }
      }}
    />
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
