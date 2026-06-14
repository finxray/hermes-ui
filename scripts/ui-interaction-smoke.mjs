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
    memoryScopeTest: args.memoryScopeTest,
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
  if ((args.sendTest || args.stopTest || args.replayTest || args.memoryLiveTest || args.memoryScopeTest) && !canUseLiveHermes(hermesStatus)) {
    addResult(
      "hermes-send-precondition",
      "fail",
      "Live send requires /api/hermes/status to report mode=real and reachable=true."
    );
    finalize();
    return;
  }
  if ((args.memoryLiveTest || args.memoryScopeTest) && !canUseLiveBrainMemory(brainMemoryStatus)) {
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
      await checkSplitSideChat();
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
    memoryScopeTest: false,
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
    } else if (arg === "--memory-scope-test") {
      parsed.memoryScopeTest = true;
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

  await expectAttribute(
    "right-rail-default-collapsed",
    shell,
    "data-right-collapsed",
    "true",
    "Right rail starts collapsed by default."
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
        "right-rail-context-contract",
        page.getByText("Active context contract", { exact: true }).first(),
        "Context tab exposes the active context contract."
      );
      await checkTenantScopeDiagnostics();
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

async function checkSplitSideChat() {
  const shell = page.locator("main").first();
  const rightPanel = page.locator("[data-shell-rail='right']").first();
  const splitButton = page.getByRole("button", {
    name: "Split chat and context panels evenly",
    exact: true
  });

  await splitButton.click({ timeout: timeoutMs });
  await expectAttribute(
    "split-side-chat-open",
    shell,
    "data-right-collapsed",
    "false",
    "Title split control opens the right pane."
  );

  const sideTab = page.locator("[data-side-chat-tab='true']").first();
  await expectAttribute(
    "split-side-chat-active-tab",
    sideTab,
    "aria-selected",
    "true",
    "Split control activates the side-chat tab."
  );
  const sideTabText = await compactText(sideTab);
  check(
    "split-side-chat-title-in-tab",
    sideTabText.length > 0 && sideTabText !== "Side chat",
    `Side chat tab shows the active chat title inline: "${sideTabText}".`
  );
  await expectVisible(
    "split-side-chat-composer",
    rightPanel.getByLabel("Message", { exact: true }),
    "Side chat owns a message composer after splitting."
  );
  await expectHidden(
    "split-side-chat-no-start-hero",
    rightPanel.getByText("What should Hermes work on?", { exact: true }),
    "Fresh split side chat does not show the large welcome prompt."
  );
  await expectHidden(
    "split-side-chat-no-start-banner",
    rightPanel.getByText("Hermes is reached through the BFF when available; offline turns stay local.", { exact: true }),
    "Fresh split side chat does not show the start-state connection banner."
  );

  const closeSplitButton = page.getByRole("button", {
    name: "Return to single chat view",
    exact: true
  });
  await expectAttribute(
    "split-side-chat-toggle-button-active",
    closeSplitButton,
    "aria-pressed",
    "true",
    "Title split control exposes an active pressed state while split chat is open."
  );
  await closeSplitButton.click({ timeout: timeoutMs });
  await expectAttribute(
    "split-side-chat-toggle-close",
    shell,
    "data-right-collapsed",
    "true",
    "Clicking the active title split control collapses back to a single chat."
  );
  await splitButton.click({ timeout: timeoutMs });
  await expectAttribute(
    "split-side-chat-toggle-reopen",
    shell,
    "data-right-collapsed",
    "false",
    "Clicking the title split control again reopens split chat."
  );
  await page.waitForTimeout(520);

  const composerAlignment = await page.evaluate(() => {
    const textareas = Array.from(document.querySelectorAll("textarea[aria-label='Message']"))
      .filter((textarea) => textarea instanceof HTMLElement && textarea.offsetParent !== null);
    const boxes = textareas
      .map((textarea) => textarea.closest("[class*='box']"))
      .filter((box) => box instanceof HTMLElement);
    const bottoms = boxes.map((box) => box.getBoundingClientRect().bottom);
    const viewportBottom = window.innerHeight;
    return {
      bottoms,
      offsets: bottoms.map((bottom) => Math.round((viewportBottom - bottom) * 10) / 10)
    };
  });
  check(
    "split-composer-bottom-alignment",
    composerAlignment.bottoms.length >= 2 &&
      Math.abs(composerAlignment.bottoms[0] - composerAlignment.bottoms[1]) <= 2 &&
      composerAlignment.offsets.every((offset) => offset >= 8 && offset <= 12),
    `Main/right composer bottoms align with 10px viewport offset: offsets=${composerAlignment.offsets.join(", ") || "missing"}.`
  );

  const splitColumns = await page.evaluate(() => {
    const mainWindow = document.querySelector("[data-shell-main-window='true']");
    if (!mainWindow) {
      return null;
    }
    const columns = window.getComputedStyle(mainWindow).gridTemplateColumns
      .split(" ")
      .map((value) => Number.parseFloat(value))
      .filter((value) => Number.isFinite(value));
    if (columns.length < 2) {
      return null;
    }
    return {
      chat: columns[0],
      right: columns[1]
    };
  });
  check(
    "split-side-chat-even-width",
    Boolean(splitColumns) && Math.abs(splitColumns.chat - splitColumns.right) <= 4,
    `Split control sets near-even columns: chat=${splitColumns?.chat ?? "missing"}, right=${splitColumns?.right ?? "missing"}.`
  );

  await page.locator("[data-side-chat-add='true']").click({ timeout: timeoutMs });
  await expectVisible(
    "split-side-chat-menu",
    page.locator("#studio-side-chat-menu"),
    "Side chat tab opens the matching session menu."
  );
  await expectVisible(
    "split-side-chat-menu-create",
    page.getByRole("menuitem", { name: "New side chat", exact: true }),
    "Side chat menu exposes a new-chat action."
  );

  const menuItems = page.locator("#studio-side-chat-menu [role='menuitem']");
  const menuItemCount = await menuItems.count();
  check(
    "split-side-chat-menu-existing",
    menuItemCount > 1,
    `Side chat menu lists existing project chats; menu item count=${menuItemCount}.`
  );
  if (menuItemCount > 1) {
    await menuItems.nth(menuItemCount - 1).click({ timeout: timeoutMs });
    await expectHidden(
      "split-side-chat-menu-select-close",
      page.locator("#studio-side-chat-menu"),
      "Selecting an existing chat closes the side-chat menu."
    );
  }
  await expectAttribute(
    "split-side-chat-selected-remains-active",
    sideTab,
    "aria-selected",
    "true",
    "Selected chat remains in the active side-chat tab."
  );
  const selectedSideTabText = await compactText(sideTab);
  check(
    "split-side-chat-selected-title-in-tab",
    selectedSideTabText.length > 0 && selectedSideTabText !== "Side chat",
    `Selected existing chat title stays inside the side-chat tab: "${selectedSideTabText}".`
  );

  await sideTab.click({ timeout: timeoutMs });
  await expectAttribute(
    "split-side-chat-close",
    page.getByRole("tab", { name: "Console", exact: true }),
    "aria-selected",
    "true",
    "Clicking the active X side-chat tab closes it back to Console."
  );
  await splitButton.click({ timeout: timeoutMs });
  await page.waitForTimeout(520);

  const consoleTab = page.getByRole("tab", { name: "Console", exact: true });
  await consoleTab.click({ timeout: timeoutMs });
  await expectAttribute(
    "split-console-tab-active",
    consoleTab,
    "aria-selected",
    "true",
    "Console tab can replace the side-chat tab in the right pane."
  );
  await expectVisible(
    "split-console-content",
    page.getByText("Context console", { exact: true }).first(),
    "Console content is visible after switching tabs."
  );

  await page.getByRole("button", { name: "Collapse right context panel", exact: true }).click({ timeout: timeoutMs });
  await expectAttribute(
    "split-console-collapse",
    shell,
    "data-right-collapsed",
    "true",
    "Top-right toggle still collapses the right pane after split use."
  );
  await page.getByRole("button", { name: "Open right context panel", exact: true }).click({ timeout: timeoutMs });
  await expectAttribute(
    "split-console-reopen",
    shell,
    "data-right-collapsed",
    "false",
    "Top-right toggle reopens the right pane after split use."
  );
  await expectAttribute(
    "split-console-reopen-default",
    consoleTab,
    "aria-selected",
    "true",
    "Top-right context toggle reopens directly to the console tab."
  );
}

async function checkComposer() {
  if (args.memoryScopeTest) {
    await runLiveMemoryScopeIsolationSmoke();
    return;
  }

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
  const marker = `BM_UI_MEMORY_TIMELINE_15E_${timestampMarker()}_${randomMarker()}`;
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
  await checkTenantScopeDiagnostics();
  await checkBrainMemoryMarkerSearch(marker);
  await checkNoVisibleSecrets("memory-live-visible-secrets");
  await checkNoHorizontalOverflow("memory-live-overflow");
}

async function runLiveMemoryScopeIsolationSmoke() {
  const workspace = await seedMemoryScopeIsolationWorkspace();
  addResult(
    "memory-scope-workspace-seeded",
    "pass",
    `Seeded isolated workspace tenant=${workspace.tenantId}, A1=${workspace.sessionA1StableKey}, A2=${workspace.sessionA2StableKey}, B1=${workspace.sessionB1StableKey}.`
  );

  await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("load", { timeout: timeoutMs });
  await expectVisible(
    "memory-scope-active-session",
    page.getByText("Scope isolation A1", { exact: true }).first(),
    "Session A1 is active in the isolated browser workspace."
  );

  const contexts = await scopeIsolationContexts();
  if (!contexts) {
    addResult("memory-scope-contexts", "fail", "Could not derive A1/A2/B1 contexts from isolated browser workspace state.");
    return;
  }
  check(
    "memory-scope-tenant",
    contexts.a1.project.tenantId === "local-dev" &&
      contexts.a2.project.tenantId === "local-dev" &&
      contexts.b1.project.tenantId === "local-dev",
    "All scope-isolation contexts use tenant local-dev."
  );
  check(
    "memory-scope-stable-keys",
    contexts.a1.project.stableKey === workspace.projectAStableKey &&
      contexts.a1.session?.stableKey === workspace.sessionA1StableKey &&
      contexts.a2.session?.stableKey === workspace.sessionA2StableKey &&
      contexts.b1.project.stableKey === workspace.projectBStableKey &&
      contexts.b1.session?.stableKey === workspace.sessionB1StableKey,
    "Project/session stable keys remained deterministic after hydration."
  );

  const marker = `BM_SCOPE_A1_${timestampMarker()}_${randomMarker()}`;
  const ackMarker = "BM_SCOPE_A1_STORED";
  const message =
    `Store this harmless Brain Memory scope-isolation marker exactly in the current Studio session memory: ${marker}. ` +
    `Use the active project/session scope from this request. Then reply ${ackMarker}.`;
  const textarea = page.getByLabel("Message", { exact: true });
  const sendButton = page.getByRole("button", { name: "Send message", exact: true });
  const initialAssistantCount = await page.locator('article[data-role="assistant"]').count();

  await textarea.fill(message, { timeout: timeoutMs });
  addResult("memory-scope-marker-generated", "pass", `Generated marker ${marker}.`);
  await page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="Send message"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout: timeoutMs });

  await sendButton.click({ timeout: timeoutMs });
  addResult("memory-scope-send-click", "pass", "Clicked Send for opt-in multi-session Brain Memory scope smoke.");

  await page.getByText(message, { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  addResult("memory-scope-user-message", "pass", "Unique scope-isolation user message rendered in Session A1.");

  await page.waitForFunction(
    ({ initialCount }) => document.querySelectorAll('article[data-role="assistant"]').length > initialCount,
    { initialCount: initialAssistantCount },
    { timeout: liveSendTimeoutMs }
  );
  addResult("memory-scope-assistant-created", "pass", "A new assistant message was created for scope-isolation smoke.");

  const assistantResult = await waitForAssistantResponse(initialAssistantCount, ackMarker);
  if (!assistantResult.ok) {
    addResult("memory-scope-assistant-response", "fail", assistantResult.message);
    return;
  }
  addResult(
    "memory-scope-assistant-response",
    "pass",
    `Observed non-empty assistant response: ${assistantResult.preview}`
  );
  addResult(
    "memory-scope-assistant-ack",
    assistantResult.hasMarker ? "pass" : "warn",
    assistantResult.hasMarker
      ? `Assistant response included ${ackMarker}.`
      : `Assistant response did not include ${ackMarker}; BFF scope search remains authoritative.`
  );

  const streamStatus = streamResponses.at(-1);
  addResult(
    "memory-scope-stream-response",
    streamStatus && streamStatus < 400 ? "pass" : "fail",
    streamStatus
      ? `/api/hermes/chat/stream returned HTTP ${streamStatus}.`
      : "No /api/hermes/chat/stream response was observed."
  );

  await checkMemoryActivityBlock();
  await checkMemoryTimelineRail();
  await checkTenantScopeDiagnostics();

  const sameSession = await checkMarkerSearch({
    context: contexts.a1,
    expectFound: true,
    marker,
    name: "memory-scope-same-session",
    successMessage: "Same project + same session found the session-scoped marker."
  });
  await checkMarkerInspect({
    context: contexts.a1,
    marker,
    memoryId: sameSession.first?.id,
    name: "memory-scope-inspect",
    expectedProjectKey: contexts.a1.project.stableKey,
    expectedSessionKey: contexts.a1.session?.stableKey
  });
  await checkMarkerSearch({
    context: contexts.a2,
    expectFound: false,
    marker,
    name: "memory-scope-different-session",
    successMessage: "Same project + different session returned 0 marker results."
  });
  await checkMarkerSearch({
    context: contexts.b1,
    expectFound: false,
    marker,
    name: "memory-scope-different-project",
    successMessage: "Different project returned 0 marker results."
  });
  await checkProjectOnlyMarkerSearch({
    context: contexts.projectOnlyA,
    expectedProjectKey: contexts.a1.project.stableKey,
    expectedSessionKey: contexts.a1.session?.stableKey,
    marker
  });

  await checkNoVisibleSecrets("memory-scope-visible-secrets");
  await checkNoHorizontalOverflow("memory-scope-overflow");
}

async function checkTenantScopeDiagnostics() {
  const contextTab = page.getByRole("button", { name: "Show context panel", exact: true });
  await contextTab.click({ timeout: timeoutMs });
  await expectVisible(
    "tenant-scope-diagnostics-section",
    page.getByText("Tenant / scope diagnostics", { exact: true }).first(),
    "Context tab exposes tenant/scope diagnostics."
  );
  const diagnostics = page.locator('section[aria-labelledby="tenant-scope-diagnostics-heading"] details');
  const isOpen = await diagnostics.evaluate((node) => node instanceof HTMLDetailsElement && node.open);
  if (!isOpen) {
    await diagnostics.locator("summary").click({ timeout: timeoutMs });
  }
  await expectVisible(
    "tenant-scope-diagnostics-tenant",
    diagnostics.getByText("local-dev", { exact: true }).first(),
    "Tenant/scope diagnostics shows the local-dev tenant."
  );
  await expectHidden(
    "tenant-scope-diagnostics-no-drift",
    diagnostics.getByText(/tenant-local|tenant mismatch|drift detected/i).first(),
    "Tenant/scope diagnostics does not show a tenant mismatch warning."
  );
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

  const search = await postJson("/api/brain-memory/search", {
    context,
    limit: 10,
    query: marker
  });
  const markerResults = Array.isArray(search.body?.results)
    ? search.body.results.filter((result) => JSON.stringify(result).includes(marker))
    : [];
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

  const searchTenant = search.body?.scope?.tenantId;
  check(
    "memory-live-bff-search-tenant",
    !searchTenant || searchTenant === context.project.tenantId,
    searchTenant
      ? `BFF search scope tenant matched UI tenant ${context.project.tenantId}.`
      : "BFF search response did not expose tenant; strict tenant behavior is verified by same-context search success and no fallback."
  );
  const resultProjectOk = !first.projectKey || first.projectKey === context.project.stableKey;
  const resultSessionOk = !first.sessionKey || first.sessionKey === context.session?.stableKey;
  const resultScopeOk =
    first.scopeStatus === "matching-session" ||
    (!first.scopeStatus && resultProjectOk && resultSessionOk);
  check(
    "memory-live-bff-result-scope",
    resultProjectOk && resultSessionOk && resultScopeOk,
    `Search result scope project=${first.projectKey || "unknown"}, session=${first.sessionKey || "none"}, status=${first.scopeStatus || "unknown"}.`
  );

  const inspect = await postJson("/api/brain-memory/memory/inspect", {
    context,
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
    const detailTenant = detail.scope?.tenantId;
    const tenantOk = !detailTenant || detailTenant === context.project.tenantId;
    const projectOk = detail.projectKey === context.project.stableKey;
    const sessionOk = detail.sessionKey === context.session?.stableKey;
    const scopeOk = detail.scopeStatus === "matching-session";
    addResult(
      "memory-live-inspect-scope",
      tenantOk && projectOk && sessionOk && scopeOk ? "pass" : "fail",
      `${scopeText}${detailTenant ? `, tenant=${detailTenant}` : ""}.`
    );
    check(
      "memory-live-detail-evidence-placeholder",
      inspect.body?.evidence?.status === "not_implemented" &&
        Array.isArray(inspect.body?.evidence?.evidence) &&
        inspect.body.evidence.evidence.length === 0,
      `Evidence status is ${inspect.body?.evidence?.status || "unknown"} with ${inspect.body?.evidence?.evidence?.length ?? "unknown"} item(s).`
    );
    check(
      "memory-live-detail-supersession-placeholder",
      inspect.body?.supersession?.status === "not_implemented" &&
        Array.isArray(inspect.body?.supersession?.chain) &&
        inspect.body.supersession.chain.length === 0,
      `Supersession status is ${inspect.body?.supersession?.status || "unknown"} with ${inspect.body?.supersession?.chain?.length ?? "unknown"} item(s).`
    );
    await checkMemoryDetailUiFromSearch({ marker, memoryId: first.id });
  }

  const differentProjectContext = {
    ...context,
    project: {
      ...context.project,
      id: `${context.project.id}-different`,
      stableKey: `${context.project.stableKey}:different`
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

async function checkMemoryDetailUiFromSearch({ marker, memoryId }) {
  const memoryTab = page.getByRole("button", { name: "Show memory panel", exact: true });
  await memoryTab.click({ timeout: timeoutMs });
  const searchInput = page.getByLabel("Search Brain Memory", { exact: true });
  await searchInput.fill(marker, { timeout: timeoutMs });
  await page.getByRole("button", { name: "Search", exact: true }).click({ timeout: timeoutMs });

  const resultButton = page
    .locator('section[aria-labelledby="memory-results-heading"] button')
    .filter({ hasText: marker })
    .first();
  await resultButton.waitFor({ state: "visible", timeout: timeoutMs });
  await resultButton.click({ timeout: timeoutMs });

  const detailPanel = page.locator('section[aria-labelledby="memory-detail-heading"]');
  await expectVisible(
    "memory-live-detail-panel",
    detailPanel.getByText("Read-only detail", { exact: true }).first(),
    "Memory detail panel opens as read-only detail."
  );
  await expectVisible(
    "memory-live-detail-scoped-result",
    detailPanel.getByText("Scoped result", { exact: true }).first(),
    "Memory detail panel labels the Gateway item as a scoped result."
  );
  await expectVisible(
    "memory-live-detail-id",
    detailPanel.getByText(memoryId, { exact: true }).first(),
    "Memory detail panel shows the selected memory id."
  );
  await expectVisible(
    "memory-live-detail-evidence-not-implemented",
    detailPanel.getByText("Evidence: not implemented by Gateway yet.", { exact: true }).first(),
    "Evidence section honestly reports Gateway not_implemented state."
  );
  await expectVisible(
    "memory-live-detail-supersession-not-implemented",
    detailPanel.getByText("Supersession chain: not implemented by Gateway yet.", { exact: true }).first(),
    "Supersession section honestly reports Gateway not_implemented state."
  );
  await expectVisible(
    "memory-live-detail-audit-metadata-only",
    detailPanel.getByText("Metadata only", { exact: true }).first(),
    "Audit section is labelled as metadata only."
  );
  await expectVisible(
    "memory-live-detail-audit-metadata-collapsed",
    detailPanel.getByText("Audit metadata", { exact: true }).first(),
    "Audit metadata disclosure is present."
  );
  await expectHidden(
    "memory-live-detail-no-delete",
    detailPanel.getByText(/Delete memory|Mark stale|Supersede memory|Pin memory/i).first(),
    "Memory detail panel exposes no mutation/admin actions."
  );
}

async function checkMarkerSearch({ context, expectFound, marker, name, successMessage }) {
  const search = await postJson("/api/brain-memory/search", {
    context,
    limit: 10,
    query: marker
  });
  const markerResults = Array.isArray(search.body?.results)
    ? search.body.results.filter((result) => JSON.stringify(result).includes(marker))
    : [];
  const found = search.ok && search.body?.mode === "real" && markerResults.length > 0;
  const passed = expectFound ? found : search.ok && search.body?.mode === "real" && markerResults.length === 0;
  addResult(
    name,
    passed ? "pass" : "fail",
    passed
      ? successMessage
      : `Expected marker ${expectFound ? "to be found" : "to be absent"}; mode=${search.body?.mode || "unknown"}, markerResults=${markerResults.length}, status=${search.status || search.error || "unknown"}.`
  );

  const searchTenant = search.body?.scope?.tenantId;
  if (search.ok && search.body?.mode === "real") {
    check(
      `${name}-tenant`,
      !searchTenant || searchTenant === context.project.tenantId,
      searchTenant
        ? `BFF search tenant matched ${context.project.tenantId}.`
        : "BFF search response did not expose tenant; scope is still verified through strict same-context/different-context results."
    );
  }

  return {
    first: markerResults[0] ?? null,
    markerResults,
    search
  };
}

async function checkMarkerInspect({ context, expectedProjectKey, expectedSessionKey, marker, memoryId, name }) {
  if (!memoryId) {
    addResult(name, "fail", "Cannot inspect scope because same-session search did not return a memory id.");
    return;
  }

  const inspect = await postJson("/api/brain-memory/memory/inspect", {
    context,
    memoryId
  });
  const detail = inspect.body?.detail;
  const inspectOk = inspect.ok && inspect.body?.mode === "real" && detail;
  if (!inspectOk) {
    addResult(
      name,
      "fail",
      `BFF inspect did not return detail; mode=${inspect.body?.mode || "unknown"}, status=${inspect.status || inspect.error || "unknown"}.`
    );
    return;
  }

  const detailTenant = detail.scope?.tenantId;
  const tenantOk = !detailTenant || detailTenant === context.project.tenantId;
  const projectOk = detail.projectKey === expectedProjectKey;
  const sessionOk = detail.sessionKey === expectedSessionKey;
  const scopeOk = detail.scopeStatus === "matching-session";
  const contentOk = JSON.stringify(detail).includes(marker);

  addResult(
    name,
    tenantOk && projectOk && sessionOk && scopeOk && contentOk ? "pass" : "fail",
    `Inspect detail project=${detail.projectKey || "unknown"}, session=${detail.sessionKey || "none"}, scope=${detail.scopeStatus || "unknown"}${detailTenant ? `, tenant=${detailTenant}` : ""}.`
  );
}

async function checkProjectOnlyMarkerSearch({ context, expectedProjectKey, expectedSessionKey, marker }) {
  const search = await postJson("/api/brain-memory/search", {
    context,
    limit: 10,
    query: marker
  });
  const markerResults = Array.isArray(search.body?.results)
    ? search.body.results.filter((result) => JSON.stringify(result).includes(marker))
    : [];
  const ok = search.ok && search.body?.mode === "real";
  const first = markerResults[0] ?? null;
  const found = ok && first;
  const searchTenant = search.body?.scope?.tenantId;
  const firstScope = first
    ? `project=${first.projectKey || "unknown"}, session=${first.sessionKey || "none"}, status=${first.scopeStatus || "unknown"}`
    : "no marker result";

  addResult(
    "memory-scope-project-only-query",
    found ? "pass" : "fail",
    ok
      ? `Project-only search is currently project-broad and returned ${markerResults.length} marker result(s); ${firstScope}. Project-level marker creation was not attempted.`
      : `Project-only search failed; mode=${search.body?.mode || "unknown"}, status=${search.status || search.error || "unknown"}.`
  );

  if (!found) {
    return;
  }

  check(
    "memory-scope-project-only-original-session-key",
    first.sessionKey === expectedSessionKey,
    `Project-only read preserved original sessionKey ${first.sessionKey || "none"}.`
  );
  check(
    "memory-scope-project-only-scope-status",
    first.scopeStatus === "matching-project",
    `Project-only read reports scopeStatus ${first.scopeStatus || "unknown"}.`
  );
  check(
    "memory-scope-project-only-project-key",
    first.projectKey === expectedProjectKey,
    `Project-only read stayed in project ${first.projectKey || "unknown"}.`
  );
  check(
    "memory-scope-project-only-query-tenant",
    !searchTenant || searchTenant === context.project.tenantId,
    searchTenant
      ? `BFF project-only search tenant matched ${context.project.tenantId}.`
      : "BFF project-only search response did not expose tenant."
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

  const exportPreview = await checkRunHistoryStatus("completed", "composer-run-history-replay-after-reload");
  await expectVisible(
    "replay-export-preview-after-reload",
    exportPreview.getByText("Local preview only", { exact: true }).first(),
    "Local export preview remains available after reload."
  );
  await checkNoVisibleSecrets("replay-visible-secrets");
  await checkNoHorizontalOverflow("replay-after-reload-overflow");
}

async function checkRunHistoryStatus(expectedStatus, name) {
  const contextTab = page.getByRole("button", { name: "Show context panel", exact: true });
  await contextTab.click({ timeout: timeoutMs });
  const exportPreview = page.locator('section[aria-labelledby="export-preview-heading"]');
  await expectVisible(
    `${name}-section`,
    exportPreview.getByText("Export preview", { exact: true }).first(),
    "Export preview section is visible after live composer action."
  );

  const storedRun = await page.waitForFunction(
    ({ expectedStatus: status }) => {
      const raw = window.localStorage.getItem("hermes-ui.workspace.v1");
      if (!raw) {
        return null;
      }
      const state = JSON.parse(raw);
      const active = state.sessions?.find((session) => session.id === state.activeSessionId);
      const run = active?.runRecords?.find((record) => record.status === status);
      return run
        ? {
            replayCount: Array.isArray(run.activityReplay) ? run.activityReplay.length : 0,
            status: run.status
          }
        : null;
    },
    { expectedStatus },
    { timeout: timeoutMs }
  ).then((value) => value.jsonValue()).catch(() => null);
  check(
    name,
    storedRun?.status === expectedStatus,
    storedRun?.status === expectedStatus
      ? `Workspace persistence includes a ${expectedStatus} Web UI run.`
      : `Workspace persistence did not include a ${expectedStatus} Web UI run.`
  );

  const details = exportPreview.locator("details").first();
  const isOpen = await details.evaluate((node) => node instanceof HTMLDetailsElement && node.open).catch(() => false);
  if (!isOpen) {
    await details.locator("summary").click({ timeout: timeoutMs });
  }
  await page.waitForFunction(
    ({ status }) => {
      const pre = document.querySelector('section[aria-labelledby="export-preview-heading"] pre[data-export-preview-json="ready"]');
      const text = pre?.textContent || "";
      return text.includes(`"status": "${status}"`) && text.includes('"activityReplay"');
    },
    { status: expectedStatus },
    { timeout: timeoutMs }
  ).then(
    () => addResult(`${name}-export-preview-run`, "pass", "Export preview JSON includes the persisted run status and activity replay."),
    () => addResult(`${name}-export-preview-run`, "fail", "Export preview JSON did not include the persisted run status and activity replay.")
  );
  if (expectedStatus === "stopped") {
    check(
      `${name}-persisted-stopped-event`,
      Number(storedRun?.replayCount ?? 0) > 0,
      "Stopped run persistence includes replay activity."
    );
  }
  return exportPreview;
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
    ["voice-input", "Voice input coming soon"]
  ];
  for (const [name, label] of composerControls) {
    await expectDisabled(
      `composer-${name}-disabled`,
      page.getByRole("button", { name: label, exact: true }),
      `${label} control is disabled.`
    );
  }

  const modelButton = page
    .locator(
      'button[aria-label="Provider and model selector disabled"], button[aria-label="One Hermes model available"], button[aria-label="Select Hermes model"]'
    )
    .first();
  const modelButtonLabel = await modelButton.getAttribute("aria-label", { timeout: timeoutMs }).catch(() => "");
  if (modelButtonLabel === "Select Hermes model") {
    const enabled = await modelButton.isEnabled({ timeout: timeoutMs }).catch(() => false);
    check(
      "composer-model-selector-enabled",
      enabled,
      "Runtime model selector is enabled when Hermes exposes multiple selectable models."
    );
  } else {
    const disabled = await modelButton.isDisabled({ timeout: timeoutMs }).catch(() => false);
    check(
      "composer-model-selector-disabled",
      disabled,
      `Model selector remains disabled when Hermes exposes no runtime choice or only one model (${modelButtonLabel || "missing"}).`
    );
  }

  const stopButtons = await page.getByRole("button", { name: "Stop generation", exact: true }).count();
  check("composer-stop-idle-hidden", stopButtons === 0, "Stop generation is not exposed outside generation state.");
  const modelStateText = await modelButton
    .innerText({ timeout: timeoutMs })
    .then((text) => text.replace(/\s+/g, " ").trim())
    .catch(() => "");
  check(
    "composer-model-server-configured",
    Boolean(modelStateText) &&
      !/select model|switch model/i.test(modelStateText) &&
      !/^(gpt-|claude-)/i.test(modelStateText),
    `Composer shows grounded Hermes model label (read-only): "${modelStateText || "missing"}".`
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
        tenantId: project.memoryScope?.tenantId || "local-dev",
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

async function seedMemoryScopeIsolationWorkspace() {
  return page.evaluate(() => {
    const now = new Date().toISOString();
    const tenantId = "local-dev";
    const projectAId = "project-scope-a";
    const projectBId = "project-scope-b";
    const sessionA1Id = "session-scope-a1";
    const sessionA2Id = "session-scope-a2";
    const sessionB1Id = "session-scope-b1";
    const projectStableKey = (projectId) => `studio:${tenantId}:project:${projectId}`;
    const sessionStableKey = (projectId, sessionId) => `studio:${tenantId}:project:${projectId}:session:${sessionId}`;
    const makeProject = (id, name) => ({
      createdAt: now,
      description: "Isolated smoke project for live Brain Memory scope regression.",
      icon: id === projectAId ? "SA" : "SB",
      id,
      memoryScope: {
        contextPolicy: "balanced",
        pinnedMemoryIds: [],
        projectId: id,
        retrievalProfile: "balanced",
        stableProjectKey: projectStableKey(id),
        tenantId,
        userVisibleSummary: `${name} scope-isolation project.`
      },
      memoryScopeKey: projectStableKey(id),
      name,
      updatedAt: now
    });
    const makeSession = (projectId, id, title) => ({
      archivedAt: undefined,
      artifacts: [],
      createdAt: now,
      hermesSessionId: `hermes-${id}`,
      id,
      memoryEvidence: [],
      memoryScope: {
        includeProjectContext: true,
        includeSessionContext: true,
        projectId,
        sessionId: id,
        stableSessionKey: sessionStableKey(projectId, id),
        tenantId,
        userVisibleSummary: `${title} scope-isolation session.`
      },
      messages: [],
      projectId,
      runRecords: [],
      summary: "Empty scope-isolation smoke session",
      title,
      titleSource: "manual",
      toolEvents: [],
      updatedAt: now
    });

    const state = {
      activeProjectId: projectAId,
      activeSessionId: sessionA1Id,
      connectionStatus: {
        brainMemory: "real",
        hermes: "real"
      },
      modelChoices: [
        {
          id: "hermes-agent",
          label: "Hermes Agent",
          provider: "Hermes"
        }
      ],
      projects: [
        makeProject(projectAId, "Scope Isolation Project A"),
        makeProject(projectBId, "Scope Isolation Project B")
      ],
      sessions: [
        makeSession(projectAId, sessionA1Id, "Scope isolation A1"),
        makeSession(projectAId, sessionA2Id, "Scope isolation A2"),
        makeSession(projectBId, sessionB1Id, "Scope isolation B1")
      ],
      version: 1
    };

    window.localStorage.setItem("hermes-ui.workspace.v1", JSON.stringify(state));
    return {
      projectAStableKey: projectStableKey(projectAId),
      projectBStableKey: projectStableKey(projectBId),
      sessionA1StableKey: sessionStableKey(projectAId, sessionA1Id),
      sessionA2StableKey: sessionStableKey(projectAId, sessionA2Id),
      sessionB1StableKey: sessionStableKey(projectBId, sessionB1Id),
      tenantId
    };
  });
}

async function scopeIsolationContexts() {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem("hermes-ui.workspace.v1");
    if (!raw) {
      return null;
    }
    const state = JSON.parse(raw);
    const toContext = (projectId, sessionId) => {
      const project = state.projects?.find((item) => item.id === projectId);
      const session = sessionId
        ? state.sessions?.find((item) => item.id === sessionId)
        : null;
      if (!project || (sessionId && !session)) {
        return null;
      }
      return {
        project: {
          contextPolicy: project.memoryScope?.contextPolicy || "balanced",
          id: project.id,
          retrievalProfile: project.memoryScope?.retrievalProfile || "balanced",
          stableKey: project.memoryScope?.stableProjectKey || project.memoryScopeKey || project.id,
          tenantId: project.memoryScope?.tenantId || "local-dev",
          title: project.name
        },
        session: session
          ? {
              id: session.id,
              includeProjectContext: session.memoryScope?.includeProjectContext !== false,
              includeSessionContext: session.memoryScope?.includeSessionContext !== false,
              stableKey: session.memoryScope?.stableSessionKey || session.id,
              title: session.title
            }
          : null,
        ui: {
          source: "hermes-ui",
          workspaceVersion: 1
        }
      };
    };

    const a1 = toContext("project-scope-a", "session-scope-a1");
    const a2 = toContext("project-scope-a", "session-scope-a2");
    const b1 = toContext("project-scope-b", "session-scope-b1");
    const projectOnlyA = toContext("project-scope-a", null);
    return a1 && a2 && b1 && projectOnlyA ? { a1, a2, b1, projectOnlyA } : null;
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
