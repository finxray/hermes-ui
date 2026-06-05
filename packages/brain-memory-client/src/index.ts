import type {
  BrainMemoryClientConfig,
  BrainMemoryError,
  BrainMemoryInspectRequest,
  BrainMemorySearchRequest,
  LifecycleMetrics,
  LifecycleTimelineResponse,
  NormalizedBrainMemoryInspectResponse,
  NormalizedBrainMemorySearchScope,
  NormalizedBrainMemorySearchResponse,
  NormalizedBrainMemoryStatus,
  NormalizedMemoryDetail,
  NormalizedMemoryEvidence,
  NormalizedMemoryLifecycleAuditEvent,
  NormalizedMemoryLayer,
  NormalizedMemoryResult,
  NormalizedMemoryScopeStatus,
  NormalizedMemorySupersessionChainItem,
  NormalizedMemorySupersessionChain,
  NormalizedSupersessionStatus
} from "./types";

const DEFAULT_TIMEOUT_MS = 3500;
const SEARCH_PATH = "/ui/memory/search";
const MEMORY_PATH = "/ui/memory";
const LIFECYCLE_METRICS_PATH = "/v1/memory/lifecycle/metrics";
const LIFECYCLE_TIMELINE_PATH = "/v1/memory/lifecycle/timeline";
const HEALTH_PATH = "/health";
const CAPABILITIES_PATH = "/ui/capabilities";

export type {
  BrainMemoryClientConfig,
  BrainMemoryError,
  BrainMemoryInspectRequest,
  BrainMemoryMode,
  BrainMemorySearchContext,
  BrainMemorySearchRequest,
  LifecycleMetrics,
  LifecycleTimelineResponse,
  TimelineEvent,
  NormalizedBrainMemoryInspectResponse,
  NormalizedBrainMemorySearchScope,
  NormalizedBrainMemorySearchResponse,
  NormalizedBrainMemoryStatus,
  NormalizedMemoryDetail,
  NormalizedMemoryEvidence,
  NormalizedMemoryLifecycleAuditEvent,
  NormalizedMemoryLayer,
  NormalizedMemoryResult,
  NormalizedMemoryScopeStatus,
  NormalizedMemorySupersessionChainItem,
  NormalizedMemorySupersessionChain,
  NormalizedSupersessionStatus
} from "./types";

export async function getBrainMemoryStatus(
  config: BrainMemoryClientConfig
): Promise<NormalizedBrainMemoryStatus> {
  const checkedAt = new Date().toISOString();

  if (config.enabled === false) {
    return {
      mode: "mock",
      configured: false,
      reachable: false,
      baseUrl: null,
      health: null,
      capabilities: null,
      error: {
        kind: "disabled",
        message: "Real Brain Memory Gateway checks are disabled for this UI process."
      },
      checkedAt
    };
  }

  if (!config.baseUrl?.trim()) {
    return {
      mode: "unconfigured",
      configured: false,
      reachable: false,
      baseUrl: null,
      health: null,
      capabilities: null,
      error: {
        kind: "unconfigured",
        message: "Set BRAIN_MEMORY_GATEWAY_URL and enable real Gateway checks to inspect memory."
      },
      checkedAt
    };
  }

  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return {
      mode: "error",
      configured: true,
      reachable: false,
      baseUrl: null,
      health: null,
      capabilities: null,
      error: {
        kind: "invalid_config",
        message: "BRAIN_MEMORY_GATEWAY_URL must be a valid http:// or https:// URL."
      },
      checkedAt
    };
  }

  const result = await fetchGatewayJson({
    base,
    fetchImpl: config.fetchImpl ?? fetch,
    method: "GET",
    path: HEALTH_PATH,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    uiApiKey: resolveUiApiKey(config)
  });

  if (!result.ok) {
    return {
      mode: "error",
      configured: true,
      reachable: false,
      baseUrl: safeDisplayUrl(base),
      health: null,
      capabilities: null,
      error: result.error,
      checkedAt
    };
  }

  const capabilitiesResult = await fetchGatewayJson({
    base,
    fetchImpl: config.fetchImpl ?? fetch,
    method: "GET",
    path: CAPABILITIES_PATH,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    uiApiKey: resolveUiApiKey(config)
  });

  return {
    mode: "real",
    configured: true,
    reachable: true,
    baseUrl: safeDisplayUrl(base),
    health: result.data,
    capabilities: capabilitiesResult.ok ? extractCapabilities(capabilitiesResult.data) : null,
    error: null,
    checkedAt
  };
}

