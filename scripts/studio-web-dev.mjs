#!/usr/bin/env node

import { spawn } from "node:child_process";
import { join, resolve } from "node:path";

const root = resolve(process.cwd());
const webRoot = join(root, "apps", "web");
const nextCliPath = join(root, "node_modules", "next", "dist", "bin", "next");
const args = parseArgs(process.argv.slice(2));
const timeoutMs = 1800;
const startupTimeoutMs = 45_000;
const probePorts = [3000, 3001, 3002, 3003, 3004, 3005, 3006, 3007];
const host = args.host || "127.0.0.1";
const port = Number(args.port || 3000);
const baseUrl = `http://${host}:${port}`;
let startedChild = null;
let childStartProblem = null;
let shuttingDown = false;

await main();

async function main() {
  if (args.help) {
    printHelp();
    return;
  }

  const cliError = validateArgs();
  if (cliError) {
    output({
      ok: false,
      baseUrl,
      action: "refused",
      reason: cliError
    }, `Refusing to start Web UI: ${cliError}`);
    process.exitCode = 1;
    return;
  }

  if (args.json && !args.dryRun) {
    output({
      ok: false,
      baseUrl,
      action: "refused",
      reason: "--json is supported for dry-run/refusal output only"
    }, "--json is supported with --dry-run or refusal checks only because the dev server is long-running and streams logs.");
    process.exitCode = 1;
    return;
  }

  const selected = await inspectBaseUrl(baseUrl);
  const suggestion = await suggestFreePort(port);
  const selectedSummary = summarizeInspection(selected);

  if (selected.classification === "likely-studio") {
    await handleAlreadyHealthy(selectedSummary);
    return;
  }

  if (selected.classification !== "unreachable") {
    const reason = refusalReason(selected.classification);
    output({
      ok: false,
      baseUrl,
      action: "refused",
      selected: selectedSummary,
      suggestedPort: suggestion?.port || null,
      suggestedBaseUrl: suggestion?.baseUrl || null,
      recoveryRunbook: "docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md"
    }, [
      `Refusing to start Web UI on ${baseUrl}: ${reason}.`,
      `Selected port classification: ${selected.classification}.`,
      suggestion
        ? `Try: npm run studio:web -- --port ${suggestion.port} --open --ui-smoke`
        : "No free port was found in 3000-3007; choose a known-free port with --port.",
      "This wrapper never kills existing processes, deletes caches, or edits env files.",
      "Runbook: docs/runbooks/HEALTHY_STUDIO_SERVER_RECOVERY.md"
    ].join("\n"));
    process.exitCode = 1;
    return;
  }

  if (args.dryRun) {
    output({
      ok: true,
      baseUrl,
      action: "dry-run",
      selected: selectedSummary,
      startCommand: startCommandDisplay(),
      openCommand: args.open ? `node scripts/open-studio-browser.mjs --url=${baseUrl}/` : null,
      smokeCommands: smokeCommands()
    }, [
      `Dry run: ${baseUrl} is free.`,
      `Would start: ${startCommandDisplay()}`,
      args.open ? `Would open: node scripts/open-studio-browser.mjs --url=${baseUrl}/` : "Open: disabled.",
      ...smokeCommands().map((command) => `Would run: ${command}`),
      "Ctrl+C would stop only the Web UI child process started by this wrapper."
    ].join("\n"));
    return;
  }

  await startDevServer();
}

function parseArgs(values) {
  const parsed = {
    dryRun: false,
    help: false,
    host: "",
    json: false,
    noOpen: false,
    open: false,
    port: "",
    smoke: false,
    uiSmoke: false,
    unknown: [],
    verbose: false
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--help" || value === "-h") {
      parsed.help = true;
    } else if (value === "--dry-run") {
      parsed.dryRun = true;
    } else if (value === "--host") {
      parsed.host = values[index + 1] || "";
      index += 1;
    } else if (value.startsWith("--host=")) {
      parsed.host = value.slice("--host=".length);
    } else if (value === "--json") {
      parsed.json = true;
    } else if (value === "--no-open") {
      parsed.noOpen = true;
      parsed.open = false;
    } else if (value === "--open") {
      parsed.open = !parsed.noOpen;
    } else if (value === "--port") {
      parsed.port = values[index + 1] || "";
      index += 1;
    } else if (value.startsWith("--port=")) {
      parsed.port = value.slice("--port=".length);
    } else if (value === "--smoke") {
      parsed.smoke = true;
    } else if (value === "--ui-smoke") {
      parsed.uiSmoke = true;
    } else if (value === "--verbose") {
      parsed.verbose = true;
    } else {
      parsed.unknown.push(value);
    }
  }

  return parsed;
}

