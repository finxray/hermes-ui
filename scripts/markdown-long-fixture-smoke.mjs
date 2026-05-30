#!/usr/bin/env node

import { chromium } from "playwright";
import { preflightStaticChunks, printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 10_000;
const report = {
  baseUrl,
  checks: [],
  summary: {
    failed: 0,
    passed: 0,
    warned: 0
  }
};

const browserIssues = [];
const networkIssues = [];
let browser;
let context;
let page;

await main();

async function main() {
  printSelectedBaseUrl({ baseUrl, json: args.json, label: "Long markdown fixture smoke" });
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
    const origin = new URL(baseUrl).origin;
    context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
    page = await context.newPage();
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
      const status = response.status();
      if (status >= 400 && !isIgnoredNetworkResponse(url, status)) {
        networkIssues.push(`HTTP ${status}: ${safeDisplayUrl(url)}`);
      }
    });

    const response = await page.goto(`${baseUrl}/design/markdown-long-fixture`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    });
    if (!response?.ok()) {
      addResult(
        "route-load",
        "fail",
        `Long markdown fixture route at ${baseUrl}/design/markdown-long-fixture returned HTTP ${response?.status() ?? "unknown"}. If ${baseUrl} is stale, restart that server or pass --base-url for a healthy Studio server.`
      );
      finalize();
      return;
    }
    await page.waitForLoadState("load", { timeout: timeoutMs });
    addResult("route-load", "pass", "Long markdown fixture route loaded.");

    await checkLongFixture();
    await checkScrollableCodeAndTables();
    await checkCopyButtons();
    await checkRawHtmlSafety();
    await checkPartialMarkdown();
    await checkNoHorizontalOverflow("markdown-long-fixture-overflow");
    checkBrowserIssues();
  } catch (error) {
    addResult("markdown-long-fixture-run", "fail", safeErrorMessage(error));
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

async function checkLongFixture() {
  const fixture = page.getByLabel("Long markdown fixture", { exact: true });
  await expectVisible("fixture-region", fixture, "Long markdown fixture region is visible.");
  await expectVisible(
    "fixture-heading",
    fixture.getByRole("heading", { name: "Long Markdown Fixture Response", exact: true }),
    "Long markdown heading rendered."
  );
  const assistantMessageCount = await fixture.locator("article").count();
  check("fixture-assistant-message-count", assistantMessageCount >= 2, `Rendered ${assistantMessageCount} assistant message(s).`);
  await expectVisible(
    "fixture-long-list",
    fixture.getByText("Budget item 18", { exact: false }),
    "Long unordered list rendered to the final deterministic item."
  );
  await expectVisible(
    "fixture-wide-table",
    fixture.locator("table").filter({ hasText: "Future Fast Provider Concern" }),
    "Wide GFM table rendered."
  );
  await expectVisible(
    "fixture-long-code",
    fixture.locator("figure").filter({ hasText: "veryLongProviderTraceLine" }),
    "Long TypeScript code block rendered."
  );
  await expectVisible(
    "fixture-long-link",
    fixture.getByRole("link", { name: /Brain Memory Gateway notes/i }),
    "Long fixture safe link rendered."
  );
}

async function checkScrollableCodeAndTables() {
  const codeScroller = page.locator("figure pre").first();
  await expectVisible("fixture-code-scroller-visible", codeScroller, "Code scroll container is visible.");
  const codeMetrics = await codeScroller.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      maxHeight: style.maxHeight,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth
    };
  });
  check(
    "fixture-code-scroller-bounded",
    codeMetrics.maxHeight !== "none" && ["auto", "scroll"].includes(codeMetrics.overflowY),
    `Code block max-height=${codeMetrics.maxHeight}, overflow-y=${codeMetrics.overflowY}.`
  );
  check(
    "fixture-code-scroller-horizontal",
    ["auto", "scroll"].includes(codeMetrics.overflowX),
    `Code block overflow-x=${codeMetrics.overflowX}, scrollWidth=${codeMetrics.scrollWidth}, clientWidth=${codeMetrics.clientWidth}.`
  );

  const tableParent = page.locator("table").first().locator("xpath=..");
  const tableMetrics = await tableParent.evaluate((node) => {
    const style = window.getComputedStyle(node);
    return {
      overflowX: style.overflowX,
      scrollWidth: node.scrollWidth,
      clientWidth: node.clientWidth
    };
  });
  check(
    "fixture-table-scroller",
    ["auto", "scroll"].includes(tableMetrics.overflowX),
    `Table wrapper overflow-x=${tableMetrics.overflowX}, scrollWidth=${tableMetrics.scrollWidth}, clientWidth=${tableMetrics.clientWidth}.`
  );
}

