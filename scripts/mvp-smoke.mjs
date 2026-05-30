#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const root = resolve(process.cwd());
const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 10_000;

const report = {
  baseUrl,
  checks: [],
  mode: {
    requireHermes: args.requireHermes,
    requireBrainMemory: args.requireBrainMemory
  },
  summary: {
    passed: 0,
    warned: 0,
    failed: 0
  }
};

await main();

async function main() {
  printSelectedBaseUrl({ baseUrl, json: args.json, label: "MVP smoke" });
  for (const arg of args.unknown) {
    addResult("cli-args", "fail", `Unknown argument: ${arg}`);
  }

  await checkSourceSmokeTargets();
  const rootPage = await checkGet("/", { expectText: ["Brain Memory Studio"] });
  if (rootPage.ok && typeof rootPage.text === "string") {
    checkHtml("root-title", rootPage.text.includes("<title>Brain Memory Studio</title>"), {
      fail: "Root HTML did not include the expected document title.",
      pass: "Root HTML includes the Brain Memory Studio title."
    });
    checkHtml("root-old-green-ui", !/old green ui|#00ff00|#0f0\b/i.test(rootPage.text), {
      fail: "Root HTML appears to contain old green UI markers.",
      pass: "Root HTML does not contain old green UI markers."
    });
  }

  await checkOptionalDesignRoute();
  const hermesStatus = await checkJsonGet("/api/hermes/status", {
    required: true,
    validate: (body) =>
      body &&
      typeof body === "object" &&
      typeof body.mode === "string" &&
      body.uiCapabilities &&
      typeof body.uiCapabilities === "object" &&
      body.uiCapabilities.chat &&
      body.uiCapabilities.models &&
      body.uiCapabilities.models.clientSelectable === false &&
      body.uiCapabilities.models.selectionStatus &&
      body.uiCapabilities.ui
  });
  const brainMemoryStatus = await checkJsonGet("/api/brain-memory/status", {
    required: true,
    validate: (body) => body && typeof body === "object" && typeof body.mode === "string"
  });

  const brainMemorySearch = await checkBrainMemorySearch(brainMemoryStatus.body);
  await checkBrainMemoryInspect(brainMemoryStatus.body, brainMemorySearch.body);
  await checkHermesLiveSmoke(hermesStatus.body);
  checkBrainMemoryMode(brainMemoryStatus.body, brainMemorySearch.body);

  finalize();
}

function parseArgs(values) {
  const parsed = {
    baseUrl: "",
    json: false,
    unknown: [],
    requireHermes: false,
    requireBrainMemory: false,
    verbose: false
  };

  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--require-hermes") {
      parsed.requireHermes = true;
    } else if (arg === "--require-brain-memory") {
      parsed.requireBrainMemory = true;
    } else if (arg === "--verbose") {
      parsed.verbose = true;
    } else if (arg === "--base-url") {
      parsed.baseUrl = values[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      parsed.baseUrl = arg.slice("--base-url=".length);
    } else {
      parsed.unknown.push(arg);
    }
  }

  return parsed;
}

