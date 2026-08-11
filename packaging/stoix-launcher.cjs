"use strict";

const { spawn } = require("node:child_process");
const { createServer } = require("node:net");
const {
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync
} = require("node:fs");
const { homedir } = require("node:os");
const { dirname, join, resolve } = require("node:path");

const args = parseArgs(process.argv.slice(2));
const bundleRoot = resolve(__dirname, "..");
const appRoot = join(bundleRoot, "app");
const serverPath = join(appRoot, "apps", "web", "server.js");
let child = null;
let stopping = false;
let startupError = null;
let instanceLockPath = null;
let runtimeStatePath = null;
let ownsInstanceLock = false;
let failureExitCode = null;

const stop = () => {
  if (stopping) return;
  stopping = true;
  if (!child) {
    cleanupInstanceFiles();
    return;
  }
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 4_000).unref();
};

main().catch((error) => {
  failureExitCode = 1;
  console.error(error instanceof Error ? error.message : String(error));
  stop();
  cleanupInstanceFiles();
  process.exitCode = 1;
});

async function main() {
  if (args.help) {
    printHelp();
    return;
  }

  if (!existsSync(serverPath)) {
    fail(`Stoix server is missing: ${serverPath}`);
  }

  const configPath = args.config ? resolve(args.config) : defaultConfigPath();
  ensureConfig(configPath);
  const config = readConfig(configPath);
  const hostname = "127.0.0.1";
  const requestedPort = args.port ?? parsePort(config.STOIX_PORT || "3210", "STOIX_PORT");

  if (args.doctor) {
    await printDoctor(configPath, config);
    return;
  }

  const instance = await acquireInstance(dirname(configPath));
  if (instance) {
    console.log(`Stoix ${instance.version || readVersion()} is already running at ${instance.url}`);
    console.log(`Configuration: ${configPath}`);
    if (!args.noOpen) void openBrowser(instance.url);
    return;
  }

  const port = await choosePort(hostname, requestedPort, configPath);
  const url = `http://${hostname}:${port}/`;

  child = spawn(process.execPath, [serverPath], {
    cwd: appRoot,
    env: {
      ...config,
      ...process.env,
      HERMES_API_BASE_URL:
        process.env.HERMES_API_BASE_URL ||
        config.HERMES_API_BASE_URL ||
        "http://127.0.0.1:8642",
      HERMES_UI_ENABLE_REAL_HERMES:
        process.env.HERMES_UI_ENABLE_REAL_HERMES ||
        config.HERMES_UI_ENABLE_REAL_HERMES ||
        "true",
      HOSTNAME: hostname,
      NODE_ENV: "production",
      PORT: String(port)
    },
    stdio: "inherit",
    windowsHide: true
  });
  child.once("error", (error) => {
    startupError = error;
  });

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  process.on("exit", cleanupInstanceFiles);
  child.once("exit", (code, signal) => {
    cleanupInstanceFiles();
    if (!stopping && code !== 0) {
      console.error(`Stoix server exited before shutdown (code=${code}, signal=${signal || "none"}).`);
    }
    process.exitCode = failureExitCode ?? (stopping ? 0 : code ?? (signal ? 1 : 0));
  });

  await waitUntilReady(url, 30_000);
  writeRuntimeState(url);
  console.log(`Stoix ${readVersion()} is running at ${url}`);
  console.log(`Configuration: ${configPath}`);
  if (args.smoke) {
    const status = await fetch(new URL("/api/hermes/status", url), { cache: "no-store" });
    if (!status.ok) {
      throw new Error(`Hermes status route returned HTTP ${status.status}.`);
    }
    console.log("Stoix package smoke passed.");
    stop();
  } else if (!args.noOpen) {
    void openBrowser(url);
  }
}