function validateArgs() {
  if (args.unknown.length > 0) {
    return `unknown argument(s): ${args.unknown.join(", ")}`;
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return `--port must be an integer from 1 to 65535; received ${args.port || "3000"}`;
  }
  if (!/^[a-zA-Z0-9.:-]+$/.test(host)) {
    return `--host contains unsupported characters; received ${host}`;
  }
  return "";
}

async function handleAlreadyHealthy(selectedSummary) {
  output({
    ok: true,
    baseUrl,
    action: "already-running",
    selected: selectedSummary,
    smokeCommands: smokeCommands()
  }, [
    `A healthy Studio server is already running at ${baseUrl}.`,
    "No new dev server was started.",
    args.open ? `Opening: node scripts/open-studio-browser.mjs --url=${baseUrl}/` : "Open: disabled.",
    ...smokeCommands().map((command) => `Running: ${command}`)
  ].join("\n"));

  if (args.open) {
    await runOneShot("studio:open", process.execPath, ["scripts/open-studio-browser.mjs", `--url=${baseUrl}/`]);
  }
  await runRequestedSmokes();
}

async function startDevServer() {
  const commandSpec = buildDevCommand();
  printText([
    "Brain Memory Studio Web UI dev server",
    "=====================================",
    `Selected URL: ${baseUrl}`,
    `Starting: ${commandSpec.display}`,
    args.verbose ? `Spawn command: ${commandSpec.command} ${commandSpec.args.join(" ")}` : "",
    args.verbose ? `Spawn cwd: ${commandSpec.cwd}` : "",
    args.verbose ? `Platform: ${process.platform}${isWsl() ? " (WSL)" : ""}` : "",
    "This starts only the Web UI dev server.",
    "Ctrl+C stops only the child process started by this wrapper.",
    ""
  ].filter(Boolean).join("\n"));

  registerShutdownHandlers();
  startedChild = spawnWebDevServer(commandSpec);

  startedChild.on("exit", (code, signal) => {
    if (!shuttingDown) {
      printText(`Web UI dev server exited with ${signal || code || 0}.`);
    }
    process.exitCode = typeof code === "number" ? code : 0;
  });

  const ready = await waitForHealthyServer();
  if (!ready.ok) {
    printText(`Web UI did not become healthy at ${baseUrl}: ${ready.reason}`);
    stopStartedChild();
    process.exitCode = 1;
    return;
  }

  printText(`Web UI is healthy at ${baseUrl}.`);
  if (args.open) {
    await runOneShot("studio:open", process.execPath, ["scripts/open-studio-browser.mjs", `--url=${baseUrl}/`]);
  }
  await runRequestedSmokes();
  printText("Server is still running. Press Ctrl+C to stop this Web UI child process.");
}

async function waitForHealthyServer() {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < startupTimeoutMs) {
    if (childStartProblem) {
      return { ok: false, reason: childStartProblem };
    }
    if (startedChild?.exitCode !== null) {
      return { ok: false, reason: `child exited with ${startedChild.exitCode}` };
    }
    last = await inspectBaseUrl(baseUrl);
    if (last.classification === "likely-studio") {
      return { ok: true };
    }
    if (args.verbose) {
      printText(`Waiting for ${baseUrl}: ${describeInspection(last)}`);
    }
    await sleep(1000);
  }
  return { ok: false, reason: last ? describeInspection(last) : "timeout" };
}

async function runRequestedSmokes() {
  if (args.smoke) {
    await runOneShot("smoke:mvp", npmCommand(), ["run", "smoke:mvp", "--", "--base-url", baseUrl]);
  }
  if (args.uiSmoke) {
    await runOneShot("smoke:ui", npmCommand(), ["run", "smoke:ui", "--", "--base-url", baseUrl]);
  }
}

async function runOneShot(label, command, commandArgs) {
  printText(`Running ${label}: ${[command, ...commandArgs].join(" ")}`);
  const result = await new Promise((resolveResult) => {
    const spawnSpec = buildPortableSpawn(command, commandArgs);
    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd: root,
      env: process.env,
      shell: spawnSpec.shell,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
    child.on("exit", (code, signal) => {
      resolveResult({ code, signal });
    });
    child.on("error", (error) => {
      resolveResult({ code: 1, error });
    });
  });

  if (result.code !== 0) {
    const detail = result.error?.message || result.signal || `exit ${result.code}`;
    printText(`${label} failed: ${detail}`);
    process.exitCode = 1;
  }
}

