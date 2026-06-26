"use client";

import { Activity, Clock, Cpu, Database, FileText, FolderGit2, KeyRound, RefreshCw, Server, ShieldCheck, Terminal, Trash2 } from "@/components/ui/AppIcons";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BrainMemoryConsole } from "@/components/memory/BrainMemoryConsole";
import { EmptyState } from "@/components/ui/EmptyState";
import { HermesStatusPanel } from "@/components/shell/HermesStatusPanel";
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import { computeActivityDuration, extractCommandDetails, formatActivityDuration } from "@/lib/agentActivityEvents";
import { fetchHermesSessionMessages, deleteHermesSessionBff } from "@/lib/hermesSessionsClient";
import { createSessionExportPreview } from "@/lib/persistedActivityReplay";
import { buildTenantScopeDiagnostics, type TenantScopeDiagnostics } from "@/lib/tenantScopeDiagnostics";
import { formatSessionUpdatedAt } from "@/lib/workspaceStore";
import type { NormalizedBrainMemoryStatus } from "@hermes-ui/brain-memory-client";
import type { HermesSessionMessage, HermesSessionSummary, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { ChatMessage, Project, Session } from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
import type { AgentActivityEvent } from "@/types/agentActivity";
import styles from "./ContextRail.module.css";

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];

type ContextRailProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  allSessions: Session[];
  brainMemoryStatus: NormalizedBrainMemoryStatus | null;
  hermesSessions: HermesSessionSummary[];
  hermesStatus: NormalizedHermesStatus | null;
  hermesSessionModel: HermesSessionModelSync;
  isBrainMemoryStatusLoading: boolean;
  isHermesSessionsLoading: boolean;
  isHermesStatusLoading: boolean;
  isHermesStatusRefreshing?: boolean;
  refreshBrainMemoryStatus: () => void;
  refreshHermesStatus: () => void;
  refreshHermesSessions: () => void;
  tenantScopePosture: TenantScopeDiagnostics["redactedPosture"] | null;
  workspaceActions: WorkspaceActions;
};

type PanelTab = "context" | "memory" | "tools" | "files";

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
  brainMemoryStatus,
  hermesSessions,
  hermesStatus,
  hermesSessionModel,
  isBrainMemoryStatusLoading,
  isHermesSessionsLoading,
  isHermesStatusLoading,
  isHermesStatusRefreshing = false,
  refreshBrainMemoryStatus,
  refreshHermesStatus,
  refreshHermesSessions,
  tenantScopePosture,
  workspaceActions
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
              isRefreshing={isHermesStatusRefreshing}
              onRefresh={() => {
                refreshHermesStatus();
                void hermesSessionModel.refresh();
              }}
              sessionModel={hermesSessionModel}
              status={hermesStatus}
            />
            <HermesHistorySection
              allSessions={allSessions}
              hermesSessions={hermesSessions}
              isLoading={isHermesSessionsLoading}
              onRefresh={refreshHermesSessions}
              workspaceActions={workspaceActions}
            />
            <ActiveContextSection activeProject={activeProject} activeSession={activeSession} />
            <TenantScopeDiagnosticsSection
              activeProject={activeProject}
              activeSession={activeSession}
              brainMemoryStatus={brainMemoryStatus}
              hermesStatus={hermesStatus}
              redactedPosture={tenantScopePosture}
            />
            <ExportPreviewSection activeSession={activeSession} />
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

