export type BrainMemoryMode = "real" | "mock" | "unconfigured" | "error";

export type BrainMemoryError = {
  kind:
    | "disabled"
    | "unconfigured"
    | "invalid_config"
    | "network"
    | "timeout"
    | "unauthorized"
    | "forbidden"
    | "http_error"
    | "bad_response"
    | "unknown";
  message: string;
};

export type BrainMemoryClientConfig = {
  baseUrl?: string | null;
  /**
   * Optional UI/BFF bearer gate for Brain Memory /ui/** endpoints.
   * This does not authorize tenant memory access by itself.
   */
  uiApiKey?: string | null;
  /**
   * Tenant-bound Gateway memory key sent only where Gateway memory auth is required.
   */
  gatewayMemoryApiKey?: string | null;
  /**
   * Backward-compatible alias for the old BRAIN_MEMORY_API_KEY env var.
   * Prefer uiApiKey and gatewayMemoryApiKey for new integrations.
   */
  legacyApiKey?: string | null;
  enabled?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type NormalizedBrainMemoryStatus = {
  mode: BrainMemoryMode;
  configured: boolean;
  reachable: boolean;
  baseUrl: string | null;
  health: Record<string, unknown> | null;
  capabilities: Record<string, unknown> | null;
  error: BrainMemoryError | null;
  checkedAt: string;
};

export type BrainMemorySearchContext = {
  project: {
    id: string;
    title: string;
    stableKey: string;
    tenantId: string;
    retrievalProfile: string;
    contextPolicy: string;
  };
  session: {
    id: string;
    title: string;
    stableKey: string;
    includeProjectContext: boolean;
    includeSessionContext: boolean;
  } | null;
  ui: {
    source: "hermes-ui";
    workspaceVersion: number;
  };
};

export type BrainMemorySearchRequest = {
  query: string;
  limit: number;
  context: BrainMemorySearchContext;
};

export type BrainMemoryInspectRequest = {
  memoryId: string;
  context: BrainMemorySearchContext;
};

export type LifecycleMetrics = {
  active_count: number;
  archived_count: number;
  superseded_count: number;
  deleted_soft_count: number;
  archives_24h: number;
  archives_7d: number;
  archives_lifetime: number;
  restores_24h: number;
  restores_7d: number;
  restores_lifetime: number;
  deletes_24h: number;
  deletes_7d: number;
  deletes_lifetime: number;
  supersedes_24h: number;
  supersedes_7d: number;
  supersedes_lifetime: number;
};

export type TimelineEvent = {
  audit_event_id: string;
  memory_id: string;
  tenant_id: string;
  operation: string;
  from_state: string | null;
  to_state: string;
  reason: string | null;
  caller_label: string | null;
  created_at: string;
  lifecycle_state: string | null;
  project_key?: string | null;
  session_key?: string | null;
};

export type LifecycleTimelineResponse = {
  events: TimelineEvent[];
  total: number;
  limit: number;
  offset: number;
};

export type NormalizedLifecycleMetricsResponse = {
  mode: BrainMemoryMode;
  metrics: LifecycleMetrics | null;
  error: BrainMemoryError | null;
  checkedAt: string;
};

export type NormalizedLifecycleTimelineResponse = {
  mode: BrainMemoryMode;
  events: TimelineEvent[];
  total: number;
  limit: number;
  offset: number;
  error: BrainMemoryError | null;
  checkedAt: string;
};

export type NormalizedMemoryLayer =
  | "hot"
  | "canonical"
  | "semantic"
  | "curated"
  | "raglight"
  | "unknown";

export type NormalizedSupersessionStatus = "active" | "superseded" | "unknown";

export type NormalizedMemoryScopeStatus =
  | "matching-project"
  | "matching-session"
  | "legacy-unscoped"
  | "mismatched-project"
  | "mismatched-session"
  | "unknown";

export type NormalizedBrainMemorySearchScope = {
  tenantId?: string;
  projectKey?: string;
  sessionKey?: string;
  mode?: string;
  includeLegacyUnscoped?: boolean;
  status?: string;
  legacyUnscopedExcluded?: number;
  mismatchedProjectExcluded?: number;
  mismatchedSessionExcluded?: number;
};

export type NormalizedMemoryResult = {
  id: string;
  title?: string;
  content: string;
  snippet?: string;
  layer?: NormalizedMemoryLayer;
  score?: number;
  source?: string;
  projectKey?: string;
  sessionKey?: string;
  evidenceCount?: number;
  scopeStatus?: NormalizedMemoryScopeStatus;
  supersessionStatus?: NormalizedSupersessionStatus;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
};

export type NormalizedMemoryDetail = {
  id: string;
  content: string;
  snippet?: string;
  layer?: NormalizedMemoryLayer;
  source?: string;
  projectKey?: string;
  sessionKey?: string;
  scopeStatus?: NormalizedMemoryScopeStatus;
  supersessionStatus?: NormalizedSupersessionStatus;
  evidenceCount?: number;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, unknown>;
  scope?: NormalizedBrainMemorySearchScope | null;
  lifecycleState?: string;
  archivedAt?: string;
  deletedAt?: string;
  supersedesMemoryId?: string;
  supersededByMemoryId?: string;
  auditEvents?: NormalizedMemoryLifecycleAuditEvent[];
  supersessionChain?: NormalizedMemorySupersessionChainItem[];
};

export type NormalizedMemoryLifecycleAuditEvent = {
  id: string;
  operation: string;
  fromState?: string | null;
  toState: string;
  reason?: string | null;
  callerLabel?: string | null;
  createdAt: string;
};

export type NormalizedMemorySupersessionChainItem = {
  memoryId: string;
  lifecycleState: string;
  createdAt: string;
};

export type NormalizedMemoryEvidence = {
  memoryId: string;
  evidence: unknown[];
  status?: string;
};

export type NormalizedMemorySupersessionChain = {
  memoryId: string;
  chain: unknown[];
  status?: string;
};

export type NormalizedBrainMemorySearchResponse = {
  mode: BrainMemoryMode;
  query: string;
  results: NormalizedMemoryResult[];
  scope?: NormalizedBrainMemorySearchScope | null;
  error: BrainMemoryError | null;
  searchedAt: string;
};

export type NormalizedBrainMemoryInspectResponse = {
  mode: BrainMemoryMode;
  memoryId: string;
  detail: NormalizedMemoryDetail | null;
  evidence: NormalizedMemoryEvidence | null;
  supersession: NormalizedMemorySupersessionChain | null;
  error: BrainMemoryError | null;
  checkedAt: string;
};
