import type { HermesClientConfig } from "@hermes-ui/hermes-client";
import { spawn } from "node:child_process";
import { DEFAULT_HERMES_API_BASE_URL } from "./hermesDefaults.ts";
import {
  ensureWslConnectionLease,
  resolveWslHermesInstallation
} from "./wslHermesDiscovery.ts";

const SESSION_TOKEN_ASSIGNMENT = /window\.__HERMES_SESSION_TOKEN__\s*=\s*("(?:[^"\\]|\\.)*")/;
// A successful key belongs to the running Stoix process. Re-reading it by
// spawning WSL can briefly reset Windows localhost forwarding, so keep it for
// the process lifetime; installer-driven key changes restart Stoix.
const WSL_KEY_CACHE_OK_MS = Number.MAX_SAFE_INTEGER;
const WSL_KEY_CACHE_MISS_MS = 10_000;

type WslApiKeyCache = {
  cacheKey: string;
  expiresAt: number;
  inFlight: Promise<string | undefined> | null;
  value: string | undefined;
};

const wslApiKeyCache = globalThis as typeof globalThis & {
  __stoixWslApiKeyCache?: WslApiKeyCache;
};

export async function resolveHermesClientConfig(
  overrides: Partial<HermesClientConfig> = {}
): Promise<HermesClientConfig> {
  const baseUrl = overrides.baseUrl !== undefined
    ? overrides.baseUrl
    : process.env.HERMES_API_BASE_URL?.trim() || DEFAULT_HERMES_API_BASE_URL;
  const configuredApiKey = overrides.apiKey ?? process.env.HERMES_API_KEY;
  let apiKey = configuredApiKey?.trim() || undefined;

  if (
    process.platform === "win32" &&
    isLoopbackHttpUrl(baseUrl) &&
    windowsHermesMode(process.env) !== "native"
  ) {
    try {
      const installation = await resolveWslHermesInstallation(process.env);
      await ensureWslConnectionLease(installation.distro);
      apiKey ||= await discoverWslApiServerKey("win32", process.env);
    } catch {
      // Native loopback/session-token fallback remains available below.
    }
  }

  apiKey ||= await discoverLoopbackSessionToken(baseUrl);

  return {
    ...overrides,
    apiKey,
    baseUrl,
    enabled: overrides.enabled ?? process.env.HERMES_UI_ENABLE_REAL_HERMES !== "false"
  };
}

export async function discoverWslApiServerKey(
  platform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env
): Promise<string | undefined> {
  if (platform !== "win32") {
    return undefined;
  }

  const cacheKey = environment.STUDIO_WSL_DISTRO?.trim().toLowerCase() || "auto";
  const cache = wslApiKeyCache.__stoixWslApiKeyCache ??= {
    cacheKey,
    expiresAt: 0,
    inFlight: null,
    value: undefined
  };
  if (cache.cacheKey !== cacheKey) {
    cache.cacheKey = cacheKey;
    cache.expiresAt = 0;
    cache.inFlight = null;
    cache.value = undefined;
  }
  if (cache.expiresAt > Date.now()) {
    return cache.value;
  }
  if (cache.inFlight) {
    return cache.inFlight;
  }

  cache.inFlight = readWslApiServerKey(environment).then((value) => {
    cache.value = value;
    cache.expiresAt = value ? WSL_KEY_CACHE_OK_MS : Date.now() + WSL_KEY_CACHE_MISS_MS;
    cache.inFlight = null;
    return value;
  });
  return cache.inFlight;
}

async function readWslApiServerKey(
  environment: NodeJS.ProcessEnv
): Promise<string | undefined> {

  let distro: string;
  try {
    distro = (await resolveWslHermesInstallation(environment)).distro;
  } catch {
    return undefined;
  }

  const script = "cat ~/.hermes/.env 2>/dev/null";
  return new Promise((resolve) => {
    const child = spawn("wsl.exe", ["-d", distro, "--", "bash", "-lc", script], {
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true
    });
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => finish(undefined), 5_000);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (output.length <= 65_536) {
        output += chunk;
      }
    });
    child.once("error", () => finish(undefined));
    child.once("close", (code) => {
      const key = unquoteEnvValue(lastEnvAssignment(output, "API_SERVER_KEY"));
      finish(code === 0 && validSecret(key) ? key : undefined);
    });

    function finish(value: string | undefined) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (value === undefined && child.exitCode === null) {
        child.kill();
      }
      resolve(value);
    }
  });
}

function lastEnvAssignment(source: string, key: string): string {
  let value = "";
  const prefix = `${key}=`;
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith(prefix)) {
      value = line.slice(prefix.length).trim();
    }
  }
  return value;
}

function unquoteEnvValue(value: string): string {
  if (
    value.length >= 2 &&
    value[0] === value.at(-1) &&
    (value.startsWith('"') || value.startsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

export async function discoverLoopbackSessionToken(
  baseUrl: string | null | undefined,
  fetchImpl: typeof fetch = fetch
): Promise<string | undefined> {
  const target = parseLoopbackHttpUrl(baseUrl);
  if (!target) {
    return undefined;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    const response = await fetchImpl(new URL("/", target), {
      cache: "no-store",
      headers: { Accept: "text/html" },
      signal: controller.signal
    });
    if (!response.ok) {
      return undefined;
    }
    const match = SESSION_TOKEN_ASSIGNMENT.exec(await response.text());
    if (!match?.[1]) {
      return undefined;
    }
    const token = JSON.parse(match[1]) as unknown;
    return typeof token === "string" && validSecret(token)
      ? token
      : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

function validSecret(value: string): boolean {
  return value.length >= 16 && value.length <= 512 && !/[\x00-\x1f\x7f]/.test(value);
}

function parseLoopbackHttpUrl(value: string | null | undefined): URL | null {
  if (!value?.trim()) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" && isLoopbackHostname(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

function isLoopbackHttpUrl(value: string | null | undefined): boolean {
  return Boolean(parseLoopbackHttpUrl(value));
}

function windowsHermesMode(environment: NodeJS.ProcessEnv): string {
  return environment.HERMES_DASHBOARD_WINDOWS_MODE?.trim().toLowerCase() || "auto";
}