async function inspectBaseUrl(targetBaseUrl) {
  const rootResult = await fetchText(`${targetBaseUrl}/`);
  if (!rootResult.ok) {
    return {
      baseUrl: targetBaseUrl,
      classification: "unreachable",
      root: summarizeFetch(rootResult),
      staticAssets: { checked: 0, failures: [] }
    };
  }

  const html = rootResult.text || "";
  const looksLikeStudio = html.includes("Brain Memory Studio");
  const oldGreenUiPresent = /old green ui|#00ff00|#0f0\b/i.test(html);
  const assets = extractStaticAssetPaths(html).slice(0, 6);
  const staticAssets = assets.length > 0
    ? await checkStaticAssets(targetBaseUrl, assets)
    : { checked: 0, failures: [] };
  const hermesStatus = await fetchJson(`${targetBaseUrl}/api/hermes/status`);
  const classification = classify({
    hermesStatus,
    looksLikeStudio,
    oldGreenUiPresent,
    rootResult,
    staticAssets
  });

  return {
    baseUrl: targetBaseUrl,
    classification,
    hermesStatus: {
      ok: hermesStatus.ok,
      mode: hermesStatus.body?.mode,
      reachable: hermesStatus.body?.reachable,
      status: hermesStatus.status || 0
    },
    looksLikeStudio,
    oldGreenUiPresent,
    root: summarizeFetch(rootResult),
    staticAssets
  };
}

function classify({ hermesStatus, looksLikeStudio, oldGreenUiPresent, rootResult, staticAssets }) {
  if (!rootResult.ok) {
    return "unreachable";
  }
  if (looksLikeStudio && (oldGreenUiPresent || staticAssets.failures.length > 0)) {
    return "stale-or-broken-studio";
  }
  if (looksLikeStudio) {
    return "likely-studio";
  }
  if (hermesStatus.ok) {
    return "possible-studio-bff";
  }
  return "occupied-non-studio";
}

async function suggestFreePort(selectedPort) {
  const candidates = Array.from(new Set([
    ...probePorts.filter((candidate) => candidate !== selectedPort),
    selectedPort + 1,
    selectedPort + 2
  ])).filter((candidate) => candidate > 0 && candidate <= 65535);

  for (const candidate of candidates) {
    const target = `http://${host}:${candidate}`;
    const inspection = await inspectBaseUrl(target);
    if (inspection.classification === "unreachable") {
      return { baseUrl: target, port: candidate };
    }
  }
  return null;
}

function extractStaticAssetPaths(html) {
  const matches = html.matchAll(/["'](\/_next\/static\/[^"']+)["']/g);
  return Array.from(new Set(Array.from(matches, (match) => match[1].replace(/&amp;/g, "&"))));
}

async function checkStaticAssets(targetBaseUrl, assets) {
  const results = [];
  for (const asset of assets) {
    const result = await fetchHeadOrGet(`${targetBaseUrl}${asset}`);
    results.push({
      error: result.error,
      ok: result.ok,
      path: asset,
      status: result.status || 0
    });
  }
  return {
    checked: results.length,
    failures: results.filter((item) => !item.ok)
  };
}

async function fetchHeadOrGet(url) {
  const head = await fetchWithTimeout(url, { method: "HEAD" }, async () => "");
  if (head.ok || head.status !== 405) {
    return head;
  }
  return fetchWithTimeout(url, {}, async () => "");
}

async function fetchText(url) {
  return fetchWithTimeout(url, {}, async (response) => response.text());
}

async function fetchJson(url) {
  return fetchWithTimeout(url, {}, async (response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { parseError: true, preview: text.slice(0, 120) };
    }
  });
}

