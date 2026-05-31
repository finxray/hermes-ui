#!/usr/bin/env node

import { chromium } from "playwright";
import { preflightStaticChunks, printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 15_000;
const runStartedAt = Date.now();
const expected = {
  activityEvents: 500,
  artifacts: 500,
  commandActivityGroups: 100,
  recentCommands: 8,
  toolEvents: 500
};
const budget = {
  routeLoadWarnMs: 5_000,
  scrollActionWarnMs: 100,
  tabSwitchWarnMs: 500
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
  printSelectedBaseUrl({ baseUrl, json: args.json, label: "Large artifacts/tools smoke" });
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
    const response = await page.goto(`${baseUrl}/design/artifacts-tools-large-fixture`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    });
    if (!response?.ok()) {
      addResult(
        "route-load",
        "fail",
        `Large artifacts/tools fixture route returned HTTP ${response?.status() ?? "unknown"}. If ${baseUrl} is stale, restart that server or pass --base-url for a healthy Studio server.`
      );
      finalize();
      return;
    }
    await page.waitForLoadState("load", { timeout: timeoutMs });
    const routeLoadMs = Date.now() - startedAt;
    report.metrics.routeLoadMs = routeLoadMs;
    report.metrics.navigationTiming = await collectNavigationTiming();
    addResult("route-load", "pass", `Large artifacts/tools fixture route loaded in ${routeLoadMs}ms.`);
    addTimingWarning("route-load-budget", routeLoadMs, budget.routeLoadWarnMs, "Route load");

    await checkFixtureChrome();
    await checkActivityDetails();
    await checkToolsTab();
    await checkFilesTab();
    await checkRightRailScrollResponsiveness();
    await checkNoHorizontalOverflow();
    checkNoServiceCalls();
    checkBrowserIssues();
  } catch (error) {
    addResult("large-artifacts-tools-smoke-run", "fail", safeErrorMessage(error));
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
    page.getByRole("heading", { name: "Large artifacts and tools fixture", exact: true }),
    "Fixture title is visible."
  );
  await expectVisible(
    "fixture-scale-artifacts-visible",
    page.getByText("500 artifacts", { exact: true }),
    "Artifact-count metric is visible."
  );
  await expectVisible(
    "fixture-scale-tools-visible",
    page.getByText("500 legacy tool rows", { exact: true }),
    "Legacy tool-count metric is visible."
  );
  await expectVisible(
    "fixture-context-rail-visible",
    page.getByLabel("Context, memory, tools, and files", { exact: true }),
    "Existing ContextRail component is visible."
  );
  await expectVisible(
    "fixture-activity-block-visible",
    page.getByLabel("Agent activity", { exact: true }),
    "Existing AgentActivityBlock component is visible."
  );
}

async function checkActivityDetails() {
  const metrics = await page.evaluate(() => {
    const activity = document.querySelector('[aria-label="Agent activity"]');
    const details = activity?.querySelectorAll("details") ?? [];
    const commands = activity?.querySelectorAll('details[data-type="command"]') ?? [];
    return {
      activityCommandDetailsCount: commands.length,
      activityDetailsCount: details.length,
      activityOpenDetailsCount: activity?.querySelectorAll("details[open]").length ?? 0,
      totalDetailsCount: document.querySelectorAll("details").length,
      totalOpenDetailsCount: document.querySelectorAll("details[open]").length
    };
  });
  report.metrics.renderedDetailsCount = metrics.totalDetailsCount;
  report.metrics.openDetailsCount = metrics.totalOpenDetailsCount;
  report.metrics.activityDetailsCount = metrics.activityDetailsCount;
  report.metrics.activityCommandDetailsCount = metrics.activityCommandDetailsCount;
  check(
    "fixture-activity-details-count",
    metrics.activityDetailsCount === expected.activityEvents,
    `Rendered ${metrics.activityDetailsCount} collapsed activity detail group(s).`
  );
  check(
    "fixture-command-activity-details-count",
    metrics.activityCommandDetailsCount === expected.commandActivityGroups,
    `Rendered ${metrics.activityCommandDetailsCount} command activity detail group(s).`
  );
  check(
    "fixture-details-collapsed-by-default",
    metrics.totalOpenDetailsCount === 0,
    `Open detail regions by default: ${metrics.totalOpenDetailsCount}.`
  );
}

