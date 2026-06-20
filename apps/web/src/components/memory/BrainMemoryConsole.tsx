"use client";

import { Activity, Database, Search } from "@/components/ui/AppIcons";
import { useEffect, useMemo, useState } from "react";
import { BrainMemoryStatusPanel } from "@/components/memory/BrainMemoryStatusPanel";
import { LifecycleDashboard } from "@/components/memory/LifecycleDashboard";
import { LifecycleTimeline } from "@/components/memory/LifecycleTimeline";
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
  const [resultLimit, setResultLimit] = useState(8);
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
  const isGatewayConnected = status?.mode === "real" && status.reachable === true;
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
  const canInspectTimelineMemory = isGatewayConnected;

  useEffect(() => {
    setQuery(activeSession?.memoryEvidence[0]?.title ?? activeProject.name);
    setMockDetail(null);
    setSelectedMemoryId(null);
    setResultLimit(8);
    clearInspection();
  }, [
    activeProject.id,
    activeProject.name,
    activeSession?.id,
    activeSession?.memoryEvidence,
    clearInspection
  ]);

  async function submit(event: FormEvent<HTMLFormElement>, limit = resultLimit) {
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
      limit,
      query: cleanQuery
    });
  }

  async function showMore() {
    const newLimit = resultLimit + 8;
    setResultLimit(newLimit);
    const cleanQuery = query.trim();
    if (!cleanQuery) return;
    setMockDetail(null);
    setSelectedMemoryId(null);
    clearInspection();
    await search({ context, limit: newLimit, query: cleanQuery });
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

      <LifecycleDashboard isGatewayConnected={isGatewayConnected} />

      <LifecycleTimeline
        canInspectMemory={canInspectTimelineMemory}
        isGatewayConnected={isGatewayConnected}
        onInspectMemory={(memoryId) => {
          setMockDetail(null);
          setSelectedMemoryId(memoryId);
          void inspect({
            context,
            memoryId
          });
        }}
      />

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
        {!isGatewayConnected ? (
          <div className={styles.disabledBanner} role="status">
            <span className={styles.disabledBannerLabel}>Gateway not connected</span>
            Brain Memory Gateway is not connected. Only local mock evidence is available. Set{" "}
            BRAIN_MEMORY_GATEWAY_URL and enable real Gateway to search live memory.
          </div>
        ) : null}
        <form className={styles.searchForm} onSubmit={submit}>
          <input
            aria-label="Search Brain Memory"
            className={styles.searchInput}
            disabled={!isGatewayConnected}
            placeholder={
              isGatewayConnected
                ? "Search memory in active scope"
                : "Gateway not connected — mock results only"
            }
            title={
              isGatewayConnected
                ? undefined
                : "Connect Brain Memory Gateway to enable live search"
            }
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <button
            className={styles.searchButton}
            type="submit"
            disabled={!isGatewayConnected || isSearching || query.trim().length === 0}
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
            isSearching={isSearching}
            results={gatewayResults}
            resultLimit={resultLimit}
            selectedMemoryId={selectedMemoryId}
            onSelect={(memory) => {
              setMockDetail(null);
              setSelectedMemoryId(memory.id);
              void inspect({
                context,
                memoryId: memory.id
              });
            }}
            onShowMore={() => void showMore()}
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
          <pre className={styles.metadataPre}>{safeJson(item.details)}</pre>
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
  const PREVIEW_COUNT = 6;
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? results : results.slice(0, PREVIEW_COUNT);
  const remaining = results.length - PREVIEW_COUNT;

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
    <>
      <ul className={styles.resultList}>
        {visible.map((memory) => (
          <li key={memory.id}>
            <button
              aria-current={selectedMemoryId === memory.id ? "true" : undefined}
              className={`${styles.resultItem} ${
                selectedMemoryId === memory.id ? styles.resultItemActive : ""
              }`}
              type="button"
              onClick={() => onSelect(memory)}
            >
              <div className={styles.resultHeader}>
                <span className={styles.resultTitle}>{memory.title}</span>
                <div className={styles.resultBadges}>
                  <span className={styles.scoreBadge}>{memory.score}</span>
                  <LayerPill layer={memory.layer} />
                </div>
              </div>
              <div className={styles.cardBody}>{memory.excerpt}</div>
              <div className={styles.resultMeta}>
                <span>{memory.source}</span>
                <span className={styles.resultMetaDot}>·</span>
                <span>{memory.timestamp}</span>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {!showAll && remaining > 0 ? (
        <button
          className={styles.showMoreButton}
          type="button"
          onClick={() => setShowAll(true)}
        >
          Show {remaining} more
        </button>
      ) : null}
    </>
  );
}

function GatewayMemoryResults({
  isSearching,
  onSelect,
  onShowMore,
  results,
  resultLimit,
  selectedMemoryId
}: {
  isSearching: boolean;
  onSelect: (memory: NormalizedMemoryResult) => void;
  onShowMore: () => void;
  results: NormalizedMemoryResult[];
  resultLimit: number;
  selectedMemoryId: string | null;
}) {
  if (isSearching && results.length === 0) {
    return <SearchSkeleton />;
  }

  if (results.length === 0) {
    return (
      <EmptyState
        compact
        title="No Gateway memory found"
        body="The read-only Gateway search returned no results for this scope."
      />
    );
  }

  const canShowMore = results.length >= resultLimit;

  return (
    <>
      <ul className={styles.resultList}>
        {results.map((memory) => (
          <li key={memory.id}>
            <button
              aria-current={selectedMemoryId === memory.id ? "true" : undefined}
              className={`${styles.resultItem} ${
                selectedMemoryId === memory.id ? styles.resultItemActive : ""
              }`}
              type="button"
              onClick={() => onSelect(memory)}
            >
              <div className={styles.resultHeader}>
                <span className={styles.resultTitle}>{memory.title ?? memory.id}</span>
                <div className={styles.resultBadges}>
                  <span className={styles.scoreBadge}>{formatScore(memory.score)}</span>
                  <LayerPill layer={memory.layer ?? memory.scopeStatus ?? "unknown"} />
                </div>
              </div>
              <div className={styles.cardBody}>{memory.snippet ?? memory.content}</div>
              <div className={styles.resultMeta}>
                <span>{memory.source ?? "Gateway"}</span>
                <span className={styles.resultMetaDot}>·</span>
                <span>evidence {memory.evidenceCount ?? 0}</span>
              </div>
              <div className={styles.resultScope}>
                {memory.projectKey ?? "project scope unknown"}
                {memory.sessionKey ? ` · ${memory.sessionKey}` : ""}
                {memory.supersessionStatus ? ` · ${memory.supersessionStatus}` : ""}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {canShowMore ? (
        <button
          className={styles.showMoreButton}
          disabled={isSearching}
          type="button"
          onClick={onShowMore}
        >
          {isSearching ? "Loading…" : "Show more"}
        </button>
      ) : null}
    </>
  );
}

function LayerPill({ layer }: { layer: string }) {
  const normalized = layer?.toLowerCase() ?? "unknown";
  return (
    <span className={styles.layerPill} data-layer={normalized}>
      {layer}
    </span>
  );
}

function SearchSkeleton() {
  return (
    <div className={styles.skeletonList} aria-label="Loading results" role="status">
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.skeletonCard}>
          <div className={styles.skeletonLine} style={{ height: 12, width: "65%" }} />
          <div className={styles.skeletonLine} style={{ height: 10, width: "90%", marginTop: 8 }} />
          <div className={styles.skeletonLine} style={{ height: 10, width: "45%", marginTop: 6 }} />
        </div>
      ))}
    </div>
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
