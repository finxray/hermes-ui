#!/usr/bin/env node

import { chromium } from "playwright";
import { preflightStaticChunks, printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 15_000;
const runStartedAt = Date.now();
const expected = {
  projects: 25,
  recentChats: 2,
  sessions: 1_000
};
const budget = {
  activeSelectionWarnMs: 750,
  routeLoadWarnMs: 5_000,
  rowCountWarn: 1_500,
  scrollActionWarnMs: 100
};
const report = {
  baseUrl,
  budget,
  checks: [],
  expected,
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
  printSelectedBaseUrl({ baseUrl, json: args.json, label: "Large sidebar smoke" });
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
    const response = await page.goto(`${baseUrl}/design/sidebar-large-fixture`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    });
    if (!response?.ok()) {
      addResult(
        "route-load",
        "fail",
        `Large sidebar fixture route returned HTTP ${response?.status() ?? "unknown"}. If ${baseUrl} is stale, restart that server or pass --base-url for a healthy Studio server.`
      );
      finalize();
      return;
    }
    await page.waitForLoadState("load", { timeout: timeoutMs });
    const routeLoadMs = Date.now() - startedAt;
    report.metrics.routeLoadMs = routeLoadMs;
    report.metrics.navigationTiming = await collectNavigationTiming();
    addResult("route-load", "pass", `Large sidebar fixture route loaded in ${routeLoadMs}ms.`);
    addTimingWarning("route-load-budget", routeLoadMs, budget.routeLoadWarnMs, "Route load");

    await checkFixtureChrome();
    await checkSidebarCounts();
    await checkSidebarScrollResponsiveness();
    await checkActiveRowSelection();
    await checkNoHorizontalOverflow();
    checkNoServiceCalls();
    checkBrowserIssues();
  } catch (error) {
    addResult("large-sidebar-smoke-run", "fail", safeErrorMessage(error));
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
    page.getByRole("heading", { name: "Large sidebar measurement fixture", exact: true }),
    "Fixture title is visible."
  );
  await expectVisible(
    "fixture-scale-projects-visible",
    page.getByText("25 projects", { exact: true }),
    "Project-count metric is visible."
  );
  await expectVisible(
    "fixture-scale-sessions-visible",
    page.getByText("1000 sessions", { exact: true }),
    "Session-count metric is visible."
  );
  await expectVisible(
    "fixture-sidebar-visible",
    page.getByLabel("Projects and chats", { exact: true }),
    "Existing Sidebar component is visible."
  );
  await expectVisible(
    "fixture-panel-visible",
    page.getByLabel("Large sidebar measurement panel", { exact: true }),
    "Fixture main panel is visible."
  );
}

async function checkSidebarCounts() {
  const metrics = await collectSidebarMetrics();
  report.metrics.sidebar = metrics;
  report.metrics.renderedProjectCount = metrics.projectRows;
  report.metrics.renderedSessionCount = metrics.sessionRows;
  report.metrics.renderedRecentChatCount = metrics.recentRows;
  report.metrics.renderedSidebarRowCount = metrics.renderedSidebarRowCount;
  check("fixture-sidebar-project-count", metrics.projectRows === expected.projects, `Rendered ${metrics.projectRows} project group(s).`);
  check("fixture-sidebar-session-count", metrics.sessionRows === expected.sessions, `Rendered ${metrics.sessionRows} sidebar session row(s).`);
  check("fixture-sidebar-recent-count", metrics.recentRows === expected.recentChats, `Rendered ${metrics.recentRows} recent chat row(s).`);
  addResult(
    "fixture-sidebar-row-count-budget",
    metrics.renderedSidebarRowCount > budget.rowCountWarn ? "warn" : "pass",
    `Rendered project/session/recent rows: ${metrics.renderedSidebarRowCount}; warning threshold ${budget.rowCountWarn}.`
  );
}

