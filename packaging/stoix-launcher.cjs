"use strict";

const { spawn } = require("node:child_process");
const { createServer } = require("node:net");
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { homedir } = require("node:os");
const { dirname, join, resolve } = require("node:path");

const args = parseArgs(process.argv.slice(2));
const bundleRoot = resolve(__dirname, "..");
const appRoot = join(bundleRoot, "app");
const serverPath = join(appRoot, "apps", "web", "server.js");
let child = null;
let stopping = false;

const stop = () => {
  if (stopping || !child) return;
  stopping = true;
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 4_000).unref();
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  stop();
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
  const requestedPort = args.port ?? Number(config.STOIX_PORT || 3210);
  const port = await choosePort(hostname, requestedPort);
  const url = `http://${hostname}:${port}/`;

  child = spawn(process.execPath, [serverPath], {
    cwd: appRoot,
    env: {
      ...process.env,
      ...config,
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

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  child.once("exit", (code, signal) => {
    if (!stopping && code !== 0) {
      console.error(`Stoix server exited before shutdown (code=${code}, signal=${signal || "none"}).`);
    }
    process.exitCode = stopping ? 0 : code ?? (signal ? 1 : 0);
  });

  await waitUntilReady(url, 30_000);
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
    openBrowser(url);
  }
}

function parseArgs(values) {
  const parsed = { config: null, help: false, noOpen: false, port: null, smoke: false };
  for (const value of values) {
    if (value === "--help" || value === "-h") parsed.help = true;
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
  if (existsSync(path)) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    [
      "# Stoix local configuration. Keep this file private.",
      "HERMES_API_BASE_URL=http://127.0.0.1:8642",
      "HERMES_API_KEY=",
      "HERMES_UI_ENABLE_REAL_HERMES=true",
      "",
      "# Optional Hermes dashboard overrides.",
      "HERMES_DASHBOARD_BASE_URL=",
      "HERMES_DASHBOARD_SESSION_TOKEN=",
      ""
    ].join("\n"),
    { encoding: "utf8", mode: 0o600 }
  );
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

async function choosePort(host, preferredPort) {
  for (let offset = 0; offset < 20; offset += 1) {
    const candidate = preferredPort + offset;
    if (candidate > 65535) break;
    if (await isPortAvailable(host, candidate)) return candidate;
  }
  throw new Error(`No free local port was found near ${preferredPort}.`);
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
  const opener = spawn(command.file, command.args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  opener.unref();
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
  --port=PORT     Preferred loopback port; Stoix tries the next 19 if occupied.
  --config=PATH   Use a specific private configuration file.
  --smoke         Start, verify the production routes, then stop.
  --help          Show this help.
`);
}

function fail(message) {
  console.error(message);
  process.exit(2);
}
