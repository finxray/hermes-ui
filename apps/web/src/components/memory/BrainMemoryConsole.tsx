"use client";

import { Activity, Database, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrainMemoryStatusPanel } from "@/components/memory/BrainMemoryStatusPanel";
import { ContextField, MemoryDetailPanel, ScopeSummary } from "@/components/memory/MemoryDetailPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBrainMemorySearch } from "@/hooks/useBrainMemorySearch";
import { useMemoryInspection } from "@/hooks/useMemoryInspection";
import {
  createMemoryTimelineItems,
  formatMemoryOperation,
  formatMemoryScope,
  summarizeMemoryTimeline
} from "@/lib/memoryTimeline";
import { WORKSPACE_STORAGE_VERSION } from "@/lib/workspaceStore";
import type {
  BrainMemorySearchContext,
  NormalizedBrainMemoryStatus,
  NormalizedMemoryResult
} from "@hermes-ui/brain-memory-client";
import type { MemoryEvidence, Project, Session } from "@/data/types";
import type { AgentActivityEvent } from "@/types/agentActivity";
import type { MemoryTimelineItem } from "@/lib/memoryTimeline";
import type { FormEvent } from "react";
import styles from "./BrainMemoryConsole.module.css";

type BrainMemoryConsoleProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  status: NormalizedBrainMemoryStatus | null;
  isStatusLoading: boolean;
  onRefreshStatus: () => void;
};

export function BrainMemoryConsole({
  activeProject,
  activeSession,
  activityEvents,
  status,
  isStatusLoading,
  onRefreshStatus
}: BrainMemoryConsoleProps) {
  const [query, setQuery] = useState("");
  const [mockDetail, setMockDetail] = useState<MemoryEvidence | null>(null);
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null);
  const { isSearching, lastResponse, search } = useBrainMemorySearch();
  const {
    clearInspection,
    inspect,
    isInspecting,
    response: inspectionResponse
  } = useMemoryInspection();
  const context = useMemo(
    () => makeSearchContext(activeProject, activeSession),
    [activeProject, activeSession]
  );
  const mockResults = useMemo(
    () => filterMockEvidence(activeSession?.memoryEvidence ?? [], query),
    [activeSession, query]
  );
  const gatewayResults = lastResponse?.mode === "real" ? lastResponse.results : [];
  const shouldUseMock = !lastResponse || lastResponse.mode !== "real";
  const scope = lastResponse?.mode === "real" ? lastResponse.scope : null;
  const memoryTimelineItems = useMemo(
    () =>
      createMemoryTimelineItems(activityEvents, {
        projectKey: activeProject.memoryScope.stableProjectKey,
        sessionKey: activeSession?.memoryScope.stableSessionKey
      }).slice(-12),
    [
      activeProject.memoryScope.stableProjectKey,
      activeSession?.memoryScope.stableSessionKey,
      activityEvents
    ]
  );
  const timelineSummary = useMemo(
    () => summarizeMemoryTimeline(memoryTimelineItems),
    [memoryTimelineItems]
  );
  const canInspectTimelineMemory = status?.mode === "real" && status.reachable === true;

  useEffect(() => {
    setQuery(activeSession?.memoryEvidence[0]?.title ?? activeProject.name);
    setMockDetail(null);
    setSelectedMemoryId(null);
    clearInspection();
  }, [
    activeProject.id,
    activeProject.name,
    activeSession?.id,
    activeSession?.memoryEvidence,
    clearInspection
  ]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return;
    }
    setMockDetail(null);
    setSelectedMemoryId(null);
    clearInspection();
    await search({
      context,
      limit: 8,
      query: cleanQuery
    });
  }

  return (
    <>
      <BrainMemoryStatusPanel
        isLoading={isStatusLoading}
        onRefresh={onRefreshStatus}
        status={status}
      />

      <section className={styles.section} aria-labelledby="memory-scope-heading">
        <div className={styles.sectionLabel} id="memory-scope-heading">
          <span>Memory scope</span>
          <Database size={13} aria-hidden="true" />
        </div>
        <div className={styles.card}>
          <div className={styles.cardTitle}>
            <span>{activeProject.name}</span>
            <span className={styles.pill}>read-only</span>
          </div>
          <div className={styles.fieldGrid}>
            <ContextField label="Tenant" value={activeProject.memoryScope.tenantId} />
            <ContextField label="Project key" value={activeProject.memoryScope.stableProjectKey} />
            <ContextField
              label="Session key"
              value={activeSession?.memoryScope.stableSessionKey ?? "No active session"}
            />
            <ContextField label="Retrieval" value={activeProject.memoryScope.retrievalProfile} />
            <ContextField label="Policy" value={activeProject.memoryScope.contextPolicy} />
            <ContextField
              label="Project context"
              value={activeSession?.memoryScope.includeProjectContext ? "Included" : "Off"}
            />
            <ContextField
              label="Session context"
              value={activeSession?.memoryScope.includeSessionContext ? "Included" : "Off"}
            />
            <ContextField
              label="Gateway"
              value={status?.mode === "real" && status.reachable ? "Connected" : "Prepared"}
            />
          </div>
        </div>
      </section>

      <MemoryTimelineSection
        canInspectMemory={canInspectTimelineMemory}
        items={memoryTimelineItems}
        onInspectMemory={(memoryId) => {
          setMockDetail(null);
          setSelectedMemoryId(memoryId);
          void inspect({
            context,
            memoryId
          });
        }}
        summary={timelineSummary}
      />

      <section className={styles.section} aria-labelledby="memory-search-heading">
        <div className={styles.sectionLabel} id="memory-search-heading">
          <span>Memory search</span>
          <Search size={13} aria-hidden="true" />
        </div>
        <form className={styles.searchForm} onSubmit={submit}>
          <input
            aria-label="Search Brain Memory"
            className={styles.searchInput}
            placeholder="Search memory in active scope"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <button
            className={styles.searchButton}
            type="submit"
            disabled={isSearching || query.trim().length === 0}
          >
            Search
          </button>
        </form>
        <div className={styles.meta}>
          Browser calls the local BFF only; the BFF calls Gateway read-only endpoints when enabled.
          Tenant search may require BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY.
        </div>
        <div className={styles.meta}>
          Project/session scope is enforced by Brain Memory Gateway. Legacy unscoped memories are
          excluded by default.
        </div>
        {scope ? <ScopeSummary scope={scope} /> : null}
        {lastResponse?.error ? <div className={styles.error}>{lastResponse.error.message}</div> : null}
      </section>

      <section className={styles.section} aria-labelledby="memory-results-heading">
        <div className={styles.sectionLabel} id="memory-results-heading">
          <span>{shouldUseMock ? "Mock/local results" : "Gateway results"}</span>
          <span>{shouldUseMock ? mockResults.length : gatewayResults.length}</span>
        </div>
        {shouldUseMock ? (
          <MockMemoryResults
            results={mockResults}
            selectedMemoryId={selectedMemoryId}
            onSelect={(memory) => {
              clearInspection();
              setSelectedMemoryId(memory.id);
              setMockDetail(memory);
            }}
          />
        ) : (
          <GatewayMemoryResults
            results={gatewayResults}
            selectedMemoryId={selectedMemoryId}
            onSelect={(memory) => {
              setMockDetail(null);
              setSelectedMemoryId(memory.id);
              void inspect({
                context,
                memoryId: memory.id
              });
            }}
          />
        )}
      </section>

      {(mockDetail || inspectionResponse || isInspecting) ? (
        <MemoryDetailPanel
          inspection={inspectionResponse}
          isInspecting={isInspecting}
          mockDetail={mockDetail}
          onClose={() => {
            setMockDetail(null);
            setSelectedMemoryId(null);
            clearInspection();
          }}
        />
      ) : null}
    </>
  );
}

