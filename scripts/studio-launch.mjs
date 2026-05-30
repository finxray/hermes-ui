#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const args = parseArgs(process.argv.slice(2));
const timeoutMs = 3500;
const webUiUrl = trimSlash(process.env.STUDIO_WEB_UI_URL || "http://127.0.0.1:3000");
const envPath = join(root, "apps", "web", ".env.local");
const env = readEnvFile(envPath);

const report = {
  cwd: root,
  webUiUrl,
  mode: "unknown",
  flags: {
    check: args.check,
    devCommand: args.devCommand,
    open: args.open,
    requireBrainMemory: args.requireBrainMemory,
    requireHermes: args.requireHermes,
    smoke: args.smoke,
    uiSmoke: args.uiSmoke,
    verbose: args.verbose
  },
  checks: [],
  commands: [],
  env: {
    hermes: readHermesEnv(env),
    brainMemory: readBrainMemoryEnv(env)
  },
  services: {
    webUi: null,
    staticAssets: null,
    hermesBff: null,
    hermesDirect: null,
    brainMemoryBff: null,
    brainMemoryDirect: null
  },
  suggestions: []
};

await main();

async function main() {
  for (const arg of args.unknown) {
    addCheck("cli-args", "fail", `Unknown argument: ${arg}`);
  }

  checkRepo();
  await checkToolchain();
  report.mode = inferMode(report.env);
  const webUiResult = await checkWebUi();
  const staticAssetsResult = await checkStaticAssets(webUiResult);
  const hermesBffResult = await checkHermesBff(webUiResult);
  const hermesDirectResult = await checkHermesDirect(report.env.hermes);
  const brainMemoryBffResult = await checkBrainMemoryBff(webUiResult);
  const brainMemoryDirectResult = await checkBrainMemoryDirect(report.env.brainMemory);

  report.services.webUi = summarizeWebUi(webUiResult);
  report.services.staticAssets = staticAssetsResult;
  report.services.hermesBff = summarizeBffStatus(hermesBffResult);
  report.services.hermesDirect = summarizeService(hermesDirectResult);
  report.services.brainMemoryBff = summarizeBffStatus(brainMemoryBffResult);
  report.services.brainMemoryDirect = summarizeService(brainMemoryDirectResult);
  checkRequiredServices();

  if (args.devCommand) {
    addCommand("dev-command", "pass", "npm run dev", "Run this in a separate terminal to start the Web UI dev server.");
  }

  if (args.smoke) {
    await runSmokeCommand(
      "smoke:mvp",
      `npm run smoke:mvp${requireFlagsForSmoke().length ? ` -- ${requireFlagsForSmoke().join(" ")}` : ""}`,
      process.execPath,
      [join(root, "scripts", "mvp-smoke.mjs"), ...requireFlagsForSmoke()]
    );
  }

  if (args.uiSmoke) {
    await runSmokeCommand(
      "smoke:ui",
      "npm run smoke:ui",
      process.execPath,
      [join(root, "scripts", "ui-interaction-smoke.mjs")]
    );
  }

  if (args.open) {
    await runOpenCommand();
  }

  report.suggestions = makeSuggestions();

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport();
  }

  const failed = report.checks.some((check) => check.status === "fail") ||
    report.commands.some((command) => command.status === "fail");
  process.exitCode = failed ? 1 : 0;
}

