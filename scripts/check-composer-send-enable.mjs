#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function expect(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

const composerPath = "apps/web/src/components/chat/Composer.tsx";
const chatViewPath = "apps/web/src/components/chat/ChatView.tsx";
const composerCssPath = "apps/web/src/components/chat/Composer.module.css";

if (!existsSync(join(root, composerPath))) {
  failures.push(`Missing ${composerPath}`);
}

const composer = read(composerPath);
const chatView = read(chatViewPath);
const composerCss = read(composerCssPath);

expect(composer.includes('const [draft, setDraft] = useState("")'), "Composer keeps local draft state.");
expect(composer.includes("function updateDraft(value: string)"), "Composer centralizes draft updates.");
expect(composer.includes("onChange={(event) => updateDraft(event.currentTarget.value)}"), "Composer textarea onChange updates draft.");
expect(composer.includes("onInput={(event) => updateDraft(event.currentTarget.value)}"), "Composer textarea onInput mirrors draft for native typing.");
expect(composer.includes("draft.trim().length > 0"), "Composer send enablement uses trimmed draft length.");
expect(composer.includes("canSend ? styles.ready :"), "Composer send button applies ready styling from canSend.");
expect(composer.includes('data-ready={canSend ? "true" : "false"}'), "Composer send button exposes data-ready for styling.");
expect(
  composer.includes("disabled={isGenerating ? disabled || isStopRequested : !canSend}"),
  "Composer send disabled state is tied to canSend while idle."
);
expect(composer.includes('type={isGenerating ? "button" : "submit"}'), "Composer uses submit type when idle.");
expect(chatView.includes("disabled={!activeSession}"), "ChatView only disables composer without an active session.");
expect(!chatView.includes("disabled={!canUseRealHermes"), "ChatView must not disable composer from Hermes reachability.");
expect(composerCss.includes(".sendButton[data-ready=\"true\"]"), "Send button ready styles use data-ready attribute.");
expect(
  composerCss.includes(".sendButton:disabled:not(.stopButton)") || composerCss.includes('[data-ready="false"]'),
  "Disabled send styling remains scoped."
);

if (process.env.HERMES_UI_COMPOSER_SEND_PROBE === "1") {
  try {
    const { chromium } = await import("playwright");
    const baseUrl = process.env.HERMES_UI_BASE_URL || "http://localhost:3000";
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${baseUrl}/`, { waitUntil: "load", timeout: 15000 });

    const chatRow = page.locator('section[aria-labelledby="chats-heading"] button:not([disabled])').first();
    if ((await chatRow.count()) > 0) {
      await chatRow.click();
    }

    const textarea = page.getByLabel("Message", { exact: true });
    await textarea.click();
    await page.keyboard.type("enable send check", { delay: 20 });

    const sendButton = page.getByRole("button", { name: "Send message", exact: true });
    await page.waitForFunction(() => {
      const button = document.querySelector('button[aria-label="Send message"]');
      return button instanceof HTMLButtonElement && !button.disabled;
    });

    const probe = await sendButton.evaluate((button) => {
      const textareaEl = document.querySelector('textarea[aria-label="Message"]');
      const box = button.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return {
        dataReady: button.getAttribute("data-ready"),
        disabled: button.disabled,
        draft: textareaEl instanceof HTMLTextAreaElement ? textareaEl.value : "",
        hitAria: hit instanceof HTMLElement ? hit.getAttribute("aria-label") : null,
        hitTag: hit instanceof HTMLElement ? hit.tagName : null
      };
    });

    expect(probe.draft.trim().length > 0, "Browser textarea value is non-empty after keyboard typing.");
    expect(!probe.disabled, "Send button is enabled after keyboard typing.");
    expect(probe.dataReady === "true", `Send button data-ready is true (saw ${probe.dataReady}).`);
    expect(
      probe.hitAria === "Send message" || probe.hitTag === "BUTTON",
      `Send button receives pointer hits (hit ${probe.hitTag} ${probe.hitAria ?? ""}).`
    );

    await browser.close();
  } catch (error) {
    failures.push(`Playwright composer probe failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error("Composer send-enable checks failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Composer send-enable checks passed.");