function MemoryTimelineSection({
  canInspectMemory,
  items,
  onInspectMemory,
  summary
}: {
  canInspectMemory: boolean;
  items: MemoryTimelineItem[];
  onInspectMemory: (memoryId: string) => void;
  summary: ReturnType<typeof summarizeMemoryTimeline>;
}) {
  return (
    <section className={styles.section} aria-labelledby="memory-activity-heading">
      <div className={styles.sectionLabel} id="memory-activity-heading">
        <span>Memory activity</span>
        <Activity size={13} aria-hidden="true" />
      </div>
      <div className={styles.timelineStats} aria-label="Memory activity summary">
        <ContextField label="Events" value={String(summary.total)} />
        <ContextField label="Running" value={String(summary.running)} />
        <ContextField label="Failed" value={String(summary.failed)} />
      </div>
      {items.length === 0 ? (
        <EmptyState compact title="No memory activity" body="No memory activity in this session yet." />
      ) : (
        <ol className={styles.timelineList}>
          {items.map((item) => (
            <MemoryTimelineRow
              canInspectMemory={canInspectMemory}
              item={item}
              key={item.id}
              onInspectMemory={onInspectMemory}
            />
          ))}
        </ol>
      )}
    </section>
  );
}

function MemoryTimelineRow({
  canInspectMemory,
  item,
  onInspectMemory
}: {
  canInspectMemory: boolean;
  item: MemoryTimelineItem;
  onInspectMemory: (memoryId: string) => void;
}) {
  const hasInspectAction = canInspectMemory && Boolean(item.memoryId);
  return (
    <li className={styles.timelineItem} data-status={item.status}>
      <div className={styles.timelineDot} aria-hidden="true" />
      <div className={styles.timelineBody}>
        <div className={styles.cardTitle}>
          <span>{formatMemoryOperation(item.operation)}</span>
          <span className={styles.pill}>{item.status}</span>
        </div>
        <div className={styles.cardBody}>{item.summary ?? item.title}</div>
        <div className={styles.meta}>
          {formatMemoryScope(item.projectKey, item.sessionKey)}
          {item.durationMs !== undefined ? ` - ${formatTimelineDuration(item.durationMs)}` : ""}
        </div>
        {item.memoryId ? <div className={styles.meta}>memory {item.memoryId}</div> : null}
        {item.scopeStatus ? <div className={styles.meta}>scope {item.scopeStatus}</div> : null}
        <details className={styles.metadata}>
          <summary>Redacted details</summary>
          <pre>{safeJson(item.details)}</pre>
        </details>
        {hasInspectAction ? (
          <button
            className={styles.linkAction}
            type="button"
            onClick={() => item.memoryId && onInspectMemory(item.memoryId)}
          >
            Inspect detail
          </button>
        ) : null}
      </div>
    </li>
  );
}

