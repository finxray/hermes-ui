import type {
  HermesClientConfig,
  HermesEndpointName,
  HermesEndpointResult,
  HermesStatusError,
  NormalizedHermesStatus
} from "./types";

const DEFAULT_TIMEOUT_MS = 3500;

const ENDPOINTS: Array<{
  name: HermesEndpointName;
  path: string;
  auth: boolean;
}> = [
  { name: "capabilities", path: "/v1/capabilities", auth: true },
  { name: "health", path: "/health", auth: false },
  { name: "healthDetailed", path: "/health/detailed", auth: false },
  { name: "models", path: "/v1/models", auth: true }
];

export type {
  HermesClientConfig,
  HermesEndpointName,
  HermesEndpointResult,
  HermesStatusError,
  NormalizedHermesStatus
} from "./types";

export async function getHermesStatus(
  config: HermesClientConfig
): Promise<NormalizedHermesStatus> {
  const checkedAt = new Date().toISOString();

  if (config.enabled === false) {
    return {
      mode: "mock",
      configured: false,
      reachable: false,
      baseUrl: null,
      capabilities: null,
      health: null,
      models: null,
      error: {
        kind: "disabled",
        message: "Real Hermes status is disabled for this UI process."
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
      capabilities: null,
      health: null,
      models: null,
      error: {
        kind: "unconfigured",
        message: "Set HERMES_API_BASE_URL to enable real Hermes status checks."
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
      capabilities: null,
      health: null,
      models: null,
      error: {
        kind: "invalid_config",
        message: "HERMES_API_BASE_URL must be a valid http:// or https:// URL."
      },
      checkedAt
    };
  }

  const fetchImpl = config.fetchImpl ?? fetch;
  const results = await Promise.all(
    ENDPOINTS.map((endpoint) =>
      fetchEndpoint({
        apiKey: config.apiKey,
        auth: endpoint.auth,
        base,
        fetchImpl,
        name: endpoint.name,
        path: endpoint.path,
        timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS
      })
    )
  );

  const capabilities = getData(results, "capabilities");
  const health = {
    basic: getData(results, "health"),
    detailed: getData(results, "healthDetailed")
  };
  const models = getData(results, "models");
  const reachable = results.some((result) => result.ok);

  if (!reachable) {
    return {
      mode: "error",
      configured: true,
      reachable: false,
      baseUrl: safeDisplayUrl(base),
      capabilities: null,
      health: null,
      models: null,
      error: firstError(results) ?? {
        kind: "unknown",
        message: "Hermes did not return a successful health or capability response."
      },
      checkedAt
    };
  }

  return {
    mode: "real",
    configured: true,
    reachable: true,
    baseUrl: safeDisplayUrl(base),
    capabilities,
    health,
    models,
    error: null,
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

async function fetchEndpoint(args: {
  apiKey?: string | null;
  auth: boolean;
  base: URL;
  fetchImpl: typeof fetch;
  name: HermesEndpointName;
  path: string;
  timeoutMs: number;
}): Promise<HermesEndpointResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), args.timeoutMs);
  const headers = new Headers({ Accept: "application/json" });
  if (args.auth && args.apiKey) {
    headers.set("Authorization", `Bearer ${args.apiKey}`);
  }

  try {
    const response = await args.fetchImpl(buildEndpointUrl(args.base, args.path), {
      cache: "no-store",
      headers,
      signal: controller.signal
    });
    const data = await readJsonObject(response);

    if (!response.ok) {
      return {
        name: args.name,
        ok: false,
        status: response.status,
        data,
        error: {
          kind: "http_error",
          message: `${args.path} returned HTTP ${response.status}.`
        }
      };
    }

    return {
      name: args.name,
      ok: true,
      status: response.status,
      data,
      error: null
    };
  } catch (error) {
    return {
      name: args.name,
      ok: false,
      status: null,
      data: null,
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

function getData(results: HermesEndpointResult[], name: HermesEndpointName) {
  return results.find((result) => result.name === name && result.ok)?.data ?? null;
}

function firstError(results: HermesEndpointResult[]): HermesStatusError | null {
  return results.find((result) => result.error)?.error ?? null;
}

function normalizeFetchError(error: unknown): HermesStatusError {
  if (error instanceof Error && error.name === "AbortError") {
    return {
      kind: "timeout",
      message: "Timed out while checking Hermes status."
    };
  }

  return {
    kind: "network",
    message: "Could not reach Hermes at the configured base URL."
  };
}
