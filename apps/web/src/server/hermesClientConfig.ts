import type { HermesClientConfig } from "@hermes-ui/hermes-client";
import { spawn } from "node:child_process";

const SESSION_TOKEN_ASSIGNMENT = /window\.__HERMES_SESSION_TOKEN__\s*=\s*("(?:[^"\\]|\\.)*")/;

export async function resolveHermesClientConfig(
  overrides: Partial<HermesClientConfig> = {}
): Promise<HermesClientConfig> {
  const baseUrl = overrides.baseUrl ?? process.env.HERMES_API_BASE_URL;
  const configuredApiKey = overrides.apiKey ?? process.env.HERMES_API_KEY;
  const apiKey = configuredApiKey?.trim()
    || await discoverWslApiServerKey()
    || await discoverLoopbackSessionToken(baseUrl);

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

  const distro = environment.STUDIO_WSL_DISTRO?.trim() || "Ubuntu";
  if (!/^[A-Za-z0-9._-]{1,80}$/.test(distro)) {
    return undefined;
  }

  const script = "awk 'BEGIN { value = \"\" } /^API_SERVER_KEY=/ { value = substr($0, index($0, \"=\") + 1) } END { printf \"%s\", value }' \"$HOME/.hermes/.env\" 2>/dev/null";
  return new Promise((resolve) => {
    const child = spawn("wsl.exe", ["-d", distro, "--", "bash", "-lc", script], {
      stdio: ["ignore", "pipe", "ignore"],
      windowsHide: true
    });
    let output = "";
    let settled = false;
    const timeout = setTimeout(() => finish(undefined), 2_000);

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (output.length <= 512) {
        output += chunk;
      }
    });
    child.once("error", () => finish(undefined));
    child.once("close", (code) => {
      const key = unquoteEnvValue(output.trim());
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