function makeSearchContext(
  activeProject: Project,
  activeSession: Session | null
): BrainMemorySearchContext {
  return {
    project: {
      id: activeProject.id,
      title: activeProject.name,
      stableKey: activeProject.memoryScope.stableProjectKey,
      tenantId: activeProject.memoryScope.tenantId,
      retrievalProfile: activeProject.memoryScope.retrievalProfile,
      contextPolicy: activeProject.memoryScope.contextPolicy
    },
    session: activeSession
      ? {
          id: activeSession.id,
          title: activeSession.title,
          stableKey: activeSession.memoryScope.stableSessionKey,
          includeProjectContext: activeSession.memoryScope.includeProjectContext,
          includeSessionContext: activeSession.memoryScope.includeSessionContext
        }
      : null,
    ui: {
      source: "hermes-ui",
      workspaceVersion: WORKSPACE_STORAGE_VERSION
    }
  };
}

function filterMockEvidence(memoryEvidence: MemoryEvidence[], query: string) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return memoryEvidence;
  }

  return memoryEvidence.filter((memory) =>
    [memory.title, memory.layer, memory.excerpt, memory.source]
      .join(" ")
      .toLowerCase()
      .includes(cleanQuery)
  );
}

function MockMemoryResults({
  onSelect,
  results,
  selectedMemoryId
}: {
  onSelect: (memory: MemoryEvidence) => void;
  results: MemoryEvidence[];
  selectedMemoryId: string | null;
}) {
  if (results.length === 0) {
    return (
      <EmptyState
        compact
        title="No mock memory matched"
        body="Gateway search is not connected, so only local mock evidence is filtered."
      />
    );
  }

  return (
    <ul className={styles.resultList}>
      {results.map((memory) => (
        <li key={memory.id}>
          <button
            aria-current={selectedMemoryId === memory.id ? "true" : undefined}
            className={`${styles.resultButton} ${
              selectedMemoryId === memory.id ? styles.resultActive : ""
            }`}
            type="button"
            onClick={() => onSelect(memory)}
          >
            <div className={styles.cardTitle}>
              <span>{memory.title}</span>
              <span className={styles.pill}>{memory.layer}</span>
            </div>
            <div className={styles.cardBody}>{memory.excerpt}</div>
            <div className={styles.meta}>
              {memory.source} - mock score {memory.score} - {memory.timestamp}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function GatewayMemoryResults({
  onSelect,
  results,
  selectedMemoryId
}: {
  onSelect: (memory: NormalizedMemoryResult) => void;
  results: NormalizedMemoryResult[];
  selectedMemoryId: string | null;
}) {
  if (results.length === 0) {
    return (
      <EmptyState
        compact
        title="No Gateway memory found"
        body="The read-only Gateway search returned no results for this scope."
      />
    );
  }

  return (
    <ul className={styles.resultList}>
      {results.map((memory) => (
        <li key={memory.id}>
          <button
            aria-current={selectedMemoryId === memory.id ? "true" : undefined}
            className={`${styles.resultButton} ${
              selectedMemoryId === memory.id ? styles.resultActive : ""
            }`}
            type="button"
            onClick={() => onSelect(memory)}
          >
            <div className={styles.cardTitle}>
              <span>{memory.title ?? memory.id}</span>
              <span className={styles.pill}>{memory.scopeStatus ?? memory.layer ?? "unknown"}</span>
            </div>
            <div className={styles.cardBody}>{memory.snippet ?? memory.content}</div>
            <div className={styles.meta}>
              {memory.source ?? "Gateway"} - score {formatScore(memory.score)} - evidence{" "}
              {memory.evidenceCount ?? 0}
            </div>
            <div className={styles.meta}>
              {memory.projectKey ?? "project scope unknown"} -{" "}
              {memory.sessionKey ?? "project memory"} - {memory.supersessionStatus ?? "unknown"}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function formatScore(score: number | undefined) {
  return typeof score === "number" ? score.toFixed(2) : "n/a";
}

function formatTimelineDuration(durationMs: number) {
  if (durationMs > 0 && durationMs < 1000) {
    return "<1s";
  }
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function safeJson(value: unknown) {
  const text = JSON.stringify(value ?? {}, null, 2) ?? "{}";
  return text.length > 2_400 ? `${text.slice(0, 2_400)}\n... truncated` : text;
}