export async function searchBrainMemory(
  config: BrainMemoryClientConfig,
  request: BrainMemorySearchRequest
): Promise<NormalizedBrainMemorySearchResponse> {
  const searchedAt = new Date().toISOString();
  const query = request.query.trim().slice(0, 512);
  const limit = clampLimit(request.limit);

  if (!query) {
    return {
      mode: "error",
      query,
      results: [],
      scope: null,
      error: {
        kind: "bad_response",
        message: "Memory search query is required."
      },
      searchedAt
    };
  }

  if (config.enabled === false) {
    return {
      mode: "mock",
      query,
      results: [],
      scope: null,
      error: {
        kind: "disabled",
        message: "Real Brain Memory Gateway search is disabled; using local mock evidence."
      },
      searchedAt
    };
  }

  if (!config.baseUrl?.trim()) {
    return {
      mode: "unconfigured",
      query,
      results: [],
      scope: null,
      error: {
        kind: "unconfigured",
        message: "Set BRAIN_MEMORY_GATEWAY_URL and enable real Gateway search."
      },
      searchedAt
    };
  }

  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return {
      mode: "error",
      query,
      results: [],
      scope: null,
      error: {
        kind: "invalid_config",
        message: "BRAIN_MEMORY_GATEWAY_URL must be a valid http:// or https:// URL."
      },
      searchedAt
    };
  }

  const body = {
    context: request.context,
    context_policy: request.context.project.contextPolicy,
    include_evidence_summary: true,
    limit,
    project_id: request.context.project.id,
    query,
    retrieval_profile: request.context.project.retrievalProfile,
    session_id: request.context.session?.id,
    tenant_id: request.context.project.tenantId
  };

  let result = await fetchGatewayJson({
    base,
    body,
    fetchImpl: config.fetchImpl ?? fetch,
    gatewayMemoryApiKey: config.gatewayMemoryApiKey,
    method: "POST",
    path: SEARCH_PATH,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    uiApiKey: resolveUiApiKey(config)
  });

  if (!result.ok && shouldTryGetSearchFallback(result.error)) {
    result = await fetchGatewayJson({
      base,
      fetchImpl: config.fetchImpl ?? fetch,
      gatewayMemoryApiKey: config.gatewayMemoryApiKey,
      method: "GET",
      path: buildSearchFallbackPath(request, query, limit),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      uiApiKey: resolveUiApiKey(config)
    });
  }

  if (!result.ok) {
    return {
      mode: "error",
      query,
      results: [],
      scope: null,
      error: result.error,
      searchedAt
    };
  }

  return {
    mode: "real",
    query,
    results: normalizeSearchResults(result.data).slice(0, limit),
    scope: normalizeSearchScope(result.data),
    error: null,
    searchedAt
  };
}

