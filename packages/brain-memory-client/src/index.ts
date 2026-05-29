import type {
  BrainMemoryClientConfig,
  BrainMemoryError,
  BrainMemoryInspectRequest,
  BrainMemorySearchRequest,
  NormalizedBrainMemoryInspectResponse,
  NormalizedBrainMemorySearchScope,
  NormalizedBrainMemorySearchResponse,
  NormalizedBrainMemoryStatus,
  NormalizedMemoryDetail,
  NormalizedMemoryEvidence,
  NormalizedMemoryLayer,
  NormalizedMemoryResult,
  NormalizedMemoryScopeStatus,
  NormalizedMemorySupersessionChain,
  NormalizedSupersessionStatus
} from "./types";

const DEFAULT_TIMEOUT_MS = 3500;
const SEARCH_PATH = "/ui/memory/search";
const MEMORY_PATH = "/ui/memory";
const HEALTH_PATH = "/health";
const CAPABILITIES_PATH = "/ui/capabilities";

export type {
  BrainMemoryClientConfig,
  BrainMemoryError,
  BrainMemoryInspectRequest,
  BrainMemoryMode,
  BrainMemorySearchContext,
  BrainMemorySearchRequest,
  NormalizedBrainMemoryInspectResponse,
  NormalizedBrainMemorySearchScope,
  NormalizedBrainMemorySearchResponse,
  NormalizedBrainMemoryStatus,
  NormalizedMemoryDetail,
  NormalizedMemoryEvidence,
  NormalizedMemoryLayer,
  NormalizedMemoryResult,
  NormalizedMemoryScopeStatus,
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
        message: "Set BRAIN_MEMORY_GATEWAY_URL and enable real Gateway reads."
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

  const [evidenceResult, supersessionResult] = await Promise.all([
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
    })
  ]);

  let partialError: BrainMemoryError | null = null;
  if (!evidenceResult.ok) {
    partialError = evidenceResult.error;
  } else if (!supersessionResult.ok) {
    partialError = supersessionResult.error;
  }

  return {
    mode: "real",
    memoryId,
    detail: normalizeMemoryDetail(detailResult.data, memoryId),
    evidence: evidenceResult.ok ? normalizeMemoryEvidence(evidenceResult.data, memoryId) : null,
    supersession: supersessionResult.ok
      ? normalizeMemorySupersessionChain(supersessionResult.data, memoryId)
      : null,
    error: partialError,
    checkedAt
  };
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
      message:
        "Brain Memory UI API bearer is missing/invalid, or Gateway memory auth is required for this endpoint."
    };
  }

  if (status === 403) {
    return {
      kind: "forbidden",
      message:
        "Tenant-bound Gateway memory key is missing, lacks read access, or is not authorized for this tenant."
    };
  }

  if (status === 404) {
    return {
      kind: "http_error",
      message:
        "Memory is not available in the current project/session scope, or the endpoint was not found (HTTP 404)."
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
    scope: normalizeSearchScope(data)
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
