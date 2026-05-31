#!/usr/bin/env node

import { chromium } from "playwright";
import { preflightStaticChunks, printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const EXPECTED_TEXT = "HERMES_RUNS_REPLAY_UI_OK";
const STORAGE_KEY = "hermes-ui.workspace.v1";
const WORKSPACE_VERSION = 1;
const timeoutMs = 10_000;
const liveTimeoutMs = 60_000;

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const routeUrl = new URL("/api/hermes/runs/experimental-chat", ensureTrailingSlash(baseUrl)).toString();
const contextShape = makeRunsReplayUiContext(args);

const report = {
  baseUrl,
  checks: [],
  mode: {
    expectDisabled: args.expectDisabled,
    headed: args.headed,
    requireHermes: args.requireHermes
  },
  summary: {
    failed: 0,
    passed: 0,
    warned: 0
  }
};

let browser;
let browserContext;
let page;

await main();

async function main() {
  printSelectedBaseUrl({ baseUrl, json: args.json, label: "Hermes Runs replay UI smoke" });
  for (const arg of args.unknown) {
    addResult("cli-args", "fail", `Unknown argument: ${arg}`);
  }

  const serverReady = await checkServer();
  if (!serverReady) {
    finalize();
    return;
  }

  const routeResult = await postExperimentalRunsChat();
  if (args.expectDisabled) {
    await checkDisabledState(routeResult);
    finalize();
    return;
  }

  if (!routeResult.ok) {
    const message = routeResult.error ?? `BFF route returned HTTP ${routeResult.status || "none"}.`;
    addResult("runs-route-enabled", args.requireHermes ? "fail" : "warn", message);
    finalize();
    return;
  }

  const runsResult = routeResult.body;
  const shape = validateRunsReplayPreview(runsResult);
  addResult("runs-preview-shape", shape.ok ? "pass" : "fail", shape.message);
  if (!shape.ok) {
    finalize();
    return;
  }

  const staticPreflight = await preflightStaticChunks({
    addResult,
    baseUrl,
    failName: "static-assets-preflight",
    timeoutMs
  });
  if (!staticPreflight.ok) {
    finalize();
    return;
  }

  try {
    browser = await launchBrowser();
    browserContext = await browser.newContext({ viewport: { height: 900, width: 1440 } });
    await browserContext.addInitScript(({ key, state }) => {
      window.localStorage.setItem(key, JSON.stringify(state));
    }, {
      key: STORAGE_KEY,
      state: createHydratedWorkspaceState(runsResult)
    });
    page = await browserContext.newPage();
    const browserIssues = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !isIgnoredConsoleError(message.text())) {
        browserIssues.push(`console error: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      browserIssues.push(`page error: ${error.message}`);
    });
    page.on("response", (response) => {
      const url = response.url();
      if (response.status() >= 400 && !isIgnoredNetworkResponse(url, response.status())) {
        browserIssues.push(`HTTP ${response.status()}: ${safeDisplayUrl(url)}`);
      }
    });

    await openRoot();
    await verifyRunsReplayUi(runsResult);
    check(
      "browser-errors",
      browserIssues.length === 0,
      browserIssues.length === 0
        ? "No browser console, page, or unexpected HTTP errors were captured."
        : browserIssues.slice(0, 5).join(" | ")
    );
  } catch (error) {
    addResult("browser-run", "fail", safeErrorMessage(error));
  } finally {
    if (browserContext) {
      await browserContext.close();
    }
    if (browser) {
      await browser.close();
    }
  }

  finalize();
}

function parseArgs(values) {
  const parsed = {
    baseUrl: "",
    expectDisabled: false,
    headed: false,
    json: false,
    projectId: "project-runs-replay-ui-16l",
    requireHermes: false,
    sessionId: "session-runs-replay-ui-16l",
    tenantId: "local-dev",
    unknown: []
  };

  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (arg === "--base-url") {
      parsed.baseUrl = values[index + 1] ?? "";
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      parsed.baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--expect-disabled") {
      parsed.expectDisabled = true;
    } else if (arg === "--headed") {
      parsed.headed = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--project-id") {
      parsed.projectId = sanitizeId(values[index + 1], parsed.projectId);
      index += 1;
    } else if (arg.startsWith("--project-id=")) {
      parsed.projectId = sanitizeId(arg.slice("--project-id=".length), parsed.projectId);
    } else if (arg === "--require-hermes") {
      parsed.requireHermes = true;
    } else if (arg === "--session-id") {
      parsed.sessionId = sanitizeId(values[index + 1], parsed.sessionId);
      index += 1;
    } else if (arg.startsWith("--session-id=")) {
      parsed.sessionId = sanitizeId(arg.slice("--session-id=".length), parsed.sessionId);
    } else if (arg === "--tenant-id") {
      parsed.tenantId = sanitizeId(values[index + 1], parsed.tenantId);
      index += 1;
    } else if (arg.startsWith("--tenant-id=")) {
      parsed.tenantId = sanitizeId(arg.slice("--tenant-id=".length), parsed.tenantId);
    } else {
      parsed.unknown.push(arg);
    }
  }

  return parsed;
}

async function checkServer() {
  const result = await fetchWithTimeout(`${baseUrl}/`);
  addResult(
    "GET /",
    result.ok ? "pass" : "fail",
    result.ok
      ? `Web UI server returned HTTP ${result.status}.`
      : `Web UI server is not reachable at ${baseUrl} (${result.status || result.error}).`
  );
  return result.ok;
}

async function postExperimentalRunsChat() {
  return postJson(routeUrl, {
    context: contextShape,
    expectedText: EXPECTED_TEXT,
    message: `Reply exactly: ${EXPECTED_TEXT}`,
    model: null,
    provider: null,
    recentMessages: []
  }, liveTimeoutMs);
}

async function checkDisabledState(result) {
  const disabled = result.status === 403 && result.body?.mode === "disabled";
  addResult(
    "runs-route-disabled",
    disabled ? "pass" : "fail",
    disabled
      ? "Experimental Runs route returned HTTP 403 mode=disabled and no UI hydration was attempted."
      : `Expected HTTP 403 mode=disabled, got HTTP ${result.status || "none"} mode=${result.body?.mode || "none"}.`
  );
  const safety = result.body?.safety;
  check("disabled-no-run-record-preview", !result.body?.runRecordPreview, "Disabled response has no runRecordPreview.");
  check("disabled-production-chat-untouched", safety?.productionChatUntouched === true, "Disabled response keeps production chat untouched.");
}

async function launchBrowser() {
  const options = {
    headless: !args.headed,
    timeout: timeoutMs
  };
  try {
    return await chromium.launch({ ...options, channel: "msedge" });
  } catch {
    return chromium.launch(options);
  }
}

async function openRoot() {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("load", { timeout: timeoutMs });
  const title = await page.title();
  check("root-title", title === "Brain Memory Studio", `Document title is "${title}".`);
  await expectVisible("root-brand-visible", page.getByText("Brain Memory Studio").first(), "Brain Memory Studio is visible.");
}

async function verifyRunsReplayUi(runsResult) {
  const record = runsResult.runRecordPreview;
  const showContextPanel = page.getByRole("button", { name: "Show context panel", exact: true });
  if (await showContextPanel.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await showContextPanel.click({ timeout: timeoutMs });
  }
  const runHistory = page.locator('section[aria-labelledby="run-history-heading"]');
  await expectVisible("run-history-section", runHistory.getByText("Run history", { exact: true }).first(), "Run history section is visible.");
  await expectVisible("runs-record-summary", runHistory.getByText(record.summary, { exact: true }).first(), "Runs-backed run summary is visible.");
  await expectVisible("runs-record-status", runHistory.getByText("completed", { exact: true }).first(), "Runs-backed run status is completed.");
  await expectVisible("runs-record-source", runHistory.getByText("web-ui", { exact: true }).first(), "Runs-backed source channel is visible.");
  await expectVisible("runs-record-hermes-run", runHistory.getByText(record.hermesRunId, { exact: true }).first(), "Hermes run id is visible in selected-run detail.");
  await expectVisible("runs-record-hermes-session", runHistory.getByText(record.hermesSessionId, { exact: true }).first(), "Hermes session id is visible in selected-run detail.");
  await expectVisible("runs-replay-section", runHistory.getByText("Persisted replay", { exact: true }).first(), "Persisted replay section is visible.");
  for (const event of record.activityReplay.slice(0, 3)) {
    await expectVisible(`runs-replay-row-${event.id}`, runHistory.getByText(event.title, { exact: true }).first(), `Persisted replay row "${event.title}" is visible.`);
  }
  await expectHidden("runs-replay-not-empty", runHistory.getByText("No persisted activity replay for this run", { exact: true }).first(), "Runs-backed replay is not empty.");
  await expectVisible("runs-replay-event-count", page.getByText(`${record.activityReplay.length} persisted replay events`, { exact: false }).first(), "Run detail shows persisted replay count.");

  const bodyText = await page.locator("body").innerText({ timeout: timeoutMs });
  check("runs-no-message-delta-visible", !bodyText.includes("message.delta"), "message.delta is not visible as a per-token replay row.");
  check("runs-no-hidden-reasoning-visible", !/chain[_-]?of[_-]?thought|private reasoning|hidden reasoning/i.test(bodyText), "Hidden/private reasoning text is not visible.");
  check("runs-no-visible-secrets", !hasVisibleSecret(bodyText), "No credential-like values are visible.");
  await checkNoHorizontalOverflow("runs-replay-no-horizontal-overflow");
}

function validateRunsReplayPreview(report) {
  if (!report || report.mode !== "success" || !report.ok) {
    return {
      ok: false,
      message: `Experimental Runs route did not succeed; mode=${report?.mode || "none"} error=${report?.error?.message || "none"}.`
    };
  }
  const record = report.runRecordPreview;
  const replay = Array.isArray(report.activityReplayPreview) ? report.activityReplayPreview : [];
  if (!record) {
    return { ok: false, message: "runRecordPreview is missing." };
  }
  if (record.id === report.runId || !record.id?.startsWith("run-preview-")) {
    return { ok: false, message: "runRecordPreview id is not a local run-preview id." };
  }
  if (record.hermesRunId !== report.runId) {
    return { ok: false, message: "runRecordPreview.hermesRunId does not match route runId." };
  }
  if (record.status !== "completed") {
    return { ok: false, message: `runRecordPreview status should be completed, got ${record.status}.` };
  }
  if (record.sourceChannel !== "web-ui") {
    return { ok: false, message: "runRecordPreview sourceChannel should be web-ui." };
  }
  if (!Array.isArray(record.activityReplay) || record.activityReplay.length !== replay.length || replay.length === 0) {
    return { ok: false, message: "activityReplayPreview is missing or not mirrored on runRecordPreview." };
  }
  if (replay.length > 40) {
    return { ok: false, message: "activityReplayPreview exceeds the persisted replay bound." };
  }
  if (replay.some((event) => event?.hermes?.eventType === "message.delta")) {
    return { ok: false, message: "message.delta was persisted as a replay row." };
  }
  const serialized = JSON.stringify({ record, replay });
  if (serialized.includes("message.delta")) {
    return { ok: false, message: "message.delta leaked into persisted replay JSON." };
  }
  if (serialized.includes("rawReasoningTextRendered\":true")) {
    return { ok: false, message: "Raw reasoning text render flag is true." };
  }
  if (hasVisibleSecret(serialized)) {
    return { ok: false, message: "Credential-like value appears in replay preview JSON." };
  }
  return { ok: true, message: `RunRecord preview ${record.id} has ${replay.length} bounded replay rows.` };
}

function createHydratedWorkspaceState(runsResult) {
  const now = new Date().toISOString();
  const project = {
    createdAt: now,
    description: "Isolated browser smoke project for experimental Runs replay UI hydration.",
    icon: "RU",
    id: contextShape.project.id,
    memoryScope: {
      contextPolicy: contextShape.project.contextPolicy,
      pinnedMemoryIds: [],
      projectId: contextShape.project.id,
      retrievalProfile: contextShape.project.retrievalProfile,
      stableProjectKey: contextShape.project.stableKey,
      tenantId: contextShape.project.tenantId,
      userVisibleSummary: "Isolated Runs replay UI smoke project."
    },
    memoryScopeKey: contextShape.project.stableKey,
    name: contextShape.project.title,
    updatedAt: now
  };
  const assistantMessageId = "msg-runs-replay-ui-assistant";
  const userMessageId = "msg-runs-replay-ui-user";
  const runRecord = {
    ...runsResult.runRecordPreview,
    assistantMessageId,
    userMessageId
  };
  return {
    activeProjectId: project.id,
    activeSessionId: contextShape.session.id,
    connectionStatus: {
      brainMemory: "unknown",
      hermes: "real"
    },
    modelChoices: [
      {
        id: "hermes-default",
        label: "Hermes server model",
        provider: "Hermes"
      }
    ],
    projects: [project],
    sessions: [
      {
        artifacts: [],
        createdAt: now,
        hermesSessionId: contextShape.session.hermesSessionId,
        id: contextShape.session.id,
        memoryEvidence: [],
        memoryScope: {
          includeProjectContext: true,
          includeSessionContext: true,
          projectId: project.id,
          sessionId: contextShape.session.id,
          stableSessionKey: contextShape.session.stableKey,
          tenantId: contextShape.project.tenantId,
          userVisibleSummary: "Isolated Runs replay UI smoke session."
        },
        messages: [
          {
            author: "Alexey",
            content: `Reply exactly: ${EXPECTED_TEXT}`,
            createdAt: "16L smoke",
            id: userMessageId,
            role: "user",
            status: "complete"
          },
          {
            author: "Hermes",
            content: runsResult.outputPreview || runsResult.assistantTextPreview || EXPECTED_TEXT,
            createdAt: "16L smoke",
            id: assistantMessageId,
            role: "assistant",
            references: ["Experimental Hermes Runs replay UI hydration"],
            status: "complete"
          }
        ],
        projectId: project.id,
        runRecords: [runRecord],
        summary: "Isolated Runs replay UI hydration smoke session",
        title: "Runs replay UI smoke",
        titleSource: "manual",
        toolEvents: [],
        updatedAt: now
      }
    ],
    version: WORKSPACE_VERSION
  };
}

function makeRunsReplayUiContext(parsed) {
  const tenantId = sanitizeId(parsed.tenantId, "local-dev");
  const projectId = sanitizeId(parsed.projectId, "project-runs-replay-ui-16l");
  const sessionId = sanitizeId(parsed.sessionId, "session-runs-replay-ui-16l");
  const projectStableKey = `studio:${tenantId}:project:${projectId}`;
  const sessionStableKey = `${projectStableKey}:session:${sessionId}`;
  return {
    project: {
      contextPolicy: "balanced",
      id: projectId,
      pinnedMemoryIds: [],
      retrievalProfile: "balanced",
      stableKey: projectStableKey,
      tenantId,
      title: "Runs Replay UI Hydration"
    },
    session: {
      hermesSessionId: `hermes-session-${sessionId}`,
      id: sessionId,
      includeProjectContext: true,
      includeSessionContext: true,
      stableKey: sessionStableKey,
      title: "Runs Replay UI Hydration"
    },
    ui: {
      source: "hermes-ui",
      workspaceVersion: WORKSPACE_VERSION
    }
  };
}

async function expectVisible(name, locator, message) {
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    addResult(name, "pass", message);
  } catch {
    addResult(name, "fail", `${message} Element was not visible.`);
  }
}

async function expectHidden(name, locator, message) {
  try {
    await locator.waitFor({ state: "hidden", timeout: timeoutMs });
    addResult(name, "pass", message);
  } catch {
    addResult(name, "fail", `${message} Element was still visible.`);
  }
}

async function checkNoHorizontalOverflow(name) {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  check(name, sizes.scrollWidth <= sizes.clientWidth + 1, `Document width ${sizes.scrollWidth}px fits viewport ${sizes.clientWidth}px.`);
}

function check(name, ok, message) {
  addResult(name, ok ? "pass" : "fail", message);
}

function addResult(name, status, message) {
  report.checks.push({ message, name, status });
  if (!args.json) {
    console.log(`${icon(status)} ${name}: ${message}`);
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
      `Hermes Runs replay UI smoke summary: ${report.summary.passed} passed, ${report.summary.warned} warnings, ${report.summary.failed} failed.`
    );
  }
  process.exitCode = report.summary.failed > 0 ? 1 : 0;
}

async function fetchWithTimeout(url, timeout = timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });
    return {
      ok: response.ok,
      status: response.status
    };
  } catch (error) {
    return {
      error: error instanceof Error && error.name === "AbortError" ? "timeout" : "unreachable",
      ok: false,
      status: 0
    };
  } finally {
    clearTimeout(timer);
  }
}

async function postJson(url, payload, timeout = timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal
    });
    const text = await response.text();
    return {
      body: parseJson(text),
      ok: response.ok,
      status: response.status
    };
  } catch (error) {
    return {
      body: null,
      error: error instanceof Error && error.name === "AbortError" ? "timeout" : safeErrorMessage(error),
      ok: false,
      status: 0
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function hasVisibleSecret(value) {
  return /(Bearer\s+(?!\[redacted\])[A-Za-z0-9._~+/=-]{12,}|(?:api[_-]?key|apikey|token|password)\s*[:=]\s*(?!\[redacted\]|set\b|not set\b|true\b|false\b)[^,\s}]+)/i.test(value);
}

function isIgnoredNetworkResponse(url, status) {
  return status === 404 && /favicon|apple-touch-icon|icon/i.test(url);
}

function isIgnoredConsoleError(message) {
  if (message.includes("/_next/webpack-hmr")) {
    return true;
  }
  return /Failed to load resource: the server responded with a status of 404/i.test(message);
}

function safeDisplayUrl(value) {
  try {
    const url = new URL(value);
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return value;
  }
}

function safeErrorMessage(error) {
  if (!(error instanceof Error)) {
    return "Unknown error.";
  }
  return error.message.replace(/(api[_-]?key|authorization|token|secret)=([^&\s]+)/gi, "$1=[redacted]");
}

function sanitizeId(value, fallback) {
  return typeof value === "string"
    ? value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 96) || fallback
    : fallback;
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
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