export async function inspectBrainMemory(
  config: BrainMemoryClientConfig,
  request: BrainMemoryInspectRequest
): Promise<NormalizedBrainMemoryInspectResponse> {
  const checkedAt = new Date().toISOString();
  const memoryId = request.memoryId.trim().slice(0, 256);

  if (!memoryId) {
    return {
      mode: "error",
      memoryId,
      detail: null,
      evidence: null,
      supersession: null,
      error: {
        kind: "bad_response",
        message: "Memory id is required."
      },
      checkedAt
    };
  }

  if (config.enabled === false) {
    return {
      mode: "mock",
      memoryId,
      detail: null,
      evidence: null,
      supersession: null,
      error: {
        kind: "disabled",
        message: "Real Brain Memory Gateway inspection is disabled."
      },
      checkedAt
    };
  }

  if (!config.baseUrl?.trim()) {
    return {
      mode: "unconfigured",
      memoryId,
      detail: null,
      evidence: null,
      supersession: null,
      error: {
        kind: "unconfigured",
        message: "Brain Memory Gateway is not configured. Showing local/mock memory only."
      },
      checkedAt
    };
  }

  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    return {
      mode: "error",
      memoryId,
      detail: null,
      evidence: null,
      supersession: null,
      error: {
        kind: "invalid_config",
        message: "BRAIN_MEMORY_GATEWAY_URL must be a valid http:// or https:// URL."
      },
      checkedAt
    };
  }

  const detailResult = await fetchGatewayJson({
    base,
    fetchImpl: config.fetchImpl ?? fetch,
    gatewayMemoryApiKey: config.gatewayMemoryApiKey,
    method: "GET",
    path: buildMemoryReadPath(request, memoryId),
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    uiApiKey: resolveUiApiKey(config)
  });

  if (!detailResult.ok) {
    return {
      mode: "error",
      memoryId,
      detail: null,
      evidence: null,
      supersession: null,
      error: detailResult.error,
      checkedAt
    };
  }

  const [evidenceResult, supersessionResult, lifecycleResult] = await Promise.all([
    fetchGatewayJson({
      base,
      fetchImpl: config.fetchImpl ?? fetch,
      gatewayMemoryApiKey: config.gatewayMemoryApiKey,
      method: "GET",
      path: buildMemoryReadPath(request, `${memoryId}/evidence`),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      uiApiKey: resolveUiApiKey(config)
    }),
    fetchGatewayJson({
      base,
      fetchImpl: config.fetchImpl ?? fetch,
      gatewayMemoryApiKey: config.gatewayMemoryApiKey,
      method: "GET",
      path: buildMemoryReadPath(request, `${memoryId}/supersession-chain`),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      uiApiKey: resolveUiApiKey(config)
    }),
    fetchGatewayJson({
      base,
      fetchImpl: config.fetchImpl ?? fetch,
      gatewayMemoryApiKey: config.gatewayMemoryApiKey,
      method: "GET",
      path: buildLifecycleInspectPath(request, memoryId),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      uiApiKey: resolveUiApiKey(config)
    })
  ]);

  let partialError: BrainMemoryError | null = null;
  if (!evidenceResult.ok) {
    partialError = evidenceResult.error;
  } else if (!supersessionResult.ok) {
    partialError = supersessionResult.error;
  }

  const uiDetail = normalizeMemoryDetail(detailResult.data, memoryId);
  const lifecycleDetail = lifecycleResult.ok
    ? normalizeMemoryDetail(lifecycleResult.data, memoryId)
    : null;

  return {
    mode: "real",
    memoryId,
    detail: mergeMemoryDetails(uiDetail, lifecycleDetail),
    evidence: evidenceResult.ok ? normalizeMemoryEvidence(evidenceResult.data, memoryId) : null,
    supersession: supersessionResult.ok
      ? normalizeMemorySupersessionChain(supersessionResult.data, memoryId)
      : null,
    error: partialError,
    checkedAt
  };
}

