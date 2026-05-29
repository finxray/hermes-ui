import { Activity, Database, FileText, FolderGit2, ShieldCheck } from "lucide-react";
import type { Project, Session } from "@/data/types";

type ContextPanelProps = {
  activeProject: Project;
  activeSession: Session | null;
};

export function ContextPanel({ activeProject, activeSession }: ContextPanelProps) {
  const memoryEvidence = activeSession?.memoryEvidence ?? [];
  const toolEvents = activeSession?.toolEvents ?? [];
  const artifacts = activeSession?.artifacts ?? [];

  return (
    <aside className="context-panel" aria-label="Context, memory, tools, and files">
      <header className="panel-head">
        <h2>Context console</h2>
        <p>Read-only mock view. Gateway-backed memory inspection arrives later.</p>
        <div className="panel-tabs" aria-label="Panel sections">
          <button className="tab-button is-active" type="button">
            Context
          </button>
          <button className="tab-button" type="button">
            Memory
          </button>
          <button className="tab-button" type="button">
            Tools
          </button>
          <button className="tab-button" type="button">
            Files
          </button>
        </div>
      </header>

      <div className="panel-scroll">
        <section className="panel-section" aria-labelledby="active-context-heading">
          <div className="section-label" id="active-context-heading">
            <span>Active context</span>
            <ShieldCheck size={13} aria-hidden="true" />
          </div>
          <div className="summary-card">
            <div>
              <div className="card-title">
                <span>{activeProject.name}</span>
                <span className="pill">mock</span>
              </div>
              <div className="card-body">{activeProject.description}</div>
            </div>
            <div className="summary-grid">
              <div className="metric">
                <div className="metric-value">{activeSession?.messages.length ?? 0}</div>
                <div className="metric-label">session messages</div>
              </div>
              <div className="metric">
                <div className="metric-value">{memoryEvidence.length}</div>
                <div className="metric-label">memory refs</div>
              </div>
            </div>
            <div className="card-meta">{activeProject.memoryScopeKey}</div>
          </div>
        </section>

        <section className="panel-section" aria-labelledby="retrieved-memory-heading">
          <div className="section-label" id="retrieved-memory-heading">
            <span>Retrieved memory</span>
            <Database size={13} aria-hidden="true" />
          </div>
          {memoryEvidence.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-state-title">No retrieved memory</div>
              <p>This project/session has no mock evidence yet.</p>
            </div>
          ) : (
            <ul className="memory-list">
              {memoryEvidence.map((memory) => (
                <li className="memory-card" key={memory.id}>
                  <div className="card-title">
                    <span>{memory.title}</span>
                    <span className="pill">{memory.layer}</span>
                  </div>
                  <div className="card-body">{memory.excerpt}</div>
                  <div className="card-meta">
                    {memory.source} - score {memory.score} - {memory.timestamp}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-section" aria-labelledby="tool-activity-heading">
          <div className="section-label" id="tool-activity-heading">
            <span>Tool activity</span>
            <Activity size={13} aria-hidden="true" />
          </div>
          {toolEvents.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-state-title">No tool activity</div>
              <p>Tool events remain mocked until Hermes streaming is added.</p>
            </div>
          ) : (
            <ul className="tool-list">
              {toolEvents.map((event) => (
                <li className="tool-card" key={event.id}>
                  <span className="tool-icon" aria-hidden="true">
                    <Activity size={14} />
                  </span>
                  <span>
                    <span className="card-title">
                      <span>{event.name}</span>
                      <span className="pill">{event.status}</span>
                    </span>
                    <span className="card-body">{event.detail}</span>
                    <span className="card-meta">{event.time}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel-section" aria-labelledby="files-heading">
          <div className="section-label" id="files-heading">
            <span>Files and artifacts</span>
            <FolderGit2 size={13} aria-hidden="true" />
          </div>
          {artifacts.length === 0 ? (
            <div className="empty-state compact">
              <div className="empty-state-title">No files attached</div>
              <p>Artifacts are local mock metadata for now.</p>
            </div>
          ) : (
            <ul className="artifact-list">
              {artifacts.map((artifact) => (
                <li className="artifact-card" key={artifact.id}>
                  <FileText className="artifact-icon" size={18} aria-hidden="true" />
                  <span>
                    <span className="card-title">
                      <span>{artifact.name}</span>
                      <span className="pill">{artifact.status}</span>
                    </span>
                    <span className="card-meta">{artifact.kind}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  );
}
