import {
  Brain,
  FileText,
  FolderPlus,
  MessageSquarePlus,
  MessagesSquare
} from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import type { Project, Session, WorkspaceMock } from "@/data/types";

type SidebarProps = {
  projects: Project[];
  sessions: Session[];
  activeProject: Project;
  activeSession: Session;
  connectionStatus: WorkspaceMock["connectionStatus"];
};

export function Sidebar({
  projects,
  sessions,
  activeProject,
  activeSession,
  connectionStatus
}: SidebarProps) {
  return (
    <aside className="sidebar" aria-label="Projects and sessions">
      <div className="brand">
        <div className="brand-mark">
          <div className="brand-icon" aria-hidden="true">
            <Brain size={17} />
          </div>
          <div>
            <p className="brand-title">Brain Memory Studio</p>
            <p className="brand-subtitle">Hermes UI static shell</p>
          </div>
        </div>
      </div>

      <div className="sidebar-actions">
        <button className="text-button" type="button" disabled title="Mocked in Slice 01">
          <FolderPlus size={15} aria-hidden="true" />
          Project
        </button>
        <button className="text-button" type="button" disabled title="Mocked in Slice 01">
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
              <button
                className={`project-button ${project.id === activeProject.id ? "is-active" : ""}`}
                type="button"
                aria-current={project.id === activeProject.id ? "page" : undefined}
              >
                <span className="project-glyph" aria-hidden="true">
                  {project.icon}
                </span>
                <span>
                  <span className="project-name">{project.name}</span>
                  <span className="project-description">{project.description}</span>
                </span>
                <span className="project-count">{project.sessionCount}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="sidebar-section" aria-labelledby="sessions-heading">
        <div className="section-label" id="sessions-heading">
          <span>Sessions</span>
          <span>{activeProject.name}</span>
        </div>
        <ul className="session-list">
          {sessions.map((session) => (
            <li key={session.id}>
              <button
                className={`session-button ${session.id === activeSession.id ? "is-active" : ""}`}
                type="button"
                aria-current={session.id === activeSession.id ? "page" : undefined}
              >
                <MessagesSquare size={15} aria-hidden="true" />
                <span>
                  <span className="session-title">{session.title}</span>
                  <span className="session-meta">
                    {session.updatedAt} · {session.messageCount} messages
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="sidebar-foot">
        <div className="section-label">
          <span>Mock connections</span>
          <FileText size={13} aria-hidden="true" />
        </div>
        <div className="status-stack">
          <StatusBadge label={`Hermes: ${connectionStatus.hermes}`} tone="mock" />
          <StatusBadge label={`Brain Memory: ${connectionStatus.brainMemory}`} tone="mock" />
        </div>
      </div>
    </aside>
  );
}