async function checkSourceSmokeTargets() {
  const files = [
    "apps/web/src/components/shell/TopBar.tsx",
    "apps/web/src/components/shell/Sidebar.tsx",
    "apps/web/src/components/shell/ContextRail.tsx",
    "apps/web/src/components/memory/BrainMemoryConsole.tsx",
    "apps/web/src/components/chat/Composer.tsx",
    "apps/web/src/lib/memoryTimeline.ts",
    "docs/product/BRAIN_MEMORY_EVENT_TIMELINE_13K.md",
    "docs/product/COMMAND_EXECUTION_DETAILS_13L.md",
    "docs/product/PROVIDER_MODEL_SELECTOR_13J.md"
  ];

  for (const file of files) {
    const ok = existsSync(join(root, file));
    addResult(`source:${file}`, ok ? "pass" : "fail", ok ? `${file} exists.` : `${file} is missing.`);
  }

  if (report.checks.some((check) => check.status === "fail" && check.name.startsWith("source:"))) {
    return;
  }

  const topBar = readFile("apps/web/src/components/shell/TopBar.tsx");
  const sidebar = readFile("apps/web/src/components/shell/Sidebar.tsx");
  const contextRail = readFile("apps/web/src/components/shell/ContextRail.tsx");
  const memoryConsole = readFile("apps/web/src/components/memory/BrainMemoryConsole.tsx");
  const memoryTimeline = readFile("apps/web/src/lib/memoryTimeline.ts");
  const composer = readFile("apps/web/src/components/chat/Composer.tsx");

  checkSource("ui:left-rail-toggle-label", topBar.includes("Collapse left sidebar"), "Top bar exposes left rail toggle labels.");
  checkSource(
    "ui:right-rail-toggle-label",
    topBar.includes("Collapse right context panel"),
    "Top bar exposes right rail toggle labels."
  );
  checkSource(
    "ui:top-menu-current-label",
    topBar.includes('aria-label="Workspace section current"'),
    "Top menu marks the current Workspace section explicitly."
  );
  checkSource(
    "ui:top-menu-placeholders-disabled",
    topBar.includes("section coming soon") && topBar.includes("disabled"),
    "Deferred top menu sections are disabled and labelled as coming soon."
  );
  checkSource(
    "ui:settings-button-label",
    sidebar.includes('aria-label="Open settings and connection status"'),
    "Settings control has a deterministic accessible label."
  );
  checkSource(
    "ui:settings-popover-label",
    sidebar.includes('aria-label="Settings and connection status"'),
    "Settings popover keeps an accessible dialog label."
  );
  for (const panel of ["context", "memory", "tools", "files"]) {
    checkSource(
      `ui:${panel}-panel-tab-label`,
      contextRail.includes('aria-label={`Show ${children.toLowerCase()} panel`}') &&
        contextRail.includes(`"${panel}"`),
      `Right rail ${panel} tab has a deterministic accessible label.`
    );
  }
  checkSource(
    "ui:files-artifacts-disabled-download",
    contextRail.includes("Local/mock only") && contextRail.includes("Download unavailable"),
    "Files tab clearly distinguishes local/mock artifacts from unavailable downloads."
  );
  checkSource(
    "ui:memory-activity-timeline",
    memoryConsole.includes("Memory activity") &&
      memoryConsole.includes("No memory activity in this session yet.") &&
      memoryTimeline.includes("createMemoryTimelineItems") &&
      memoryTimeline.includes("operation === \"delete\""),
    "Memory tab exposes a read-only Brain Memory event timeline and honest empty state."
  );
  checkSource(
    "ui:memory-timeline-no-direct-calls",
    !memoryTimeline.includes("fetch(") &&
      !memoryTimeline.includes("localStorage") &&
      !memoryConsole.includes("/api/brain-memory"),
    "Memory timeline derives from activity events without direct Gateway/storage calls."
  );
  checkSource(
    "ui:command-detail-rendering",
    contextRail.includes("Recent commands") &&
      contextRail.includes("No command activity in this session yet.") &&
      contextRail.includes("extractCommandDetails") &&
      readFile("apps/web/src/components/chat/AgentActivityBlock.tsx").includes("stdoutPreview") &&
      readFile("apps/web/src/lib/agentActivityEvents.ts").includes("sourceChannel"),
    "Command activity exposes structured details, stdout/stderr previews, and source channel metadata."
  );
  checkSource(
    "ui:composer-textarea-label",
    composer.includes('aria-label="Message"'),
    "Composer textarea has an accessible label."
  );
  checkSource(
    "ui:composer-send-label",
    composer.includes("Send message"),
    "Composer send button has an accessible label."
  );
  checkSource(
    "ui:composer-placeholders-disabled",
    composer.includes("Attach context coming soon") &&
      composer.includes("Provider and model selector disabled") &&
      composer.includes("Voice input coming soon"),
    "Deferred composer controls are disabled and labelled as placeholders."
  );
  checkSource(
    "ui:model-selector-server-configured",
    composer.includes("runtime model switching is disabled") &&
      composer.includes("Runtime model switching is not verified"),
    "Provider/model selector stays disabled unless Hermes runtime switching is verified."
  );
  checkSource(
    "ui:stream-batching-copy",
    composer.includes("Streaming batches deltas with an animation-frame flush") &&
      composer.includes("not one React update per token"),
    "Composer documents the fast-stream batching assumption."
  );
  checkSource(
    "ui:composer-stop-placeholder",
    composer.includes("Stop generation") &&
      composer.includes("browser-to-BFF stream") &&
      composer.includes("not a Hermes run-stop request"),
    "Composer stop state is explicitly labelled as stream abort, not fake run stop."
  );
}

