"use client";

import { Database, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrainMemoryStatusPanel } from "@/components/BrainMemoryStatusPanel";
import { useMemoryInspection } from "@/hooks/useMemoryInspection";
import { useBrainMemorySearch } from "@/hooks/useBrainMemorySearch";
import { WORKSPACE_STORAGE_VERSION } from "@/lib/workspaceStore";
import type {
  NormalizedBrainMemorySearchScope,
  BrainMemorySearchContext,
  NormalizedBrainMemoryInspectResponse,
  NormalizedBrainMemoryStatus,
  NormalizedMemoryDetail,
  NormalizedMemoryEvidence,
  NormalizedMemoryResult,
  NormalizedMemorySupersessionChain
} from "@hermes-ui/brain-memory-client";
import type { MemoryEvidence, Project, Session } from "@/data/types";
import type { FormEvent } from "react";

type BrainMemoryConsoleProps = {
  activeProject: Project;
  activeSession: Session | null;
  status: NormalizedBrainMemoryStatus | null;
  isStatusLoading: boolean;
  onRefreshStatus: () => void;
};

export function BrainMemoryConsole({
  activeProject,
  activeSession,
  status,
  isStatusLoading,
  onRefreshStatus
}: BrainMemoryConsoleProps) {
  const [query, setQuery] = useState("gateway");
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

      <section className="panel-section" aria-labelledby="memory-scope-heading">
        <div className="section-label" id="memory-scope-heading">
          <span>Memory scope</span>
          <Database size={13} aria-hidden="true" />
        </div>
        <div className="summary-card">
          <div className="card-title">
            <span>{activeProject.name}</span>
            <span className="pill">read-only</span>
          </div>
          <div className="context-contract-grid">
            <ContextField label="Tenant" value={activeProject.memoryScope.tenantId} />
            <ContextField label="Project key" value={activeProject.memoryScope.stableProjectKey} />
            <ContextField
              label="Session key"
              value={activeSession?.memoryScope.stableSessionKey ?? "No active session"}
            />
            <ContextField
              label="Retrieval"
              value={activeProject.memoryScope.retrievalProfile}
            />
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

      <section className="panel-section" aria-labelledby="memory-search-heading">
        <div className="section-label" id="memory-search-heading">
          <span>Memory search</span>
          <Search size={13} aria-hidden="true" />
        </div>
        <form className="memory-search-form" onSubmit={submit}>
          <input
            aria-label="Search Brain Memory"
            className="memory-search-input"
            placeholder="Search memory in active scope"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
          <button
            className="text-button"
            type="submit"
            disabled={isSearching || query.trim().length === 0}
          >
            Search
          </button>
        </form>
        <div className="card-meta">
          Browser calls the local BFF only; the BFF calls Gateway read-only endpoints when enabled.
          Tenant search may require BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY.
        </div>
        <div className="card-meta">
          Project/session scope is enforced by Brain Memory Gateway. Legacy unscoped memories are
          excluded by default.
        </div>
        {scope ? <ScopeSummary scope={scope} /> : null}
        {lastResponse?.error ? <div className="status-error">{lastResponse.error.message}</div> : null}
      </section>

      <section className="panel-section" aria-labelledby="memory-results-heading">
        <div className="section-label" id="memory-results-heading">
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
      <div className="empty-state compact">
        <div className="empty-state-title">No mock memory matched</div>
        <p>Gateway search is not connected, so only local mock evidence is filtered.</p>
      </div>
    );
  }

  return (
    <ul className="memory-list">
      {results.map((memory) => (
        <li key={memory.id}>
          <button
            aria-current={selectedMemoryId === memory.id ? "true" : undefined}
            className={`memory-card memory-card-button${selectedMemoryId === memory.id ? " is-active" : ""}`}
            type="button"
            onClick={() => onSelect(memory)}
          >
            <div className="card-title">
              <span>{memory.title}</span>
              <span className="pill">{memory.layer}</span>
            </div>
            <div className="card-body">{memory.excerpt}</div>
            <div className="card-meta">
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
      <div className="empty-state compact">
        <div className="empty-state-title">No Gateway memory found</div>
        <p>The read-only Gateway search returned no results for this scope.</p>
      </div>
    );
  }

  return (
    <ul className="memory-list">
      {results.map((memory) => (
        <li key={memory.id}>
          <button
            aria-current={selectedMemoryId === memory.id ? "true" : undefined}
            className={`memory-card memory-card-button${selectedMemoryId === memory.id ? " is-active" : ""}`}
            type="button"
            onClick={() => onSelect(memory)}
          >
            <div className="card-title">
              <span>{memory.title ?? memory.id}</span>
              <span className="pill">{memory.scopeStatus ?? memory.layer ?? "unknown"}</span>
            </div>
            <div className="card-body">{memory.snippet ?? memory.content}</div>
            <div className="card-meta">
              {memory.source ?? "Gateway"} - score {formatScore(memory.score)} - evidence{" "}
              {memory.evidenceCount ?? 0}
            </div>
            <div className="card-meta">
              {memory.projectKey ?? "project scope unknown"} -{" "}
              {memory.sessionKey ?? "project memory"} - {memory.supersessionStatus ?? "unknown"}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MemoryDetailPanel({
  inspection,
  isInspecting,
  mockDetail,
  onClose
}: {
  inspection: NormalizedBrainMemoryInspectResponse | null;
  isInspecting: boolean;
  mockDetail: MemoryEvidence | null;
  onClose: () => void;
}) {
  const detail = inspection?.detail ?? null;

  return (
    <section className="panel-section" aria-labelledby="memory-detail-heading">
      <div className="section-label" id="memory-detail-heading">
        <span>Memory detail</span>
        <button
          aria-label="Close memory detail"
          className="icon-button subtle"
          type="button"
          onClick={onClose}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {isInspecting ? (
        <div className="summary-card memory-detail-panel">
          <div className="card-title">
            <span>Loading memory</span>
            <span className="pill">read-only</span>
          </div>
          <div className="card-body">Fetching scoped detail through the local BFF.</div>
        </div>
      ) : null}

      {!isInspecting && inspection?.error ? (
        <div className="status-error">{inspection.error.message}</div>
      ) : null}

      {!isInspecting && mockDetail ? <MockMemoryDetail memory={mockDetail} /> : null}

      {!isInspecting && detail ? (
        <GatewayMemoryDetail
          detail={detail}
          evidence={inspection?.evidence ?? null}
          supersession={inspection?.supersession ?? null}
        />
      ) : null}
    </section>
  );
}

function MockMemoryDetail({ memory }: { memory: MemoryEvidence }) {
  return (
    <div className="summary-card memory-detail-panel">
      <div className="card-title">
        <span>{memory.title}</span>
        <span className="pill">mock/local</span>
      </div>
      <div className="memory-detail-content">{memory.excerpt}</div>
      <div className="context-contract-grid">
        <ContextField label="Memory id" value={memory.id} />
        <ContextField label="Layer" value={memory.layer} />
        <ContextField label="Source" value={memory.source} />
        <ContextField label="Timestamp" value={memory.timestamp} />
      </div>
      <div className="card-meta">
        Gateway detail is unavailable in mock mode; this is local demo evidence only.
      </div>
    </div>
  );
}

function GatewayMemoryDetail({
  detail,
  evidence,
  supersession
}: {
  detail: NormalizedMemoryDetail;
  evidence: NormalizedMemoryEvidence | null;
  supersession: NormalizedMemorySupersessionChain | null;
}) {
  return (
    <div className="summary-card memory-detail-panel">
      <div className="card-title">
        <span>{detail.id}</span>
        <span className="pill">{detail.scopeStatus ?? "scoped"}</span>
      </div>
      <div className="memory-detail-content">{detail.content}</div>
      {detail.snippet ? <div className="card-body">Snippet: {detail.snippet}</div> : null}
      <div className="context-contract-grid">
        <ContextField label="Memory id" value={detail.id} />
        <ContextField label="Layer" value={detail.layer ?? "unknown"} />
        <ContextField label="Source" value={detail.source ?? "Gateway"} />
        <ContextField label="Project key" value={detail.projectKey ?? "unknown"} />
        <ContextField label="Session key" value={detail.sessionKey ?? "project-level"} />
        <ContextField label="Supersession" value={detail.supersessionStatus ?? "unknown"} />
        <ContextField label="Evidence count" value={String(detail.evidenceCount ?? 0)} />
        <ContextField label="Created" value={detail.createdAt ?? "unknown"} />
        <ContextField label="Updated" value={detail.updatedAt ?? "unknown"} />
      </div>
      {detail.scope ? <ScopeSummary scope={detail.scope} /> : null}
      <ReadOnlyStatusSection
        label="Evidence"
        status={evidence?.status}
        emptyText="Evidence storage is not implemented yet."
        count={evidence?.evidence.length ?? 0}
      />
      <ReadOnlyStatusSection
        label="Supersession chain"
        status={supersession?.status}
        emptyText="Supersession chain storage is not implemented yet."
        count={supersession?.chain.length ?? 0}
      />
      {detail.metadata ? (
        <details className="memory-metadata">
          <summary>Metadata</summary>
          <pre>{JSON.stringify(detail.metadata, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function ReadOnlyStatusSection({
  count,
  emptyText,
  label,
  status
}: {
  count: number;
  emptyText: string;
  label: string;
  status?: string;
}) {
  return (
    <div className="memory-readonly-section">
      <div className="card-title">
        <span>{label}</span>
        <span className="pill">{status ?? "unknown"}</span>
      </div>
      <div className="card-body">
        {status === "not_implemented" || count === 0
          ? emptyText
          : `${count} read-only item${count === 1 ? "" : "s"} available.`}
      </div>
    </div>
  );
}

function ScopeSummary({ scope }: { scope: NormalizedBrainMemorySearchScope }) {
  const excluded = scope.legacyUnscopedExcluded ?? 0;
  const mismatchedProject = scope.mismatchedProjectExcluded ?? 0;
  const mismatchedSession = scope.mismatchedSessionExcluded ?? 0;

  return (
    <div className="card-meta">
      Scope: {scope.status ?? "unknown"} / {scope.mode ?? "project"} for{" "}
      {scope.projectKey ?? "project"}.
      {excluded > 0 ? ` Legacy/unscoped excluded: ${excluded}.` : ""}
      {mismatchedProject > 0 ? ` Project mismatches excluded: ${mismatchedProject}.` : ""}
      {mismatchedSession > 0 ? ` Session mismatches excluded: ${mismatchedSession}.` : ""}
    </div>
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

function formatScore(score: number | undefined) {
  return typeof score === "number" ? score.toFixed(2) : "n/a";
}
