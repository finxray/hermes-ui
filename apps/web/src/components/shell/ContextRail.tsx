"use client";

import { Activity, Clock, Cpu, FileText, FolderGit2, RefreshCw, Server, ShieldCheck, Terminal, Trash2 } from "@/components/ui/AppIcons";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { HermesStatusPanel } from "@/components/shell/HermesStatusPanel";
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import { computeActivityDuration, extractCommandDetails, formatActivityDuration } from "@/lib/agentActivityEvents";
import { fetchHermesSessionMessages, deleteHermesSessionBff } from "@/lib/hermesSessionsClient";
import { createSessionExportPreview } from "@/lib/persistedActivityReplay";
import { isExternalChannelSource, makeSessionChannel, normalizeHermesMessages } from "@/lib/sessionChannels";
import { formatSessionUpdatedAt } from "@/lib/workspaceStore";
import type { HermesSessionSummary, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session } from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { useScrollOverflowTarget } from "@/hooks/useScrollOverflowTarget";
import type { AgentActivityEvent } from "@/types/agentActivity";
import styles from "./ContextRail.module.css";

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];

type ContextRailProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  allSessions: Session[];
  hermesSessions: HermesSessionSummary[];
  hermesStatus: NormalizedHermesStatus | null;
  hermesSessionModel: HermesSessionModelSync;
  isHermesSessionsLoading: boolean;
  isHermesStatusLoading: boolean;
  isHermesStatusRefreshing?: boolean;
  refreshHermesStatus: () => void;
  refreshHermesSessions: () => void;
  workspaceActions: WorkspaceActions;
};

type PanelTab = "context" | "tools" | "files";

const SESSION_EXPORT_EXCLUDED_FIELDS = [
  "api keys and credentials",
  "full raw Hermes payloads",
  "full stdout/stderr/output beyond previews",
  "binary/blob data",
  "direct service URLs with secrets"
];

type ExportPreviewCache = {
  buildMs: number;
  cacheKey: string;
  previewJson: string;
};

