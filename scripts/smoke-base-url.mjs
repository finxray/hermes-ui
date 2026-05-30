export const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

export function trimSlash(value) {
  return value.replace(/\/$/, "");
}

export function selectedBaseUrl(value) {
  return trimSlash(value || DEFAULT_BASE_URL);
}

export function printSelectedBaseUrl({ baseUrl, json, label }) {
  if (!json) {
    console.log(`${label} selected base URL: ${baseUrl}`);
  }
}

export async function preflightStaticChunks({
  addResult,
  baseUrl,
  failName = "static-assets-preflight",
  sampleSize = 8,
  timeoutMs = 10_000
}) {
  const root = await fetchTextWithTimeout(`${baseUrl}/`, timeoutMs);
  if (!root.ok) {
    addResult(
      failName,
      "fail",
      `Selected base URL ${baseUrl} is not reachable at / (${root.status || root.error || "unknown error"}).`
    );
    return { ok: false, root };
  }

  const assets = extractStaticAssetPaths(root.text || "").slice(0, sampleSize);
  if (assets.length === 0) {
    addResult(
      failName,
      "fail",
      `Selected base URL ${baseUrl} did not expose Next static chunks from /. This can indicate a stale or non-Studio server.`
    );
    return { assets: [], failures: [], ok: false, root };
  }

  const results = [];
  for (const path of assets) {
    const result = await fetchHeadOrGet(`${baseUrl}${path}`, timeoutMs);
    results.push({
      error: result.error,
      ok: result.ok,
      path,
      status: result.status || 0
    });
  }

  const failures = results.filter((item) => !item.ok);
  if (failures.length > 0) {
    const failureText = failures
      .slice(0, 4)
      .map((failure) => `${failure.path} -> ${failure.status || failure.error || "unknown"}`)
      .join(" | ");
    addResult(
      failName,
      "fail",
      `Selected base URL ${baseUrl} has failing Next static chunks: ${failureText}. Likely stale Next server. Manual recovery: restart the process serving ${baseUrl}, or run the smoke with a healthy URL: npm run smoke:ui -- --base-url <healthy-url>. Only remove apps/web/.next after stopping the server and confirming the repo path.`
    );
    return { assets: results, failures, ok: false, root };
  }

  addResult(
    failName,
    "pass",
    `Selected base URL ${baseUrl} passed static chunk preflight (${results.length} checked).`
  );
  return { assets: results, failures: [], ok: true, root };
}

function extractStaticAssetPaths(html) {
  const matches = html.matchAll(/["'](\/_next\/static\/[^"']+)["']/g);
  return Array.from(new Set(Array.from(matches, (match) => match[1].replace(/&amp;/g, "&"))));
}

async function fetchTextWithTimeout(url, timeoutMs) {
  return fetchWithTimeout(url, {}, async (response) => response.text(), timeoutMs);
}

async function fetchHeadOrGet(url, timeoutMs) {
  const head = await fetchWithTimeout(url, { method: "HEAD" }, async () => "", timeoutMs);
  if (head.ok || head.status !== 405) {
    return head;
  }
  return fetchWithTimeout(url, {}, async () => "", timeoutMs);
}

async function fetchWithTimeout(url, init, readBody, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal
    });
    const body = await readBody(response);
    return {
      ok: response.ok,
      status: response.status,
      text: typeof body === "string" ? body : undefined
    };
  } catch (error) {
    return {
      error: error instanceof Error && error.name === "AbortError" ? "timeout" : "unreachable",
      ok: false,
      status: 0
    };
  } finally {
    clearTimeout(timeout);
  }
}
