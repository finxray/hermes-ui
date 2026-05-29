"use client";

import { Activity, Database, FileText, FolderGit2, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { BrainMemoryConsole } from "@/components/BrainMemoryConsole";
import { HermesStatusPanel } from "@/components/HermesStatusPanel";
import type { NormalizedBrainMemoryStatus } from "@hermes-ui/brain-memory-client";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session } from "@/data/types";

type ContextPanelProps = {
  activeProject: Project;
  activeSession: Session | null;
  brainMemoryStatus: NormalizedBrainMemoryStatus | null;
  hermesStatus: NormalizedHermesStatus | null;
  isBrainMemoryStatusLoading: boolean;
  isHermesStatusLoading: boolean;
  refreshBrainMemoryStatus: () => void;
  refreshHermesStatus: () => void;
};

type PanelTab = "context" | "memory" | "tools" | "files";

export function ContextPanel({
  activeProject,
  activeSession,
  brainMemoryStatus,
  hermesStatus,
  isBrainMemoryStatusLoading,
  isHermesStatusLoading,
  refreshBrainMemoryStatus,
  refreshHermesStatus
}: ContextPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("context");
  const memoryEvidence = activeSession?.memoryEvidence ?? [];
  const toolEvents = activeSession?.toolEvents ?? [];
  const artifacts = activeSession?.artifacts ?? [];

  return (
    <aside className="context-panel" aria-label="Context, memory, tools, and files">
      <header className="panel-head">
        <h2>Context console</h2>
        <p>Hermes can stream live; Brain Memory inspection is read-only and Gateway-mediated.</p>
        <div className="panel-tabs" aria-label="Panel sections">
          <TabButton active={activeTab === "context"} onClick={() => setActiveTab("context")}>
            Context
          </TabButton>
          <TabButton active={activeTab === "memory"} onClick={() => setActiveTab("memory")}>
            Memory
          </TabButton>
          <TabButton active={activeTab === "tools"} onClick={() => setActiveTab("tools")}>
            Tools
          </TabButton>
          <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")}>
            Files
          </TabButton>
        </div>
      </header>

      <div className="panel-scroll">
        {activeTab === "context" ? (
          <>
            <HermesStatusPanel
              isLoading={isHermesStatusLoading}
              onRefresh={refreshHermesStatus}
              status={hermesStatus}
            />
            <ActiveContextSection activeProject={activeProject} activeSession={activeSession} />
            <ContextContractSection activeProject={activeProject} activeSession={activeSession} />
            <RetrievedMemorySection memoryEvidence={memoryEvidence} />
          </>
        ) : null}

        {activeTab === "memory" ? (
          <BrainMemoryConsole
            activeProject={activeProject}
            activeSession={activeSession}
            isStatusLoading={isBrainMemoryStatusLoading}
            onRefreshStatus={refreshBrainMemoryStatus}
            status={brainMemoryStatus}
          />
        ) : null}

        {activeTab === "tools" ? <ToolActivitySection toolEvents={toolEvents} /> : null}

        {activeTab === "files" ? <FilesSection artifacts={artifacts} /> : null}
      </div>
    </aside>
  );
}

function TabButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: string;
  onClick: () => void;
}) {
  return (
    <button className={`tab-button ${active ? "is-active" : ""}`} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function ActiveContextSection({
  activeProject,
  activeSession
}: {
  activeProject: Project;
  activeSession: Session | null;
}) {
  const memoryEvidence = activeSession?.memoryEvidence ?? [];

  return (
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
  );
}

function ContextContractSection({
  activeProject,
  activeSession
}: {
  activeProject: Project;
  activeSession: Session | null;
}) {
  return (
    <section className="panel-section" aria-labelledby="context-contract-heading">
      <div className="section-label" id="context-contract-heading">
        <span>Active context contract</span>
        <KeyRound size={13} aria-hidden="true" />
      </div>
      <div className="summary-card">
        <div className="card-title">
          <span>Prepared scope</span>
          <span className="pill">Brain Memory later</span>
        </div>
        <div className="context-contract-grid">
          <ContextField label="Tenant" value={activeProject.memoryScope.tenantId} />
          <ContextField label="Project" value={activeProject.memoryScope.projectId} />
          <ContextField label="Project key" value={activeProject.memoryScope.stableProjectKey} />
          <ContextField label="Retrieval" value={activeProject.memoryScope.retrievalProfile} />
          <ContextField label="Policy" value={activeProject.memoryScope.contextPolicy} />
          <ContextField
            label="Pinned"
            value={
              activeProject.memoryScope.pinnedMemoryIds.length > 0
                ? activeProject.memoryScope.pinnedMemoryIds.join(", ")
                : "None"
            }
          />
          <ContextField label="Session" value={activeSession?.memoryScope.sessionId ?? "None"} />
          <ContextField
            label="Session key"
            value={activeSession?.memoryScope.stableSessionKey ?? "No active session"}
          />
          <ContextField
            label="Hermes session"
            value={activeSession?.hermesSessionId ?? "No active session"}
          />
          <ContextField
            label="Project context"
            value={activeSession?.memoryScope.includeProjectContext ? "Included" : "Off"}
          />
          <ContextField
            label="Session context"
            value={activeSession?.memoryScope.includeSessionContext ? "Included" : "Off"}
          />
          <ContextField label="Status" value="Prepared, not connected to Brain Memory" />
        </div>
        <div className="card-body">
          {activeSession?.memoryScope.userVisibleSummary ??
            activeProject.memoryScope.userVisibleSummary ??
            "This scope is ready to travel with Hermes requests."}
        </div>
      </div>
    </section>
  );
}

function RetrievedMemorySection({ memoryEvidence }: { memoryEvidence: Session["memoryEvidence"] }) {
  return (
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
  );
}

function ToolActivitySection({ toolEvents }: { toolEvents: Session["toolEvents"] }) {
  return (
    <section className="panel-section" aria-labelledby="tool-activity-heading">
      <div className="section-label" id="tool-activity-heading">
        <span>Tool activity</span>
        <Activity size={13} aria-hidden="true" />
      </div>
      {toolEvents.length === 0 ? (
        <div className="empty-state compact">
          <div className="empty-state-title">No tool activity</div>
          <p>Hermes stream tool events will appear here when a connected agent emits them.</p>
        </div>
      ) : (
        <ul className="tool-list">
          {toolEvents.map((event) => (
            <li className="tool-card" data-status={event.status} key={event.id}>
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
  );
}

function FilesSection({ artifacts }: { artifacts: Session["artifacts"] }) {
  return (
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
  );
}

function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div className="context-field">
      <span className="context-field-label">{label}</span>
      <span className="context-field-value">{value}</span>
    </div>
  );
}