function parseArgs(values) {
  const parsed = {
    check: false,
    devCommand: false,
    json: false,
    open: false,
    requireBrainMemory: false,
    requireHermes: false,
    smoke: false,
    uiSmoke: false,
    unknown: [],
    verbose: false
  };

  for (const value of values) {
    if (value === "--check") {
      parsed.check = true;
    } else if (value === "--dev-command") {
      parsed.devCommand = true;
    } else if (value === "--json") {
      parsed.json = true;
    } else if (value === "--open") {
      parsed.open = true;
    } else if (value === "--require-brain-memory") {
      parsed.requireBrainMemory = true;
    } else if (value === "--require-hermes") {
      parsed.requireHermes = true;
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

function checkRepo() {
  addCheck(
    "repo-root",
    hasRepoShape(),
    "Current directory looks like Hermes UI repo.",
    "Run this command from the Hermes UI repository root."
  );
  addCheck(
    "web-env-local",
    existsSync(envPath),
    "apps/web/.env.local exists.",
    "apps/web/.env.local is missing. Run npm run studio:env -- --mode web-ui-with-hermes or another mode.",
    "warn"
  );
}

async function checkToolchain() {
  addCheck("node", isNodeVersionSupported(process.version), `Node ${process.version}`, "Node 20.9+ is recommended.");
  const npmVersion = await getNpmVersion();
  addCheck("npm", Boolean(npmVersion), npmVersion ? `npm ${npmVersion}` : "npm was not found.", "Install npm with Node.js.");
}

function hasRepoShape() {
  return existsSync(join(root, "package.json")) &&
    existsSync(join(root, "apps", "web", "package.json")) &&
    existsSync(join(root, "packages"));
}

async function getNpmVersion() {
  const userAgent = process.env.npm_config_user_agent;
  const fromUserAgent = userAgent?.match(/npm\/([^\s]+)/)?.[1];
  if (fromUserAgent) {
    return fromUserAgent;
  }

  for (const command of process.platform === "win32" ? ["npm.cmd", "npm"] : ["npm"]) {
    try {
      const { stdout } = await execFileAsync(command, ["--version"], { timeout: timeoutMs });
      return stdout.trim();
    } catch {
      // Try the next command form.
    }
  }
  return "";
}

function isNodeVersionSupported(version) {
  const major = Number(version.replace(/^v/, "").split(".")[0]);
  return Number.isFinite(major) && major >= 20;
}

async function checkWebUi() {
  const result = await fetchText(`${webUiUrl}/`);
  if (!result.ok) {
    addCheck(
      "web-ui-root",
      false,
      "",
      `Web UI is not reachable at ${webUiUrl} (${describeFetchResult(result)}).`,
      "warn"
    );
    return { ...result, statusLabel: "unreachable" };
  }

  const titleOk = typeof result.text === "string" && result.text.includes("<title>Brain Memory Studio</title>");
  addCheck("web-ui-root", true, `Web UI returned HTTP ${result.status}.`, "");
  addCheck(
    "web-ui-title",
    titleOk,
    "Root HTML includes the Brain Memory Studio title.",
    "Root HTML did not include the Brain Memory Studio title.",
    "warn"
  );
  return { ...result, statusLabel: "connected" };
}

async function checkStaticAssets(rootResult) {
  if (!rootResult?.ok || typeof rootResult.text !== "string") {
    addCheck(
      "next-static-assets",
      false,
      "",
      "Static asset check skipped because the Web UI root is not reachable.",
      "warn"
    );
    return { status: "skipped", checked: 0, failures: [] };
  }

  const assets = extractStaticAssetPaths(rootResult.text).slice(0, 8);
  if (assets.length === 0) {
    addCheck(
      "next-static-assets",
      false,
      "",
      "Root HTML did not expose Next static asset references. Restart the server if hydration looks stale.",
      "warn"
    );
    return { status: "warn", checked: 0, failures: [] };
  }

  const failures = [];
  for (const path of assets) {
    const result = await fetchHeadOrGet(`${webUiUrl}${path}`);
    if (!result.ok) {
      failures.push(`${path} -> ${describeFetchResult(result)}`);
    }
  }

  addCheck(
    "next-static-assets",
    failures.length === 0,
    `${assets.length} Next static asset(s) responded successfully.`,
    `Static chunk failure detected: ${failures.slice(0, 3).join("; ")}. Restart the Web UI server; if stale assets persist, stop it and remove apps/web/.next only after confirming the path.`,
    "warn"
  );

  return {
    status: failures.length === 0 ? "connected" : "warn",
    checked: assets.length,
    failures
  };
}

function extractStaticAssetPaths(html) {
  const matches = html.matchAll(/["'](\/_next\/static\/[^"']+)["']/g);
  return Array.from(new Set(Array.from(matches, (match) => match[1].replace(/&amp;/g, "&"))));
}

async function checkHermesBff(webUi) {
  if (!webUi?.ok) {
    addCheck(
      "hermes-bff-status",
      false,
      "",
      "Hermes BFF status skipped because the Web UI server is not reachable.",
      args.requireHermes ? "required" : "warn"
    );
    return { status: "skipped" };
  }
  const result = await fetchJson(`${webUiUrl}/api/hermes/status`);
  const live = result.ok && result.body?.mode === "real" && result.body?.reachable === true;
  addCheck(
    "hermes-bff-status",
    live || (!args.requireHermes && result.ok),
    live
      ? "Hermes BFF reports real/reachable."
      : result.ok
        ? `Hermes BFF reports mode=${result.body?.mode || "unknown"}, reachable=${String(result.body?.reachable === true)}.`
        : "",
    result.ok
      ? `Hermes is required but BFF reported mode=${result.body?.mode || "unknown"}, reachable=${String(result.body?.reachable === true)}.`
      : `Hermes BFF status failed with ${describeFetchResult(result)}.`,
    args.requireHermes ? "required" : result.ok ? "warn" : "warn"
  );
  return result;
}

async function checkHermesDirect(hermesEnv) {
  if (hermesEnv.enableRealHermes === "false" || !hermesEnv.baseUrl) {
    addCheck(
      "hermes-direct-health",
      false,
      "",
      "Hermes direct health skipped because HERMES_API_BASE_URL is not configured or real Hermes mode is disabled.",
      args.requireHermes ? "required" : "warn"
    );
    return { status: "unconfigured" };
  }
  const result = await fetchJson(`${trimSlash(hermesEnv.baseUrl)}/health`);
  addCheck(
    "hermes-direct-health",
    result.ok,
    `Hermes direct /health returned HTTP ${result.status}.`,
    `Hermes direct /health failed with ${describeFetchResult(result)}.`,
    args.requireHermes ? "required" : "warn"
  );
  return result;
}

async function checkBrainMemoryBff(webUi) {
  if (!webUi?.ok) {
    addCheck(
      "brain-memory-bff-status",
      false,
      "",
      "Brain Memory BFF status skipped because the Web UI server is not reachable.",
      args.requireBrainMemory ? "required" : "warn"
    );
    return { status: "skipped" };
  }

  const result = await fetchJson(`${webUiUrl}/api/brain-memory/status`);
  const live = result.ok && result.body?.mode === "real" && result.body?.reachable === true;
  addCheck(
    "brain-memory-bff-status",
    live || (!args.requireBrainMemory && result.ok),
    live
      ? "Brain Memory BFF reports real/reachable."
      : result.ok
        ? `Brain Memory BFF reports mode=${result.body?.mode || "unknown"}, reachable=${String(result.body?.reachable === true)}.`
        : "",
    result.ok
      ? `Brain Memory is required but BFF reported mode=${result.body?.mode || "unknown"}, reachable=${String(result.body?.reachable === true)}.`
      : `Brain Memory BFF status failed with ${describeFetchResult(result)}.`,
    args.requireBrainMemory ? "required" : result.ok ? "warn" : "warn"
  );
  return result;
}

async function checkBrainMemoryDirect(brainMemoryEnv) {
  if (brainMemoryEnv.enableRealGateway !== "true" || !brainMemoryEnv.baseUrl) {
    addCheck(
      "brain-memory-direct-health",
      false,
      "",
      "Brain Memory Gateway direct health skipped because real Gateway mode is disabled or no URL is configured.",
      args.requireBrainMemory ? "required" : "warn"
    );
    return { status: "disabled" };
  }

  const result = await fetchJson(`${trimSlash(brainMemoryEnv.baseUrl)}/health`, {
    headers: makeBrainMemoryUiAuthHeader()
  });
  addCheck(
    "brain-memory-direct-health",
    result.ok,
    `Brain Memory Gateway direct /health returned HTTP ${result.status}.`,
    `Brain Memory Gateway direct /health failed with ${describeFetchResult(result)}.`,
    args.requireBrainMemory ? "required" : "warn"
  );
  return result;
}

function checkRequiredServices() {
  if (args.requireHermes) {
    const bffLive = report.services.hermesBff?.ok &&
      report.services.hermesBff.body?.mode === "real" &&
      report.services.hermesBff.body?.reachable === true;
    addCheck(
      "require-hermes",
      bffLive,
      "Required Hermes check passed through the Web UI BFF.",
      "Required Hermes check failed; start Hermes, verify env, and restart the Web UI server."
    );
  }

  if (args.requireBrainMemory) {
    const bffLive = report.services.brainMemoryBff?.ok &&
      report.services.brainMemoryBff.body?.mode === "real" &&
      report.services.brainMemoryBff.body?.reachable === true;
    addCheck(
      "require-brain-memory",
      bffLive,
      "Required Brain Memory check passed through the Web UI BFF.",
      "Required Brain Memory check failed; mock/unconfigured state is not accepted with --require-brain-memory."
    );
  }
}

function summarizeWebUi(result) {
  return {
    ok: result?.ok === true,
    status: result?.status || 0,
    statusLabel: result?.statusLabel || (result?.ok ? "connected" : "unreachable"),
    titlePresent: typeof result?.text === "string" && result.text.includes("<title>Brain Memory Studio</title>"),
    url: safeUrl(`${webUiUrl}/`)
  };
}

function summarizeBffStatus(result) {
  return {
    ok: result?.ok === true,
    status: result?.status || 0,
    body: result?.body && typeof result.body === "object"
      ? {
          configured: result.body.configured,
          errorKind: result.body.error?.kind,
          mode: result.body.mode,
          reachable: result.body.reachable
        }
      : null,
    url: result?.url || ""
  };
}

function summarizeService(result) {
  const nonHttpStatus = typeof result?.status === "string" ? result.status : "";
  return {
    ok: result?.ok === true,
    status: result?.status || 0,
    statusLabel: nonHttpStatus || (result?.ok ? "connected" : "error"),
    body: result?.body && typeof result.body === "object"
      ? {
          platform: result.body.platform,
          status: result.body.status
        }
      : undefined,
    url: result?.url || ""
  };
}

function readHermesEnv(values) {
  return {
    baseUrl: values.HERMES_API_BASE_URL || "",
    apiKeySet: Boolean(values.HERMES_API_KEY),
    enableMemoryScopeBridge: values.HERMES_UI_ENABLE_MEMORY_SCOPE_BRIDGE || "",
    enableRealHermes: values.HERMES_UI_ENABLE_REAL_HERMES || ""
  };
}

function readBrainMemoryEnv(values) {
  return {
    baseUrl: values.BRAIN_MEMORY_GATEWAY_URL || "",
    enableRealGateway: values.BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY || "",
    gatewayMemoryApiKeySet: Boolean(values.BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY),
    legacyApiKeySet: Boolean(values.BRAIN_MEMORY_API_KEY),
    uiApiKeySet: Boolean(values.BRAIN_MEMORY_UI_API_KEY)
  };
}

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        if (index === -1) {
          return [line, ""];
        }
        return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

function inferMode(currentEnv) {
  const hermesConfigured =
    currentEnv.hermes.enableRealHermes !== "false" && Boolean(currentEnv.hermes.baseUrl);
  const brainMemoryEnabled = currentEnv.brainMemory.enableRealGateway === "true";
  const brainMemoryConfigured = brainMemoryEnabled && Boolean(currentEnv.brainMemory.baseUrl);

  if (hermesConfigured && brainMemoryConfigured) {
    return "bundle-ready";
  }
  if (brainMemoryConfigured) {
    return "brain-memory-configured";
  }
  if (hermesConfigured) {
    return "web-ui-only";
  }
  return "unconfigured-dev";
}

async function runSmokeCommand(name, display, command, commandArgs) {
  try {
    const { stdout, stderr } = await execFileAsync(command, commandArgs, {
      cwd: root,
      maxBuffer: 1024 * 1024 * 8,
      timeout: name === "smoke:ui" ? 120_000 : 90_000
    });
    addCommand(name, "pass", display, lastLines(`${stdout}\n${stderr}`));
  } catch (error) {
    addCommand(name, "fail", display, lastLines(`${error.stdout || ""}\n${error.stderr || error.message || ""}`));
  }
}

function requireFlagsForSmoke() {
  const flags = [];
  if (args.requireHermes) {
    flags.push("--require-hermes");
  }
  if (args.requireBrainMemory) {
    flags.push("--require-brain-memory");
  }
  return flags;
}

async function runOpenCommand() {
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      join(root, "scripts", "open-studio-browser.mjs"),
      `--url=${webUiUrl}/`
    ], {
      cwd: root,
      timeout: 15_000
    });
    addCommand("studio:open", "pass", `node scripts/open-studio-browser.mjs --url=${webUiUrl}/`, lastLines(`${stdout}\n${stderr}`));
  } catch (error) {
    addCommand(
      "studio:open",
      "fail",
      `node scripts/open-studio-browser.mjs --url=${webUiUrl}/`,
      lastLines(`${error.stdout || ""}\n${error.stderr || error.message || ""}`)
    );
  }
}

