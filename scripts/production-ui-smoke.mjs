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
  page.on("pageerror", (error) => browserErrors.push(`page: ${error.message}`));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByRole("navigation", { name: "Workspace sections" }).waitFor();

  check((await page.title()) === "Stoix", "document title is Stoix");
  const faviconHref = await page.locator('link[rel="icon"]').first().getAttribute("href");
  check(Boolean(faviconHref?.includes("stoix-helmet")), "Stoix helmet favicon is configured");
  if (faviconHref) await assertHttpOk(new URL(faviconHref, baseUrl), "Stoix favicon");
  check(await page.getByRole("form", { name: "Message composer" }).isVisible(), "workspace composer is visible");
  check(!(await page.locator("body").innerText()).includes("Brain Memory"), "core workspace has no Brain Memory UI");
  await checkOverflow(page, "workspace desktop");

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
