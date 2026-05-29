import type {
  BrainMemoryClientConfig,
  BrainMemoryError,
  BrainMemorySearchRequest,
  NormalizedBrainMemorySearchResponse,
  NormalizedBrainMemoryStatus,
  NormalizedMemoryLayer,
  NormalizedMemoryResult,
  NormalizedSupersessionStatus
} from "./types";

const DEFAULT_TIMEOUT_MS = 3500;
const SEARCH_PATH = "/ui/memory/search";
const HEALTH_PATH = "/health";

export type {
  BrainMemoryClientConfig,
  BrainMemoryError,
  BrainMemoryMode,
  BrainMemorySearchContext,
  BrainMemorySearchRequest,
  NormalizedBrainMemorySearchResponse,
  NormalizedBrainMemoryStatus,
  NormalizedMemoryLayer,
  NormalizedMemoryResult,
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
    apiKey: config.apiKey,
    base,
    fetchImpl: config.fetchImpl ?? fetch,
    method: "GET",
    path: HEALTH_PATH,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
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

  return {
    mode: "real",
    configured: true,
    reachable: true,
    baseUrl: safeDisplayUrl(base),
    health: result.data,
    capabilities: extractCapabilities(result.data),
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
      error: {
        kind: "invalid_config",
        message: "BRAIN_MEMORY_GATEWAY_URL must be a valid http:// or https:// URL."
      },
      searchedAt
    };
  }

  const body = {
    include_evidence_summary: true,
    limit,
    project_id: request.context.project.id,
    query,
    retrieval_profile: request.context.project.retrievalProfile,
    session_id: request.context.session?.id,
    tenant_id: request.context.project.tenantId,
    context: request.context
  };

  let result = await fetchGatewayJson({
    apiKey: config.apiKey,
    base,
    body,
    fetchImpl: config.fetchImpl ?? fetch,
    method: "POST",
    path: SEARCH_PATH,
    timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  });

  if (!result.ok && shouldTryGetSearchFallback(result.error)) {
    result = await fetchGatewayJson({
      apiKey: config.apiKey,
      base,
      fetchImpl: config.fetchImpl ?? fetch,
      method: "GET",
      path: buildSearchFallbackPath(request, query, limit),
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
    });
  }

  if (!result.ok) {
    return {
      mode: "error",
      query,
      results: [],
      error: result.error,
      searchedAt
    };
  }

  return {
    mode: "real",
    query,
    results: normalizeSearchResults(result.data).slice(0, limit),
    error: null,
    searchedAt
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

function applyGatewayAuth(headers: Headers, apiKey?: string | null) {
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
}

async function fetchGatewayJson(args: {
  apiKey?: string | null;
  base: URL;
  body?: Record<string, unknown>;
  fetchImpl: typeof fetch;
  method: "GET" | "POST";
  path: string;
  timeoutMs: number;
}): Promise<
  | { ok: true; data: Record<string, unknown> | null }
  | { ok: false; error: BrainMemoryError }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const headers = new Headers({ Accept: "application/json" });
  applyGatewayAuth(headers, args.apiKey);

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
        error: {
          kind: "http_error",
          message: `${args.path} returned HTTP ${response.status}.`
        }
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

function extractCapabilities(data: Record<string, unknown> | null): Record<string, unknown> | null {
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
    supersessionStatus: normalizeSupersessionStatus(item.supersession_status),
    createdAt: asOptionalString(item.created_at) ?? asOptionalString(item.createdAt),
    updatedAt: asOptionalString(item.updated_at) ?? asOptionalString(item.updatedAt),
    metadata: normalizeMetadata(item.metadata)
  };
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