function makeSuggestions() {
  const suggestions = [];
  if (!existsSync(envPath)) {
    suggestions.push("Create env with npm run studio:env -- --mode web-ui-with-hermes or web-ui-only.");
  }
  if (!report.services.webUi?.ok) {
    suggestions.push("Start the Web UI in a separate terminal: npm run dev.");
  }
  if (report.services.staticAssets?.status === "warn") {
    suggestions.push("Static chunk issues usually mean a stale Next server. Restart npm run dev or next start; only then consider removing apps/web/.next.");
  }
  if (args.requireHermes && !(report.services.hermesBff?.body?.mode === "real" && report.services.hermesBff?.body?.reachable === true)) {
    suggestions.push("Hermes was required. Start Hermes API, verify HERMES_API_BASE_URL, and restart the Web UI after env changes.");
  }
  if (report.env.brainMemory.enableRealGateway === "true" && !report.env.brainMemory.gatewayMemoryApiKeySet) {
    suggestions.push("Brain Memory live mode is enabled; set BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY unless Gateway dev bypass is intentional.");
  }
  if (args.requireBrainMemory && !(report.services.brainMemoryBff?.body?.mode === "real" && report.services.brainMemoryBff?.body?.reachable === true)) {
    suggestions.push("Brain Memory was required. Start Gateway, verify BRAIN_MEMORY_GATEWAY_URL and keys, and restart the Web UI.");
  }
  if (!args.smoke) {
    suggestions.push("Run npm run studio:launch -- --smoke for the route/BFF smoke.");
  }
  if (!args.uiSmoke) {
    suggestions.push("Run npm run studio:launch -- --ui-smoke for the browser interaction smoke.");
  }
  if (!args.open) {
    suggestions.push("Open the app with npm run studio:launch -- --open.");
  }
  if (args.devCommand) {
    suggestions.push("The launcher does not start long-running services by default; run npm run dev yourself.");
  }
  return suggestions;
}