function TenantScopeDiagnosticsSection({
  activeProject,
  activeSession,
  brainMemoryStatus,
  hermesStatus,
  redactedPosture
}: {
  activeProject: Project;
  activeSession: Session | null;
  brainMemoryStatus: NormalizedBrainMemoryStatus | null;
  hermesStatus: NormalizedHermesStatus | null;
  redactedPosture: TenantScopeDiagnostics["redactedPosture"] | null;
}) {
  const diagnostics = buildTenantScopeDiagnostics({
    activeProject,
    activeSession,
    brainMemoryStatus,
    hermesStatus,
    redactedPosture
  });
  const status =
    diagnostics.checks.errors.length > 0
      ? "drift"
      : diagnostics.checks.warnings.length > 0
        ? "watch"
        : "aligned";

  return (
    <section className={styles.section} aria-labelledby="tenant-scope-diagnostics-heading">
      <SectionLabel
        id="tenant-scope-diagnostics-heading"
        icon={<KeyRound size={13} />}
        label="Tenant / scope diagnostics"
      />
      <details className={styles.diagnosticsDetails}>
        <summary>
          <span>Read-only drift check</span>
          <span className={styles.pill}>{status}</span>
        </summary>
        <div className={styles.fieldGrid}>
          <ContextField label="Tenant" value={diagnostics.ui.tenantId} />
          <ContextField label="Project key" value={diagnostics.ui.projectStableKey} />
          <ContextField label="Session key" value={diagnostics.ui.sessionStableKey} />
          <ContextField label="Hermes session" value={diagnostics.ui.hermesSessionId ?? "No active session"} />
          <ContextField
            label="Brain Memory"
            value={`${diagnostics.brainMemoryBff.mode}${diagnostics.brainMemoryBff.reachable ? " / reachable" : ""}`}
          />
          <ContextField
            label="Hermes"
            value={diagnostics.hermes.reachable ? "real / reachable" : "unreachable or checking"}
          />
          <ContextField
            label="Scope bridge"
            value={diagnostics.hermes.memoryScopeBridgeActive ? "active" : "deferred"}
          />
          <ContextField
            label="Gateway memory key"
            value={formatKeyState(diagnostics.redactedPosture.gatewayMemoryKeySet)}
          />
          <ContextField
            label="Allowed tenants"
            value={diagnostics.redactedPosture.allowedTenantsSummary ?? "not exposed to browser"}
          />
        </div>
        {diagnostics.checks.errors.length > 0 ? (
          <ul className={styles.diagnosticsList} aria-label="Tenant scope errors">
            {diagnostics.checks.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        {diagnostics.checks.warnings.length > 0 ? (
          <ul className={`${styles.diagnosticsList} ${styles.diagnosticsWarnings}`} aria-label="Tenant scope warnings">
            {diagnostics.checks.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
      </details>
    </section>
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
  allSessions,
  hermesSessions,
  isLoading,
  onRefresh,
  workspaceActions
}: {
  allSessions: Session[];
  hermesSessions: HermesSessionSummary[];
  isLoading: boolean;
  onRefresh: () => void;
  workspaceActions: WorkspaceActions;
}) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const pendingRestoreRef = useRef<{
    hermesSessionId: string;
    title: string;
    messages: ChatMessage[];
  } | null>(null);

  useEffect(() => {
    const pending = pendingRestoreRef.current;
    if (!pending) {
      return;
    }
    const newSession = allSessions.find(
      (session) => !session.archivedAt && session.messages.length === 0 && session.hermesSessionId !== pending.hermesSessionId
    );
    if (!newSession) {
      return;
    }
    pendingRestoreRef.current = null;
    workspaceActions.renameSession(newSession.id, pending.title || "Restored session");
    if (pending.messages.length > 0) {
      workspaceActions.loadHermesMessages(newSession.id, pending.messages);
    }
  }, [allSessions, workspaceActions]);

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
      pendingRestoreRef.current = {
        hermesSessionId: summary.id,
        title: summary.title || "Restored session",
        messages: result.ok ? normalizeHermesMessages(result.messages) : []
      };
      workspaceActions.createSession();
    },
    [allSessions, restoringId, workspaceActions]
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
          title="Refresh"
          type="button"
        >
          <RefreshCw size={13} />
        </button>
      </div>
      {isLoading && hermesSessions.length === 0 ? (
        <p className={styles.emptyText}>Loading Hermes sessions...</p>
      ) : (
        <ul className={styles.hermesHistoryList}>
          {unmappedHermesSessions.slice(0, 12).map((summary) => {
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
                      title={`Restore: ${summary.title}`}
                      type="button"
                    >
                      <span className={styles.hermesHistoryTitle}>
                        {isRestoring ? "Restoring..." : summary.title}
                      </span>
                      <span className={styles.hermesHistoryMeta}>
                        {summary.model ? (
                          <span title={`Model: ${summary.model}`}>
                            <Cpu size={13} aria-hidden="true" />
                          </span>
                        ) : null}
                        {summary.startedAt ? (
                          <span title={new Date(summary.startedAt).toLocaleString()}>
                            <Clock size={13} aria-hidden="true" />
                            {formatSessionUpdatedAt(summary.startedAt)}
                          </span>
                        ) : null}
                        {typeof summary.messageCount === "number" ? (
                          <span title={`${summary.messageCount} messages`}>{summary.messageCount}msg</span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      aria-label={`Delete Hermes session ${summary.title}`}
                      className={styles.hermesHistoryDelete}
                      onClick={() => setDeleteConfirmId(summary.id)}
                      title="Delete session"
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {unmappedHermesSessions.length === 0 && hermesSessions.length > 0 ? (
            <li className={styles.emptyText}>All Hermes sessions are already in Studio chats.</li>
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
  const memoryEvidence = activeSession?.memoryEvidence ?? [];

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
          <Metric label="memory refs" value={memoryEvidence.length} />
        </div>
        <div className={styles.meta}>{activeProject.memoryScopeKey}</div>
      </div>
    </section>
  );
}

function normalizeHermesMessages(messages: HermesSessionMessage[]): ChatMessage[] {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      author: message.role === "user" ? "You" : "Hermes",
      content: message.content,
      createdAt: message.createdAt ?? new Date().toISOString(),
      status: "complete" as const
    }));
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

function ExportPreviewSection({ activeSession }: { activeSession: Session | null }) {
  const [isExportPreviewOpen, setIsExportPreviewOpen] = useState(false);
  const [exportPreviewCache, setExportPreviewCache] = useState<ExportPreviewCache | null>(null);
  const exportPreviewCacheKey = activeSession ? createExportPreviewCacheKey(activeSession) : null;

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
            <span>Local preview only</span>
            <span className={styles.pill}>no backend export</span>
          </div>
          <div className={styles.cardBody}>
            Session transcript and memory scope are previewed from local
            browser state. Raw payloads and credential-like values are excluded or redacted.
          </div>
        </div>
        <div className={styles.metrics}>
          <Metric label="messages" value={activeSession.messages.length} />
          <Metric label="excluded fields" value={SESSION_EXPORT_EXCLUDED_FIELDS.length} />
        </div>
        <div className={styles.fieldGrid}>
          <ContextField label="Session title" value={activeSession.title} />
          <ContextField label="Updated" value={formatRunDate(activeSession.updatedAt)} />
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
                  <span className={styles.artifactTitle}>{artifact.title}</span>
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
                {artifact.path ? (
                  <span className={`${styles.meta} ${styles.artifactFileName}`}>
                    {artifact.path}
                  </span>
                ) : null}
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

function formatKeyState(value?: boolean) {
  if (value === true) {
    return "set";
  }
  if (value === false) {
    return "not set";
  }
  return "not exposed to browser";
}