function parseArgs(values) {
  const parsed = {
    config: null,
    doctor: false,
    help: false,
    noOpen: false,
    port: null,
    smoke: false
  };
  for (const value of values) {
    if (value === "--help" || value === "-h") parsed.help = true;
    else if (value === "--doctor") {
      parsed.doctor = true;
      parsed.noOpen = true;
    }
    else if (value === "--no-open") parsed.noOpen = true;
    else if (value === "--smoke") {
      parsed.smoke = true;
      parsed.noOpen = true;
    } else if (value.startsWith("--port=")) {
      const port = Number(value.slice("--port=".length));
      if (!Number.isInteger(port) || port < 1 || port > 65535) fail("Invalid --port value.");
      parsed.port = port;
    } else if (value.startsWith("--config=")) {
      parsed.config = value.slice("--config=".length);
    } else {
      fail(`Unknown option: ${value}`);
    }
  }
  return parsed;
}

function defaultConfigPath() {
  if (process.platform === "win32") {
    return join(process.env.APPDATA || join(homedir(), "AppData", "Roaming"), "Stoix", "config.env");
  }
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support", "Stoix", "config.env");
  }
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "stoix", "config.env");
}

function ensureConfig(path) {
  const configDirectory = dirname(path);
  mkdirSync(configDirectory, { recursive: true, mode: 0o700 });
  if (!existsSync(path)) {
    writeFileSync(
      path,
      [
        "# Stoix local configuration. Keep this file private.",
        "HERMES_API_BASE_URL=http://127.0.0.1:8642",
        "HERMES_API_KEY=",
        "HERMES_UI_ENABLE_REAL_HERMES=true",
        "STOIX_PORT=3210",
        "",
        "# Optional Hermes dashboard overrides.",
        "HERMES_DASHBOARD_BASE_URL=",
        "HERMES_DASHBOARD_SESSION_TOKEN=",
        ""
      ].join("\n"),
      { encoding: "utf8", mode: 0o600 }
    );
  }
  if (process.platform !== "win32") {
    chmodSync(configDirectory, 0o700);
    chmodSync(path, 0o600);
  }
}

function readConfig(path) {
  const allowed = new Set([
    "HERMES_API_BASE_URL",
    "HERMES_API_KEY",
    "HERMES_DASHBOARD_BASE_URL",
    "HERMES_DASHBOARD_SESSION_TOKEN",
    "HERMES_UI_DEFAULT_MODEL_ID",
    "HERMES_UI_ENABLE_REAL_HERMES",
    "HERMES_UI_UPDATE_MANIFEST_URL",
    "STOIX_PORT"
  ]);
  const result = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (!allowed.has(key)) continue;
    result[key] = unquote(trimmed.slice(separator + 1).trim());
  }
  return result;
}

function unquote(value) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function choosePort(host, preferredPort, configPath) {
  if (await isPortAvailable(host, preferredPort)) {
    return preferredPort;
  }
  throw new Error(
    `Stoix local port ${preferredPort} is already in use. Close the application using it, ` +
      `or set STOIX_PORT to another stable port in ${configPath}. Stoix does not switch ports ` +
      "silently because browser workspace data is tied to the local address."
  );
}

function isPortAvailable(host, port) {
  return new Promise((resolveAvailable) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolveAvailable(false));
    server.listen({ host, port, exclusive: true }, () => {
      server.close(() => resolveAvailable(true));
    });
  });
}

async function waitUntilReady(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (startupError) throw new Error(`Stoix server could not start: ${startupError.message}`);
    if (child.exitCode !== null) throw new Error("Stoix server stopped during startup.");
    try {
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(1_500) });
      if (response.ok) return;
    } catch {
      // Startup is still in progress.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  }
  throw new Error(`Stoix did not become ready within ${Math.round(timeoutMs / 1_000)} seconds.`);
}

function openBrowser(url) {
  const command =
    process.platform === "win32"
      ? { file: "cmd.exe", args: ["/d", "/s", "/c", "start", "", url] }
      : process.platform === "darwin"
        ? { file: "open", args: [url] }
        : { file: "xdg-open", args: [url] };
  return new Promise((resolveOpen) => {
    const opener = spawn(command.file, command.args, {
      detached: true,
      stdio: "ignore",
      windowsHide: true
    });
    opener.once("error", (error) => {
      console.warn(`Could not open the browser automatically (${error.message}). Open ${url}`);
      resolveOpen(false);
    });
    opener.once("spawn", () => {
      opener.unref();
      resolveOpen(true);
    });
  });
}

