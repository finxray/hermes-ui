#!/usr/bin/env node

import { chromium } from "playwright";

const args = parseArgs(process.argv.slice(2));
const baseUrl = new URL(args.baseUrl || "http://127.0.0.1:3000/").toString();
const failures = [];
const browserErrors = [];

await assertHttpOk(baseUrl, "production root");
await assertHttpOk(new URL("/api/hermes/status", baseUrl), "Hermes status BFF");

const browser = await chromium.launch({ headless: !args.headed });
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 500) {
      browserErrors.push(`response: HTTP ${response.status()} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByRole("navigation", { name: "Workspace sections" }).waitFor();

  check((await page.title()) === "Stoix", "document title is Stoix");
  const faviconHref = await page.locator('link[rel="icon"]').first().getAttribute("href");
  check(Boolean(faviconHref?.includes("stoix-helmet")), "Stoix helmet favicon is configured");
  if (faviconHref) await assertHttpOk(new URL(faviconHref, baseUrl), "Stoix favicon");
  check(await page.getByRole("form", { name: "Message composer" }).isVisible(), "workspace composer is visible");
  check(!(await page.locator("body").innerText()).includes("Brain Memory"), "core workspace has no Brain Memory UI");
  const fullscreenButton = page.getByRole("button", { name: "Enter full screen" });
  const contextConsoleButton = page.getByRole("button", { name: "Open context console" });
  await fullscreenButton.waitFor();
  const fullscreenControlOrder = await fullscreenButton.evaluate((button, consoleButton) =>
    Boolean(consoleButton && (button.compareDocumentPosition(consoleButton) & Node.DOCUMENT_POSITION_FOLLOWING)),
    await contextConsoleButton.elementHandle()
  );
  check(fullscreenControlOrder, "full-screen control precedes the context console control");
  if (!(await fullscreenButton.isDisabled())) {
    await fullscreenButton.click();
    await page.waitForFunction(() => Boolean(document.fullscreenElement), undefined, { timeout: 3_000 });
    check(await page.getByRole("button", { name: "Exit full screen" }).isVisible(), "full-screen control reflects active state");
    await page.getByRole("button", { name: "Exit full screen" }).click();
    await page.waitForFunction(() => !document.fullscreenElement, undefined, { timeout: 3_000 });
  } else {
    check(true, "full-screen control degrades safely in Chromium's unsupported headless shell");
  }
  const focusPersistentScrollbarRule = await page.evaluate(() =>
    Array.from(document.styleSheets).some((sheet) =>
      Array.from(sheet.cssRules).some(
        (rule) =>
          rule instanceof CSSStyleRule &&
          rule.selectorText?.includes(".scrollbar-hover-context:focus-within")
      )
    )
  );
  check(!focusPersistentScrollbarRule, "panel scrollbars are hover-only and do not persist with focus");
  await checkOverflow(page, "workspace desktop");

  const activeTab = page.getByRole("tab").first();
  const tabFontSize = Number.parseFloat(await activeTab.evaluate((element) => getComputedStyle(element).fontSize));
  const mainTabBar = page.locator('[data-chat-tab-bar="true"][data-pane="main"]');
  const initialMainTab = mainTabBar.locator("[data-chat-tab-id]").first();
  await initialMainTab.waitFor();
  await page.mouse.move(1400, 860);
  await page.waitForTimeout(170);
  const singleMainResting = await readChatTabVisualState(initialMainTab);
  check(singleMainResting.active, "the left pane's only tab is active");
  check(singleMainResting.closeOpacity === 1, "the active one-tab left pane keeps its close control visible");
  check(singleMainResting.moreOpacity === 1, "the active one-tab left pane keeps its actions control visible");
  check(isTransparentColor(singleMainResting.background), "the active one-tab left pane has no resting background");
  await initialMainTab.hover();
  await page.waitForTimeout(170);
  const singleMainHovered = await readChatTabVisualState(initialMainTab);
  check(!isTransparentColor(singleMainHovered.background), "the active one-tab left pane gains a background on hover");

  await page.getByRole("button", { name: /Add chat tab in left pane/ }).click();
  const addChatMenu = page.getByRole("menu", { name: /Add chat to left pane/ });
  await addChatMenu.waitFor();
  const addMenuMetrics = await addChatMenu.evaluate((menu) => {
    const firstItem = menu.querySelector('[role="menuitem"]');
    const firstIcon = firstItem?.querySelector("svg");
    return {
      fontSize: firstItem ? Number.parseFloat(getComputedStyle(firstItem).fontSize) : 0,
      iconSize: firstIcon?.getBoundingClientRect().width ?? 0,
      itemHeight: firstItem?.getBoundingClientRect().height ?? 0,
      width: menu.getBoundingClientRect().width
    };
  });
  check(Math.abs(addMenuMetrics.fontSize - tabFontSize) < 0.05, "tab picker font matches the tab title");
  check(addMenuMetrics.itemHeight <= 32, "tab picker uses compact rows");
  check(addMenuMetrics.iconSize <= 14.1, "tab picker uses compact icons");
  check(addMenuMetrics.width <= 250.1, "tab picker uses compact width");
  await addChatMenu.getByRole("menuitem", { name: "New chat", exact: true }).first().click();
  await mainTabBar.locator("[data-chat-tab-id]").nth(1).waitFor();
  await page.mouse.move(1400, 860);
  await page.waitForTimeout(170);
  const inactiveMainTab = mainTabBar.locator('[data-chat-tab-id][data-active="false"]').first();
  const inactiveMainResting = await readChatTabVisualState(inactiveMainTab);
  check(inactiveMainResting.closeOpacity === 0, "an inactive tab hides its close control at rest");
  check(inactiveMainResting.moreOpacity === 0, "an inactive tab hides its actions control at rest");
  check(isTransparentColor(inactiveMainResting.background), "an inactive tab has no resting background");
  await inactiveMainTab.hover();
  await page.waitForTimeout(170);
  const inactiveMainHovered = await readChatTabVisualState(inactiveMainTab);
  check(inactiveMainHovered.closeOpacity === 1, "an inactive tab reveals its close control on hover");
  check(inactiveMainHovered.moreOpacity === 1, "an inactive tab reveals its actions control on hover");
  check(!isTransparentColor(inactiveMainHovered.background), "an inactive tab reveals its background on hover");

  const activeMainTab = mainTabBar.locator('[data-chat-tab-id][data-active="true"]');
  await activeMainTab.getByRole("button", { name: /Chat actions for/ }).click();
  const chatActionsMenu = page.getByRole("menu", { name: "Chat actions" });
  await chatActionsMenu.waitFor();
  const commandMetrics = await chatActionsMenu.locator('[role="menuitem"]').evaluateAll((items) =>
    items.map((item) => ({
      fontSize: Number.parseFloat(getComputedStyle(item).fontSize),
      iconSize: item.querySelector("svg")?.getBoundingClientRect().width ?? 0,
      itemHeight: item.getBoundingClientRect().height
    }))
  );
  check(commandMetrics.every((item) => Math.abs(item.fontSize - tabFontSize) < 0.05), "chat menu font matches the tab title");
  check(commandMetrics.every((item) => item.itemHeight <= 30.1), "chat menu uses compact rows");
  check(commandMetrics.every((item) => item.iconSize <= 14.1), "chat menu uses compact icons");
  await chatActionsMenu.getByRole("menuitem", { name: "Split screen", exact: true }).click();
  const sideTabBar = page.locator('[data-chat-tab-bar="true"][data-pane="side"]');
  const singleSideTab = sideTabBar.locator("[data-chat-tab-id]").first();
  await singleSideTab.waitFor();
  await page.mouse.move(1400, 860);
  await page.waitForTimeout(170);
  const singleSideResting = await readChatTabVisualState(singleSideTab);
  check(singleSideResting.active, "the right pane's only tab is active");
  check(singleSideResting.closeOpacity === 1, "the active one-tab right pane keeps its close control visible");
  check(singleSideResting.moreOpacity === 1, "the active one-tab right pane keeps its actions control visible");
  check(isTransparentColor(singleSideResting.background), "the active one-tab right pane has no resting background");

  await page.getByRole("button", { name: "Plugins", exact: true }).click();
  await page.locator("#plugins-heading").filter({ hasText: "Plugins" }).waitFor();
  const controlsBefore = await page.getByLabel("Search plugins and skills").boundingBox();
  await page.getByRole("tab", { name: "Skills", exact: true }).click();
  await page.locator("#plugins-heading").filter({ hasText: "Skills" }).waitFor();
  const controlsAfter = await page.getByLabel("Search plugins and skills").boundingBox();
  check(
    Boolean(controlsBefore && controlsAfter && Math.abs(controlsBefore.y - controlsAfter.y) < 1),
    "Plugins/Skills toggle keeps controls vertically stable"
  );
  await page.getByRole("tab", { name: "Plugins", exact: true }).click();
  await checkOverflow(page, "plugins desktop");

  for (const section of ["Config", "Keys", "Logs"]) {
    await page.getByRole("button", { name: section, exact: true }).click();
    await page.locator(`#${section.toLowerCase()}-heading`).waitFor();
    check(!(await page.locator("body").innerText()).includes("Brain Memory"), `${section} has no Brain Memory UI`);
    await checkOverflow(page, `${section.toLowerCase()} desktop`);
  }

  const settingsButton = page.getByRole("button", { name: /Open settings/ });
  await settingsButton.click();
  await page.locator("#settings-heading").waitFor();
  check(await page.getByText("Stoix version", { exact: true }).isVisible(), "Settings shows Stoix version");
  check(await page.getByText("Software updates", { exact: true }).isVisible(), "Settings shows software updates");
  check(!(await page.locator("body").innerText()).includes("Brain Memory"), "Settings has no Brain Memory UI");
  await checkOverflow(page, "settings desktop");

  await page.setViewportSize({ width: 768, height: 720 });
  await page.waitForTimeout(150);
  await checkOverflow(page, "settings compact");

  check(browserErrors.length === 0, `browser has no errors${browserErrors.length ? `: ${browserErrors.join(" | ")}` : ""}`);
} finally {
  await browser.close();
}