async function fetchWithTimeout(url, init, readBody) {
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
      body,
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

function summarizeInspection(value) {
  return {
    baseUrl: value.baseUrl,
    classification: value.classification,
    hermesBffReachable: value["hermesStatus"]?.ok === true,
    looksLikeStudio: value.looksLikeStudio === true,
    oldGreenUiPresent: value.oldGreenUiPresent === true,
    rootStatus: value.root?.status || 0,
    staticChecked: value.staticAssets?.checked || 0,
    staticFailures: (value.staticAssets?.failures || []).map((failure) => ({
      path: failure.path,
      status: failure.status || 0,
      error: failure.error
    }))
  };
}

function summarizeFetch(result) {
  return {
    error: result.error,
    ok: result.ok === true,
    status: result.status || 0
  };
}

function refusalReason(classification) {
  if (classification === "stale-or-broken-studio") {
    return "the selected port is serving a stale or broken Studio build";
  }
  if (classification === "possible-studio-bff") {
    return "the selected port appears to be occupied by a Studio-like BFF that is not a healthy app";
  }
  return "the selected port is occupied by a non-Studio server";
}

function startCommandDisplay() {
  return buildDevCommand().display;
}

function smokeCommands() {
  const commands = [];
  if (args.smoke) {
    commands.push(`npm run smoke:mvp -- --base-url ${baseUrl}`);
  }
  if (args.uiSmoke) {
    commands.push(`npm run smoke:ui -- --base-url ${baseUrl}`);
  }
  return commands;
}

function npmCommand() {
  return isWindows() ? "npm.cmd" : "npm";
}

function isWindows() {
  return process.platform === "win32";
}

function isWsl() {
  if (process.platform !== "linux") {
    return false;
  }
  return Boolean(process.env.WSL_DISTRO_NAME || process.env.WSL_INTEROP);
}

function buildDevCommand() {
  return {
    args: [nextCliPath, "dev", "--hostname", host, "--port", String(port)],
    command: process.execPath,
    cwd: webRoot,
    display: `cd apps/web && node ${relativeNextCliDisplay()} dev --hostname ${host} --port ${port}`,
    shell: false
  };
}

function spawnWebDevServer(commandSpec) {
  const child = spawn(commandSpec.command, commandSpec.args, {
    cwd: commandSpec.cwd,
    env: process.env,
    shell: commandSpec.shell,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  child.on("error", (error) => {
    childStartProblem = `${error.code || "spawn-error"}: ${error.message}`;
    printText(`Web UI dev server failed to start: ${childStartProblem}`);
  });
  return child;
}

function buildPortableSpawn(command, commandArgs) {
  if (isWindows() && isCmdShim(command)) {
    return {
      args: [],
      command: commandLine(command, commandArgs),
      shell: true
    };
  }
  return {
    args: commandArgs,
    command,
    shell: false
  };
}

function isCmdShim(command) {
  return command.toLowerCase().endsWith(".cmd");
}

function commandLine(command, commandArgs) {
  return [command, ...commandArgs].map((value) => (
    /\s/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value
  )).join(" ");
}

function relativeNextCliDisplay() {
  return isWindows()
    ? "..\\..\\node_modules\\next\\dist\\bin\\next"
    : "../../node_modules/next/dist/bin/next";
}

function registerShutdownHandlers() {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      shuttingDown = true;
      printText(`Received ${signal}; stopping Web UI child process started by this wrapper.`);
      stopStartedChild();
      setTimeout(() => {
        process.exit(signal === "SIGINT" ? 130 : 143);
      }, 800).unref();
    });
  }
}

function stopStartedChild() {
  if (!startedChild || startedChild.killed) {
    return;
  }
  if (isWindows() && startedChild.pid) {
    const killer = spawn("taskkill.exe", ["/PID", String(startedChild.pid), "/T"], {
      stdio: "ignore",
      windowsHide: true
    });
    killer.on("error", () => {
      startedChild.kill("SIGINT");
    });
    return;
  }
  startedChild.kill("SIGINT");
}

function describeInspection(inspection) {
  const details = [inspection.classification];
  if (inspection.root?.status) {
    details.push(`root HTTP ${inspection.root.status}`);
  } else if (inspection.root?.error) {
    details.push(`root ${inspection.root.error}`);
  }
  const failures = inspection.staticAssets?.failures || [];
  if (failures.length > 0) {
    const first = failures[0];
    details.push(`static chunk failed: ${first.path} -> ${first.status || first.error || "unknown"}`);
  }
  return details.join("; ");
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function output(jsonValue, textValue) {
  if (args.json) {
    console.log(JSON.stringify(jsonValue, null, 2));
  } else {
    printText(textValue);
  }
}

function printText(value) {
  console.log(value);
}

function printHelp() {
  console.log(`Brain Memory Studio Web UI dev server wrapper
==============================================

Purpose:
  Explicitly start only the Next.js Web UI dev server after checking that the
  selected port is free or already serving a healthy Studio app.

Usage:
  npm run studio:web -- [flags]
  node scripts/studio-web-dev.mjs [flags]

Flags:
  --help             Print this help and exit.
  --port <port>      Selected Web UI port. Default: 3000.
  --host <host>      Selected host. Default: 127.0.0.1.
  --open             Open the selected base URL after it is healthy.
  --no-open          Keep browser opening disabled.
  --smoke            Run smoke:mvp against the selected base URL.
  --ui-smoke         Run smoke:ui against the selected base URL.
  --dry-run          Print what would happen without starting a server.
  --json             Print structured output for dry-run/refusal checks.
  --verbose          Print repeated startup wait status.

Examples:
  npm run studio:web -- --port 3002 --open --ui-smoke
  npm run studio:web -- --port 3002 --dry-run
  npm run studio:web:3002 -- --open

Behavior:
  - refuses stale or broken selected Studio ports;
  - refuses occupied non-Studio ports;
  - does not kill existing processes;
  - does not delete .next;
  - does not edit env files;
  - does not manage Hermes, Brain Memory, or system services;
  - starts only the Web UI workspace Next CLI from apps/web;
  - uses npm.cmd on Windows Node and npm on Linux/WSL/macOS for optional smokes;
  - avoids npm.cmd for the long-running dev server to avoid spawn EINVAL;
  - pipes child logs instead of inheriting hidden automation handles;
  - Ctrl+C stops only the child process started by this wrapper.`);
}
