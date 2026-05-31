#!/usr/bin/env node

import { chromium } from "playwright";
import { preflightStaticChunks, printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 10_000;
const liveSendTimeoutMs = 60_000;

const report = {
  baseUrl,
  checks: [],
  mode: {
    headed: args.headed,
    memoryLiveTest: args.memoryLiveTest,
    requireBrainMemory: args.requireBrainMemory,
    requireHermes: args.requireHermes,
    replayTest: args.replayTest,
    sendTest: args.sendTest,
    stopTest: args.stopTest
  },
  summary: {
    passed: 0,
    warned: 0,
    failed: 0
  }
};

const browserIssues = [];
const networkIssues = [];
const staticAssetIssues = [];
const streamResponses = [];
let browser;
let context;
let page;

await main();

async function main() {
  printSelectedBaseUrl({ baseUrl, json: args.json, label: "UI interaction smoke" });
  for (const arg of args.unknown) {
    addResult("cli-args", "fail", `Unknown argument: ${arg}`);
  }

  const serverReady = await checkServer();
  if (!serverReady) {
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

  const hermesStatus = await checkHermesRequirement();
  const brainMemoryStatus = await checkBrainMemoryRequirement();
  if ((args.sendTest || args.stopTest || args.replayTest || args.memoryLiveTest) && !canUseLiveHermes(hermesStatus)) {
    addResult(
      "hermes-send-precondition",
      "fail",
      "Live send requires /api/hermes/status to report mode=real and reachable=true."
    );
    finalize();
    return;
  }
  if (args.memoryLiveTest && !canUseLiveBrainMemory(brainMemoryStatus)) {
    addResult(
      "brain-memory-live-precondition",
      "fail",
      "Live memory timeline smoke requires /api/brain-memory/status to report mode=real and reachable=true."
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
      if (status >= 400 && url.includes("/_next/static/")) {
        staticAssetIssues.push(`HTTP ${status}: ${safeDisplayUrl(url)}`);
      } else if (status >= 400 && !isIgnoredNetworkResponse(url, status)) {
        networkIssues.push(`HTTP ${status}: ${safeDisplayUrl(url)}`);
      }
      if (url.includes("/api/hermes/chat/stream")) {
        streamResponses.push(status);
      }
    });

    await loadRoot();
    if (checkStaticAssetIssues()) {
      await checkSidebar();
      await checkRailToggles();
      await checkSettingsPopover();
      await checkRightRailTabs();
      await checkComposer();
      await checkDisabledPlaceholders();
      await checkNoHorizontalOverflow("final-layout-overflow");
      checkBrowserIssues();
    }
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
    memoryLiveTest: false,
    requireBrainMemory: false,
    requireHermes: false,
    replayTest: false,
    sendTest: false,
    stopTest: false,
    unknown: []
  };

  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (arg === "--headed") {
      parsed.headed = true;
    } else if (arg === "--json") {
      parsed.json = true;
    } else if (arg === "--memory-live-test") {
      parsed.memoryLiveTest = true;
      parsed.requireBrainMemory = true;
      parsed.requireHermes = true;
      parsed.sendTest = true;
    } else if (arg === "--require-brain-memory") {
      parsed.requireBrainMemory = true;
    } else if (arg === "--require-hermes") {
      parsed.requireHermes = true;
    } else if (arg === "--send-test") {
      parsed.sendTest = true;
    } else if (arg === "--replay-test") {
      parsed.replayTest = true;
      parsed.requireHermes = true;
      parsed.sendTest = true;
    } else if (arg === "--stop-test") {
      parsed.stopTest = true;
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
  if (!args.requireHermes && !args.sendTest && !args.memoryLiveTest) {
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

async function checkBrainMemoryRequirement() {
  if (!args.requireBrainMemory && !args.memoryLiveTest) {
    return null;
  }

  const result = await fetchJsonWithTimeout(`${baseUrl}/api/brain-memory/status`);
  if (!result.ok) {
    addResult(
      "GET /api/brain-memory/status",
      "fail",
      `Brain Memory status was required but returned ${result.status || result.error}.`
    );
    return null;
  }

  const mode = result.body?.mode || "unknown";
  const reachable = result.body?.reachable === true;
  const ok = mode === "real" && reachable;
  addResult(
    "GET /api/brain-memory/status",
    ok ? "pass" : "fail",
    `Brain Memory status mode=${mode}, reachable=${String(reachable)}.`
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

  await checkNewChatQuickAction();
}

async function checkNewChatQuickAction() {
  const chatAction = page.getByRole("button", { name: "Chat", exact: true });
  await chatAction.click({ timeout: timeoutMs });
  const active = await page.waitForFunction(
    () => {
      const rows = Array.from(
        document.querySelectorAll(
          'section[aria-labelledby="projects-heading"] ul ul button:not([disabled])'
        )
      );
      const active = rows.find((row) => row.getAttribute("aria-current") === "page");
      const rawText = active instanceof HTMLElement ? active.innerText : active?.textContent;
      const text = rawText?.replace(/\s+/g, " ").trim() || "";
      return text ? { label: text, matchesDefaultTitle: /^New chat(?: \d+)?\b/.test(text) } : null;
    },
    null,
    { timeout: timeoutMs }
  ).then((value) => value.jsonValue()).catch(() => null);
  const label = typeof active?.label === "string" ? active.label : "";
  check(
    "sidebar-new-chat",
    label.length > 0,
    `New chat quick action created active child row "${label}".`
  );
  check(
    "sidebar-new-chat-default-title",
    active?.matchesDefaultTitle === true,
    `New chat active row keeps default title before first message: "${label}".`
  );
  await checkNoHorizontalOverflow("sidebar-new-chat-overflow");
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
    if (name === "files") {
      await expectVisible(
        "right-rail-files-local-state",
        page.getByText("Local/mock only", { exact: true }).first(),
        "Files tab exposes local/mock artifact source state."
      );
    }
    if (name === "context") {
      await expectVisible(
        "right-rail-run-history",
        page.getByText("Run history", { exact: true }).first(),
        "Context tab exposes local Web UI run history."
      );
      await expectVisible(
        "right-rail-run-history-empty-state",
        page.getByText("No runs in this session yet", { exact: true }).first(),
        "Run history empty state is honest before a send."
      );
      await expectVisible(
        "right-rail-export-preview",
        page.getByText("Export preview", { exact: true }).first(),
        "Context tab exposes the local export preview surface."
      );
      await expectHidden(
        "right-rail-export-json-collapsed",
        page.locator("pre").filter({ hasText: '"exportVersion"' }).first(),
        "Export preview JSON stays collapsed by default."
      );
    }
    if (name === "memory") {
      await expectVisible(
        "right-rail-memory-activity",
        page.getByText("Memory activity", { exact: true }).first(),
        "Memory tab exposes the session memory activity timeline."
      );
      await expectVisible(
        "right-rail-memory-empty-state",
        page.getByText("No memory activity in this session yet.", { exact: true }).first(),
        "Memory timeline empty state is honest when no session memory events exist."
      );
    }
    if (name === "tools") {
      await expectVisible(
        "right-rail-command-activity",
        page.getByText("Recent commands", { exact: true }).first(),
        "Tools tab exposes the session command activity summary."
      );
      await expectVisible(
        "right-rail-command-empty-state",
        page.getByText("No command activity in this session yet.", { exact: true }).first(),
        "Command activity empty state is honest when no session command events exist."
      );
    }
  }
}

async function checkComposer() {
  const textarea = page.getByLabel("Message", { exact: true });
  const sendButton = page.getByRole("button", { name: "Send message", exact: true });
  const message = args.sendTest
    ? args.stopTest
      ? `UI_SMOKE_STOP_${Date.now()} write a detailed answer in many short numbered lines.`
      : args.replayTest
        ? `UI_SMOKE_REPLAY_${Date.now()} please reply with UI_SMOKE_SEND_OK.`
        : `UI_SMOKE_SEND_${Date.now()} please reply with UI_SMOKE_SEND_OK.`
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
    if (args.memoryLiveTest) {
      await runLiveMemoryTimelineSmoke({ sendButton });
    } else if (args.stopTest) {
      await runLiveStopSmoke({ message, sendButton });
    } else if (args.replayTest) {
      await runLiveReplaySmoke({ message, sendButton });
    } else {
      await runLiveSendSmoke({ message, sendButton });
    }
  } else {
    await textarea.fill("", { timeout: timeoutMs });
    addResult("composer-send-click", "warn", "Optional send click skipped; pass --send-test to exercise Hermes.");
  }
}

async function runLiveMemoryTimelineSmoke({ sendButton }) {
  const marker = `BM_UI_MEMORY_TIMELINE_15D_${timestampMarker()}_${randomMarker()}`;
  const ackMarker = "BM_UI_MEMORY_TIMELINE_STORED";
  const message = `Store this harmless UI timeline marker in Brain Memory exactly: ${marker}. Then reply ${ackMarker}.`;
  const textarea = page.getByLabel("Message", { exact: true });
  const initialAssistantCount = await page.locator('article[data-role="assistant"]').count();

  await textarea.fill(message, { timeout: timeoutMs });
  addResult("memory-live-marker-generated", "pass", `Generated marker ${marker}.`);
  await page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="Send message"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout: timeoutMs });

  await sendButton.click({ timeout: timeoutMs });
  addResult("memory-live-send-click", "pass", "Clicked Send for opt-in live Brain Memory timeline smoke.");

  await page.getByText(message, { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  addResult("memory-live-user-message", "pass", "Unique memory-live user message rendered in the transcript.");

  await page.waitForFunction(
    ({ initialCount }) => document.querySelectorAll('article[data-role="assistant"]').length > initialCount,
    { initialCount: initialAssistantCount },
    { timeout: liveSendTimeoutMs }
  );
  addResult("memory-live-assistant-created", "pass", "A new assistant message was created for memory-live smoke.");

  const assistantResult = await waitForAssistantResponse(initialAssistantCount, ackMarker);
  if (!assistantResult.ok) {
    addResult("memory-live-assistant-response", "fail", assistantResult.message);
    return;
  }
  addResult(
    "memory-live-assistant-response",
    "pass",
    `Observed non-empty assistant response: ${assistantResult.preview}`
  );
  addResult(
    "memory-live-assistant-ack",
    assistantResult.hasMarker ? "pass" : "warn",
    assistantResult.hasMarker
      ? `Assistant response included ${ackMarker}.`
      : `Assistant response did not include ${ackMarker}; BFF marker search remains authoritative.`
  );

  const streamStatus = streamResponses.at(-1);
  addResult(
    "memory-live-stream-response",
    streamStatus && streamStatus < 400 ? "pass" : "fail",
    streamStatus
      ? `/api/hermes/chat/stream returned HTTP ${streamStatus}.`
      : "No /api/hermes/chat/stream response was observed."
  );

  await checkMemoryActivityBlock();
  await checkMemoryTimelineRail();
  await checkBrainMemoryMarkerSearch(marker);
  await checkNoVisibleSecrets("memory-live-visible-secrets");
  await checkNoHorizontalOverflow("memory-live-overflow");
}

async function checkMemoryActivityBlock() {
  const memoryBlock = page.locator('section[aria-label="Agent activity"] details[data-type="memory"]').last();
  await memoryBlock.waitFor({ state: "visible", timeout: liveSendTimeoutMs });
  const summaryText = await compactText(memoryBlock.locator("summary"));
  const hasExpectedLabel = /Stored memory|Searched memory|Checked memory health|Brain Memory|mcp_brain_memory_memory_store/i.test(summaryText);
  check(
    "memory-live-activity-block",
    hasExpectedLabel,
    `Chat activity block shows Brain Memory activity: "${truncate(summaryText, 140)}".`
  );
  const collapsed = await memoryBlock.evaluate((node) => node instanceof HTMLDetailsElement && !node.open);
  check("memory-live-activity-collapsed", collapsed, "Brain Memory activity details are collapsed by default.");
}

async function checkMemoryTimelineRail() {
  const memoryTab = page.getByRole("button", { name: "Show memory panel", exact: true });
  await memoryTab.click({ timeout: timeoutMs });
  await expectAttribute(
    "memory-live-rail-memory-active",
    memoryTab,
    "aria-pressed",
    "true",
    "Memory rail tab is active after live memory send."
  );

  const timeline = page.locator('section[aria-labelledby="memory-activity-heading"]');
  await expectVisible(
    "memory-live-rail-section",
    timeline.getByText("Memory activity", { exact: true }).first(),
    "Right-rail Memory activity section is visible."
  );
  await page.waitForFunction(
    () => {
      const section = document.querySelector('section[aria-labelledby="memory-activity-heading"]');
      const text = section?.textContent || "";
      return /Store|Stored memory|Brain Memory|memory/i.test(text) &&
        section.querySelectorAll("li").length > 0;
    },
    null,
    { timeout: liveSendTimeoutMs }
  );
  addResult("memory-live-rail-item", "pass", "Right-rail Memory timeline shows a memory activity item.");
  const detail = timeline.locator("details").first();
  await detail.waitFor({ state: "attached", timeout: timeoutMs });
  const collapsed = await detail.evaluate((node) => node instanceof HTMLDetailsElement && !node.open);
  check("memory-live-rail-details-collapsed", collapsed, "Memory timeline redacted details are collapsed by default.");
}

async function checkBrainMemoryMarkerSearch(marker) {
  const context = await currentBrainMemoryContext();
  if (!context) {
    addResult("memory-live-context", "fail", "Could not derive current project/session scope from isolated browser workspace state.");
    return;
  }
  addResult(
    "memory-live-context",
    "pass",
    `Using current UI scope project=${context.project.stableKey}, session=${context.session?.stableKey || "none"}.`
  );

  let search = await postJson("/api/brain-memory/search", {
    context,
    limit: 10,
    query: marker
  });
  let effectiveContext = context;
  let markerResults = Array.isArray(search.body?.results)
    ? search.body.results.filter((result) => JSON.stringify(result).includes(marker))
    : [];
  if (markerResults.length === 0 && context.project.tenantId !== "local-dev") {
    const localDevContext = {
      ...context,
      project: {
        ...context.project,
        tenantId: "local-dev"
      }
    };
    const localDevSearch = await postJson("/api/brain-memory/search", {
      context: localDevContext,
      limit: 10,
      query: marker
    });
    const localDevMarkerResults = Array.isArray(localDevSearch.body?.results)
      ? localDevSearch.body.results.filter((result) => JSON.stringify(result).includes(marker))
      : [];
    if (localDevMarkerResults.length > 0) {
      addResult(
        "memory-live-bff-search-ui-tenant",
        "warn",
        `UI tenant ${context.project.tenantId} did not return marker; Hermes MCP stored it under local-dev with the same project/session keys.`
      );
      search = localDevSearch;
      effectiveContext = localDevContext;
      markerResults = localDevMarkerResults;
    }
  }
  const first = markerResults[0] ?? search.body?.results?.[0];
  const searchOk = search.ok && search.body?.mode === "real" && markerResults.length > 0;
  addResult(
    "memory-live-bff-search",
    searchOk ? "pass" : "fail",
    searchOk
      ? `BFF search found marker in ${markerResults.length} result(s).`
      : `BFF search did not find marker; mode=${search.body?.mode || "unknown"}, status=${search.status || search.error || "unknown"}.`
  );

  if (!searchOk || !first?.id) {
    return;
  }

  const inspect = await postJson("/api/brain-memory/memory/inspect", {
    context: effectiveContext,
    memoryId: first.id
  });
  const detail = inspect.body?.detail;
  const inspectOk = inspect.ok && inspect.body?.mode === "real" && detail;
  addResult(
    "memory-live-bff-inspect",
    inspectOk ? "pass" : "fail",
    inspectOk
      ? `BFF inspect returned detail for ${first.id}.`
      : `BFF inspect did not return detail; mode=${inspect.body?.mode || "unknown"}, status=${inspect.status || inspect.error || "unknown"}.`
  );
  if (inspectOk) {
    const scopeText = `project=${detail.projectKey || "unknown"}, session=${detail.sessionKey || "none"}, scope=${detail.scopeStatus || "unknown"}`;
    addResult("memory-live-inspect-scope", "pass", `Inspect scope: ${scopeText}.`);
  }

  const differentProjectContext = {
    ...effectiveContext,
    project: {
      ...effectiveContext.project,
      id: `${effectiveContext.project.id}-different`,
      stableKey: `${effectiveContext.project.stableKey}:different`
    }
  };
  const differentProjectSearch = await postJson("/api/brain-memory/search", {
    context: differentProjectContext,
    limit: 10,
    query: marker
  });
  const differentProjectResults = Array.isArray(differentProjectSearch.body?.results)
    ? differentProjectSearch.body.results
    : [];
  const scopedOut = differentProjectSearch.ok &&
    differentProjectSearch.body?.mode === "real" &&
    differentProjectResults.length === 0;
  addResult(
    "memory-live-different-project-scope",
    scopedOut ? "pass" : "fail",
    scopedOut
      ? "Different project search returned 0 results for marker."
      : `Different project search returned ${differentProjectResults.length} result(s).`
  );
}

async function runLiveStopSmoke({ message, sendButton }) {
  const initialAssistantCount = await page.locator('article[data-role="assistant"]').count();

  await sendButton.click({ timeout: timeoutMs });
  addResult("composer-send-click", "pass", "Clicked Send for opt-in live stop smoke.");

  await page.getByText(message, { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  addResult("composer-user-message", "pass", "Unique user stop-smoke message rendered in the transcript.");

  const stopButton = page.getByRole("button", { name: "Stop generation", exact: true });
  await stopButton.waitFor({ state: "visible", timeout: timeoutMs });
  const stopEnabled = await stopButton.isEnabled();
  check("composer-stop-visible", stopEnabled, "Stop generation button is visible and enabled during streaming.");
  await stopButton.click({ timeout: timeoutMs });
  addResult("composer-stop-click", "pass", "Clicked Stop generation.");

  await page.getByRole("button", { name: "Send message", exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  addResult("composer-stop-returned-send", "pass", "Composer returned to Send message state after stop.");

  await page.getByText("Stopped", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(
    () => document.body.innerText.includes("Generation stopped by user"),
    null,
    { timeout: timeoutMs }
  );
  addResult("composer-stopped-activity", "pass", "Stopped/cancelled activity appeared after abort.");

  const latestAssistantStatus = await page.evaluate(({ initialCount }) => {
    const messages = Array.from(document.querySelectorAll('article[data-role="assistant"]'));
    return messages[initialCount]?.getAttribute("data-status") || "";
  }, { initialCount: initialAssistantCount });
  check(
    "composer-stop-not-red-error",
    latestAssistantStatus !== "error",
    `Stopped assistant message status is "${latestAssistantStatus || "unknown"}".`
  );

  const textarea = page.getByLabel("Message", { exact: true });
  await textarea.fill(`UI_SMOKE_AFTER_STOP_${Date.now()} ready`, { timeout: timeoutMs });
  const sendAgain = page.getByRole("button", { name: "Send message", exact: true });
  const sendAgainEnabled = await sendAgain.isEnabled();
  check("composer-send-after-stop", sendAgainEnabled, "User can type another message and Send is enabled after stop.");
  await checkRunHistoryStatus("stopped", "composer-run-history-stopped");
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
  await checkRunHistoryStatus("completed", "composer-run-history-completed");
}

async function runLiveReplaySmoke({ message, sendButton }) {
  const initialAssistantCount = await page.locator('article[data-role="assistant"]').count();

  await sendButton.click({ timeout: timeoutMs });
  addResult("composer-send-click", "pass", "Clicked Send for opt-in reload replay smoke.");

  await page.getByText(message, { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  addResult("composer-user-message", "pass", "Unique replay-smoke message rendered in the transcript.");

  await page.waitForFunction(
    ({ initialCount }) => document.querySelectorAll('article[data-role="assistant"]').length > initialCount,
    { initialCount: initialAssistantCount },
    { timeout: liveSendTimeoutMs }
  );
  addResult("composer-assistant-created", "pass", "A new assistant message was created for replay smoke.");

  const assistantResult = await waitForAssistantResponse(initialAssistantCount);
  if (!assistantResult.ok) {
    addResult("composer-assistant-response", "fail", assistantResult.message);
    return;
  }
  addResult(
    "composer-assistant-response",
    "pass",
    `Observed replay-smoke assistant response: ${assistantResult.preview}`
  );

  await checkRunHistoryStatus("completed", "composer-run-history-replay-before-reload");
  await checkNoHorizontalOverflow("replay-before-reload-overflow");

  await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("load", { timeout: timeoutMs });
  addResult("replay-page-reload", "pass", "Reloaded the app in the same isolated browser context.");

  await page.getByText(message, { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  addResult("replay-selected-session-retained", "pass", "Selected session still shows the unique user message after reload.");

  const runHistory = await checkRunHistoryStatus("completed", "composer-run-history-replay-after-reload");
  await expectHidden(
    "replay-not-empty-after-reload",
    runHistory.getByText("No persisted activity replay for this run", { exact: true }).first(),
    "Persisted replay is not empty after reload."
  );
  await expectVisible(
    "replay-export-preview-after-reload",
    page.getByText("Local preview only", { exact: true }).first(),
    "Local export preview remains available after reload."
  );
  await expectVisible(
    "replay-export-counts-after-reload",
    page.getByText("replay events", { exact: true }).first(),
    "Export preview includes replay event count after reload."
  );
  await checkNoVisibleSecrets("replay-visible-secrets");
  await checkNoHorizontalOverflow("replay-after-reload-overflow");
}

async function checkRunHistoryStatus(expectedStatus, name) {
  const contextTab = page.getByRole("button", { name: "Show context panel", exact: true });
  await contextTab.click({ timeout: timeoutMs });
  const runHistory = page.locator('section[aria-labelledby="run-history-heading"]');
  await expectVisible(
    `${name}-section`,
    runHistory.getByText("Run history", { exact: true }).first(),
    "Run history section is visible after live composer action."
  );
  await expectVisible(
    name,
    runHistory.getByText(expectedStatus, { exact: true }).first(),
    `Run history includes a ${expectedStatus} Web UI run.`
  );
  await expectVisible(
    `${name}-persisted-replay`,
    runHistory.getByText("Persisted replay", { exact: true }).first(),
    "Selected run exposes persisted replay activity."
  );
  if (expectedStatus === "stopped") {
    await expectVisible(
      `${name}-persisted-stopped-event`,
      runHistory.getByText("Stopped", { exact: true }).first(),
      "Stopped run replay includes the persisted stopped activity."
    );
  }
  return runHistory;
}

async function waitForAssistantResponse(initialAssistantCount, expectedMarker = "UI_SMOKE_SEND_OK") {
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
      hasMarker: text.includes(expectedMarker),
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
    ["model-selector", "Provider and model selector disabled"],
    ["voice-input", "Voice input coming soon"]
  ];
  for (const [name, label] of composerControls) {
    await expectDisabled(
      `composer-${name}-disabled`,
      page.getByRole("button", { name: label, exact: true }),
      `${label} control is disabled.`
    );
  }

  const stopButtons = await page.getByRole("button", { name: "Stop generation", exact: true }).count();
  check("composer-stop-idle-hidden", stopButtons === 0, "Stop generation is not exposed outside generation state.");
  const modelStateText = await page.evaluate(() => {
    const button = document.querySelector('button[aria-label="Provider and model selector disabled"]');
    return button?.textContent?.replace(/\s+/g, " ").trim() || "";
  });
  check(
    "composer-model-server-configured",
    /Server-configured|unavailable|unknown/i.test(modelStateText),
    `Composer shows non-client-selectable provider/model state: "${modelStateText || "missing"}".`
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

async function checkNoVisibleSecrets(name) {
  const bodyText = await page.locator("body").innerText({ timeout: timeoutMs }).catch(() => "");
  const match = bodyText.match(
    /(Bearer\s+(?!\[redacted\]|token\b|strings?\b|value\b)(?=[A-Za-z0-9._~+/=-]{12,})[A-Za-z0-9._~+/=-]+|(?:api[_-]?key|apikey|token|password)\s*[:=]\s*(?!\[redacted\]|set\b|not set\b|true\b|false\b)[^,\s]+)/i
  );
  addResult(
    name,
    match ? "fail" : "pass",
    match
      ? `Credential-like visible text matched ${truncate(match[0].replace(/(Bearer\s+).+/i, "$1[redacted]"), 80)}.`
      : "No credential-like values are visible in replay/export smoke output."
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

function checkStaticAssetIssues() {
  if (staticAssetIssues.length === 0) {
    addResult("static-assets-loaded", "pass", "Next.js static chunks loaded without HTTP errors.");
    return true;
  }
  addResult(
    "static-assets-loaded",
    "fail",
    `Next.js static chunks failed to load; app may be server-rendered but not hydrated. ${staticAssetIssues
      .slice(0, 3)
      .join(" | ")}`
  );
  return false;
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

async function postJson(path, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
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

function canUseLiveBrainMemory(status) {
  return status?.mode === "real" && status.reachable === true;
}

async function currentBrainMemoryContext() {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("hermes-ui.workspace.v1");
    if (!raw) {
      return null;
    }
    const state = JSON.parse(raw);
    const project = state.projects?.find((item) => item.id === state.activeProjectId);
    const session = state.sessions?.find((item) => item.id === state.activeSessionId);
    if (!project || !session) {
      return null;
    }
    return {
      project: {
        contextPolicy: project.memoryScope?.contextPolicy || "balanced",
        id: project.id,
        retrievalProfile: project.memoryScope?.retrievalProfile || "balanced",
        stableKey: project.memoryScope?.stableProjectKey || project.memoryScopeKey || project.id,
        tenantId: project.memoryScope?.tenantId || "tenant-local",
        title: project.name
      },
      session: {
        id: session.id,
        includeProjectContext: session.memoryScope?.includeProjectContext !== false,
        includeSessionContext: session.memoryScope?.includeSessionContext !== false,
        stableKey: session.memoryScope?.stableSessionKey || session.id,
        title: session.title
      },
      ui: {
        source: "hermes-ui",
        workspaceVersion: 1
      }
    };
  });
}

function timestampMarker() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
}

function randomMarker() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
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