if (failures.length) {
  console.error("Production UI smoke failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Production UI smoke passed.");

function parseArgs(values) {
  const result = { baseUrl: "", headed: false };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--headed") result.headed = true;
    else if (value === "--base-url") result.baseUrl = values[++index] || "";
    else if (value.startsWith("--base-url=")) result.baseUrl = value.slice("--base-url=".length);
    else throw new Error(`Unknown argument: ${value}`);
  }
  return result;
}

async function readChatTabVisualState(tab) {
  return tab.evaluate((element) => {
    const closeButton = element.querySelector('button[aria-label^="Close tab"]');
    const moreButton = element.querySelector('button[aria-label^="Chat actions for"]');
    return {
      active: element.getAttribute("data-active") === "true",
      background: getComputedStyle(element).backgroundColor,
      closeOpacity: closeButton ? Number.parseFloat(getComputedStyle(closeButton).opacity) : -1,
      moreOpacity: moreButton ? Number.parseFloat(getComputedStyle(moreButton).opacity) : -1
    };
  });
}

function isTransparentColor(value) {
  return value === "transparent" || value === "rgba(0, 0, 0, 0)";
}

async function assertHttpOk(input, label) {
  const response = await fetch(input, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  check(response.ok, `${label} returned HTTP ${response.status}`);
}

async function checkOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  check(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label} has no page-level horizontal overflow`);
}

function check(condition, label) {
  if (condition) {
    console.log(`PASS ${label}`);
  } else {
    failures.push(label);
  }
}