async function checkToolsTab() {
  const startedAt = Date.now();
  await page.getByRole("button", { name: "Show tools panel", exact: true }).click({ timeout: timeoutMs });
  await page.getByText("Tool activity", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  const elapsedMs = Date.now() - startedAt;
  report.metrics.toolsTabSwitchMs = elapsedMs;
  addResult("fixture-tools-tab", "pass", `Tools tab switched in ${elapsedMs}ms.`);
  addTimingWarning("fixture-tools-tab-budget", elapsedMs, budget.tabSwitchWarnMs, "Tools tab switch");

  const metrics = await page.evaluate(() => {
    const commandSection = document.querySelector('[aria-labelledby="command-activity-heading"]');
    const toolSection = document.querySelector('[aria-labelledby="tool-activity-heading"]');
    return {
      renderedCommandCount: commandSection?.querySelectorAll("li").length ?? 0,
      renderedToolEventCount: toolSection?.querySelectorAll("li").length ?? 0
    };
  });
  report.metrics.renderedCommandCount = metrics.renderedCommandCount;
  report.metrics.renderedToolEventCount = metrics.renderedToolEventCount;
  check(
    "fixture-rendered-command-count",
    metrics.renderedCommandCount === expected.recentCommands,
    `Rendered ${metrics.renderedCommandCount} recent command row(s).`
  );
  check(
    "fixture-rendered-tool-event-count",
    metrics.renderedToolEventCount === expected.toolEvents,
    `Rendered ${metrics.renderedToolEventCount} legacy tool event row(s).`
  );
}

async function checkFilesTab() {
  const startedAt = Date.now();
  await page.getByRole("button", { name: "Show files panel", exact: true }).click({ timeout: timeoutMs });
  await page.getByText("Files and artifacts", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  const elapsedMs = Date.now() - startedAt;
  report.metrics.filesTabSwitchMs = elapsedMs;
  addResult("fixture-files-tab", "pass", `Files tab switched in ${elapsedMs}ms.`);
  addTimingWarning("fixture-files-tab-budget", elapsedMs, budget.tabSwitchWarnMs, "Files tab switch");

  const artifactCount = await page.evaluate(() => {
    const filesSection = document.querySelector('[aria-labelledby="files-heading"]');
    return filesSection?.querySelectorAll("li").length ?? 0;
  });
  report.metrics.renderedArtifactCount = artifactCount;
  check(
    "fixture-rendered-artifact-count",
    artifactCount === expected.artifacts,
    `Rendered ${artifactCount} artifact row(s).`
  );
}

async function checkRightRailScrollResponsiveness() {
  const result = await page.evaluate(async () => {
    const rail = document.querySelector('[aria-label="Context, memory, tools, and files"]');
    const scroll = rail?.children.item(1);
    if (!(scroll instanceof HTMLElement)) {
      return { ok: false, reason: "missing right rail scroll region" };
    }

    const before = {
      clientHeight: scroll.clientHeight,
      scrollHeight: scroll.scrollHeight,
      scrollTop: scroll.scrollTop
    };
    const downStartedAt = performance.now();
    scroll.scrollTop = scroll.scrollHeight;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const downMs = performance.now() - downStartedAt;
    const downTop = scroll.scrollTop;

    const upStartedAt = performance.now();
    scroll.scrollTop = 0;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const upMs = performance.now() - upStartedAt;

    return {
      before,
      downMs,
      downTop,
      ok: downTop > 0 && scroll.scrollTop === 0,
      upMs
    };
  });
  report.metrics.rightRailScroll = result;
  const maxScrollMs = Math.max(result.downMs ?? 0, result.upMs ?? 0);
  check(
    "fixture-right-rail-scroll-responsive",
    result.ok === true,
    result.ok
      ? `Right rail scroll down/up responded in ${Math.round(result.downMs)}ms / ${Math.round(result.upMs)}ms.`
      : `Right rail scroll check failed: ${result.reason ?? "unknown"}.`
  );
  addTimingWarning("fixture-right-rail-scroll-budget", maxScrollMs, budget.scrollActionWarnMs, "Right rail scroll action");
}

async function checkNoHorizontalOverflow() {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    overflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
    scrollWidth: document.documentElement.scrollWidth
  }));
  report.metrics.horizontalOverflow = sizes;
  check(
    "artifacts-tools-large-fixture-overflow",
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
      `Large artifacts/tools smoke summary: ${report.summary.passed} passed, ${report.summary.warned} warnings, ${report.summary.failed} failed.`
    );
  }

  process.exitCode = report.summary.failed > 0 ? 1 : 0;
}

function printMetricSummary() {
  if (!args.verbose) {
    return;
  }
  console.log("");
  console.log("Large artifacts/tools measurement metrics:");
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