async function checkSidebarScrollResponsiveness() {
  const result = await page.evaluate(async () => {
    const sidebar = document.querySelector('[aria-label="Projects and chats"]');
    if (!(sidebar instanceof HTMLElement)) {
      return { ok: false, reason: "missing sidebar" };
    }

    const before = {
      clientHeight: sidebar.clientHeight,
      scrollHeight: sidebar.scrollHeight,
      scrollTop: sidebar.scrollTop
    };
    const downStartedAt = performance.now();
    sidebar.scrollTop = sidebar.scrollHeight;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const downMs = performance.now() - downStartedAt;
    const downTop = sidebar.scrollTop;

    const upStartedAt = performance.now();
    sidebar.scrollTop = 0;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const upMs = performance.now() - upStartedAt;

    return {
      before,
      downMs,
      downTop,
      ok: downTop > 0 && sidebar.scrollTop === 0,
      upMs
    };
  });
  report.metrics.sidebarScroll = result;
  const maxScrollMs = Math.max(result.downMs ?? 0, result.upMs ?? 0);
  check(
    "fixture-sidebar-scroll-responsive",
    result.ok === true,
    result.ok
      ? `Sidebar scroll down/up responded in ${Math.round(result.downMs)}ms / ${Math.round(result.upMs)}ms.`
      : `Sidebar scroll check failed: ${result.reason ?? "unknown"}.`
  );
  addTimingWarning("fixture-sidebar-scroll-budget", maxScrollMs, budget.scrollActionWarnMs, "Sidebar scroll action");
}

async function checkActiveRowSelection() {
  const sessionRows = page.locator('section[aria-labelledby="projects-heading"] ul ul li button');
  const count = await sessionRows.count();
  if (count !== expected.sessions) {
    addResult("fixture-active-row-selection", "fail", `Expected ${expected.sessions} selectable session rows, found ${count}.`);
    return;
  }

  const target = sessionRows.nth(count - 1);
  const startedAt = Date.now();
  await target.click({ timeout: timeoutMs });
  await page.getByRole("heading", { name: "Sidebar chat 25-040", exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  const elapsedMs = Date.now() - startedAt;
  report.metrics.activeRowSelectionMs = elapsedMs;
  addResult("fixture-active-row-selection", "pass", `Selecting the last session row updated the panel in ${elapsedMs}ms.`);
  addTimingWarning("fixture-active-row-selection-budget", elapsedMs, budget.activeSelectionWarnMs, "Active row selection");
}

async function checkNoHorizontalOverflow() {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    scrollWidth: document.documentElement.scrollWidth
  }));
  report.metrics.horizontalOverflow = sizes;
  check(
    "large-sidebar-fixture-overflow",
    sizes.overflowPx <= 1,
    `Document width ${sizes.scrollWidth}px fits viewport ${sizes.clientWidth}px.`
  );
}

async function collectSidebarMetrics() {
  return page.evaluate(() => {
    const sidebar = document.querySelector('[aria-label="Projects and chats"]');
    const projects = document.querySelector('[aria-labelledby="projects-heading"]');
    const recentChats = document.querySelector('[aria-labelledby="chats-heading"]');
    const projectRows = projects?.querySelectorAll(":scope > ul > li").length ?? 0;
    const sessionRows = projects?.querySelectorAll("ul ul li").length ?? 0;
    const recentRows = recentChats?.querySelectorAll(":scope > ul > li").length ?? 0;
    return {
      clientHeight: sidebar instanceof HTMLElement ? sidebar.clientHeight : 0,
      projectRows,
      recentRows,
      renderedSidebarRowCount: projectRows + sessionRows + recentRows,
      scrollHeight: sidebar instanceof HTMLElement ? sidebar.scrollHeight : 0,
      scrollTop: sidebar instanceof HTMLElement ? sidebar.scrollTop : 0,
      sessionRows
    };
  });
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
      `Large sidebar smoke summary: ${report.summary.passed} passed, ${report.summary.warned} warnings, ${report.summary.failed} failed.`
    );
  }

  process.exitCode = report.summary.failed > 0 ? 1 : 0;
}

function printMetricSummary() {
  if (!args.verbose) {
    return;
  }
  console.log("");
  console.log("Large sidebar measurement metrics:");
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
