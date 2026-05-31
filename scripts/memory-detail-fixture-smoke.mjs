#!/usr/bin/env node

import { chromium } from "playwright";
import { preflightStaticChunks, printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 10_000;
const routePath = "/design/memory-detail-fixture";
const secretSentinels = [
  "fixture-api-key-should-not-render",
  "fixture-bearer-should-not-render",
  "fixture-token-should-not-render"
];

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
const requestedUrls = [];
let browser;
let context;
let page;

await main();

async function main() {
  printSelectedBaseUrl({ baseUrl, json: args.json, label: "Memory detail fixture smoke" });
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
    page.on("response", (response) => {
      const url = response.url();
      const status = response.status();
      if (status >= 400 && !isIgnoredNetworkResponse(url, status)) {
        networkIssues.push(`HTTP ${status}: ${safeDisplayUrl(url)}`);
      }
    });
    page.on("request", (request) => {
      requestedUrls.push(request.url());
    });

    const response = await page.goto(`${baseUrl}${routePath}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
    });
    if (!response?.ok()) {
      addResult(
        "route-load",
        "fail",
        `Memory detail fixture route at ${baseUrl}${routePath} returned HTTP ${response?.status() ?? "unknown"}.`
      );
      finalize();
      return;
    }
    await page.waitForLoadState("load", { timeout: timeoutMs });
    addResult("route-load", "pass", "Memory detail fixture route loaded.");

    await checkFixtureContent();
    await checkNoMutationControls();
    await checkNoSecretSentinels();
    await checkNoServiceCalls();
    await checkNoHorizontalOverflow("memory-detail-fixture-overflow");
    checkBrowserIssues();
  } catch (error) {
    addResult("memory-detail-fixture-run", "fail", safeErrorMessage(error));
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

async function checkFixtureContent() {
  await expectVisible(
    "fixture-page",
    page.getByLabel("Memory detail fixture page", { exact: true }),
    "Memory detail fixture page is visible."
  );
  const detail = page.getByLabel("Gateway-backed memory detail fixture", { exact: true });
  await expectVisible("fixture-region", detail, "Gateway-backed memory detail fixture is visible.");
  await expectVisible(
    "fixture-read-only-detail",
    detail.getByText("Read-only detail", { exact: true }).first(),
    "Read-only detail text is visible."
  );
  await expectVisible(
    "fixture-scoped-result",
    detail.getByText("Scoped result", { exact: true }).first(),
    "Scoped result text is visible."
  );
  await expectVisible(
    "fixture-memory-id",
    detail.getByText("fixture-memory-detail-15j", { exact: true }).first(),
    "Fixture memory id is visible."
  );
  await expectVisible(
    "fixture-evidence-not-implemented",
    detail.getByText("Evidence: not implemented by Gateway yet.", { exact: true }).first(),
    "Evidence not_implemented text is visible."
  );
  await expectVisible(
    "fixture-supersession-not-implemented",
    detail.getByText("Supersession chain: not implemented by Gateway yet.", { exact: true }).first(),
    "Supersession not_implemented text is visible."
  );
  await expectVisible(
    "fixture-audit-metadata-only",
    detail.getByText("Metadata only", { exact: true }).first(),
    "Audit metadata-only text is visible."
  );
  await expectVisible(
    "fixture-audit-metadata-disclosure",
    detail.getByText("Audit metadata", { exact: true }).first(),
    "Audit metadata disclosure is visible."
  );
  await detail.locator("details").filter({ hasText: "Audit metadata" }).locator("summary").click({
    timeout: timeoutMs
  });
  await expectVisible(
    "fixture-wrong-scope-error",
    page.getByText("Memory is not available in the current project/session scope (HTTP 404).", { exact: true }).first(),
    "Wrong-scope error fixture is visible."
  );
}

async function checkNoMutationControls() {
  const controls = page.getByRole("button").or(page.getByRole("link"));
  const text = await controls.evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.replace(/\s+/g, " ").trim() || "").join(" ")
  );
  const forbidden = /delete|supersede|pin|mark stale|edit memory|admin/i.test(text);
  check(
    "fixture-no-mutation-controls",
    !forbidden,
    forbidden
      ? `Mutation/admin control text was visible in controls: ${text}`
      : "No delete, supersede, pin, mark stale, edit, or admin controls are visible."
  );
}

async function checkNoSecretSentinels() {
  const bodyText = await page.locator("body").innerText({ timeout: timeoutMs }).catch(() => "");
  const leaked = secretSentinels.filter((sentinel) => bodyText.includes(sentinel));
  const rawBearer = /Bearer\s+(?!\[redacted\])fixture-/i.test(bodyText);
  check(
    "fixture-no-secret-sentinels",
    leaked.length === 0 && !rawBearer,
    leaked.length === 0 && !rawBearer
      ? "Secret-like fixture sentinels are redacted or absent from visible text."
      : `Secret-like fixture sentinel leaked: ${leaked.join(", ") || "raw bearer"}`
  );
  check(
    "fixture-redacted-visible",
    bodyText.includes("[redacted]") || bodyText.includes("Bearer [redacted]"),
    "Redacted metadata marker is visible."
  );
}

async function checkNoServiceCalls() {
  const serviceCalls = requestedUrls.filter((url) =>
    /\/api\/|127\.0\.0\.1:8080|127\.0\.0\.1:8642|\/ui\/memory|\/v1\//i.test(url)
  );
  check(
    "fixture-no-service-calls",
    serviceCalls.length === 0,
    serviceCalls.length === 0
      ? "Fixture route made no failing API, Gateway, Hermes, or storage calls."
      : `Unexpected service-like network activity: ${serviceCalls.join(" | ")}`
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
      `Memory detail fixture smoke summary: ${report.summary.passed} passed, ${report.summary.warned} warnings, ${report.summary.failed} failed.`
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
    (message.includes("WebSocket connection to") && message.includes("_next/webpack-hmr"))
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
