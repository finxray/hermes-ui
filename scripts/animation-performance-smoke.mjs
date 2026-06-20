#!/usr/bin/env node

import { chromium } from "playwright";
import { preflightStaticChunks, printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 10_000;
const sampleMs = 2_000;
const budget = {
  averageFpsWarn: 50,
  droppedFrameRatioWarn: 0.18,
  longestFrameWarnMs: 80
};
const report = {
  baseUrl,
  budget,
  checks: [],
  metrics: {},
  mode: {
    headed: args.headed
  },
  summary: {
    failed: 0,
    passed: 0,
    warned: 0
  }
};

let browser;
let context;
let page;

await main();

async function main() {
  printSelectedBaseUrl({ baseUrl, json: args.json, label: "Animation performance smoke" });
  for (const arg of args.unknown) {
    addResult("cli-args", "fail", `Unknown argument: ${arg}`);
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

  try {
    browser = await launchBrowser();
    context = await browser.newContext({ viewport: { height: 940, width: 1680 } });
    page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    await page.waitForLoadState("load", { timeout: timeoutMs });

    await checkPlainShellCanvas();
    await checkPanelHierarchy();
    await checkMainWindowSurface();
    await checkInteractionPolish();
    await sampleAnimationFrames();
    await checkNoHorizontalOverflow();
  } catch (error) {
    addResult("animation-smoke-run", "fail", safeErrorMessage(error));
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

async function checkPlainShellCanvas() {
  const layer = await page.evaluate(() => {
    const shell = document.querySelector("[class*='shell']");
    if (!shell) {
      return null;
    }
    const shellStyle = window.getComputedStyle(shell);
    const beforeStyle = window.getComputedStyle(shell, "::before");
    const afterStyle = window.getComputedStyle(shell, "::after");
    return {
      afterAnimationName: afterStyle.animationName,
      afterContent: afterStyle.content,
      beforeAnimationName: beforeStyle.animationName,
      beforeContent: beforeStyle.content,
      shellAnimationName: shellStyle.animationName,
      shellBackgroundImage: shellStyle.backgroundImage
    };
  });
  report.metrics.shellCanvas = layer;

  check(
    "shell-oil-slick-ambient-layer",
    Boolean(layer) && layer.beforeContent === "\"\"" && layer.afterContent === "\"\"",
    `Shell must mount the approved CSS-only oil slick pseudo-layers (::before=${layer?.beforeContent || "missing"}, ::after=${layer?.afterContent || "missing"}).`
  );
  check(
    "shell-historical-gradient-foundation",
    Boolean(layer?.shellBackgroundImage) &&
      layer.shellBackgroundImage.includes("radial-gradient") &&
      layer.shellBackgroundImage.includes("linear-gradient") &&
      layer.shellBackgroundImage.includes("rgba(69, 21, 32, 0.28)") &&
      layer.shellBackgroundImage.includes("rgb(36, 36, 38)") &&
      layer.shellBackgroundImage.includes("rgb(37, 23, 32)") &&
      layer.shellBackgroundImage.includes("rgb(28, 28, 30)"),
    `Shell background must retain the approved dark Studio gradient foundation, found ${layer?.shellBackgroundImage || "missing"}.`
  );
  check(
    "shell-ambient-css-only-animation",
    layer?.shellAnimationName === "none" &&
      layer?.beforeAnimationName?.includes("shellOilSlickDrift") &&
      layer?.afterAnimationName?.includes("shellOilSlickCounterDrift"),
    `Shell canvas must keep animation on subtle CSS pseudo-layers only (shell=${layer?.shellAnimationName || "missing"}, ::before=${layer?.beforeAnimationName || "missing"}, ::after=${layer?.afterAnimationName || "missing"}).`
  );
}

async function checkMainWindowSurface() {
  const surface = await page.evaluate(() => {
    const mainWindow = document.querySelector("[class*='mainWindow']");
    const chatPane = document.querySelector("[class*='chatPane']");
    const chatWorkspace = document.querySelector("[class*='workspace']");
    const composerBox = document.querySelector("[class*='box']");
    const rightPanel = document.querySelector("[data-shell-rail='right']");
    const contextRail = document.querySelector("[class*='rail']");
    const contextHead = contextRail?.querySelector("[class*='head']");
    const contextScroll = contextRail?.querySelector("[class*='scroll']");
    const userBubble = document.querySelector("[data-role='user'] [class*='card']");
    return {
      chatPaneBackground: chatPane ? window.getComputedStyle(chatPane).backgroundColor : null,
      chatWorkspaceBackground: chatWorkspace ? window.getComputedStyle(chatWorkspace).backgroundColor : null,
      composerBoxShadow: composerBox ? window.getComputedStyle(composerBox).boxShadow : null,
      contextRailBackground: contextRail ? window.getComputedStyle(contextRail).backgroundColor : null,
      contextRailBorderLeftColor: rightPanel ? window.getComputedStyle(rightPanel).borderLeftColor : null,
      contextRailBorderLeftWidth: rightPanel ? window.getComputedStyle(rightPanel).borderLeftWidth : null,
      contextRailHeadBackground: contextHead ? window.getComputedStyle(contextHead).backgroundColor : null,
      contextRailScrollBackground: contextScroll ? window.getComputedStyle(contextScroll).backgroundColor : null,
      mainWindowBackground: mainWindow ? window.getComputedStyle(mainWindow).backgroundColor : null,
      mainWindowBorderColor: mainWindow ? window.getComputedStyle(mainWindow).borderTopColor : null,
      mainWindowBorderRightColor: mainWindow ? window.getComputedStyle(mainWindow).borderRightColor : null,
      mainWindowBorderRightWidth: mainWindow ? window.getComputedStyle(mainWindow).borderRightWidth : null,
      mainWindowBorderWidth: mainWindow ? window.getComputedStyle(mainWindow).borderTopWidth : null,
      mainWindowBoxShadow: mainWindow ? window.getComputedStyle(mainWindow).boxShadow : null,
      userBubbleBoxShadow: userBubble ? window.getComputedStyle(userBubble).boxShadow : null
    };
  });
  report.metrics.mainWindowSurface = surface;

  check(
    "main-window-solid-surface",
    surface.mainWindowBackground === "rgb(14, 14, 15)" &&
      surface.chatPaneBackground === "rgb(14, 14, 15)" &&
      surface.chatWorkspaceBackground === "rgb(14, 14, 15)" &&
      surface.contextRailBackground === "rgb(14, 14, 15)" &&
      surface.contextRailBorderLeftColor === "rgba(255, 255, 255, 0.16)" &&
      surface.contextRailBorderLeftWidth === "1px" &&
      surface.contextRailHeadBackground === "rgb(14, 14, 15)" &&
      surface.contextRailScrollBackground === "rgb(14, 14, 15)" &&
      surface.mainWindowBorderColor === "rgba(255, 255, 255, 0.2)" &&
      surface.mainWindowBorderRightWidth === "0px" &&
      surface.mainWindowBorderWidth === "1px" &&
      surface.mainWindowBoxShadow === "none" &&
      surface.composerBoxShadow === "none" &&
      (!surface.userBubbleBoxShadow || surface.userBubbleBoxShadow === "none"),
    `Main window=${surface.mainWindowBackground || "missing"}, chat pane=${surface.chatPaneBackground || "missing"}, chat workspace=${surface.chatWorkspaceBackground || "missing"}, context rail=${surface.contextRailBackground || "missing"}, context head=${surface.contextRailHeadBackground || "missing"}, context scroll=${surface.contextRailScrollBackground || "missing"}, main border=${surface.mainWindowBorderWidth || "missing"} ${surface.mainWindowBorderColor || "missing"}, main right border=${surface.mainWindowBorderRightWidth || "missing"} ${surface.mainWindowBorderRightColor || "missing"}, main shadow=${surface.mainWindowBoxShadow || "missing"}, composer shadow=${surface.composerBoxShadow || "missing"}, bubble shadow=${surface.userBubbleBoxShadow || "missing"}.`
  );
}

async function checkPanelHierarchy() {
  const panels = await page.evaluate(() => {
    const sidebar = document.querySelector("[data-shell-rail='left']");
    const topbar = document.querySelector("[class*='topbar']");
    const activeTopItem = topbar?.querySelector("[aria-current='page']");
    const sidebarStyle = sidebar ? window.getComputedStyle(sidebar) : null;
    const topbarStyle = topbar ? window.getComputedStyle(topbar) : null;
    const activeTopItemStyle = activeTopItem ? window.getComputedStyle(activeTopItem) : null;
    return {
      activeTopItemBackground: activeTopItemStyle?.backgroundColor ?? null,
      sidebarBackground: sidebarStyle?.backgroundColor ?? null,
      sidebarBackgroundImage: sidebarStyle?.backgroundImage ?? null,
      sidebarBorderColor: sidebarStyle?.borderRightColor ?? null,
      sidebarBorderWidth: sidebarStyle?.borderRightWidth ?? null,
      sidebarBoxShadow: sidebarStyle?.boxShadow ?? null,
      topbarBackground: topbarStyle?.backgroundColor ?? null,
      topbarBackgroundImage: topbarStyle?.backgroundImage ?? null,
      topbarBorderColor: topbarStyle?.borderBottomColor ?? null,
      topbarBorderWidth: topbarStyle?.borderBottomWidth ?? null,
      topbarBoxShadow: topbarStyle?.boxShadow ?? null
    };
  });
  report.metrics.panelHierarchy = panels;

  check(
    "left-top-panels-restored-historical-shell",
    panels.sidebarBackground === "rgba(0, 0, 0, 0)" &&
      panels.sidebarBackgroundImage === "none" &&
      panels.sidebarBorderWidth === "0px" &&
      panels.sidebarBoxShadow === "none" &&
      panels.topbarBackground === "rgba(0, 0, 0, 0)" &&
      panels.topbarBackgroundImage.includes("linear-gradient") &&
      panels.topbarBackgroundImage.includes("rgba(0, 0, 0, 0.1)") &&
      panels.topbarBorderWidth === "0px" &&
      panels.topbarBoxShadow === "none" &&
      (panels.activeTopItemBackground === "rgba(0, 0, 0, 0)" ||
        panels.activeTopItemBackground === "transparent"),
    `Sidebar bg=${panels.sidebarBackground || "missing"}, image=${panels.sidebarBackgroundImage || "missing"}, border=${panels.sidebarBorderWidth || "missing"} ${panels.sidebarBorderColor || "missing"}, shadow=${panels.sidebarBoxShadow || "missing"}; topbar bg=${panels.topbarBackground || "missing"}, image=${panels.topbarBackgroundImage || "missing"}, border=${panels.topbarBorderWidth || "missing"} ${panels.topbarBorderColor || "missing"}, shadow=${panels.topbarBoxShadow || "missing"}, active=${panels.activeTopItemBackground || "missing"}.`
  );
}

async function checkInteractionPolish() {
  const polish = await page.evaluate(() => {
    const scrollViewport = document.querySelector("[class*='scrollViewport']");
    const parentRow = document.querySelector("[class*='row'][data-depth='0']");
    const childRow = document.querySelector("[class*='row'][data-depth='1']");
    const styles = Array.from(document.styleSheets)
      .map((sheet) => {
        try {
          return Array.from(sheet.cssRules)
            .map((rule) => rule.cssText)
            .join("\n");
        } catch {
          return "";
        }
      })
      .join("\n");

    return {
      childRowHeight: childRow ? childRow.getBoundingClientRect().height : null,
      leftResizeHandle: document.querySelector("[aria-label='Resize left sidebar']") !== null,
      parentRowHeight: parentRow ? parentRow.getBoundingClientRect().height : null,
      rightResizeHandle: document.querySelector("[aria-label='Resize right context panel']") !== null,
      rowHoverMatchesActive: (() => {
        const activeRow = document.querySelector("[data-shell-rail='left'] [class*='active']");
        if (!activeRow) {
          return false;
        }
        const activeBg = window.getComputedStyle(activeRow).backgroundColor;
        const activeColor = window.getComputedStyle(activeRow).color;
        return (
          activeBg === "rgba(255, 255, 255, 0.075)" &&
          activeColor === "rgb(244, 244, 245)"
        );
      })(),
      scrollHoverRevealRule:
        /:hover::-webkit-scrollbar-thumb[^{]*\{[^}]*background-color:\s*var\(--scrollbar-thumb\)/.test(styles) ||
        /:focus-within::-webkit-scrollbar-thumb[^{]*\{[^}]*background-color:\s*var\(--scrollbar-thumb\)/.test(styles),
      scrollPointerEvents: scrollViewport ? window.getComputedStyle(scrollViewport).pointerEvents : null,
      scrollThumbBackground: scrollViewport
        ? window.getComputedStyle(scrollViewport, "::-webkit-scrollbar-thumb").backgroundColor
        : null,
      scrollThumbTransition: scrollViewport
        ? window.getComputedStyle(scrollViewport, "::-webkit-scrollbar-thumb").transitionDuration
        : null,
      scrollWidth: scrollViewport ? window.getComputedStyle(scrollViewport, "::-webkit-scrollbar").width : null
    };
  });
  report.metrics.interactionPolish = polish;

  check(
    "main-chat-scrollbar-hover-reveal",
    polish.scrollPointerEvents === "auto" &&
      (polish.scrollWidth === "17px" || polish.scrollWidth === "17.28px" || polish.scrollWidth === "auto") &&
      polish.scrollThumbBackground === "rgba(255, 255, 255, 0)" &&
      polish.scrollHoverRevealRule === true &&
      typeof polish.scrollThumbTransition === "string" &&
      /1600ms|1\.6s/.test(polish.scrollThumbTransition),
    `Main chat scrollbar pointer-events=${polish.scrollPointerEvents || "missing"}, width=${polish.scrollWidth || "missing"}, resting thumb background=${polish.scrollThumbBackground || "missing"}, transition=${polish.scrollThumbTransition || "missing"}, hover reveal rule=${polish.scrollHoverRevealRule}.`
  );
  check(
    "panel-resize-handles-present",
    polish.leftResizeHandle === true && polish.rightResizeHandle === true,
    `Left resize handle=${polish.leftResizeHandle}, right resize handle=${polish.rightResizeHandle}.`
  );
  check(
    "sidebar-row-height-consistent",
    typeof polish.parentRowHeight === "number" &&
      typeof polish.childRowHeight === "number" &&
      Math.abs(polish.parentRowHeight - polish.childRowHeight) <= 1,
    `Sidebar parent row height=${polish.parentRowHeight || "missing"}, child row height=${polish.childRowHeight || "missing"}.`
  );
  check(
    "sidebar-hover-selected-match",
    polish.rowHoverMatchesActive === true,
    "Sidebar active row uses the visible Codex-like selected pill and primary text color."
  );
}

async function sampleAnimationFrames() {
  const result = await page.evaluate(async ({ sampleMs }) => {
    const frames = [];
    let previous = performance.now();
    const startedAt = previous;
    return new Promise((resolve) => {
      function tick(now) {
        frames.push(now - previous);
        previous = now;
        if (now - startedAt >= sampleMs) {
          const usableFrames = frames.slice(1);
          const sorted = [...usableFrames].sort((a, b) => a - b);
          const totalMs = now - startedAt;
          const droppedFrames = usableFrames.filter((value) => value > 34).length;
          resolve({
            averageFps: usableFrames.length / (totalMs / 1000),
            droppedFrameRatio: usableFrames.length > 0 ? droppedFrames / usableFrames.length : 1,
            frameCount: usableFrames.length,
            longestFrameMs: Math.max(...usableFrames),
            p95FrameMs: sorted[Math.floor(sorted.length * 0.95)] ?? 0,
            totalMs
          });
          return;
        }
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }, { sampleMs });
  report.metrics.frameSample = result;

  addTimingCheck(
    "animation-average-fps",
    result.averageFps >= budget.averageFpsWarn,
    `Expected at least ${budget.averageFpsWarn} FPS; sampled ${Math.round(result.averageFps)} FPS.`
  );
  addTimingCheck(
    "animation-dropped-frame-ratio",
    result.droppedFrameRatio <= budget.droppedFrameRatioWarn,
    `Expected dropped-frame ratio <= ${budget.droppedFrameRatioWarn}; sampled ${result.droppedFrameRatio.toFixed(3)}.`
  );
  addTimingCheck(
    "animation-longest-frame",
    result.longestFrameMs <= budget.longestFrameWarnMs,
    `Expected longest frame <= ${budget.longestFrameWarnMs}ms; sampled ${Math.round(result.longestFrameMs)}ms.`
  );
}

async function checkNoHorizontalOverflow() {
  const sizes = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  report.metrics.horizontalOverflow = sizes;
  check(
    "animation-layout-overflow",
    sizes.scrollWidth <= sizes.clientWidth + 1,
    `Document width ${sizes.scrollWidth}px fits viewport ${sizes.clientWidth}px.`
  );
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

function check(name, ok, message) {
  addResult(name, ok ? "pass" : "fail", message);
}

function addTimingCheck(name, ok, message) {
  addResult(name, ok ? "pass" : "warn", message);
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
      `Animation performance smoke summary: ${report.summary.passed} passed, ${report.summary.warned} warnings, ${report.summary.failed} failed.`
    );
  }

  process.exitCode = report.summary.failed > 0 ? 1 : 0;
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
