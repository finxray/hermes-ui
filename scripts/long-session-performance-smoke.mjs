#!/usr/bin/env node

import { chromium } from "playwright";
import { preflightStaticChunks, printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 15_000;
const report = {
  baseUrl,
  checks: [],
  metrics: {},
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
    const loadMs = Date.now() - startedAt;
    report.metrics.loadMs = loadMs;
    addResult("route-load", "pass", `Long-session fixture route loaded in ${loadMs}ms.`);

    await checkFixtureChrome();
    await checkTranscriptScale();
    await checkRailAndDetails();
    await checkSidebarScale();
    await checkScrollResponsiveness();
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
  report.metrics.renderedMessages = messageCount;
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
  report.metrics.detailsCount = detailsCount;
  report.metrics.openDetailsCount = openDetailsCount;
  check("fixture-details-present", detailsCount >= 2, `Found ${detailsCount} collapsible detail region(s).`);
  check(
    "fixture-details-collapsed-by-default",
    openDetailsCount === 0,
    `Open detail regions by default: ${openDetailsCount}.`
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
}

async function checkSidebarScale() {
  const projectRows = await page.locator('section[aria-labelledby="projects-heading"] > ul > li').count();
  const sessionRows = await page.locator('section[aria-labelledby="projects-heading"] ul ul li').count();
  report.metrics.sidebarProjects = projectRows;
  report.metrics.sidebarSessions = sessionRows;
  check("fixture-sidebar-project-count", projectRows === 5, `Rendered ${projectRows} project group(s).`);
  check("fixture-sidebar-session-count", sessionRows === 100, `Rendered ${sessionRows} sidebar session row(s).`);
}

async function checkScrollResponsiveness() {
  const result = await page.evaluate(async () => {
    const transcript = document.querySelector('[aria-label="Chat transcript"]');
    if (!(transcript instanceof HTMLElement)) {
      return { ok: false, reason: "missing transcript" };
    }
    const startedAt = performance.now();
    transcript.scrollTop = transcript.scrollHeight;
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const elapsedMs = performance.now() - startedAt;
    return {
      elapsedMs,
      ok: transcript.scrollTop > 0
    };
  });
  report.metrics.scrollFrameMs = result.elapsedMs;
  check(
    "fixture-scroll-responsive",
    result.ok && result.elapsedMs < 100,
    result.ok
      ? `Transcript scroll responded in ${Math.round(result.elapsedMs)}ms.`
      : `Transcript scroll check failed: ${result.reason ?? "unknown"}.`
  );
}

async function checkNoHorizontalOverflow(name) {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  check(
    name,
    sizes.scrollWidth <= sizes.clientWidth + 1,
    `Document width ${sizes.scrollWidth}px fits viewport ${sizes.clientWidth}px.`
  );
}

function checkNoServiceCalls() {
  if (serviceCalls.length === 0) {
    addResult("fixture-no-service-calls", "pass", "Fixture route made no BFF, Hermes, Brain Memory, or direct storage service calls.");
    return;
  }
  addResult("fixture-no-service-calls", "fail", serviceCalls.slice(0, 5).join(" | "));
}

function checkBrowserIssues() {
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
      `Long-session performance smoke summary: ${report.summary.passed} passed, ${report.summary.warned} warnings, ${report.summary.failed} failed.`
    );
  }

  process.exitCode = report.summary.failed > 0 ? 1 : 0;
}

function parseArgs(values) {
  const parsed = {
    baseUrl: "",
    headed: false,
    json: false,
    unknown: []
  };

  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (arg === "--base-url") {
      parsed.baseUrl = values[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      parsed.baseUrl = arg.slice("--base-url=".length);
    } else if (arg === "--headed") {
      parsed.headed = true;
    } else if (arg === "--json") {
      parsed.json = true;
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