async function checkOptionalDesignRoute() {
  const response = await fetchText(`${baseUrl}/design/codex-shell`);
  if (response.status === 404) {
    addResult("GET /design/codex-shell", "warn", "Design route is not present; optional route skipped.");
    return;
  }

  if (!response.ok) {
    addResult(
      "GET /design/codex-shell",
      "fail",
      `Design route returned ${response.status || response.error || "an error"}.`
    );
    return;
  }

  addResult("GET /design/codex-shell", "pass", "Design route returned HTTP 200.");
}

async function checkGet(path, options = {}) {
  const result = await fetchText(`${baseUrl}${path}`);
  if (!result.ok) {
    addResult(`GET ${path}`, "fail", `Expected HTTP 2xx from ${baseUrl}${path} but received ${describeFetchResult(result)}.`);
    return result;
  }

  const missing = (options.expectText || []).filter((text) => !result.text.includes(text));
  if (missing.length > 0) {
    addResult(`GET ${path}`, "fail", `Response was missing expected text: ${missing.join(", ")}.`);
    return { ...result, ok: false };
  }

  addResult(`GET ${path}`, "pass", `Returned HTTP ${result.status}.`);
  return result;
}

async function checkJsonGet(path, options) {
  const result = await fetchJson(`${baseUrl}${path}`);
  if (!result.ok) {
    addResult(`GET ${path}`, options.required ? "fail" : "warn", `Expected JSON 2xx but received ${describeFetchResult(result)}.`);
    return result;
  }

  if (options.validate && !options.validate(result.body)) {
    addResult(`GET ${path}`, options.required ? "fail" : "warn", "JSON response did not match expected shape.");
    return { ...result, ok: false };
  }

  const mode = result.body?.mode ? ` (${result.body.mode})` : "";
  addResult(`GET ${path}`, "pass", `Returned HTTP ${result.status}${mode}.`);
  if (args.verbose) {
    addDetail(`GET ${path}`, sanitize(result.body));
  }
  return result;
}

