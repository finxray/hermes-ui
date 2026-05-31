#!/usr/bin/env node

import { chromium } from "playwright";
import { preflightStaticChunks, printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 15_000;
const runStartedAt = Date.now();
const budget = {
  routeLoadWarnMs: 5_000,
  scrollActionWarnMs: 100,
  tabSwitchWarnMs: 500
};
const report = {
  baseUrl,
  budget,
  checks: [],
  metrics: {
    browserErrorCount: 0,
    networkErrorCount: 0,
    serviceCallCount: 0,
    totalDurationMs: 0
  },
  mode: {
    budgetStrict: args.budgetStrict,
    headed: args.headed,
    verbose: args.verbose
  },
  summary: {
    failed: 0,
    passed: 0,
    warned: 0
  }
};

const browserIssues = [];
const networkIssues = [];
const serviceCalls = [];
let browser;
let context;
let page;

await main();

async function main() {
  printSelectedBaseUrl({ baseUrl, json: args.json, label: "Long-session performance smoke" });
  for (const arg of args.unknown) {
    addResult("cli-args", "fail", `Unknown argument: ${arg}`);
  }

  try {
    const staticPreflight = await preflightStaticChunks({
      addResult,
      baseUrl,
      failName: "static-assets-preflight",
      timeoutMs
    });
    report.metrics.staticChunkCount = staticPreflight.assets?.length ?? undefined;
    if (!staticPreflight.ok) {
      finalize();
      return;
    }

    browser = await launchBrowser();
    context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
    page = await context.newPage();
    page.on("console", (message) => {
      if (message.type() === "error" && !isIgnoredConsoleError(message.text())) {
        browserIssues.push(`console error: ${message.text()}`);
      }
    });
    page.on("pageerror", (error) => {
      browserIssues.push(`page error: ${error.message}`);
    });
    page.on("request", (request) => {
      const url = request.url();
      if (isForbiddenServiceCall(url)) {
        serviceCalls.push(safeDisplayUrl(url));
      }
    });
    page.on("response", (response) => {
      const url = response.url();
      const status = response.status();
      if (status >= 400 && !isIgnoredNetworkResponse(url, status)) {
        networkIssues.push(`HTTP ${status}: ${safeDisplayUrl(url)}`);
      }
    });

    const startedAt = Date.now();
    const response = await page.goto(`${baseUrl}/design/long-session-fixture`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    });
    if (!response?.ok()) {
      addResult(
        "route-load",
        "fail",
        `Long-session fixture route returned HTTP ${response?.status() ?? "unknown"}. If ${baseUrl} is stale, restart that server or pass --base-url for a healthy Studio server.`
      );
      finalize();
      return;
    }
    await page.waitForLoadState("load", { timeout: timeoutMs });
    const routeLoadMs = Date.now() - startedAt;
    report.metrics.routeLoadMs = routeLoadMs;
    report.metrics.navigationTiming = await collectNavigationTiming();
    addResult("route-load", "pass", `Long-session fixture route loaded in ${routeLoadMs}ms.`);
    addTimingWarning("route-load-budget", routeLoadMs, budget.routeLoadWarnMs, "Route load");

    await checkFixtureChrome();
    await checkTranscriptScale();
    await checkRailAndDetails();
    await checkSidebarScale();
    await checkScrollResponsiveness();
    await checkRightRailTabSwitching();
    await checkNoHorizontalOverflow("long-session-fixture-overflow");
    checkNoServiceCalls();
    checkBrowserIssues();
  } catch (error) {
    addResult("long-session-smoke-run", "fail", safeErrorMessage(error));
  } finally {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  }

  finalize();
}

async function checkFixtureChrome() {
  await expectVisible(
    "fixture-title-visible",
    page.getByRole("heading", { name: "Long-session performance fixture", exact: true }),
    "Fixture title is visible."
  );
  await expectVisible(
    "fixture-scale-messages-visible",
    page.getByText("120 messages", { exact: true }),
    "Message-count metric is visible."
  );
  await expectVisible(
    "fixture-shell-visible",
    page.getByLabel("Long-session Studio shell fixture", { exact: true }),
    "Studio shell fixture is visible."
  );
  await expectVisible(
    "fixture-sidebar-visible",
    page.getByLabel("Projects and chats", { exact: true }),
    "Existing sidebar component is visible."
  );
  await expectVisible(
    "fixture-context-rail-visible",
    page.getByLabel("Context, memory, tools, and files", { exact: true }),
    "Existing right rail component is visible."
  );
}