export async function fetchLifecycleMetrics(
  config: BrainMemoryClientConfig,
  tenantId?: string
): Promise<LifecycleMetrics> {
  const base = resolveRequiredGatewayBase(config);
  const path = tenantId?.trim()
    ? `${LIFECYCLE_METRICS_PATH}?${new URLSearchParams({ tenant_id: tenantId.trim() }).toString()}`
    : LIFECYCLE_METRICS_PATH;
  const result = await fetchGatewayJson({
    base,
    fetchImpl: config.fetchImpl ?? fetch,
    gatewayMemoryApiKey: config.gatewayMemoryApiKey,
    method: "GET",
    path,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    uiApiKey: resolveUiApiKey(config)
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return normalizeLifecycleMetrics(result.data);
}

export async function fetchLifecycleTimeline(
  config: BrainMemoryClientConfig,
  params?: { limit?: number; offset?: number; operation?: string }
): Promise<LifecycleTimelineResponse> {
  const base = resolveRequiredGatewayBase(config);
  const query = new URLSearchParams({
    limit: String(clampTimelineLimit(params?.limit)),
    offset: String(clampOffset(params?.offset))
  });
  const operation = params?.operation?.trim();
  if (operation) {
    query.set("operation", operation.slice(0, 256));
  }

  const result = await fetchGatewayJson({
    base,
    fetchImpl: config.fetchImpl ?? fetch,
    gatewayMemoryApiKey: config.gatewayMemoryApiKey,
    method: "GET",
    path: `${LIFECYCLE_TIMELINE_PATH}?${query.toString()}`,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    uiApiKey: resolveUiApiKey(config)
  });

  if (!result.ok) {
    throw new Error(result.error.message);
  }

  return normalizeLifecycleTimeline(result.data);
}

function parseBaseUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function resolveRequiredGatewayBase(config: BrainMemoryClientConfig): URL {
  if (config.enabled === false) {
    throw new Error("Real Brain Memory Gateway reads are disabled for this UI process.");
  }
  if (!config.baseUrl?.trim()) {
    throw new Error("Set BRAIN_MEMORY_GATEWAY_URL and enable real Gateway reads.");
  }
  const base = parseBaseUrl(config.baseUrl);
  if (!base) {
    throw new Error("BRAIN_MEMORY_GATEWAY_URL must be a valid http:// or https:// URL.");
  }
  return base;
}

function safeDisplayUrl(url: URL): string {
  const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return `${url.origin}${pathname}`;
}

function buildEndpointUrl(base: URL, path: string): string {
  const root = base.href.endsWith("/") ? base.href : `${base.href}/`;
  return new URL(path.replace(/^\//, ""), root).toString();
}

function resolveUiApiKey(config: BrainMemoryClientConfig): string | null {
  return cleanOptionalSecret(config.uiApiKey) ?? cleanOptionalSecret(config.legacyApiKey) ?? null;
}

function cleanOptionalSecret(value?: string | null): string | null {
  const cleanValue = value?.trim();
  return cleanValue ? cleanValue : null;
}

function applyGatewayAuth(
  headers: Headers,
  auth: { gatewayMemoryApiKey?: string | null; uiApiKey?: string | null }
) {
  const uiApiKey = cleanOptionalSecret(auth.uiApiKey);
  const gatewayMemoryApiKey = cleanOptionalSecret(auth.gatewayMemoryApiKey);
  if (uiApiKey) {
    headers.set("Authorization", `Bearer ${uiApiKey}`);
  }
  if (gatewayMemoryApiKey) {
    headers.set("X-Gateway-Memory-Api-Key", gatewayMemoryApiKey);
  }
}

async function fetchGatewayJson(args: {
  base: URL;
  body?: Record<string, unknown>;
  fetchImpl: typeof fetch;
  gatewayMemoryApiKey?: string | null;
  method: "GET" | "POST";
  path: string;
  timeoutMs: number;
  uiApiKey?: string | null;
}): Promise<
  | { ok: true; data: Record<string, unknown> | null }
  | { ok: false; error: BrainMemoryError }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const headers = new Headers({ Accept: "application/json" });
  applyGatewayAuth(headers, {
    gatewayMemoryApiKey: args.gatewayMemoryApiKey,
    uiApiKey: args.uiApiKey
  });

  if (args.method === "POST") {
    headers.set("Content-Type", "application/json");
  }

  try {
    const response = await args.fetchImpl(buildEndpointUrl(args.base, args.path), {
      body: args.body ? JSON.stringify(args.body) : undefined,
      cache: "no-store",
      headers,
      method: args.method,
      signal: controller.signal
    });
    const data = await readJsonObject(response);

    if (!response.ok) {
      return {
        ok: false,
        error: normalizeHttpError(args.path, response.status)
      };
    }

    return { ok: true, data };
  } catch (error) {
    return {
      ok: false,
      error: normalizeFetchError(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeHttpError(path: string, status: number): BrainMemoryError {
  if (status === 400) {
    return {
      kind: "bad_response",
      message:
        "Brain Memory rejected the request context or memory id for this read (HTTP 400)."
    };
  }

  if (status === 401) {
    return {
      kind: "unauthorized",
      message: "Brain Memory UI API bearer is required or invalid."
    };
  }

  if (status === 403) {
    return {
      kind: "forbidden",
      message: "Tenant key is not authorized for this memory scope."
    };
  }

  if (status === 404) {
    return {
      kind: "http_error",
      message: "Memory is not available in the current project/session scope (HTTP 404)."
    };
  }

  return {
    kind: "http_error",
    message: `${path} returned HTTP ${status}.`
  };
}

async function readJsonObject(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const data = (await response.json()) as unknown;
    return data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeFetchError(error: unknown): BrainMemoryError {
  if (error instanceof Error && error.name === "AbortError") {
    return {
      kind: "timeout",
      message: "Timed out while contacting Brain Memory Gateway."
    };
  }

  return {
    kind: "network",
    message: "Could not reach Brain Memory Gateway at the configured base URL."
  };
}

function shouldTryGetSearchFallback(error: BrainMemoryError): boolean {
  return error.kind === "http_error" && /HTTP (404|405)/.test(error.message);
}

function buildSearchFallbackPath(
  request: BrainMemorySearchRequest,
  query: string,
  limit: number
): string {
  const params = new URLSearchParams({
    limit: String(limit),
    project_id: request.context.project.id,
    q: query,
    tenant_id: request.context.project.tenantId
  });
  if (request.context.session?.id) {
    params.set("session_id", request.context.session.id);
  }
  return `${SEARCH_PATH}?${params.toString()}`;
}

function buildMemoryReadPath(request: BrainMemoryInspectRequest, memoryPath: string): string {
  const params = new URLSearchParams({
    includeSessionContext: String(request.context.session?.includeSessionContext ?? true),
    projectId: request.context.project.id,
    projectKey: request.context.project.stableKey,
    projectTitle: request.context.project.title,
    tenantId: request.context.project.tenantId
  });
  if (request.context.session?.id) {
    params.set("sessionId", request.context.session.id);
  }
  if (request.context.session?.stableKey) {
    params.set("sessionKey", request.context.session.stableKey);
  }
  if (request.context.session?.title) {
    params.set("sessionTitle", request.context.session.title);
  }

  return `${MEMORY_PATH}/${memoryPath.split("/").map(encodeURIComponent).join("/")}?${params.toString()}`;
}

function buildLifecycleInspectPath(request: BrainMemoryInspectRequest, memoryId: string): string {
  const params = new URLSearchParams({
    include_audit: "true",
    tenant_id: request.context.project.tenantId
  });
  return `/v1/memory/${encodeURIComponent(memoryId)}?${params.toString()}`;
}

function extractCapabilities(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (data?.features && typeof data.features === "object" && !Array.isArray(data.features)) {
    return data as Record<string, unknown>;
  }

  const capabilities = data?.capabilities;
  return capabilities && typeof capabilities === "object" && !Array.isArray(capabilities)
    ? (capabilities as Record<string, unknown>)
    : null;
}

function normalizeSearchResults(data: Record<string, unknown> | null): NormalizedMemoryResult[] {
  const rawResults = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.results)
      ? data.results
      : [];

  return rawResults
    .map((item, index) => normalizeSearchResult(item, index))
    .filter((item): item is NormalizedMemoryResult => Boolean(item));
}

function normalizeSearchScope(data: Record<string, unknown> | null): NormalizedBrainMemorySearchScope | null {
  const scope = data?.scope;
  if (!scope || typeof scope !== "object" || Array.isArray(scope)) {
    return null;
  }

  const item = scope as Record<string, unknown>;
  return {
    tenantId: asOptionalString(item.tenantId) ?? asOptionalString(item.tenant_id),
    projectKey: asOptionalString(item.projectKey) ?? asOptionalString(item.project_key),
    sessionKey: asOptionalString(item.sessionKey) ?? asOptionalString(item.session_key),
    mode: asOptionalString(item.mode),
    includeLegacyUnscoped: asBoolean(item.includeLegacyUnscoped ?? item.include_legacy_unscoped),
    status: asOptionalString(item.status),
    legacyUnscopedExcluded:
      asInteger(item.legacyUnscopedExcluded) ?? asInteger(item.legacy_unscoped_excluded),
    mismatchedProjectExcluded:
      asInteger(item.mismatchedProjectExcluded) ?? asInteger(item.mismatched_project_excluded),
    mismatchedSessionExcluded:
      asInteger(item.mismatchedSessionExcluded) ?? asInteger(item.mismatched_session_excluded)
  };
}

function normalizeSearchResult(value: unknown, index: number): NormalizedMemoryResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Record<string, unknown>;
  const id = asString(item.id) || asString(item.memory_id) || `memory-result-${index + 1}`;
  const content =
    asString(item.content) ||
    asString(item.content_preview) ||
    asString(item.snippet) ||
    asString(item.excerpt);

  if (!content) {
    return null;
  }

  return {
    id,
    title: asOptionalString(item.title),
    content,
    snippet: asOptionalString(item.snippet) ?? asOptionalString(item.content_preview),
    layer: normalizeLayer(item.layer),
    score: asNumber(item.score),
    source: asOptionalString(item.source) ?? asOptionalString(item.source_label),
    projectKey: asOptionalString(item.project_key) ?? asOptionalString(item.projectKey),
    sessionKey: asOptionalString(item.session_key) ?? asOptionalString(item.sessionKey),
    evidenceCount: asInteger(item.evidence_count) ?? asInteger(item.evidenceCount),
    scopeStatus: normalizeScopeStatus(item.scope_status ?? item.scopeStatus ?? metadataField(item.metadata, "scopeStatus")),
    supersessionStatus: normalizeSupersessionStatus(
      item.supersession_status ?? item.supersessionStatus
    ),
    createdAt: asOptionalString(item.created_at) ?? asOptionalString(item.createdAt),
    updatedAt: asOptionalString(item.updated_at) ?? asOptionalString(item.updatedAt),
    metadata: normalizeMetadata(item.metadata)
  };
}

function normalizeMemoryDetail(
  data: Record<string, unknown> | null,
  fallbackId: string
): NormalizedMemoryDetail | null {
  const item = unwrapMemoryDetail(data);
  if (!item) {
    return null;
  }

  const id = asString(item.id) || asString(item.memory_id) || fallbackId;
  const content =
    asString(item.content) ||
    asString(item.full_content) ||
    asString(item.content_text) ||
    asString(item.snippet);

  if (!id || !content) {
    return null;
  }

  return {
    id,
    content,
    snippet: asOptionalString(item.snippet) ?? asOptionalString(item.content_preview),
    layer: normalizeLayer(item.layer),
    source: asOptionalString(item.source) ?? asOptionalString(item.source_label),
    projectKey: asOptionalString(item.project_key) ?? asOptionalString(item.projectKey),
    sessionKey: asOptionalString(item.session_key) ?? asOptionalString(item.sessionKey),
    scopeStatus: normalizeScopeStatus(
      item.scope_status ?? item.scopeStatus ?? metadataField(item.metadata, "scopeStatus")
    ),
    supersessionStatus: normalizeSupersessionStatus(
      item.supersession_status ?? item.supersessionStatus
    ),
    evidenceCount: asInteger(item.evidence_count) ?? asInteger(item.evidenceCount),
    createdAt: asOptionalString(item.created_at) ?? asOptionalString(item.createdAt),
    updatedAt: asOptionalString(item.updated_at) ?? asOptionalString(item.updatedAt),
    metadata: normalizeMetadata(item.metadata),
    scope: normalizeSearchScope(data),
    lifecycleState: asOptionalString(item.lifecycle_state) ?? asOptionalString(item.lifecycleState),
    archivedAt: asOptionalString(item.archived_at) ?? asOptionalString(item.archivedAt),
    deletedAt: asOptionalString(item.deleted_at) ?? asOptionalString(item.deletedAt),
    supersedesMemoryId:
      asOptionalString(item.supersedes_memory_id) ?? asOptionalString(item.supersedesMemoryId),
    supersededByMemoryId:
      asOptionalString(item.superseded_by_memory_id) ?? asOptionalString(item.supersededByMemoryId),
    auditEvents: normalizeAuditEvents(item.audit_events ?? item.auditEvents),
    supersessionChain: normalizeSupersessionItems(
      item.supersession_chain ?? item.supersessionChain
    )
  };
}

function unwrapMemoryDetail(data: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!data) {
    return null;
  }

  const candidates = [data.memory, data.detail, data.data, data];
  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }
  return null;
}

function normalizeMemoryEvidence(
  data: Record<string, unknown> | null,
  fallbackId: string
): NormalizedMemoryEvidence {
  const evidence = Array.isArray(data?.evidence) ? data.evidence : [];
  return {
    memoryId: asString(data?.memoryId) || asString(data?.memory_id) || fallbackId,
    evidence,
    status: asOptionalString(data?.status)
  };
}

function normalizeMemorySupersessionChain(
  data: Record<string, unknown> | null,
  fallbackId: string
): NormalizedMemorySupersessionChain {
  const chain = Array.isArray(data?.chain) ? data.chain : [];
  return {
    memoryId: asString(data?.memoryId) || asString(data?.memory_id) || fallbackId,
    chain,
    status: asOptionalString(data?.status)
  };
}

function mergeMemoryDetails(
  primary: NormalizedMemoryDetail | null,
  lifecycle: NormalizedMemoryDetail | null
): NormalizedMemoryDetail | null {
  if (!primary) {
    return lifecycle;
  }
  if (!lifecycle) {
    return primary;
  }
  return {
    ...primary,
    archivedAt: lifecycle.archivedAt ?? primary.archivedAt,
    auditEvents: lifecycle.auditEvents ?? primary.auditEvents,
    deletedAt: lifecycle.deletedAt ?? primary.deletedAt,
    lifecycleState: lifecycle.lifecycleState ?? primary.lifecycleState,
    supersededByMemoryId: lifecycle.supersededByMemoryId ?? primary.supersededByMemoryId,
    supersedesMemoryId: lifecycle.supersedesMemoryId ?? primary.supersedesMemoryId,
    supersessionChain: lifecycle.supersessionChain ?? primary.supersessionChain
  };
}

function normalizeLifecycleMetrics(data: Record<string, unknown> | null): LifecycleMetrics {
  return {
    active_count: asInteger(data?.active_count) ?? 0,
    archived_count: asInteger(data?.archived_count) ?? 0,
    superseded_count: asInteger(data?.superseded_count) ?? 0,
    deleted_soft_count: asInteger(data?.deleted_soft_count) ?? 0,
    archives_24h: asInteger(data?.archives_24h) ?? 0,
    archives_7d: asInteger(data?.archives_7d) ?? 0,
    archives_lifetime: asInteger(data?.archives_lifetime) ?? 0,
    restores_24h: asInteger(data?.restores_24h) ?? 0,
    restores_7d: asInteger(data?.restores_7d) ?? 0,
    restores_lifetime: asInteger(data?.restores_lifetime) ?? 0,
    deletes_24h: asInteger(data?.deletes_24h) ?? 0,
    deletes_7d: asInteger(data?.deletes_7d) ?? 0,
    deletes_lifetime: asInteger(data?.deletes_lifetime) ?? 0,
    supersedes_24h: asInteger(data?.supersedes_24h) ?? 0,
    supersedes_7d: asInteger(data?.supersedes_7d) ?? 0,
    supersedes_lifetime: asInteger(data?.supersedes_lifetime) ?? 0
  };
}

function normalizeLifecycleTimeline(data: Record<string, unknown> | null): LifecycleTimelineResponse {
  const events = Array.isArray(data?.events)
    ? data.events
        .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : null))
        .filter((item): item is Record<string, unknown> => Boolean(item))
        .map((item) => ({
          audit_event_id: asString(item.audit_event_id),
          memory_id: asString(item.memory_id),
          tenant_id: asString(item.tenant_id),
          operation: asString(item.operation),
          from_state: asOptionalString(item.from_state) ?? null,
          to_state: asString(item.to_state),
          reason: asOptionalString(item.reason) ?? null,
          caller_label: asOptionalString(item.caller_label) ?? null,
          created_at: asString(item.created_at),
          lifecycle_state: asOptionalString(item.lifecycle_state) ?? null,
          project_key: asOptionalString(item.project_key) ?? null,
          session_key: asOptionalString(item.session_key) ?? null
        }))
        .filter((item) => item.audit_event_id && item.memory_id && item.operation && item.created_at)
    : [];

  return {
    events,
    total: asInteger(data?.total) ?? events.length,
    limit: asInteger(data?.limit) ?? events.length,
    offset: asInteger(data?.offset) ?? 0
  };
}

function normalizeAuditEvents(value: unknown): NormalizedMemoryLifecycleAuditEvent[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      id: asString(item.id),
      operation: asString(item.operation),
      fromState: asOptionalString(item.from_state) ?? asOptionalString(item.fromState) ?? null,
      toState: asString(item.to_state) || asString(item.toState),
      reason: asOptionalString(item.reason) ?? null,
      callerLabel: asOptionalString(item.caller_label) ?? asOptionalString(item.callerLabel) ?? null,
      createdAt: asString(item.created_at) || asString(item.createdAt)
    }))
    .filter((item) => item.id && item.operation && item.toState && item.createdAt);
}

