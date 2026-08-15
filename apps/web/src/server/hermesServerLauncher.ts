import { spawn } from "node:child_process";
import {
  buildHermesLaunchSpec,
  isAllowedLocalStartRequest,
  resolveHermesExecutable,
  type DashboardExecutable,
  type DashboardLaunchSpec
} from "./hermesDashboardLauncher.ts";

const SERVER_START_TIMEOUT_MS = 45_000;
const SERVER_POLL_INTERVAL_MS = 350;

export type HermesServerTarget = {
  baseUrl: URL | null;
  canStart: boolean;
  reason: string | null;
};

export function resolveHermesServerTarget(
  environment: NodeJS.ProcessEnv = process.env
): HermesServerTarget {
  const baseUrl = parseHttpUrl(environment.HERMES_API_BASE_URL);
  if (!baseUrl) {
    return {
      baseUrl: null,
      canStart: false,
      reason: "Configure a local HERMES_API_BASE_URL before launching Hermes."
    };
  }
  if (baseUrl.protocol !== "http:" || !isLoopbackHostname(baseUrl.hostname)) {
    return {
      baseUrl,
      canStart: false,
      reason: "Automatic Hermes startup is available only for a loopback HTTP address."
    };
  }
  if (!baseUrl.port) {
    return {
      baseUrl,
      canStart: false,
      reason: "HERMES_API_BASE_URL must include the local Hermes server port."
    };
  }
  if (environment.HERMES_UI_ENABLE_SERVER_START === "false") {
    return {
      baseUrl,
      canStart: false,
      reason: "Automatic Hermes startup is disabled for this Stoix process."
    };
  }
  return { baseUrl, canStart: true, reason: null };
}

export async function probeHermesServer(baseUrl: URL): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(new URL("/health", baseUrl), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function launchHermesServer(
  baseUrl: URL,
  platform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env
): Promise<void> {
  const executable = await resolveHermesExecutable(platform, environment);
  const launchSpecs = buildHermesServerRecoverySpecs(
    platform,
    executable,
    baseUrl
  );

  for (const launchSpec of launchSpecs.slice(0, -1)) {
    await runHermesRecoveryCommand(launchSpec);
  }
  await spawnDetached(launchSpecs.at(-1)!);
}

async function runHermesRecoveryCommand(launchSpec: DashboardLaunchSpec): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(launchSpec.command, launchSpec.args, {
      stdio: "ignore",
      windowsHide: launchSpec.platform === "win32"
    });
    child.once("error", reject);
    child.once("close", (code) => code === 0 ? resolve() : reject(new Error(`Hermes recovery command exited with code ${code ?? "unknown"}.`)));
  });
}

async function spawnDetached(launchSpec: DashboardLaunchSpec): Promise<void> {
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

export function buildHermesServerRecoverySpecs(
  platform: NodeJS.Platform,
  executable: DashboardExecutable,
  baseUrl: URL
): DashboardLaunchSpec[] {
  validatedPort(baseUrl.port);
  const specs = [buildHermesLaunchSpec(platform, executable, ["serve", "--stop"])];
  if (executable.kind === "wsl") {
    specs.push(buildHermesLaunchSpec(platform, executable, ["gateway", "stop"]));
    specs.push(buildHermesLaunchSpec(platform, executable, [
      "gateway",
      "run",
      "--replace",
      "--force"
    ]));
    return specs;
  }
  specs.push(buildHermesLaunchSpec(platform, executable, ["gateway", "start"]));
  return specs;
}

export async function waitForHermesServer(baseUrl: URL): Promise<boolean> {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await probeHermesServer(baseUrl)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, SERVER_POLL_INTERVAL_MS));
  }
  return false;
}

export function hermesServerTimeoutMessage(
  platform: NodeJS.Platform = process.platform
): string {
  const healthUrl = "http://127.0.0.1:8642/health";
  if (platform === "win32") {
    return "Hermes did not become ready. For native Windows, run `hermes gateway restart`. If Hermes is installed in WSL, run `hermes gateway run --replace --force` inside WSL. Then check `" + healthUrl + "`.";
  }
  if (platform === "darwin") {
    return "Hermes did not become ready. In macOS Terminal, run `hermes gateway restart`, then check `" + healthUrl + "`.";
  }
  return "Hermes did not become ready. Run `hermes gateway restart`, then check `" + healthUrl + "`.";
}

export function isAllowedHermesServerStartRequest(request: Request): boolean {
  return isAllowedLocalStartRequest(request, "start-server");
}

function parseHttpUrl(value: string | null | undefined): URL | null {
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

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

function validatedPort(port: string): string {
  const portNumber = Number(port);
  if (!/^\d{1,5}$/.test(port) || !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65_535) {
    throw new Error("Hermes server port is invalid.");
  }
  return String(portNumber);
}