async function checkTranscriptScale() {
  const transcript = page.getByLabel("Chat transcript", { exact: true });
  await expectVisible("fixture-transcript-visible", transcript, "Existing chat transcript is visible.");
  const messageCount = await transcript.locator("article").count();
  const transcriptMetrics = await page.evaluate(() => {
    const transcript = document.querySelector('[aria-label="Chat transcript"]');
    if (!(transcript instanceof HTMLElement)) {
      return null;
    }
    return {
      clientHeight: transcript.clientHeight,
      scrollHeight: transcript.scrollHeight,
      scrollTop: transcript.scrollTop
    };
  });
  report.metrics.renderedMessageCount = messageCount;
  report.metrics.transcript = transcriptMetrics;
  check("fixture-message-count", messageCount === 120, `Rendered ${messageCount} transcript message articles.`);
  await expectVisible(
    "fixture-last-message-visible-after-scroll",
    transcript.getByText("Measurement checkpoint 120", { exact: true }),
    "The final deterministic assistant checkpoint is reachable in the transcript."
  );
}

async function checkRailAndDetails() {
  const detailsCount = await page.locator("details").count();
  const openDetailsCount = await page.locator("details[open]").count();
  report.metrics.renderedDetailsCount = detailsCount;
  report.metrics.openDetailsCount = openDetailsCount;
  check("fixture-details-present", detailsCount >= 2, `Found ${detailsCount} collapsible detail region(s).`);
  check(
    "fixture-details-collapsed-by-default",
    openDetailsCount === 0,
    `Open detail regions by default: ${openDetailsCount}.`
  );
  check(
    "fixture-details-not-all-expanded",
    detailsCount > 0 && openDetailsCount < detailsCount,
    `Details open=${openDetailsCount}, total=${detailsCount}.`
  );
  await expectVisible(
    "fixture-run-history-visible",
    page.getByText("Run history", { exact: true }),
    "Run history section is visible."
  );
  await expectVisible(
    "fixture-export-preview-visible",
    page.getByText("Export preview", { exact: true }),
    "Export preview section is visible and collapsed details remain closed."
  );
  report.metrics.contextRail = await collectContextRailMetrics();
}

async function checkSidebarScale() {
  const projectRows = await page.locator('section[aria-labelledby="projects-heading"] > ul > li').count();
  const sessionRows = await page.locator('section[aria-labelledby="projects-heading"] ul ul li').count();
  report.metrics.renderedSidebarProjectCount = projectRows;
  report.metrics.renderedSidebarSessionCount = sessionRows;
  report.metrics.renderedSidebarRowCount = projectRows + sessionRows;
  check("fixture-sidebar-project-count", projectRows === 5, `Rendered ${projectRows} project group(s).`);
  check("fixture-sidebar-session-count", sessionRows === 100, `Rendered ${sessionRows} sidebar session row(s).`);
}

async function checkScrollResponsiveness() {
  const result = await page.evaluate(async () => {
    const transcript = document.querySelector('[aria-label="Chat transcript"]');
    if (!(transcript instanceof HTMLElement)) {
      return { ok: false, reason: "missing transcript" };
    }

    const before = {
      clientHeight: transcript.clientHeight,
      scrollHeight: transcript.scrollHeight,
      scrollTop: transcript.scrollTop
    };
    const downStartedAt = performance.now();
    transcript.scrollTop = transcript.scrollHeight;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const downMs = performance.now() - downStartedAt;
    const downTop = transcript.scrollTop;

    const upStartedAt = performance.now();
    transcript.scrollTop = 0;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const upMs = performance.now() - upStartedAt;

    return {
      before,
      downMs,
      downTop,
      ok: downTop > 0 && transcript.scrollTop === 0,
      upMs
    };
  });
  report.metrics.scroll = result;
  const maxScrollMs = Math.max(result.downMs ?? 0, result.upMs ?? 0);
  check(
    "fixture-scroll-responsive",
    result.ok === true,
    result.ok
      ? `Transcript scroll down/up responded in ${Math.round(result.downMs)}ms / ${Math.round(result.upMs)}ms.`
      : `Transcript scroll check failed: ${result.reason ?? "unknown"}.`
  );
  addTimingWarning("fixture-scroll-budget", maxScrollMs, budget.scrollActionWarnMs, "Transcript scroll action");
}

