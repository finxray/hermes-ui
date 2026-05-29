"use client";

import { Database, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrainMemoryStatusPanel } from "@/components/BrainMemoryStatusPanel";
import { useBrainMemorySearch } from "@/hooks/useBrainMemorySearch";
import { WORKSPACE_STORAGE_VERSION } from "@/lib/workspaceStore";
import type {
  NormalizedBrainMemorySearchScope,
  BrainMemorySearchContext,
  NormalizedBrainMemoryStatus,
  NormalizedMemoryResult
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
  const { isSearching, lastResponse, search } = useBrainMemorySearch();
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
  }, [activeProject.id, activeProject.name, activeSession?.id, activeSession?.memoryEvidence]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      return;
    }
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
        {scope ? <ScopeSummary scope={scope} /> : null}
        {lastResponse?.error ? <div className="status-error">{lastResponse.error.message}</div> : null}
      </section>

      <section className="panel-section" aria-labelledby="memory-results-heading">
        <div className="section-label" id="memory-results-heading">
          <span>{shouldUseMock ? "Mock/local results" : "Gateway results"}</span>
          <span>{shouldUseMock ? mockResults.length : gatewayResults.length}</span>
        </div>
        {shouldUseMock ? (
          <MockMemoryResults results={mockResults} />
        ) : (
          <GatewayMemoryResults results={gatewayResults} />
        )}
      </section>
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

function MockMemoryResults({ results }: { results: MemoryEvidence[] }) {
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
        <li className="memory-card" key={memory.id}>
          <div className="card-title">
            <span>{memory.title}</span>
            <span className="pill">{memory.layer}</span>
          </div>
          <div className="card-body">{memory.excerpt}</div>
          <div className="card-meta">
            {memory.source} - mock score {memory.score} - {memory.timestamp}
          </div>
        </li>
      ))}
    </ul>
  );
}

function GatewayMemoryResults({ results }: { results: NormalizedMemoryResult[] }) {
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
        <li className="memory-card" key={memory.id}>
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
            {memory.supersessionStatus ?? "unknown"}
          </div>
        </li>
      ))}
    </ul>
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
