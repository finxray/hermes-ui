"use client";

import { Activity, Database, FileText, FolderGit2, KeyRound, ShieldCheck, Terminal } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { BrainMemoryConsole } from "@/components/memory/BrainMemoryConsole";
import { EmptyState } from "@/components/ui/EmptyState";
import { HermesStatusPanel } from "@/components/shell/HermesStatusPanel";
import { computeActivityDuration, extractCommandDetails, formatActivityDuration } from "@/lib/agentActivityEvents";
import type { NormalizedBrainMemoryStatus } from "@hermes-ui/brain-memory-client";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session } from "@/data/types";
import type { AgentActivityEvent } from "@/types/agentActivity";
import styles from "./ContextRail.module.css";

type ContextRailProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  brainMemoryStatus: NormalizedBrainMemoryStatus | null;
  hermesStatus: NormalizedHermesStatus | null;
  isBrainMemoryStatusLoading: boolean;
  isHermesStatusLoading: boolean;
  refreshBrainMemoryStatus: () => void;
  refreshHermesStatus: () => void;
};

type PanelTab = "context" | "memory" | "tools" | "files";

export function ContextRail({
  activeProject,
  activeSession,
  activityEvents,
  brainMemoryStatus,
  hermesStatus,
  isBrainMemoryStatusLoading,
  isHermesStatusLoading,
  refreshBrainMemoryStatus,
  refreshHermesStatus
}: ContextRailProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("context");
  const memoryEvidence = activeSession?.memoryEvidence ?? [];
  const toolEvents = activeSession?.toolEvents ?? [];
  const artifacts = activeSession?.artifacts ?? [];

  return (
    <aside className={styles.rail} data-shell-rail="right" aria-label="Context, memory, tools, and files">
      <header className={styles.head}>
        <h2>Context console</h2>
        <p>Hermes can stream live; Brain Memory inspection is read-only and Gateway-mediated.</p>
        <div className={styles.tabs} aria-label="Panel sections">
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

      <div className={styles.scroll}>
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
            activityEvents={activityEvents}
            isStatusLoading={isBrainMemoryStatusLoading}
            onRefreshStatus={refreshBrainMemoryStatus}
            status={brainMemoryStatus}
          />
        ) : null}

        {activeTab === "tools" ? (
          <ToolActivitySection
            activityEvents={activityEvents}
            hermesStatus={hermesStatus}
            toolEvents={toolEvents}
          />
        ) : null}
        {activeTab === "files" ? <FilesSection artifacts={artifacts} hermesStatus={hermesStatus} /> : null}
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
    <button
      className={`${styles.tab} ${active ? styles.activeTab : ""}`}
      type="button"
      aria-label={`Show ${children.toLowerCase()} panel`}
      aria-pressed={active}
      onClick={onClick}
    >
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
    <section className={styles.section} aria-labelledby="active-context-heading">
      <SectionLabel id="active-context-heading" icon={<ShieldCheck size={13} />} label="Active context" />
      <div className={styles.card}>
        <div>
          <div className={styles.cardTitle}>
            <span>{activeProject.name}</span>
            <span className={styles.pill}>mock</span>
          </div>
          <div className={styles.cardBody}>{activeProject.description}</div>
        </div>
        <div className={styles.metrics}>
          <Metric label="session messages" value={activeSession?.messages.length ?? 0} />
          <Metric label="memory refs" value={memoryEvidence.length} />
        </div>
        <div className={styles.meta}>{activeProject.memoryScopeKey}</div>
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
    <section className={styles.section} aria-labelledby="context-contract-heading">
      <SectionLabel
        id="context-contract-heading"
        icon={<KeyRound size={13} />}
        label="Active context contract"
      />
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span>Prepared scope</span>
          <span className={styles.pill}>Brain Memory later</span>
        </div>
        <div className={styles.fieldGrid}>
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
        <div className={styles.cardBody}>
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
    <section className={styles.section} aria-labelledby="retrieved-memory-heading">
      <SectionLabel id="retrieved-memory-heading" icon={<Database size={13} />} label="Retrieved memory" />
      {memoryEvidence.length === 0 ? (
        <EmptyState compact title="No retrieved memory" body="This project/session has no mock evidence yet." />
      ) : (
        <ul className={styles.list}>
          {memoryEvidence.map((memory) => (
            <li className={styles.listCard} key={memory.id}>
              <div className={styles.cardTitle}>
                <span>{memory.title}</span>
                <span className={styles.pill}>{memory.layer}</span>
              </div>
              <div className={styles.cardBody}>{memory.excerpt}</div>
              <div className={styles.meta}>
                {memory.source} - score {memory.score} - {memory.timestamp}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ToolActivitySection({
  activityEvents,
  hermesStatus,
  toolEvents
}: {
  activityEvents: AgentActivityEvent[];
  hermesStatus: NormalizedHermesStatus | null;
  toolEvents: Session["toolEvents"];
}) {
  const toolState = hermesStatus?.uiCapabilities.tools.uiState ?? "unknown";
  const commandEvents = activityEvents.filter((event) => event.type === "command").slice(-8);
  return (
    <>
      <section className={styles.section} aria-labelledby="command-activity-heading">
        <SectionLabel id="command-activity-heading" icon={<Terminal size={13} />} label="Recent commands" />
        {commandEvents.length === 0 ? (
          <EmptyState compact title="No command activity" body="No command activity in this session yet." />
        ) : (
          <ul className={styles.list}>
            {commandEvents.map((event) => (
              <CommandActivityRow event={event} key={event.id} />
            ))}
          </ul>
        )}
      </section>
      <section className={styles.section} aria-labelledby="tool-activity-heading">
        <SectionLabel id="tool-activity-heading" icon={<Activity size={13} />} label="Tool activity" />
        {toolEvents.length === 0 ? (
          <EmptyState
            compact
            title="No tool activity"
            body={`Hermes stream tool events will appear here when emitted. Tool event UI is ${toolState}.`}
          />
        ) : (
          <ul className={styles.list}>
            {toolEvents.map((event) => (
              <li className={styles.toolRow} data-status={event.status} key={event.id}>
                <span className={styles.toolIcon} aria-hidden="true">
                  <Activity size={14} />
                </span>
                <span>
                  <span className={styles.cardTitle}>
                    <span>{event.name}</span>
                    <span className={styles.pill}>{event.status}</span>
                  </span>
                  <span className={styles.cardBody}>{event.detail}</span>
                  <span className={styles.meta}>{event.time}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function CommandActivityRow({ event }: { event: AgentActivityEvent }) {
  const command = extractCommandDetails(event);
  const durationMs = computeActivityDuration(event);
  return (
    <li className={styles.commandRow} data-status={event.status}>
      <span className={styles.toolIcon} aria-hidden="true">
        <Terminal size={14} />
      </span>
      <span className={styles.commandContent}>
        <span className={styles.cardTitle}>
          <span>{event.title}</span>
          <span className={styles.pill}>{event.status}</span>
        </span>
        <span className={styles.commandPreview}>
          {command?.command ?? command?.outputPreview ?? command?.stdoutPreview ?? "Command output unavailable"}
        </span>
        <span className={styles.meta}>
          {command?.exitCode !== undefined ? `exit ${command.exitCode}` : "exit unknown"}
          {durationMs !== undefined ? ` - ${formatActivityDuration(durationMs)}` : ""}
          {command?.sourceChannel ? ` - ${command.sourceChannel}` : ""}
        </span>
      </span>
    </li>
  );
}

function FilesSection({
  artifacts,
  hermesStatus
}: {
  artifacts: Session["artifacts"];
  hermesStatus: NormalizedHermesStatus | null;
}) {
  const fileState = hermesStatus?.uiCapabilities.files.uiState ?? "unknown";
  const artifactState = hermesStatus?.uiCapabilities.files.artifacts ?? "unknown";
  const uploadSupported = hermesStatus?.uiCapabilities.files.uploadSupported === true;
  const realArtifactsAvailable = artifactState === "available" && fileState === "available";
  return (
    <section className={styles.section} aria-labelledby="files-heading">
      <SectionLabel id="files-heading" icon={<FolderGit2 size={13} />} label="Files and artifacts" />
      <div className={styles.artifactStatus}>
        <ContextField label="Source" value={realArtifactsAvailable ? "Hermes artifact API" : "Local/mock only"} />
        <ContextField label="Artifacts" value={artifactState} />
        <ContextField label="Uploads" value={uploadSupported ? "Supported" : "Not supported"} />
      </div>
      {artifacts.length === 0 ? (
        <EmptyState
          compact
          title="No files or artifacts yet"
          body={`Hermes file/artifact UI is ${fileState}. Local/mock metadata will appear here when present.`}
        />
      ) : (
        <ul className={styles.list}>
          {artifacts.map((artifact) => (
            <li className={styles.artifactRow} data-source={artifact.source} data-status={artifact.status} key={artifact.id}>
              <FileText className={styles.artifactIcon} size={18} aria-hidden="true" />
              <span className={styles.artifactContent}>
                <span className={styles.cardTitle}>
                  <span>{artifact.title}</span>
                  <span className={styles.pill}>{artifact.status}</span>
                </span>
                <span className={styles.cardBody}>
                  {artifact.summary ?? "Artifact metadata is visible, but preview/download is not available yet."}
                </span>
                <span className={styles.meta}>
                  {artifact.kind} - {artifact.source}
                  {artifact.updatedAt ? ` - ${formatArtifactDate(artifact.updatedAt)}` : ""}
                  {artifact.sizeBytes ? ` - ${formatArtifactSize(artifact.sizeBytes)}` : ""}
                </span>
                {artifact.path ? <span className={styles.meta}>{artifact.path}</span> : null}
                <button
                  className={styles.ghostAction}
                  type="button"
                  disabled
                  aria-label={`Download unavailable for ${artifact.title}`}
                >
                  Download unavailable
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatArtifactDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric"
  }).format(timestamp);
}

function formatArtifactSize(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function SectionLabel({ icon, id, label }: { icon?: ReactNode; id: string; label: string }) {
  return (
    <div className={styles.sectionLabel} id={id}>
      <span>{label}</span>
      {icon}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricLabel}>{label}</div>
    </div>
  );
}

function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value}</span>
    </div>
  );
}