async function checkBrainMemorySearch(status) {
  const result = await fetchJson(`${baseUrl}/api/brain-memory/search`, {
    body: JSON.stringify({
      context: smokeContext(),
      limit: 3,
      query: "MVP smoke checkpoint"
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!result.ok) {
    addResult("POST /api/brain-memory/search", "fail", `Search route failed with ${describeFetchResult(result)}.`);
    return;
  }

  const mode = result.body?.mode;
  const resultCount = Array.isArray(result.body?.results) ? result.body.results.length : 0;
  if (args.requireBrainMemory && mode !== "real") {
    addResult(
      "POST /api/brain-memory/search",
      "fail",
      `Brain Memory is required but search returned normalized ${mode || "unknown"} response${authHint(result.body)}.`
    );
  } else if (status?.mode === "real" && result.body?.error?.kind === "unauthorized") {
    addResult(
      "POST /api/brain-memory/search",
      args.requireBrainMemory ? "fail" : "warn",
      "Search reached the BFF but Gateway rejected the optional UI bearer."
    );
  } else if (status?.mode === "real" && result.body?.error?.kind === "forbidden") {
    addResult(
      "POST /api/brain-memory/search",
      args.requireBrainMemory ? "fail" : "warn",
      "Search reached the BFF but the tenant-bound memory key was not authorized for this scope."
    );
  } else if (mode === "real" || mode === "mock" || mode === "unconfigured" || mode === "error") {
    addResult(
      "POST /api/brain-memory/search",
      "pass",
      `Search route returned normalized ${mode} response with ${resultCount} result(s).`
    );
  } else {
    addResult("POST /api/brain-memory/search", "fail", "Search route response did not include a normalized mode.");
  }

  return result;
}

async function checkBrainMemoryInspect(status, searchBody) {
  const resultId = Array.isArray(searchBody?.results) ? searchBody.results[0]?.id : null;
  const memoryId = typeof resultId === "string" && resultId.trim()
    ? resultId.trim()
    : "mvp-smoke-nonexistent-memory";
  const result = await fetchJson(`${baseUrl}/api/brain-memory/memory/inspect`, {
    body: JSON.stringify({
      context: smokeContext(),
      memoryId
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!result.ok) {
    addResult("POST /api/brain-memory/memory/inspect", "fail", `Inspect route failed with ${describeFetchResult(result)}.`);
    return;
  }

  const mode = result.body?.mode;
  const detailStatus = result.body?.detail ? "detail" : result.body?.error?.kind || "no-detail";
  if (args.requireBrainMemory && mode !== "real") {
    addResult(
      "POST /api/brain-memory/memory/inspect",
      "fail",
      `Brain Memory is required but inspect returned normalized ${mode || "unknown"} response${authHint(result.body)}.`
    );
  } else if (status?.mode === "real" && result.body?.error?.kind === "unauthorized") {
    addResult(
      "POST /api/brain-memory/memory/inspect",
      args.requireBrainMemory ? "fail" : "warn",
      "Inspect reached the BFF but Gateway rejected the optional UI bearer."
    );
  } else if (status?.mode === "real" && result.body?.error?.kind === "forbidden") {
    addResult(
      "POST /api/brain-memory/memory/inspect",
      args.requireBrainMemory ? "fail" : "warn",
      "Inspect reached the BFF but the tenant-bound memory key was not authorized for this scope."
    );
  } else if (mode === "real" || mode === "mock" || mode === "unconfigured" || mode === "error") {
    addResult(
      "POST /api/brain-memory/memory/inspect",
      "pass",
      `Inspect route returned normalized ${mode} response (${detailStatus}).`
    );
  } else {
    addResult("POST /api/brain-memory/memory/inspect", "fail", "Inspect route response did not include a normalized mode.");
  }

  return result;
}

async function checkHermesLiveSmoke(status) {
  const reachable = status?.mode === "real" && status?.reachable === true;
  if (!reachable) {
    addResult(
      "Hermes live mode",
      args.requireHermes ? "fail" : "warn",
      args.requireHermes
        ? "Hermes is required but BFF status is not real/reachable."
        : "Hermes is not real/reachable; live stream smoke skipped."
    );
    return;
  }

  const result = await fetchText(`${baseUrl}/api/hermes/chat/stream`, {
    body: JSON.stringify({
      context: hermesSmokeContext(),
      message: "MVP smoke check: reply with OK.",
      model: null,
      provider: null,
      recentMessages: []
    }),
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });

  if (!result.ok) {
    addResult(
      "POST /api/hermes/chat/stream",
      args.requireHermes ? "fail" : "warn",
      `Hermes stream route returned ${describeFetchResult(result)}.`
    );
    return;
  }

  const hasDone = result.text.includes('"type":"done"') || result.text.includes("event: done");
  const hasAssistant = result.text.includes('"type":"message_delta"') || result.text.includes('"type":"message_done"');
  if (hasDone && hasAssistant) {
    addResult("POST /api/hermes/chat/stream", "pass", "Hermes stream emitted assistant content and done event.");
  } else {
    addResult(
      "POST /api/hermes/chat/stream",
      args.requireHermes ? "fail" : "warn",
      "Hermes stream completed without expected assistant/done events."
    );
  }
}

function checkBrainMemoryMode(status, searchBody) {
  const live = status?.mode === "real" && status?.reachable === true;
  const searchReady = searchBody?.mode === "real";
  if (live) {
    addResult(
      "Brain Memory live mode",
      args.requireBrainMemory && !searchReady ? "fail" : "pass",
      searchReady
        ? "Brain Memory BFF reports real/reachable Gateway and search is live."
        : `Brain Memory BFF reports real/reachable Gateway, but search is not live${authHint(searchBody)}.`
    );
    return;
  }

  addResult(
    "Brain Memory live mode",
    args.requireBrainMemory ? "fail" : "warn",
    args.requireBrainMemory
      ? "Brain Memory Gateway is required but BFF status is not real/reachable."
      : "Brain Memory Gateway is not real/reachable; mock/unconfigured state accepted."
  );
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

function smokeContext() {
  return {
    project: {
      contextPolicy: "balanced",
      id: "brain-memory",
      retrievalProfile: "balanced",
      stableKey: "brain-memory",
      tenantId: "local-dev",
      title: "Brain Memory"
    },
    session: {
      id: "slice-12c-live-recheck",
      includeProjectContext: true,
      includeSessionContext: true,
      stableKey: "slice-12c-live-recheck",
      title: "Slice 12C live re-check"
    },
    ui: {
      source: "hermes-ui",
      workspaceVersion: 1
    }
  };
}

function hermesSmokeContext() {
  const context = smokeContext();
  return {
    ...context,
    project: {
      ...context.project,
      pinnedMemoryIds: [],
      userVisibleSummary: "MVP smoke context"
    },
    session: {
      ...context.session,
      hermesSessionId: "hermes-session-mvp-smoke",
      lastContextRefreshAt: undefined,
      userVisibleSummary: "MVP smoke session"
    }
  };
}

function checkSource(name, ok, message) {
  addResult(name, ok ? "pass" : "fail", ok ? message : `${message} Missing source marker.`);
}

function checkHtml(name, ok, messages) {
  addResult(name, ok ? "pass" : "fail", ok ? messages.pass : messages.fail);
}

function addResult(name, status, message) {
  report.checks.push({ message, name, status });
  if (!args.json) {
    console.log(`${icon(status)} ${name}: ${message}`);
  }
}

function addDetail(name, detail) {
  const check = report.checks.find((item) => item.name === name);
  if (check) {
    check.detail = detail;
  }
}

function finalize() {
  report.summary.passed = report.checks.filter((check) => check.status === "pass").length;
  report.summary.warned = report.checks.filter((check) => check.status === "warn").length;
  report.summary.failed = report.checks.filter((check) => check.status === "fail").length;

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log("");
    console.log(
      `MVP smoke summary: ${report.summary.passed} passed, ${report.summary.warned} warnings, ${report.summary.failed} failed.`
    );
  }

  process.exitCode = report.summary.failed > 0 ? 1 : 0;
}

function readFile(path) {
  return readFileSync(join(root, path), "utf8");
}

function sanitize(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  return JSON.parse(
    JSON.stringify(value, (key, child) => {
      if (/api[_-]?key|authorization|token|secret/i.test(key)) {
        return child ? "[redacted]" : child;
      }
      return child;
    })
  );
}

function describeFetchResult(result) {
  if (result.status) {
    return `HTTP ${result.status}`;
  }
  return result.error || "unknown error";
}

function authHint(body) {
  const kind = body?.error?.kind;
  if (kind === "unauthorized") {
    return " (UI bearer missing or invalid)";
  }
  if (kind === "forbidden") {
    return " (tenant-bound memory key missing or unauthorized)";
  }
  if (kind === "http_error") {
    return " (Gateway returned a scoped HTTP error)";
  }
  return "";
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