function readVersion() {
  try {
    return JSON.parse(readFileSync(join(bundleRoot, "VERSION.json"), "utf8")).version;
  } catch {
    return "0.1.0";
  }
}

function printHelp() {
  console.log(`Stoix launcher

Usage:
  Stoix [--no-open] [--port=3210] [--config=/path/config.env]

Options:
  --no-open       Start without opening the default browser.
  --port=PORT     Stable loopback port (default: 3210).
  --config=PATH   Use a specific private configuration file.
  --doctor        Check the package, configuration, and Hermes connection.
  --smoke         Start, verify the production routes, then stop.
  --help          Show this help.
`);
}

function parsePort(value, label) {
  const port = Number(value);
  if (!/^\d{1,5}$/.test(String(value)) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${label} must be an integer from 1 to 65535.`);
  }
  return port;
}

async function acquireInstance(configDirectory) {
  instanceLockPath = join(configDirectory, "stoix.lock");
  runtimeStatePath = join(configDirectory, "runtime.json");

  const running = await readRunningInstance();
  if (running) return running;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = openSync(instanceLockPath, "wx", 0o600);
      writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
      closeSync(descriptor);
      ownsInstanceLock = true;
      return null;
    } catch (error) {
      if (!error || error.code !== "EEXIST") throw error;
    }

    const lock = readJson(instanceLockPath);
    if (!isProcessAlive(lock?.pid)) {
      rmSync(instanceLockPath, { force: true });
      continue;
    }

    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const existing = await readRunningInstance();
      if (existing) return existing;
      if (!isProcessAlive(lock?.pid)) break;
      await delay(250);
    }
    throw new Error("Stoix is already starting. Wait a few seconds, then run Stoix again.");
  }

  throw new Error(`Could not acquire the Stoix startup lock: ${instanceLockPath}`);
}

async function readRunningInstance() {
  if (!runtimeStatePath || !existsSync(runtimeStatePath)) return null;
  const state = readJson(runtimeStatePath);
  if (!state || typeof state.url !== "string" || !/^http:\/\/127\.0\.0\.1:\d+\/$/.test(state.url)) {
    rmSync(runtimeStatePath, { force: true });
    return null;
  }
  try {
    const response = await fetch(state.url, {
      cache: "no-store",
      signal: AbortSignal.timeout(1_500)
    });
    if (response.ok) return state;
  } catch {
    // A stale runtime record is removed below.
  }
  rmSync(runtimeStatePath, { force: true });
  return null;
}

function writeRuntimeState(url) {
  if (!runtimeStatePath) return;
  writeFileSync(
    runtimeStatePath,
    `${JSON.stringify({ pid: process.pid, serverPid: child?.pid ?? null, url, version: readVersion() }, null, 2)}\n`,
    { encoding: "utf8", mode: 0o600 }
  );
  if (process.platform !== "win32") chmodSync(runtimeStatePath, 0o600);
}

function cleanupInstanceFiles() {
  if (!ownsInstanceLock) return;
  if (runtimeStatePath) rmSync(runtimeStatePath, { force: true });
  if (instanceLockPath) rmSync(instanceLockPath, { force: true });
  ownsInstanceLock = false;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function printDoctor(configPath, config) {
  const hermesUrl = config.HERMES_API_BASE_URL || "http://127.0.0.1:8642";
  let hermesStatus = "unreachable";
  try {
    const response = await fetch(new URL("/health", hermesUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(2_000)
    });
    hermesStatus = response.ok ? "ready" : `HTTP ${response.status}`;
  } catch {
    // The readable unreachable status is printed below.
  }

  console.log(`Stoix ${readVersion()} diagnostics`);
  console.log(`Platform: ${process.platform}-${process.arch}`);
  console.log(`Application: ${existsSync(serverPath) ? "ready" : "missing"}`);
  console.log(`Configuration: ${configPath}`);
  console.log(`Hermes: ${hermesStatus} (${hermesUrl})`);
  if (hermesStatus !== "ready") {
    console.log("Recovery: run `hermes doctor`, then `hermes gateway start`.");
  }
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
