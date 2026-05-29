#!/usr/bin/env node

const args = new Map();
for (const arg of process.argv.slice(2)) {
  const [key, ...rest] = arg.split("=");
  if (key?.startsWith("--")) {
    args.set(key.slice(2), rest.join("=") || "true");
  }
}

const baseUrl = args.get("url") || process.env.BRAIN_MEMORY_GATEWAY_URL;
const uiApiKey = process.env.BRAIN_MEMORY_UI_API_KEY || process.env.BRAIN_MEMORY_API_KEY;
const gatewayMemoryApiKey = process.env.BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY;
const query = args.get("query");

if (!baseUrl) {
  console.error("BRAIN_MEMORY_GATEWAY_URL is not set. Pass --url=http://127.0.0.1:8765.");
  process.exit(2);
}

const base = parseBaseUrl(baseUrl);
if (!base) {
  console.error("Brain Memory Gateway URL must be a valid http:// or https:// URL.");
  process.exit(2);
}

try {
  const health = await gatewayFetch(base, "/health", { method: "GET" });
  console.log(
    JSON.stringify(
      {
        baseUrl: safeDisplayUrl(base),
        health
      },
      null,
      2
    )
  );

  if (query) {
    const tenantId = args.get("tenant") || "local-dev";
    const search = await gatewayFetch(base, "/ui/memory/search", {
      body: JSON.stringify({
        context: {
          project: {
            contextPolicy: "project-and-session",
            id: "doctor-project",
            retrievalProfile: "balanced",
            stableKey: "doctor",
            tenantId,
            title: "Doctor"
          },
          session: null,
          ui: {
            source: "hermes-ui",
            workspaceVersion: 1
          }
        },
        include_evidence_summary: true,
        limit: 5,
        query,
        tenant_id: tenantId
      }),
      headers: {
        "Content-Type": "application/json"
      },
      includeGatewayMemoryKey: true,
      method: "POST"
    });
    console.log(JSON.stringify({ search }, null, 2));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Unknown Brain Memory check failure.");
  process.exit(1);
}

async function gatewayFetch(base, path, init) {
  const headers = new Headers({
    Accept: "application/json",
    ...(init.headers ?? {})
  });
  if (uiApiKey) {
    headers.set("Authorization", "Bearer [redacted]");
  }
  if (init.includeGatewayMemoryKey && gatewayMemoryApiKey) {
    headers.set("X-Gateway-Memory-Api-Key", "[redacted]");
  }

  const networkHeaders = new Headers(headers);
  if (uiApiKey) {
    networkHeaders.set("Authorization", `Bearer ${uiApiKey}`);
  }
  if (init.includeGatewayMemoryKey && gatewayMemoryApiKey) {
    networkHeaders.set("X-Gateway-Memory-Api-Key", gatewayMemoryApiKey);
  }

  const response = await fetch(buildEndpointUrl(base, path), {
    body: init.body,
    cache: "no-store",
    headers: networkHeaders,
    method: init.method
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text ? `${text.slice(0, 200)}${text.length > 200 ? "..." : ""}` : null;
  }

  if (!response.ok) {
    throw new Error(`${path} returned HTTP ${response.status}.`);
  }

  return {
    body,
    status: response.status
  };
}

function buildEndpointUrl(base, path) {
  const root = base.href.endsWith("/") ? base.href : `${base.href}/`;
  return new URL(path.replace(/^\//, ""), root);
}

function parseBaseUrl(value) {
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

function safeDisplayUrl(url) {
  const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
  return `${url.origin}${pathname}`;
}