function normalizeSupersessionItems(value: unknown): NormalizedMemorySupersessionChainItem[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .map((item) => (item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : null))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      memoryId: asString(item.memory_id) || asString(item.memoryId),
      lifecycleState: asString(item.lifecycle_state) || asString(item.lifecycleState),
      createdAt: asString(item.created_at) || asString(item.createdAt)
    }))
    .filter((item) => item.memoryId && item.lifecycleState && item.createdAt);
}

function metadataField(metadata: unknown, key: string): unknown {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)[key]
    : undefined;
}

function normalizeLayer(value: unknown): NormalizedMemoryLayer {
  if (
    value === "hot" ||
    value === "canonical" ||
    value === "semantic" ||
    value === "curated" ||
    value === "raglight"
  ) {
    return value;
  }
  return "unknown";
}

function normalizeSupersessionStatus(value: unknown): NormalizedSupersessionStatus {
  if (value === "active" || value === "superseded") {
    return value;
  }
  return "unknown";
}

function normalizeScopeStatus(value: unknown): NormalizedMemoryScopeStatus {
  if (
    value === "matching-project" ||
    value === "matching-session" ||
    value === "legacy-unscoped" ||
    value === "mismatched-project" ||
    value === "mismatched-session"
  ) {
    return value;
  }
  return "unknown";
}

function normalizeMetadata(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function clampLimit(value: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), 1), 20) : 8;
}

function clampTimelineLimit(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(Math.trunc(value), 1), 200)
    : 50;
}

function clampOffset(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(Math.trunc(value), 0)
    : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown): string | undefined {
  const stringValue = asString(value);
  return stringValue || undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}
