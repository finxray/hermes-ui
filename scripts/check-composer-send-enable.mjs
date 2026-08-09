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
expect(composer.includes("textareaRef"), "Composer reads draft from textarea ref as well as state.");
expect(composer.includes("function getTrimmedDraft"), "Composer resolves trimmed draft from DOM/state.");
expect(composer.includes("function updateDraft(value: string)"), "Composer centralizes draft updates.");
expect(composer.includes("draftStorageKey"), "Composer accepts a scoped draft storage key.");
expect(composer.includes("readComposerDraft") && composer.includes("writeComposerDraft"), "Composer persists unsent draft text.");
expect(composer.includes("clearComposerDraft"), "Composer clears persisted draft text after send.");
expect(composer.includes("onChange={(event) => handleDraftInput(event.currentTarget.value)}"), "Composer textarea onChange updates draft safely around voice input.");
expect(composer.includes("onInput={(event) => handleDraftInput(event.currentTarget.value)}"), "Composer textarea onInput mirrors draft safely around voice input.");
expect(
  composer.includes("function handleDraftInput(value: string)") && composer.includes("cancelVoiceInput();"),
  "Manual typing cancels active voice recognition before updating the draft."
);
expect(
  composer.includes("getTrimmedDraft(textareaRef.current, draft).length > 0"),
  "Composer send enablement uses trimmed draft length from DOM/state."
);
expect(composer.includes("canSend ? styles.ready :"), "Composer send button applies ready styling from canSend.");
expect(composer.includes('data-ready={canSend ? "true" : "false"}'), "Composer send button exposes data-ready for styling.");
expect(
  composer.includes("disabled={willQueue ? false : isGenerating ? disabled || isStopRequested : !canSend}"),
  "Composer action stays enabled for valid queued follow-ups and uses canSend while idle."
);
expect(
  composer.includes('type={willQueue ? "submit" : isGenerating ? "button" : "submit"}'),
  "Composer submits idle and queued messages while keeping the empty-draft generation action as a button."
);
expect(
  composer.includes('event.key === "Escape" && isGenerating') &&
    composer.includes('aria-keyshortcuts={isGenerating ? "Escape" : undefined}'),
  "Composer keeps stop generation keyboard-accessible while follow-up queueing is available."
);
expect(composer.includes("function focusComposerInput"), "Composer restores input focus after send.");
expect(composer.includes("disabled={disabled}") && !composer.includes("disabled={disabled || isGenerating}"), "Composer textarea stays editable while a response is generating.");
expect(chatView.includes("disabled={!activeSession}"), "ChatView only disables composer without an active session.");
expect(chatView.includes("composerDraftStorageKey"), "ChatView scopes composer draft persistence by active pane/session.");
expect(chatView.includes("LIVE_TOKEN_AFTERGLOW_MS = 15_000"), "ChatView keeps live token usage visible briefly after completion.");
expect(
  composer.includes("LiveTokenUsageTicker") && composer.includes("liveTokenUsage"),
  "Composer renders live token usage inline with the model control."
);
expect(
  chatView.includes("liveTokenUsage={visibleLiveTokenUsage}"),
  "ChatView passes visible live token usage into the composer."
);
expect(
  chatView.includes('usage.source === "estimated"') &&
    chatView.includes('normalized.source === "estimated"'),
  "ChatView rejects estimated usage before live display and run aggregation."
);
expect(
  !chatView.includes("LIVE_TOKEN_ESTIMATE_INTERVAL_MS") &&
    !chatView.includes("syncEstimatedLiveTokenUsage") &&
    !chatView.includes("estimatePromptTokensForRequest"),
  "ChatView never starts a client-side token estimate before Hermes reports usage."
);
expect(
  chatView.includes("setLiveTokenUsage(null);\n    setVisibleLiveTokenUsage(null);"),
  "A new run clears prior afterglow usage until Hermes reports usage for that run."
);
expect(
  composerCss.includes("width: 97%;") &&
    composerCss.includes("margin: 0 auto -12px;") &&
    composerCss.includes("padding: 4.5px 12px 16.5px;"),
  "Queued follow-ups use the compact inset card above the composer."
);
expect(
  composer.includes("onSteerQueuedMessage?.(message.id)") &&
    chatView.includes("function steerQueuedTurn(id: string)") &&
    chatView.includes("prioritizeQueuedTurn(id);") &&
    chatView.includes("handleStop();"),
  "Steer promotes the queued follow-up and interrupts the active stream so it runs next."
);
expect(
  composer.includes('role="menu"') &&
    composer.includes("Send next") &&
    composer.includes("Move to end") &&
    composer.includes("runQueueAction(onRemoveQueuedMessage"),
  "Queued follow-up overflow opens a functional action menu."
);
expect(
  composerCss.includes(".followUpQueue + .box") &&
    composerCss.includes("box-shadow: 0 -16px 34px rgba(0, 0, 0, 0.18);"),
  "The composer casts its follow-up shadow upward."
);
expect(!chatView.includes("liveTokenDock"), "Live token usage must not render in a separate dock above the composer.");
expect(!chatView.includes("disabled={!canUseRealHermes"), "ChatView must not disable composer from Hermes reachability.");
expect(
  composerCss.includes('.sendButton[data-ready="true"]:not(:disabled)'),
  "Send button ready styles use data-ready when enabled."
);
expect(
  composerCss.includes(".sendButton:disabled:not(.stopButton)") || composerCss.includes('[data-ready="false"]'),
  "Disabled send styling remains scoped."
);
expect(
  composer.includes("<Mic size={17.16}") &&
    composerCss.includes(".toolButton.micButton svg") &&
    composerCss.includes("width: 17.16px") &&
    composerCss.includes("height: 17.16px"),
  "Composer microphone keeps its requested 17.16px size without a CSS override changing it."
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
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const stack = document.elementsFromPoint(cx, cy);
      const hitsSend =
        stack.includes(button) ||
        stack.some(
          (node) => node instanceof HTMLElement && node.closest('button[aria-label="Send message"]') === button
        );
      return {
        dataReady: button.getAttribute("data-ready"),
        disabled: button.disabled,
        draft: textareaEl instanceof HTMLTextAreaElement ? textareaEl.value : "",
        hitsSend
      };
    });

    expect(probe.draft.trim().length > 0, "Browser textarea value is non-empty after keyboard typing.");
    expect(!probe.disabled, "Send button is enabled after keyboard typing.");
    expect(probe.dataReady === "true", `Send button data-ready is true (saw ${probe.dataReady}).`);
    expect(probe.hitsSend, "Send button receives pointer hits through icon or button surface.");

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