async function fetchText(url, init = {}) {
  return fetchWithTimeout(url, init, async (response) => response.text());
}

async function fetchJson(url, init = {}) {
  return fetchWithTimeout(url, init, async (response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return { parseError: true, preview: text.slice(0, 160) };
    }
  });
}

async function fetchHeadOrGet(url) {
  const head = await fetchWithTimeout(url, { method: "HEAD" }, async () => "");
  if (head.ok || head.status !== 405) {
    return head;
  }
  return fetchWithTimeout(url, {}, async () => "");
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
      body: sanitizeBody(body),
      ok: response.ok,
      status: response.status,
      text: typeof body === "string" ? body : undefined,
      url: safeUrl(url)
    };
  } catch (error) {
    return {
      error: error instanceof Error && error.name === "AbortError" ? "timeout" : "unreachable",
      ok: false,
      status: 0,
      url: safeUrl(url)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function sanitizeBody(value) {
  if (typeof value === "string") {
    return value.replace(/(api[_-]?key|authorization|token|secret)=([^&\s]+)/gi, "$1=[redacted]");
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return JSON.parse(JSON.stringify(value, (key, child) => (
    /api[_-]?key|authorization|token|secret|password|credential/i.test(key) && child
      ? "[redacted]"
      : child
  )));
}

function addCheck(name, okOrStatus, pass, fail = "", severity = "required") {
  const status = typeof okOrStatus === "string"
    ? okOrStatus
    : okOrStatus
      ? "pass"
      : severity === "warn"
        ? "warn"
        : "fail";
  report.checks.push({
    detail: args.verbose && status !== "pass" ? fail : undefined,
    message: status === "pass" ? pass : fail,
    name,
    required: severity !== "warn",
    status
  });
}

function addCommand(name, status, command, detail) {
  report.commands.push({
    command,
    detail: sanitizeBody(detail || ""),
    name,
    status
  });
}

function printReport() {
  console.log("Brain Memory Studio launcher");
  console.log("============================");
  console.log(`cwd: ${report.cwd}`);
  console.log(`mode: ${report.mode}`);
  console.log(`web UI: ${report.webUiUrl}`);
  console.log("");

  console.log("Environment");
  console.log(`Hermes URL: ${report.env.hermes.baseUrl || "(not set)"}`);
  console.log(`Hermes API key: ${report.env.hermes.apiKeySet ? "set" : "not set"}`);
  console.log(`Hermes real mode: ${report.env.hermes.enableRealHermes || "(not set)"}`);
  console.log(`Brain Memory URL: ${report.env.brainMemory.baseUrl || "(not set)"}`);
  console.log(`Brain Memory real mode: ${report.env.brainMemory.enableRealGateway || "(not set)"}`);
  console.log(`Brain Memory UI API key: ${report.env.brainMemory.uiApiKeySet ? "set" : "not set"}`);
  console.log(`Brain Memory tenant memory key: ${report.env.brainMemory.gatewayMemoryApiKeySet ? "set" : "not set"}`);
  console.log("");

  console.log("Checks");
  for (const check of report.checks) {
    console.log(`${icon(check.status)} ${check.name}: ${check.message}`);
  }

  if (report.commands.length > 0) {
    console.log("");
    console.log("Commands");
    for (const command of report.commands) {
      console.log(`${icon(command.status)} ${command.name}: ${command.command}`);
      if (command.detail && (args.verbose || command.status === "fail")) {
        console.log(indent(command.detail));
      }
    }
  }

  console.log("");
  console.log("Next commands");
  for (const suggestion of report.suggestions) {
    console.log(`- ${suggestion}`);
  }
}

function makeBrainMemoryUiAuthHeader() {
  const cleanValue = (env.BRAIN_MEMORY_UI_API_KEY || env.BRAIN_MEMORY_API_KEY || "").trim();
  return cleanValue ? { Authorization: `Bearer ${cleanValue}` } : undefined;
}

function describeFetchResult(result) {
  if (result.status) {
    return `HTTP ${result.status}`;
  }
  return result.error || "unknown error";
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return value;
  }
}

function trimSlash(value) {
  return value.replace(/\/$/, "");
}

function lastLines(value, maxLines = 16) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(-maxLines)
    .join("\n");
}

function indent(value) {
  return value
    .split(/\r?\n/)
    .map((line) => `  ${line}`)
    .join("\n");
}

function icon(status) {
  if (status === "pass") {
    return "[ok]";
  }
  if (status === "warn") {
    return "[--]";
  }
  return "[!!]";
}
