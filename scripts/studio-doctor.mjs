#!/usr/bin/env node

import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = resolve(process.cwd());
const args = new Set(process.argv.slice(2));
const jsonMode = args.has("--json");
const webUiUrl = process.env.STUDIO_WEB_UI_URL || "http://127.0.0.1:3000";
const timeoutMs = 2500;

const env = readEnvFile(join(root, "apps", "web", ".env.local"));
const report = {
  cwd: root,
  checks: [],
  env: {
    hermes: readHermesEnv(env),
    brainMemory: readBrainMemoryEnv(env)
  },
  installMode: "unconfigured-dev",
  services: {
    hermesDirect: null,
    hermesBff: null,
    brainMemoryCapabilitiesDirect: null,
    brainMemoryDirect: null,
    brainMemoryBff: null
  },
  suggestions: []
};

addCheck(
  "repo-root",
  existsSync(join(root, "package.json")) &&
    existsSync(join(root, "apps", "web")) &&
    existsSync(join(root, "packages")),
  "Current directory looks like Hermes UI repo.",
  "Run this command from the Hermes UI repository root."
);
addCheck(
  "root-package",
  packageHasWorkspaces(join(root, "package.json")),
  "Root package.json has workspaces.",
  "Root package.json is missing workspaces."
);
addCheck(
  "web-app",
  existsSync(join(root, "apps", "web", "package.json")),
  "apps/web package exists.",
  "apps/web package is missing."
);
addCheck(
  "env-example",
  existsSync(join(root, ".env.example")),
  ".env.example exists.",
  ".env.example is missing."
);
addCheck(
  "web-env-local",
  existsSync(join(root, "apps", "web", ".env.local")),
  "apps/web/.env.local exists.",
  "apps/web/.env.local is missing. Run npm run studio:env -- --mode web-ui-with-hermes or choose another mode.",
  "warn"
);

const nodeVersion = process.version;
const npmVersion = await getNpmVersion();
addCheck("node", isNodeVersionSupported(nodeVersion), `Node ${nodeVersion}`, "Node 20.9+ is recommended.");
addCheck(
  "npm",
  Boolean(npmVersion),
  npmVersion ? `npm ${npmVersion}` : "npm was not found.",
  "Install npm with Node.js."
);

report.installMode = inferMode(report.env);
report.services.hermesDirect = await checkHermesDirect(report.env.hermes);
report.services.hermesBff = await fetchJson(`${webUiUrl}/api/hermes/status`);
report.services.brainMemoryBff = await fetchJson(`${webUiUrl}/api/brain-memory/status`);
report.services.brainMemoryDirect = await checkBrainMemoryDirect(report.env.brainMemory);
report.services.brainMemoryCapabilitiesDirect = await checkBrainMemoryCapabilitiesDirect(
  report.env.brainMemory
);
report.brainMemoryUi = inferBrainMemoryUiState(report.env.brainMemory, report.services.brainMemoryBff);
report.suggestions = makeSuggestions(report);

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2));
} else {
  printReport(report);
}

const fatal = report.checks.some((check) => check.required && check.status === "fail");
process.exitCode = fatal ? 1 : 0;

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

function packageHasWorkspaces(path) {
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(data.workspaces) && data.workspaces.includes("apps/*");
  } catch {
    return false;
  }
}

function addCheck(name, ok, pass, fail, severity = "required") {
  report.checks.push({
    name,
    status: ok ? "pass" : severity === "warn" ? "warn" : "fail",
    message: ok ? pass : fail,
    required: severity !== "warn"
  });
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

async function checkHermesDirect(hermesEnv) {
  if (hermesEnv.enableRealHermes === "false" || !hermesEnv.baseUrl) {
    return { status: "unconfigured", detail: "Hermes direct health skipped." };
  }
  return fetchJson(`${trimSlash(hermesEnv.baseUrl)}/health`);
}

async function checkBrainMemoryDirect(brainMemoryEnv) {
  if (brainMemoryEnv.enableRealGateway !== "true" || !brainMemoryEnv.baseUrl) {
    return {
      status: "disabled",
      detail: "Brain Memory Gateway direct health skipped because real Gateway mode is disabled."
    };
  }
  return fetchJson(`${trimSlash(brainMemoryEnv.baseUrl)}/health`, {
    headers: makeBrainMemoryUiAuthHeader()
  });
}

async function checkBrainMemoryCapabilitiesDirect(brainMemoryEnv) {
  if (brainMemoryEnv.enableRealGateway !== "true" || !brainMemoryEnv.baseUrl) {
    return {
      status: "disabled",
      detail: "Brain Memory Gateway capabilities skipped because real Gateway mode is disabled."
    };
  }
  return fetchJson(`${trimSlash(brainMemoryEnv.baseUrl)}/ui/capabilities`, {
    headers: makeBrainMemoryUiAuthHeader()
  });
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: options.headers,
      signal: controller.signal
    });
    const text = await response.text();
    const body = parseMaybeJson(text);
    return {
      status: response.ok ? "connected" : "error",
      httpStatus: response.status,
      url: safeUrl(url),
      body: sanitizeBody(body)
    };
  } catch (error) {
    return {
      status: error instanceof Error && error.name === "AbortError" ? "timeout" : "unreachable",
      url: safeUrl(url),
      detail: "Service did not respond within the local timeout."
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseMaybeJson(text) {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 200);
  }
}

function sanitizeBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return body;
  }
  const copy = { ...body };
  delete copy.apiKey;
  delete copy.HERMES_API_KEY;
  delete copy.BRAIN_MEMORY_API_KEY;
  delete copy.BRAIN_MEMORY_UI_API_KEY;
  delete copy.BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY;
  return copy;
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

function inferBrainMemoryUiState(brainMemoryEnv, bffStatus) {
  if (brainMemoryEnv.enableRealGateway !== "true") {
    return "attach-later";
  }
  if (!brainMemoryEnv.baseUrl) {
    return "disabled";
  }
  if (bffStatus?.status === "connected" && bffStatus.body?.mode === "real") {
    if (!bffStatus.body.capabilities) {
      return "health-only";
    }
    return "enabled";
  }
  return "configured-unreachable";
}

function makeSuggestions(currentReport) {
  const suggestions = [];
  if (!existsSync(join(root, "apps", "web", ".env.local"))) {
    suggestions.push("Create apps/web/.env.local with npm run studio:env -- --mode web-ui-with-hermes.");
  }
  if (currentReport.services.hermesDirect.status !== "connected") {
    suggestions.push("Start Hermes API server and verify HERMES_API_BASE_URL/health.");
  }
  if (currentReport.installMode === "web-ui-only") {
    suggestions.push("Brain Memory is optional. Keep BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=false until you install/connect it.");
  }
  if (
    currentReport.env.brainMemory.enableRealGateway === "true" &&
    !currentReport.env.brainMemory.gatewayMemoryApiKeySet
  ) {
    suggestions.push(
      "For real memory search, set BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY unless Gateway loopback dev bypass is explicitly enabled."
    );
  }
  if (currentReport.installMode === "bundle-ready") {
    suggestions.push("Run npm run dev, then npm run studio:open to use the bundle-ready local setup.");
  }
  if (currentReport.services.hermesBff.status !== "connected") {
    suggestions.push("Start the Web UI dev server with npm run dev to enable BFF health checks.");
  }
  return suggestions;
}

function printReport(currentReport) {
  console.log("Brain Memory Studio doctor");
  console.log("==========================");
  console.log(`cwd: ${currentReport.cwd}`);
  console.log(`mode: ${currentReport.installMode}`);
  console.log("");

  console.log("Local checks");
  for (const check of currentReport.checks) {
    console.log(`${icon(check.status)} ${check.name}: ${check.message}`);
  }
  console.log("");

  console.log("Environment");
  console.log(`Hermes URL: ${currentReport.env.hermes.baseUrl || "(not set)"}`);
  console.log(`Hermes API key: ${currentReport.env.hermes.apiKeySet ? "set" : "not set"}`);
  console.log(`Hermes real mode: ${currentReport.env.hermes.enableRealHermes || "(not set)"}`);
  console.log(
    `Hermes memory scope bridge: ${currentReport.env.hermes.enableMemoryScopeBridge || "(default true)"}`
  );
  console.log(`Brain Memory URL: ${currentReport.env.brainMemory.baseUrl || "(not set)"}`);
  console.log(`Brain Memory UI API key: ${currentReport.env.brainMemory.uiApiKeySet ? "set" : "not set"}`);
  console.log(
    `Brain Memory tenant memory key: ${
      currentReport.env.brainMemory.gatewayMemoryApiKeySet ? "set" : "not set"
    }`
  );
  console.log(
    `Brain Memory legacy API key: ${currentReport.env.brainMemory.legacyApiKeySet ? "set" : "not set"}`
  );
  console.log(`Brain Memory real mode: ${currentReport.env.brainMemory.enableRealGateway || "(not set)"}`);
  console.log(`Brain Memory UI state: ${currentReport.brainMemoryUi}`);
  console.log("");

  console.log("Services");
  printService("Hermes direct /health", currentReport.services.hermesDirect);
  printService("Web UI BFF Hermes status", currentReport.services.hermesBff);
  printService("Web UI BFF Brain Memory status", currentReport.services.brainMemoryBff);
  printService("Brain Memory Gateway direct /health", currentReport.services.brainMemoryDirect);
  printService(
    "Brain Memory Gateway direct /ui/capabilities",
    currentReport.services.brainMemoryCapabilitiesDirect
  );
  console.log("");

  console.log("Suggested next commands");
  for (const suggestion of currentReport.suggestions) {
    console.log(`- ${suggestion}`);
  }
  if (currentReport.suggestions.length === 0) {
    console.log("- npm run dev");
    console.log("- npm run studio:open");
  }
}

function makeBrainMemoryUiAuthHeader() {
  const cleanValue = (env.BRAIN_MEMORY_UI_API_KEY || env.BRAIN_MEMORY_API_KEY || "").trim();
  return cleanValue ? { Authorization: `Bearer ${cleanValue}` } : undefined;
}

function printService(label, service) {
  const status = service?.status ?? "unknown";
  const detail = service?.body?.mode ? ` (${service.body.mode})` : service?.httpStatus ? ` (HTTP ${service.httpStatus})` : "";
  console.log(`${icon(status)} ${label}: ${status}${detail}`);
}

function icon(status) {
  if (status === "pass" || status === "connected") {
    return "[ok]";
  }
  if (status === "warn" || status === "disabled" || status === "unconfigured") {
    return "[--]";
  }
  return "[!!]";
}
