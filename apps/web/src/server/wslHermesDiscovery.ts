import { spawn } from "node:child_process";
import type { SpawnOptions } from "node:child_process";

const DISCOVERY_TIMEOUT_MS = 5_000;
const WSL_DISTRO_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._ -]{0,79}$/;
const UNIX_EXECUTABLE_PATTERN = /^\/[A-Za-z0-9._/+-]+$/;

export type WslHermesInstallation = {
  distro: string;
  path: string;
};

type WslInstallationCache = {
  cacheKey: string;
  inFlight: Promise<WslHermesInstallation> | null;
  value: WslHermesInstallation | null;
};

const wslInstallationCache = globalThis as typeof globalThis & {
  __stoixWslInstallationCache?: WslInstallationCache;
};

const wslConnectionLease = globalThis as typeof globalThis & {
  __stoixWslConnectionLease?: {
    child: ReturnType<typeof spawn>;
    distro: string;
  } | null;
};

export async function ensureWslConnectionLease(distro: string): Promise<void> {
  const validatedDistro = validatedWslDistributionName(distro);
  const existing = wslConnectionLease.__stoixWslConnectionLease;
  if (
    existing?.distro === validatedDistro &&
    existing.child.exitCode === null &&
    !existing.child.killed
  ) {
    return;
  }
  if (existing?.child.exitCode === null) {
    existing.child.kill();
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "wsl.exe",
      ["-d", validatedDistro, "--", "sleep", "infinity"],
      { stdio: "ignore", windowsHide: true }
    );
    wslConnectionLease.__stoixWslConnectionLease = {
      child,
      distro: validatedDistro
    };
    child.once("error", (error) => {
      if (wslConnectionLease.__stoixWslConnectionLease?.child === child) {
        wslConnectionLease.__stoixWslConnectionLease = null;
      }
      reject(error);
    });
    child.once("close", () => {
      if (wslConnectionLease.__stoixWslConnectionLease?.child === child) {
        wslConnectionLease.__stoixWslConnectionLease = null;
      }
    });
    child.once("spawn", resolve);
  });
}

export async function resolveWslHermesInstallation(
  environment: NodeJS.ProcessEnv = process.env
): Promise<WslHermesInstallation> {
  const cacheKey = environment.STUDIO_WSL_DISTRO?.trim().toLowerCase() || "auto";
  const cache = wslInstallationCache.__stoixWslInstallationCache ??= {
    cacheKey,
    inFlight: null,
    value: null
  };
  if (cache.cacheKey !== cacheKey) {
    cache.cacheKey = cacheKey;
    cache.inFlight = null;
    cache.value = null;
  }
  if (cache.value) return cache.value;
  if (cache.inFlight) return cache.inFlight;

  cache.inFlight = discoverWslHermesInstallation(environment)
    .then((installation) => {
      cache.value = installation;
      cache.inFlight = null;
      return installation;
    })
    .catch((error) => {
      cache.inFlight = null;
      throw error;
    });
  return cache.inFlight;
}

async function discoverWslHermesInstallation(
  environment: NodeJS.ProcessEnv
): Promise<WslHermesInstallation> {
  const explicitDistro = environment.STUDIO_WSL_DISTRO?.trim();
  const candidates = explicitDistro
    ? [validatedWslDistributionName(explicitDistro)]
    : prioritizeWslDistributions(
        parseWslDistributionList(
          await captureSpawnedText(
            spawn("wsl.exe", ["--list", "--quiet"], discoverySpawnOptions()),
            "wsl.exe --list --quiet"
          )
        )
      );

  if (candidates.length === 0) {
    throw new Error("No WSL distributions are installed. Install Ubuntu in WSL2, then install Hermes inside it.");
  }

  let lastError: unknown = null;
  for (const distro of candidates) {
    try {
      return {
        distro,
        path: await resolveWslHermesExecutable(distro)
      };
    } catch (error) {
      lastError = error;
    }
  }

  const scope = explicitDistro ? `the WSL distribution ${explicitDistro}` : "any installed WSL distribution";
  throw new Error(`Hermes was not found in ${scope}.`, { cause: lastError });
}

export async function resolveWslHermesExecutable(distro: string): Promise<string> {
  const validatedDistro = validatedWslDistributionName(distro);
  const stdout = await captureSpawnedText(
    spawn(
      "wsl.exe",
      ["-d", validatedDistro, "--", "bash", "-lc", "command -v hermes"],
      discoverySpawnOptions()
    ),
    `wsl.exe -d ${validatedDistro}`
  );
  return validatedWslHermesExecutable(
    stdout,
    `Hermes was not found in the WSL distribution ${validatedDistro}.`
  );
}

export function parseWslDistributionList(stdout: string): string[] {
  const seen = new Set<string>();
  const distributions: string[] = [];

  for (const rawLine of stdout.replaceAll("\0", "").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const candidate = rawLine.trim().replace(/^\*\s*/, "");
    if (!candidate || !WSL_DISTRO_PATTERN.test(candidate)) {
      continue;
    }
    const key = candidate.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      distributions.push(candidate);
    }
  }

  return distributions;
}

export function prioritizeWslDistributions(distributions: string[]): string[] {
  return distributions
    .map((distro, index) => ({ distro: validatedWslDistributionName(distro), index }))
    .sort((left, right) => {
      const rankDifference = wslDistributionRank(left.distro) - wslDistributionRank(right.distro);
      return rankDifference || left.index - right.index;
    })
    .map(({ distro }) => distro);
}

export function validatedWslDistributionName(value: string): string {
  const distro = value.trim();
  if (!WSL_DISTRO_PATTERN.test(distro)) {
    throw new Error("STUDIO_WSL_DISTRO contains an invalid WSL distribution name.");
  }
  return distro;
}

export function validatedWslHermesExecutable(stdout: string, message: string): string {
  const executable = stdout.trim().split(/\r?\n/)[0] ?? "";
  if (!UNIX_EXECUTABLE_PATTERN.test(executable)) {
    throw new Error(message);
  }
  return executable;
}

function wslDistributionRank(distro: string): number {
  const normalized = distro.toLowerCase();
  if (normalized === "ubuntu") return 0;
  if (normalized.startsWith("ubuntu-")) return 1;
  if (normalized === "debian") return 2;
  if (normalized === "docker-desktop" || normalized.startsWith("docker-desktop-")) return 4;
  return 3;
}

function discoverySpawnOptions(): SpawnOptions {
  return {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  };
}

async function captureSpawnedText(
  child: ReturnType<typeof spawn>,
  commandLabel: string
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      finish(new Error(`Command timed out: ${commandLabel}`));
    }, DISCOVERY_TIMEOUT_MS);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      if (stdout.length <= 16_384) stdout += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      if (stderr.length <= 4_096) stderr += chunk;
    });
    child.once("error", finish);
    child.once("close", (code) => {
      if (code === 0) {
        finish(null, stdout);
        return;
      }
      finish(new Error(stderr.replaceAll("\0", "").trim() || `${commandLabel} exited with code ${code ?? "unknown"}.`));
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