async function checkRightRailTabSwitching() {
  const tabs = [
    { label: "Show memory panel", marker: "Memory search", name: "memory" },
    { label: "Show tools panel", marker: "Recent commands", name: "tools" },
    { label: "Show files panel", marker: "Files and artifacts", name: "files" },
    { label: "Show context panel", marker: "Run history", name: "context" }
  ];
  const metrics = [];

  for (const tab of tabs) {
    const result = await switchRightRailTab(tab);
    metrics.push({ name: tab.name, ...result });
    if (!result.ok) {
      addResult(`fixture-tab-${tab.name}`, "fail", result.reason);
      continue;
    }
    addResult(
      `fixture-tab-${tab.name}`,
      "pass",
      `${tab.name} tab switched in ${Math.round(result.elapsedMs)}ms.`
    );
    addTimingWarning(
      `fixture-tab-${tab.name}-budget`,
      result.elapsedMs,
      budget.tabSwitchWarnMs,
      `${tab.name} tab switch`
    );
  }

  report.metrics.rightRailTabSwitches = metrics;
}

async function switchRightRailTab(tab) {
  try {
    const button = page.getByRole("button", { name: tab.label, exact: true });
    const startedAt = Date.now();
    await button.click({ timeout: timeoutMs });
    await page.getByText(tab.marker, { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
    return {
      elapsedMs: Date.now() - startedAt,
      ok: true
    };
  } catch (error) {
    return {
      ok: false,
      reason: `${tab.name} tab did not become visible: ${safeErrorMessage(error)}`
    };
  }
}

async function checkNoHorizontalOverflow(name) {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    scrollWidth: document.documentElement.scrollWidth
  }));
  report.metrics.horizontalOverflow = sizes;
  check(
    name,
    sizes.overflowPx <= 1,
    `Document width ${sizes.scrollWidth}px fits viewport ${sizes.clientWidth}px.`
  );
}

async function collectNavigationTiming() {
  return page.evaluate(() => {
    const entry = performance.getEntriesByType("navigation")[0];
    if (!entry) {
      return null;
    }
    return {
      domContentLoadedMs: Math.round(entry.domContentLoadedEventEnd),
      loadEventMs: Math.round(entry.loadEventEnd),
      responseEndMs: Math.round(entry.responseEnd),
      transferSize: "transferSize" in entry ? entry.transferSize : undefined
    };
  });
}

async function collectContextRailMetrics() {
  return page.evaluate(() => {
    const runHistory = document.querySelector('[aria-labelledby="run-history-heading"]');
    const replay = document.querySelector('[aria-label="Persisted activity replay"]');
    const retrievedMemory = document.querySelector('[aria-labelledby="retrieved-memory-heading"]');
    const exportPreview = document.querySelector('[aria-labelledby="export-preview-heading"]');
    const exportJson = exportPreview?.querySelector("pre");
    return {
      exportJsonChars: exportJson?.textContent?.length ?? 0,
      exportPreviewDetailsOpen: exportPreview?.querySelector("details")?.hasAttribute("open") ?? false,
      persistedReplayRows: replay?.querySelectorAll("li").length ?? 0,
      retrievedMemoryRows: retrievedMemory?.querySelectorAll("li").length ?? 0,
      runRows: runHistory?.querySelectorAll("button").length ?? 0
    };
  });
}

function checkNoServiceCalls() {
  report.metrics.serviceCallCount = serviceCalls.length;
  if (serviceCalls.length === 0) {
    addResult("fixture-no-service-calls", "pass", "Fixture route made no BFF, Hermes, Brain Memory, or direct storage service calls.");
    return;
  }
  addResult("fixture-no-service-calls", "fail", serviceCalls.slice(0, 5).join(" | "));
}

