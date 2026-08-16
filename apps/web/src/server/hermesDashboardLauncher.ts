import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";
import { configuredHermesApiBaseUrl } from "./hermesDefaults.ts";
import {
  resolveWslHermesInstallation,
  validatedWslHermesExecutable
} from "./wslHermesDiscovery.ts";

const DEFAULT_DASHBOARD_PORT = "9119";
const DASHBOARD_START_TIMEOUT_MS = 60_000;
const DASHBOARD_POLL_INTERVAL_MS = 350;

export type DashboardTarget = {
  baseUrl: URL | null;
  canStart: boolean;
  reason: string | null;
};

export type DashboardExecutable =
  | { kind: "native"; path: string }
  | { distro: string; kind: "wsl"; path: string };

export type DashboardLaunchSpec = {
  args: string[];
  command: string;
  platform: NodeJS.Platform;
};

type DashboardProbe = {
  reachable: boolean;
};

export function resolveDashboardTarget(environment: NodeJS.ProcessEnv = process.env): DashboardTarget {
  const explicitDashboardUrl = environment.HERMES_DASHBOARD_BASE_URL?.trim();
  const apiUrl = parseHttpUrl(configuredHermesApiBaseUrl(environment));
  const inferredDashboardUrl = apiUrl && isLoopbackHostname(apiUrl.hostname) && apiUrl.port === "8642"
    ? new URL(apiUrl.href)
    : null;

  if (inferredDashboardUrl) {
    inferredDashboardUrl.port = DEFAULT_DASHBOARD_PORT;
  }

  const baseUrl = explicitDashboardUrl ? parseHttpUrl(explicitDashboardUrl) : inferredDashboardUrl;
  if (!baseUrl) {
    return {
      baseUrl: null,
      canStart: false,
      reason: "Configure a local Hermes API or HERMES_DASHBOARD_BASE_URL before starting the Dashboard."
    };
  }

  if (!baseUrl.port) {
    baseUrl.port = DEFAULT_DASHBOARD_PORT;
  }

  if (!isLoopbackHostname(baseUrl.hostname) || baseUrl.protocol !== "http:") {
    return {
      baseUrl,
      canStart: false,
      reason: "Automatic Dashboard startup is available only for a loopback HTTP address."
    };
  }

  if (environment.HERMES_UI_ENABLE_DASHBOARD_START === "false") {
    return {
      baseUrl,
      canStart: false,
      reason: "Automatic Dashboard startup is disabled for this Stoix process."
    };
  }

  return { baseUrl, canStart: true, reason: null };
}

export async function probeHermesDashboard(baseUrl: URL): Promise<DashboardProbe> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);
  try {
    await fetch(new URL("/skills", baseUrl), {
      cache: "no-store",
      headers: { Accept: "text/html" },
      redirect: "manual",
      signal: controller.signal
    });
    return { reachable: true };
  } catch {
    return { reachable: false };
  } finally {
    clearTimeout(timeout);
  }
}

export async function launchHermesDashboard(baseUrl: URL): Promise<void> {
  const launchSpec = await resolveDashboardLaunchSpec(baseUrl);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(launchSpec.command, launchSpec.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: launchSpec.platform === "win32"
    });
    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
  });
}

export async function resolveDashboardLaunchSpec(
  baseUrl: URL,
  platform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env
): Promise<DashboardLaunchSpec> {
  const port = validatedDashboardPort(baseUrl.port || DEFAULT_DASHBOARD_PORT);
  const args = ["dashboard", "--host", "127.0.0.1", "--port", port, "--no-open"];
  const executable = await resolveHermesExecutable(platform, environment);
  return buildDashboardLaunchSpec(platform, executable, args);
}

export function buildDashboardLaunchSpec(
  platform: NodeJS.Platform,
  executable: DashboardExecutable,
  dashboardArgs: string[]
): DashboardLaunchSpec {
  return buildHermesLaunchSpec(platform, executable, dashboardArgs);
}

export function buildHermesLaunchSpec(
  platform: NodeJS.Platform,
  executable: DashboardExecutable,
  args: string[]
): DashboardLaunchSpec {
  if (executable.kind === "wsl") {
    if (platform !== "win32") {
      throw new Error("WSL Dashboard launch is available only on Windows.");
    }
    return {
      args: ["-d", executable.distro, "--", executable.path, ...args],
      command: "wsl.exe",
      platform
    };
  }

  return { args, command: executable.path, platform };
}

export async function resolveHermesExecutable(
  platform: NodeJS.Platform,
  environment: NodeJS.ProcessEnv
): Promise<DashboardExecutable> {
  const explicitExecutable =
    environment.HERMES_EXECUTABLE?.trim() ||
    environment.HERMES_DASHBOARD_EXECUTABLE?.trim();
  if (explicitExecutable) {
    return {
      kind: "native",
      path: platform === "win32"
        ? validatedWindowsHermesExecutable(explicitExecutable)
        : validatedUnixHermesExecutable(explicitExecutable, "HERMES_DASHBOARD_EXECUTABLE must be an absolute executable path.")
    };
  }

  if (platform === "win32") {
    return resolveWindowsHermesExecutable(environment);
  }
  if (platform === "darwin") {
    return { kind: "native", path: await resolveMacHermesExecutable() };
  }
  if (platform === "linux") {
    return { kind: "native", path: await resolveLinuxHermesExecutable() };
  }

  throw new Error(`Automatic Hermes Dashboard startup is not supported on ${platform}.`);
}

