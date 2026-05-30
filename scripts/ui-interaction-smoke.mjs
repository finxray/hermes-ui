#!/usr/bin/env node

import { chromium } from "playwright";

const args = parseArgs(process.argv.slice(2));
const baseUrl = trimSlash(args.baseUrl || "http://127.0.0.1:3000");
const timeoutMs = 10_000;
const liveSendTimeoutMs = 60_000;

const report = {
  baseUrl,
  checks: [],
  mode: {
    headed: args.headed,
    requireHermes: args.requireHermes,
    sendTest: args.sendTest
  },
  summary: {
    passed: 0,
    warned: 0,
    failed: 0
  }
};

const browserIssues = [];
const networkIssues = [];
const streamResponses = [];
let browser;
let context;
let page;

await main();

async function main() {
  for (const arg of args.unknown) {
    addResult("cli-args", "fail", `Unknown argument: ${arg}`);
  }

  const serverReady = await checkServer();
  if (!serverReady) {
    finalize();
    return;
  }

  const hermesStatus = await checkHermesRequirement();
  if (args.sendTest && !canUseLiveHermes(hermesStatus)) {
    addResult(
      "hermes-send-precondition",
      "fail",
      "Live send requires /api/hermes/status to report mode=real and reachable=true."
    );
    finalize();
    return;
  }

  try {
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
      if (url.includes("/api/hermes/chat/stream")) {
        streamResponses.push(status);
      }
      if (status >= 400 && !isIgnoredNetworkResponse(url, status)) {
        networkIssues.push(`HTTP ${status}: ${safeDisplayUrl(url)}`);
      }
    });

    await loadRoot();
    await checkSidebar();
    await checkRailToggles();
    await checkSettingsPopover();
    await checkRightRailTabs();
    await checkComposer();
    await checkDisabledPlaceholders();
    await checkNoHorizontalOverflow("final-layout-overflow");
    checkBrowserIssues();
  } catch (error) {
    addResult("browser-run", "fail", safeErrorMessage(error));
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

function parseArgs(values) {
  const parsed = {
    baseUrl: "",
    headed: false,
    json: false,
    requireHermes: false,
    sendTest: false,
    unknown: []
  };

  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (arg === "--headed") {
      parsed.headed = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--require-hermes") {
      parsed.requireHermes = true;
    } else if (arg === "--send-test") {
      parsed.sendTest = true;
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

async function checkHermesRequirement() {
  if (!args.requireHermes && !args.sendTest) {
    return null;
  }

  const result = await fetchJsonWithTimeout(`${baseUrl}/api/hermes/status`);
  if (!result.ok) {
    addResult(
      "GET /api/hermes/status",
      "fail",
      `Hermes status was required but returned ${result.status || result.error}.`
    );
    return null;
  }

  const mode = result.body?.mode || "unknown";
  const reachable = result.body?.reachable === true;
  const ok = mode === "real" && reachable;
  addResult(
    "GET /api/hermes/status",
    ok ? "pass" : "fail",
    `Hermes status mode=${mode}, reachable=${String(reachable)}.`
  );
  return result.body;
}

async function checkServer() {
  const result = await fetchWithTimeout(`${baseUrl}/`);
  if (!result.ok) {
    addResult(
      "GET /",
      "fail",
      `Web UI server is not reachable at ${baseUrl} (${result.status || result.error}).`
    );
    return false;
  }
  addResult("GET /", "pass", `Web UI server returned HTTP ${result.status}.`);
  return true;
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

async function loadRoot() {
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("load", { timeout: timeoutMs });

  const title = await page.title();
  check("root-title", title === "Brain Memory Studio", `Document title is "${title}".`);

  await expectVisible(
    "root-brand-visible",
    page.getByText("Brain Memory Studio").first(),
    "Brain Memory Studio text is visible."
  );

  const oldGreenUiPresent = await page.evaluate(() =>
    /old green ui|#00ff00|#0f0\b/i.test(document.documentElement.innerHTML)
  );
  check("root-old-green-ui", !oldGreenUiPresent, "Old green UI markers are absent.");
  await checkNoHorizontalOverflow("root-horizontal-overflow");
}

async function checkSidebar() {
  const sidebar = page.locator('aside[aria-label="Projects and chats"]');
  await expectVisible("sidebar-region", sidebar, "Project/session sidebar is visible.");
  await expectVisible("sidebar-projects", page.locator("#projects-heading"), "Projects section is visible.");
  await expectVisible("sidebar-chats", page.locator("#chats-heading"), "Chats section is visible.");

  const projectButtons = page.locator(
    'section[aria-labelledby="projects-heading"] > ul > li > button:not([disabled])'
  );
  const projectCount = await projectButtons.count();
  if (projectCount > 0) {
    const target = projectButtons.nth(projectCount > 1 ? 1 : 0);
    const label = await compactText(target);
    await target.click({ timeout: timeoutMs });
    addResult("sidebar-project-click", "pass", `Project row "${label}" accepted a safe click.`);
  } else {
    addResult("sidebar-project-click", "warn", "No clickable project rows were available.");
  }

  const childRows = page.locator(
    'section[aria-labelledby="projects-heading"] ul ul button:not([disabled])'
  );
  const childCount = await childRows.count();
  if (childCount > 0) {
    const target = childRows.first();
    const label = await compactText(target);
    await target.click({ timeout: timeoutMs });
    await expectAttribute(
      "sidebar-session-click",
      target,
      "aria-current",
      "page",
      `Session row "${label}" became active.`
    );
  } else {
    addResult("sidebar-session-click", "warn", "No clickable child session rows were available.");
  }

  const chatRows = page.locator('section[aria-labelledby="chats-heading"] button:not([disabled])');
  const chatCount = await chatRows.count();
  if (chatCount > 0) {
    const target = chatRows.first();
    const label = await compactText(target);
    await target.click({ timeout: timeoutMs });
    await expectAttribute(
      "sidebar-chat-click",
      target,
      "aria-current",
      "page",
      `Recent chat row "${label}" became active.`
    );
  } else {
    addResult("sidebar-chat-click", "warn", "No clickable recent chat rows were available.");
  }
}

async function checkRailToggles() {
  const shell = page.locator("main").first();

  await page.getByRole("button", { name: "Collapse left sidebar", exact: true }).click({ timeout: timeoutMs });
  await expectAttribute(
    "left-rail-collapse",
    shell,
    "data-left-collapsed",
    "true",
    "Left sidebar collapsed state is reflected on the shell."
  );
  await checkNoHorizontalOverflow("left-rail-collapse-overflow");

  await page.getByRole("button", { name: "Open left sidebar", exact: true }).click({ timeout: timeoutMs });
  await expectAttribute(
    "left-rail-expand",
    shell,
    "data-left-collapsed",
    "false",
    "Left sidebar expanded state is reflected on the shell."
  );

  await page.getByRole("button", { name: "Collapse right context panel", exact: true }).click({ timeout: timeoutMs });
  await expectAttribute(
    "right-rail-collapse",
    shell,
    "data-right-collapsed",
    "true",
    "Right rail collapsed state is reflected on the shell."
  );
  await checkNoHorizontalOverflow("right-rail-collapse-overflow");

  await page.getByRole("button", { name: "Open right context panel", exact: true }).click({ timeout: timeoutMs });
  await expectAttribute(
    "right-rail-expand",
    shell,
    "data-right-collapsed",
    "false",
    "Right rail expanded state is reflected on the shell."
  );
}

async function checkSettingsPopover() {
  const trigger = page.getByLabel("Open settings and connection status", { exact: true });
  const popover = page.getByRole("dialog", { name: "Settings and connection status" });

  await trigger.click({ timeout: timeoutMs });
  await expectVisible("settings-popover-open", popover, "Settings popover opens.");
  await page.keyboard.press("Escape");
  await expectHidden("settings-popover-close", popover, "Settings popover closes with Escape.");
}

async function checkRightRailTabs() {
  const tabs = [
    ["context", "Show context panel", "Active context"],
    ["memory", "Show memory panel", "Memory search"],
    ["tools", "Show tools panel", "Tool activity"],
    ["files", "Show files panel", "Files and artifacts"]
  ];

  for (const [name, label, marker] of tabs) {
    const tab = page.getByRole("button", { name: label, exact: true });
    await tab.click({ timeout: timeoutMs });
    await expectAttribute(
      `right-rail-${name}-active`,
      tab,
      "aria-pressed",
      "true",
      `${label} is active.`
    );
    await expectVisible(
      `right-rail-${name}-content`,
      page.getByText(marker, { exact: true }).first(),
      `${marker} content is visible.`
    );
  }
}

async function checkComposer() {
  const textarea = page.getByLabel("Message", { exact: true });
  const sendButton = page.getByRole("button", { name: "Send message", exact: true });
  const message = args.sendTest
    ? `UI_SMOKE_SEND_${Date.now()} please reply with UI_SMOKE_SEND_OK.`
    : "hello smoke test";

  await textarea.fill(message, { timeout: timeoutMs });
  addResult("composer-message-typed", "pass", `Typed composer message marker ${message.split(" ")[0]}.`);
  await page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="Send message"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout: timeoutMs });

  const enabled = await sendButton.isEnabled();
  check("composer-send-enabled", enabled, "Typing into the composer enables Send message.");

  if (args.sendTest) {
    await runLiveSendSmoke({ message, sendButton });
  } else {
    await textarea.fill("", { timeout: timeoutMs });
    addResult("composer-send-click", "warn", "Optional send click skipped; pass --send-test to exercise Hermes.");
  }
}

async function runLiveSendSmoke({ message, sendButton }) {
  const startedAt = Date.now();
  const initialAssistantCount = await page.locator('article[data-role="assistant"]').count();

  await sendButton.click({ timeout: timeoutMs });
  addResult("composer-send-click", "pass", "Clicked Send for opt-in live Hermes smoke.");

  await page.getByText(message, { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  addResult("composer-user-message", "pass", "Unique user smoke message rendered in the transcript.");

  await page.waitForFunction(
    ({ initialCount }) => document.querySelectorAll('article[data-role="assistant"]').length > initialCount,
    { initialCount: initialAssistantCount },
    { timeout: liveSendTimeoutMs }
  );
  addResult("composer-assistant-created", "pass", "A new assistant message was created after Send.");

  const assistantResult = await waitForAssistantResponse(initialAssistantCount);
  if (!assistantResult.ok) {
    addResult("composer-assistant-response", "fail", assistantResult.message);
    return;
  }

  addResult(
    "composer-assistant-response",
    "pass",
    `Observed non-empty assistant response after ${Date.now() - startedAt}ms: ${assistantResult.preview}`
  );
  if (assistantResult.hasMarker) {
    addResult("composer-assistant-marker", "pass", "Assistant response included UI_SMOKE_SEND_OK.");
  } else {
    addResult(
      "composer-assistant-marker",
      "warn",
      "Assistant response did not include UI_SMOKE_SEND_OK; non-empty assistant content was accepted."
    );
  }

  const streamStatus = streamResponses.at(-1);
  addResult(
    "composer-stream-response",
    streamStatus && streamStatus < 400 ? "pass" : "fail",
    streamStatus
      ? `/api/hermes/chat/stream returned HTTP ${streamStatus}.`
      : "No /api/hermes/chat/stream response was observed."
  );
}

async function waitForAssistantResponse(initialAssistantCount) {
  try {
    await page.waitForFunction(
      ({ initialCount }) => {
        const messages = Array.from(document.querySelectorAll('article[data-role="assistant"]'));
        const latest = messages[initialCount];
        if (!latest) {
          return false;
        }
        const text = latest.textContent?.replace(/\s+/g, " ").trim() || "";
        return text.length > 0 && !text.includes("Waiting for Hermes...");
      },
      { initialCount: initialAssistantCount },
      { timeout: liveSendTimeoutMs }
    );

    await page.waitForFunction(
      ({ initialCount }) => {
        const messages = Array.from(document.querySelectorAll('article[data-role="assistant"]'));
        const latest = messages[initialCount];
        const status = latest?.getAttribute("data-status");
        return status === "complete" || status === "mock" || status === "error";
      },
      { initialCount: initialAssistantCount },
      { timeout: liveSendTimeoutMs }
    ).catch(() => undefined);

    const text = await page.evaluate(({ initialCount }) => {
      const messages = Array.from(document.querySelectorAll('article[data-role="assistant"]'));
      const latest = messages[initialCount];
      return latest?.textContent?.replace(/\s+/g, " ").trim() || "";
    }, { initialCount: initialAssistantCount });

    return {
      hasMarker: text.includes("UI_SMOKE_SEND_OK"),
      message: "Assistant response was observed.",
      ok: text.length > 0,
      preview: truncate(text, 160)
    };
  } catch {
    return {
      hasMarker: false,
      message: "Timed out waiting for non-empty assistant response.",
      ok: false,
      preview: ""
    };
  }
}

async function checkDisabledPlaceholders() {
  const topItems = ["Memory", "Projects", "Tools", "Help"];
  for (const item of topItems) {
    const button = page
      .locator("nav[aria-label='Workspace sections']")
      .getByRole("button", { name: `${item} section coming soon`, exact: true });
    await expectDisabled(
      `top-menu-${item.toLowerCase()}-disabled`,
      button,
      `${item} top menu placeholder is disabled.`
    );
  }

  const composerControls = [
    ["attach-context", "Attach context coming soon"],
    ["model-selector", "Selected model placeholder"],
    ["voice-input", "Voice input coming soon"]
  ];
  for (const [name, label] of composerControls) {
    await expectDisabled(
      `composer-${name}-disabled`,
      page.getByRole("button", { name: label, exact: true }),
      `${label} control is disabled.`
    );
  }

  const stopButtons = await page.getByRole("button", { name: "Stop response coming soon", exact: true }).count();
  check("composer-stop-placeholder", stopButtons === 0, "Stop placeholder is not exposed outside generation state.");
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
    addResult("browser-console-errors", "pass", "No browser console errors, page errors, or HTTP errors were captured.");
    return;
  }
  addResult("browser-console-errors", "fail", issues.slice(0, 5).join(" | "));
}

function isIgnoredConsoleError(message) {
  return (
    message.includes("Failed to load resource: the server responded with a status of 404") ||
    message.includes("/_next/webpack-hmr")
  );
}

function isIgnoredNetworkResponse(url, status) {
  return status === 404 && /favicon|apple-touch-icon|icon/i.test(url);
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

async function expectDisabled(name, locator, message) {
  try {
    const disabled = await locator.isDisabled({ timeout: timeoutMs });
    addResult(name, disabled ? "pass" : "fail", disabled ? message : `${message} It was enabled.`);
  } catch (error) {
    addResult(name, "fail", `${message} ${safeErrorMessage(error)}`);
  }
}

async function expectAttribute(name, locator, attribute, expected, message) {
  try {
    await locator.waitFor({ state: "attached", timeout: timeoutMs });
    const deadline = Date.now() + timeoutMs;
    let actual = await locator.getAttribute(attribute).catch(() => null);
    while (actual !== expected && Date.now() < deadline) {
      await page.waitForTimeout(100);
      actual = await locator.getAttribute(attribute).catch(() => null);
    }
    if (actual !== expected) {
      addResult(name, "fail", `${message} Expected ${attribute}="${expected}", got "${actual}".`);
      return;
    }
    addResult(name, "pass", message);
  } catch {
    const actual = await locator.getAttribute(attribute).catch(() => null);
    addResult(name, "fail", `${message} Expected ${attribute}="${expected}", got "${actual}".`);
  }
}

function check(name, ok, message) {
  addResult(name, ok ? "pass" : "fail", ok ? message : message);
}

async function compactText(locator) {
  const text = await locator.innerText({ timeout: timeoutMs }).catch(() => "");
  return text.replace(/\s+/g, " ").trim();
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
      `UI interaction smoke summary: ${report.summary.passed} passed, ${report.summary.warned} warnings, ${report.summary.failed} failed.`
    );
  }

  process.exitCode = report.summary.failed > 0 ? 1 : 0;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
    clearTimeout(timeout);
  }
}

async function fetchJsonWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
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
      error: error instanceof Error && error.name === "AbortError" ? "timeout" : "unreachable",
      ok: false,
      status: 0
    };
  } finally {
    clearTimeout(timeout);
  }
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function canUseLiveHermes(status) {
  return status?.mode === "real" && status.reachable === true;
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

function trimSlash(value) {
  return value.replace(/\/$/, "");
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
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