function checkBrowserIssues() {
  report.metrics.browserErrorCount = browserIssues.length;
  report.metrics.networkErrorCount = networkIssues.length;
  const issues = [...browserIssues, ...networkIssues];
  if (issues.length === 0) {
    addResult("fixture-browser-errors", "pass", "No browser console, page, or network errors were captured.");
    return;
  }
  addResult("fixture-browser-errors", "fail", issues.slice(0, 5).join(" | "));
}

async function expectVisible(name, locator, message) {
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    addResult(name, "pass", message);
  } catch {
    addResult(name, "fail", `${message} Element was not visible.`);
  }
}

function check(name, ok, message) {
  addResult(name, ok ? "pass" : "fail", message);
}

function addTimingWarning(name, actualMs, thresholdMs, label) {
  if (typeof actualMs !== "number" || !Number.isFinite(actualMs)) {
    addResult(name, "warn", `${label} timing was unavailable.`);
    return;
  }
  const ok = actualMs <= thresholdMs;
  if (args.budgetStrict) {
    addResult(name, ok ? "pass" : "fail", `${label} ${Math.round(actualMs)}ms; threshold ${thresholdMs}ms.`);
    return;
  }
  addResult(
    name,
    ok ? "pass" : "warn",
    `${label} ${Math.round(actualMs)}ms; warning threshold ${thresholdMs}ms.`
  );
}

function addResult(name, status, message) {
  report.checks.push({ message, name, status });
  if (!args.json) {
    console.log(`${icon(status)} ${name}: ${message}`);
  }
}

function finalize() {
  report.metrics.totalDurationMs = Date.now() - runStartedAt;
  report.summary.passed = report.checks.filter((check) => check.status === "pass").length;
  report.summary.warned = report.checks.filter((check) => check.status === "warn").length;
  report.summary.failed = report.checks.filter((check) => check.status === "fail").length;

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printMetricSummary();
    console.log("");
    console.log(
      `Long-session performance smoke summary: ${report.summary.passed} passed, ${report.summary.warned} warnings, ${report.summary.failed} failed.`
    );
  }

  process.exitCode = report.summary.failed > 0 ? 1 : 0;
}

function printMetricSummary() {
  if (!args.verbose) {
    return;
  }
  console.log("");
  console.log("Long-session measurement metrics:");
  for (const [key, value] of Object.entries(report.metrics)) {
    console.log(`- ${key}: ${formatMetricValue(value)}`);
  }
}

function formatMetricValue(value) {
  if (value === undefined) {
    return "unavailable";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function parseArgs(values) {
  const parsed = {
    baseUrl: "",
    budgetStrict: false,
    headed: false,
    json: false,
    unknown: [],
    verbose: false
  };

  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (arg === "--base-url") {
      parsed.baseUrl = values[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      parsed.baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--budget-strict") {
      parsed.budgetStrict = true;
    } else if (arg === "--headed") {
      parsed.headed = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--verbose") {
      parsed.verbose = true;
    } else {
      parsed.unknown.push(arg);
    }
  }

  return parsed;
}

async function launchBrowser() {
  const launchOptions = {
    headless: !args.headed,
    timeout: timeoutMs
  };

  try {
    return await chromium.launch({ ...launchOptions, channel: "msedge" });
  } catch {
    return chromium.launch(launchOptions);
  }
}

function isForbiddenServiceCall(value) {
  try {
    const url = new URL(value);
    if (url.pathname.startsWith("/api/")) {
      return true;
    }
    return ["8080", "8642", "8765"].includes(url.port);
  } catch {
    return false;
  }
}

function isIgnoredNetworkResponse(url, status) {
  return status === 404 && /favicon|apple-touch-icon|icon/i.test(url);
}

function isIgnoredConsoleError(message) {
  return (
    message.includes("Failed to load resource: the server responded with a status of 404") ||
    (message.includes("WebSocket connection to") && message.includes("_next/webpack-hmr")) ||
    message.includes("/_next/webpack-hmr")
  );
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

function icon(status) {
  if (status === "pass") {
    return "[ok]";
  }
  if (status === "warn") {
    return "[--]";
  }
  return "[!!]";
}