async function checkCopyButtons() {
  const codeButtons = page.getByRole("button", { name: "Copy code", exact: true });
  const codeButtonCount = await codeButtons.count();
  check("fixture-code-copy-buttons", codeButtonCount >= 4, `Found ${codeButtonCount} code copy button(s).`);
  if (codeButtonCount > 0) {
    const firstButton = codeButtons.first();
    const before = await firstButton.boundingBox();
    await firstButton.click({ timeout: timeoutMs });
    await expectVisibleOrWarn(
      "fixture-code-copy-feedback",
      page.getByRole("button", { name: "Copied", exact: true }).first(),
      "Code copy button reports copied feedback.",
      "Code copy button exists, but clipboard feedback was not available in this browser context."
    );
    const after = await page.getByRole("button", { name: "Copied", exact: true }).first().boundingBox().catch(() => null);
    if (before && after) {
      check(
        "fixture-copy-feedback-stable-width",
        Math.abs(before.width - after.width) <= 2,
        `Copy button width before=${before.width.toFixed(1)}px after=${after.width.toFixed(1)}px.`
      );
    }
  }

  const messageCopyButtons = page.getByRole("button", { name: "Copy message", exact: true });
  const messageCopyCount = await messageCopyButtons.count();
  check("fixture-message-copy-buttons", messageCopyCount >= 2, `Found ${messageCopyCount} message copy button(s).`);
}

async function checkRawHtmlSafety() {
  const rawElementCount = await page.locator("#long-raw-html-fixture").count();
  check("fixture-raw-html-element-skipped", rawElementCount === 0, "Long raw HTML fixture element was not created.");
  const rawTextVisible = await page.getByText("LONG_RAW_HTML_SHOULD_NOT_RENDER", { exact: true }).count();
  check(
    "fixture-raw-html-text-escaped",
    rawTextVisible <= 1,
    `Long raw HTML fixture text was rendered as inert text count=${rawTextVisible}, not as an HTML element.`
  );
}

async function checkPartialMarkdown() {
  const partial = page.getByLabel("Long partial markdown fixture", { exact: true });
  await expectVisible("fixture-partial-region", partial, "Long partial markdown fixture is visible.");
  await expectVisible(
    "fixture-partial-code",
    partial.getByText("partialLongFixture", { exact: false }),
    "Long partial fenced code content rendered without crashing."
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

async function expectVisibleOrWarn(name, locator, passMessage, warnMessage) {
  try {
    await locator.waitFor({ state: "visible", timeout: 2000 });
    addResult(name, "pass", passMessage);
  } catch {
    addResult(name, "warn", warnMessage);
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
      `Long markdown fixture smoke summary: ${report.summary.passed} passed, ${report.summary.warned} warnings, ${report.summary.failed} failed.`
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

function isIgnoredNetworkResponse(url, status) {
  return status === 404 && /favicon|apple-touch-icon|icon/i.test(url);
}

function isIgnoredConsoleError(message) {
  return (
    message.includes("Failed to load resource: the server responded with a status of 404") ||
    message.includes("/_next/webpack-hmr") ||
    message.includes("WebSocket connection to") && message.includes("_next/webpack-hmr")
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