async function resolveWindowsHermesExecutable(environment: NodeJS.ProcessEnv): Promise<DashboardExecutable> {
  const mode = environment.HERMES_DASHBOARD_WINDOWS_MODE?.trim().toLowerCase() || "auto";
  if (!new Set(["auto", "native", "wsl"]).has(mode)) {
    throw new Error("HERMES_DASHBOARD_WINDOWS_MODE must be auto, native, or wsl.");
  }

  if (mode !== "wsl") {
    try {
      const child = spawn("where.exe", ["hermes.exe"], discoverySpawnOptions());
      const stdout = await captureSpawnedText(child, "where.exe");
      const executable = validatedWindowsHermesExecutable(stdout);
      await captureSpawnedText(
        spawn(/* turbopackIgnore: true */ executable, ["--version"], discoverySpawnOptions()),
        executable
      );
      return { kind: "native", path: executable };
    } catch (error) {
      if (mode === "native") {
        throw new Error("Hermes was not found as a native Windows executable.", { cause: error });
      }
    }
  }

  const installation = await resolveWslHermesInstallation(environment);
  return { ...installation, kind: "wsl" };
}

async function resolveMacHermesExecutable() {
  return resolveUnixHermesExecutable("macOS", [
    async () => captureSpawnedText(spawn("/bin/zsh", ["-lc", "command -v hermes"], discoverySpawnOptions()), "/bin/zsh"),
    async () => captureSpawnedText(spawn("/bin/bash", ["-lc", "command -v hermes"], discoverySpawnOptions()), "/bin/bash"),
    async () => captureSpawnedText(spawn("/bin/sh", ["-lc", "command -v hermes"], discoverySpawnOptions()), "/bin/sh")
  ]);
}

async function resolveLinuxHermesExecutable() {
  return resolveUnixHermesExecutable("Linux", [
    async () => captureSpawnedText(spawn("/bin/bash", ["-lc", "command -v hermes"], discoverySpawnOptions()), "/bin/bash"),
    async () => captureSpawnedText(spawn("/bin/sh", ["-lc", "command -v hermes"], discoverySpawnOptions()), "/bin/sh")
  ]);
}

async function resolveUnixHermesExecutable(platformLabel: string, lookups: Array<() => Promise<string>>): Promise<string> {
  let lastError: unknown = null;
  for (const lookup of lookups) {
    try {
      const stdout = await lookup();
      return validatedUnixHermesExecutable(stdout, `Hermes was not found on ${platformLabel}.`);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Hermes was not found on ${platformLabel}.`, { cause: lastError });
}

function discoverySpawnOptions(): SpawnOptions {
  return {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: process.platform === "win32"
  };
}

async function captureSpawnedText(child: ReturnType<typeof spawn>, commandLabel: string) {
  return new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      finish(new Error(`Command timed out: ${commandLabel}`));
    }, 5_000);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.once("error", finish);
    child.once("close", (code) => {
      if (code === 0) {
        finish(null, stdout);
        return;
      }
      finish(new Error(stderr.trim() || `${commandLabel} exited with code ${code ?? "unknown"}.`));
    });

    function finish(error: Error | null, result = "") {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(result);
    }
  });
}

function validatedUnixHermesExecutable(stdout: string, message: string) {
  return validatedWslHermesExecutable(stdout, message);
}

function validatedWindowsHermesExecutable(stdout: string) {
  const executable = stdout.trim().split(/\r?\n/).find((line) => /^[A-Za-z]:\\[^\r\n]+\.exe$/i.test(line.trim()))?.trim() ?? "";
  if (!executable) {
    throw new Error("Hermes executable must be an absolute Windows .exe path.");
  }
  return executable;
}

function validatedDashboardPort(port: string) {
  const portNumber = Number(port);
  if (!/^\d{1,5}$/.test(port) || !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65_535) {
    throw new Error("Hermes Dashboard port is invalid.");
  }
  return String(portNumber);
}

export async function waitForHermesDashboard(baseUrl: URL): Promise<boolean> {
  const deadline = Date.now() + DASHBOARD_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if ((await probeHermesDashboard(baseUrl)).reachable) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, DASHBOARD_POLL_INTERVAL_MS));
  }
  return false;
}

export function isAllowedDashboardStartRequest(request: Request): boolean {
  return isAllowedLocalStartRequest(request, "start-dashboard");
}

export function isAllowedLocalStartRequest(request: Request, action: string): boolean {
  if (request.headers.get("x-hermes-ui-action") !== action) {
    return false;
  }

  const requestUrl = new URL(request.url);
  if (!isLoopbackHostname(requestUrl.hostname)) {
    return false;
  }

  const origin = request.headers.get("origin");
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || request.headers.get("host");
  if (!origin || !requestHost) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    return isLoopbackHostname(originUrl.hostname) && originUrl.host.toLowerCase() === requestHost.toLowerCase();
  } catch {
    return false;
  }
}

function parseHttpUrl(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function isLoopbackHostname(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}