export function ContextRail({
  activeProject,
  activeSession,
  activityEvents,
  allSessions,
  hermesSessions,
  hermesStatus,
  hermesSessionModel,
  isHermesSessionsLoading,
  isHermesStatusLoading,
  isHermesStatusRefreshing = false,
  refreshHermesStatus,
  refreshHermesSessions,
  workspaceActions
}: ContextRailProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("context");
  const scrollRef = useRef<HTMLDivElement>(null);
  const toolEvents = activeSession?.toolEvents ?? [];
  const artifacts = activeSession?.artifacts ?? [];

  useScrollOverflowTarget(scrollRef);

  return (
    <aside className={styles.rail} data-shell-rail="right" aria-label="Context, tools, and files">
      <header className={styles.head}>
        <h2>Console</h2>
        <p>Session context and runtime activity</p>
        <div className={styles.tabs} aria-label="Panel sections">
          <TabButton active={activeTab === "context"} onClick={() => setActiveTab("context")}>
            Context
          </TabButton>
          <TabButton active={activeTab === "tools"} onClick={() => setActiveTab("tools")}>
            Tools
          </TabButton>
          <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")}>
            Files
          </TabButton>
        </div>
      </header>

      <div ref={scrollRef} className={styles.scroll}>
        {activeTab === "context" ? (
          <>
            <HermesStatusPanel
              isLoading={isHermesStatusLoading}
              isRefreshing={isHermesStatusRefreshing}
              onRefresh={() => {
                refreshHermesStatus();
                void hermesSessionModel.refresh();
              }}
              sessionModel={hermesSessionModel}
              status={hermesStatus}
            />
            <HermesHistorySection
              activeProjectId={activeProject.id}
              allSessions={allSessions}
              hermesSessions={hermesSessions}
              isLoading={isHermesSessionsLoading}
              onRefresh={refreshHermesSessions}
              workspaceActions={workspaceActions}
            />
            <ActiveContextSection activeProject={activeProject} activeSession={activeSession} />
            <ExportPreviewSection activeSession={activeSession} />
          </>
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

function HermesHistorySection({
  activeProjectId,
  allSessions,
  hermesSessions,
  isLoading,
  onRefresh,
  workspaceActions
}: {
  activeProjectId: string;
  allSessions: Session[];
  hermesSessions: HermesSessionSummary[];
  isLoading: boolean;
  onRefresh: () => void;
  workspaceActions: WorkspaceActions;
}) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const handleRestoreSession = useCallback(
    async (summary: HermesSessionSummary) => {
      if (restoringId === summary.id) {
        return;
      }

      const existingSession = allSessions.find(
        (session) => session.hermesSessionId === summary.id && !session.archivedAt
      );

      if (existingSession) {
        workspaceActions.switchSession(existingSession.id);
        if (existingSession.messages.length === 0) {
          setRestoringId(summary.id);
          const result = await fetchHermesSessionMessages(summary.id);
          setRestoringId(null);
          if (result.ok && result.messages.length > 0) {
            workspaceActions.loadHermesMessages(existingSession.id, normalizeHermesMessages(result.messages));
          }
        }
        return;
      }

      setRestoringId(summary.id);
      const result = await fetchHermesSessionMessages(summary.id);
      setRestoringId(null);
      workspaceActions.createSessionForProject(activeProjectId, {
        activate: true,
        channel: makeSessionChannel(summary),
        createdAt: summary.startedAt,
        hermesSessionId: summary.id,
        messages: result.ok ? normalizeHermesMessages(result.messages) : [],
        title: summary.title || "Restored session",
        updatedAt: summary.lastActiveAt ?? summary.endedAt ?? summary.startedAt
      });
    },
    [activeProjectId, allSessions, restoringId, workspaceActions]
  );

  const handleDeleteHermesSession = useCallback(
    async (sessionId: string) => {
      setDeleteConfirmId(null);
      await deleteHermesSessionBff(sessionId);
      onRefresh();
    },
    [onRefresh]
  );

  const knownHermesIds = new Set(allSessions.map((session) => session.hermesSessionId).filter(Boolean));
  const unmappedHermesSessions = hermesSessions.filter((session) => !knownHermesIds.has(session.id));
  const sessionPreviewLimit = 5;
  const visibleHermesSessions = showAllSessions
    ? unmappedHermesSessions
    : unmappedHermesSessions.slice(0, sessionPreviewLimit);

  if (hermesSessions.length === 0 && !isLoading) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="hermes-history-heading">
      <div className={styles.sectionLabel} id="hermes-history-heading">
        <span className={styles.sectionLabelText}>
          <Server size={13} aria-hidden="true" />
          Hermes history
        </span>
        <button
          aria-label="Refresh Hermes sessions"
          className={styles.sectionRefresh}
          disabled={isLoading}
          onClick={onRefresh}
          type="button"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {isLoading && hermesSessions.length === 0 ? (
        <p className={styles.emptyText}>Loading Hermes sessions...</p>
      ) : (
        <ul className={styles.hermesHistoryList}>
          {visibleHermesSessions.map((summary) => {
            const isRestoring = restoringId === summary.id;
            const isConfirming = deleteConfirmId === summary.id;
            return (
              <li className={styles.hermesHistoryItem} key={`hermes-history-${summary.id}`}>
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
                  <div className={styles.hermesHistoryRow}>
                    <button
                      className={styles.hermesHistoryButton}
                      disabled={isRestoring}
                      onClick={() => void handleRestoreSession(summary)}
                      type="button"
                    >
                      <span className={styles.hermesHistoryTitle}>
                        {isRestoring ? "Restoring..." : summary.title}
                      </span>
                      <span className={styles.hermesHistoryMeta}>
                        {summary.model ? (
                          <span>
                            <Cpu size={13} aria-hidden="true" />
                          </span>
                        ) : null}
                        {summary.startedAt ? (
                          <span>
                            <Clock size={13} aria-hidden="true" />
                            {formatSessionUpdatedAt(summary.startedAt)}
                          </span>
                        ) : null}
                        {typeof summary.messageCount === "number" ? (
                          <span>{summary.messageCount}msg</span>
                        ) : null}
                      </span>
                    </button>
                    {isExternalChannelSource(summary.source) ? null : (
                      <button
                        aria-label={`Delete Hermes session ${summary.title}`}
                        className={styles.hermesHistoryDelete}
                        onClick={() => setDeleteConfirmId(summary.id)}
                        type="button"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {unmappedHermesSessions.length === 0 && hermesSessions.length > 0 ? (
            <li className={styles.emptyText}>All Hermes sessions are already in Stoix chats.</li>
          ) : null}
          {unmappedHermesSessions.length > sessionPreviewLimit ? (
            <li>
              <button
                aria-expanded={showAllSessions}
                className={styles.showMoreButton}
                onClick={() => setShowAllSessions((current) => !current)}
                type="button"
              >
                {showAllSessions
                  ? "Show less"
                  : `Show more (${unmappedHermesSessions.length - sessionPreviewLimit})`}
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </section>
  );
}

function ActiveContextSection({
  activeProject,
  activeSession
}: {
  activeProject: Project;
  activeSession: Session | null;
}) {
  return (
    <section className={styles.section} aria-labelledby="active-context-heading">
      <SectionLabel id="active-context-heading" icon={<ShieldCheck size={13} />} label="Active context" />
      <div className={styles.card}>
        <div>
          <div className={styles.cardTitle}>
            <span>{activeProject.name}</span>
            <span className={styles.pill}>local</span>
          </div>
          <div className={styles.cardBody}>{activeProject.description}</div>
        </div>
        <div className={styles.metrics}>
          <Metric label="session messages" value={activeSession?.messages.length ?? 0} />
        </div>
        <div className={styles.meta}>{activeSession?.title ?? "No active session"}</div>
      </div>
    </section>
  );
}

function ExportPreviewSection({ activeSession }: { activeSession: Session | null }) {
  const [isMounted, setIsMounted] = useState(false);
  const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);
  const [exportPreviewCache, setExportPreviewCache] = useState<ExportPreviewCache | null>(null);
  const exportPreviewCacheKey = activeSession ? createExportPreviewCacheKey(activeSession) : null;

  useEffect(() => setIsMounted(true), []);

  useEffect(() => {
    if (!activeSession || !isExportPreviewOpen || !exportPreviewCacheKey) {
      return;
    }
    if (exportPreviewCache?.cacheKey === exportPreviewCacheKey) {
      return;
    }

    const startedAt = performance.now();
    const preview = createSessionExportPreview(activeSession, activeSession.updatedAt);
    const previewJson = JSON.stringify(preview, null, 2);
    setExportPreviewCache({
      buildMs: Math.round(performance.now() - startedAt),
      cacheKey: exportPreviewCacheKey,
      previewJson
    });
  }, [activeSession, exportPreviewCache?.cacheKey, exportPreviewCacheKey, isExportPreviewOpen]);

  if (!activeSession) {
    return (
      <section className={styles.section} aria-labelledby="export-preview-heading">
        <SectionLabel id="export-preview-heading" icon={<FileText size={13} />} label="Export preview" />
        <EmptyState compact title="No active session" body="Local export preview waits for an active session." />
      </section>
    );
  }

  const previewJson =
    exportPreviewCache?.cacheKey === exportPreviewCacheKey ? exportPreviewCache.previewJson : "";
  const previewBuildMs =
    exportPreviewCache?.cacheKey === exportPreviewCacheKey ? exportPreviewCache.buildMs : undefined;

  return (
    <section className={styles.section} aria-labelledby="export-preview-heading">
      <SectionLabel id="export-preview-heading" icon={<FileText size={13} />} label="Export preview" />
      <div className={styles.card}>
        <div>
          <div className={styles.cardTitle}>
            <span>Session export preview</span>
            <span className={styles.pill}>Redacted</span>
          </div>
          <div className={styles.cardBody}>
            Review the local session transcript before export. Raw payloads and credential-like
            values are excluded or redacted.
          </div>
        </div>
        <div className={styles.metrics}>
          <Metric label="messages" value={activeSession.messages.length} />
          <Metric label="excluded fields" value={SESSION_EXPORT_EXCLUDED_FIELDS.length} />
        </div>
        <div className={styles.fieldGrid}>
          <ContextField label="Session title" value={activeSession.title} />
          <ContextField
            label="Updated"
            value={isMounted ? formatRunDate(activeSession.updatedAt) : "Current session"}
          />
        </div>
        <ul className={styles.excludedList} aria-label="Excluded export fields">
          {SESSION_EXPORT_EXCLUDED_FIELDS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <details
          className={styles.exportDetails}
          onToggle={(event) => setIsExportPreviewOpen(event.currentTarget.open)}
        >
          <summary>Preview JSON</summary>
          {previewJson ? (
            <pre
              className={styles.exportJson}
              data-export-preview-build-ms={previewBuildMs}
              data-export-preview-json="ready"
            >
              {previewJson}
            </pre>
          ) : (
            <div className={styles.exportPlaceholder}>Preparing local preview...</div>
          )}
        </details>
      </div>
    </section>
  );
}

function createExportPreviewCacheKey(session: Session) {
  const replayEventCount = session.runRecords.reduce(
    (total, run) => total + (run.activityReplay?.length ?? 0),
    0
  );
  return [
    session.id,
    session.updatedAt,
    session.messages.length,
    session.runRecords.length,
    replayEventCount
  ].join(":");
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
        <ContextField label="Source" value={realArtifactsAvailable ? "Hermes artifact API" : "Session metadata"} />
        <ContextField label="Artifacts" value={artifactState} />
        <ContextField label="Uploads" value={uploadSupported ? "Supported" : "Not supported"} />
      </div>
      {artifacts.length === 0 ? (
        <EmptyState
          compact
          title="No files or artifacts yet"
          body={`Hermes file and artifact support is ${fileState}.`}
        />
      ) : (
        <ul className={styles.list}>
          {artifacts.map((artifact) => (
            <li className={styles.artifactRow} data-source={artifact.source} data-status={artifact.status} key={artifact.id}>
              <FileText className={styles.artifactIcon} size={18} aria-hidden="true" />
              <span className={styles.artifactContent}>
                <span className={styles.cardTitle}>
                  <span className={styles.artifactTitle}>{artifact.title}</span>
                  <span className={styles.pill}>{artifact.status}</span>
                </span>
                <span className={styles.cardBody}>
                  {artifact.summary ?? "Artifact metadata from this session."}
                </span>
                <span className={styles.meta}>
                  {artifact.kind} - {artifact.source}
                  {artifact.updatedAt ? ` - ${formatArtifactDate(artifact.updatedAt)}` : ""}
                  {artifact.sizeBytes ? ` - ${formatArtifactSize(artifact.sizeBytes)}` : ""}
                </span>
                {artifact.path ? (
                  <span className={`${styles.meta} ${styles.artifactFileName}`}>
                    {artifact.path}
                  </span>
                ) : null}
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

function formatRunDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
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
