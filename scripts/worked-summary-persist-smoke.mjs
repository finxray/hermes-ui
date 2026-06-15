#!/usr/bin/env node

// Reproduces the "Worked for" activity summary vanishing the instant a real
// streamed run completes. Drives the full generating -> completed transition
// against the running web app by mocking the BFF status + chat stream (no real
// Hermes). The stream mimics the user's live scenario: a multi-request tool loop
// (3 upstream generations, matching their OpenRouter logs) that shows command
// activity while running and finishes with assistant text.
//
// Pass once the collapsed "Worked for <duration>" summary stays visible after
// the assistant reply lands. Also asserts the live token usage summed the three
// requests (regression guard for the token aggregation fix).

import { chromium } from "playwright";
import { printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 20_000;
const storageKey = "hermes-ui.workspace.v1";
const answerMarker = "ACK_WORKED_SMOKE";
const sendMarker = `WORKED_SMOKE_${Date.now()}`;

printSelectedBaseUrl({ baseUrl, json: false, label: "Worked summary persist smoke" });

let browser;
let context;

try {
  browser = await chromium.launch({ headless: !args.headed });
  context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
  await context.addInitScript(
    ({ key, state }) => {
      window.localStorage.setItem(key, JSON.stringify(state));
    },
    { key: storageKey, state: seededWorkspaceState() }
  );

  const page = await context.newPage();
  await routeMockBff(page);
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.getByText("Earlier assistant turn in this session.", { exact: true }).waitFor({
    state: "visible",
    timeout: timeoutMs
  });

  await page.getByLabel("Message", { exact: true }).fill(sendMarker, { timeout: timeoutMs });
  await page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="Send message"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout: timeoutMs });
  await page.getByRole("button", { name: "Send message", exact: true }).click({ timeout: timeoutMs });

  // Wait for the streamed answer to fully land (run completed).
  await page.getByText(answerMarker, { exact: false }).waitFor({ state: "visible", timeout: timeoutMs });

  // Give the finalize/cleanup state and the live token digit reel time to
  // settle, then snapshot the afterglow value.
  await page.waitForTimeout(2600);

  const snapshot = await page.evaluate((marker) => {
    const nodes = Array.from(
      document.querySelectorAll('[data-chat-message-id], [data-agent-activity-block="true"]')
    );
    const order = nodes.map((node, index) => {
      const isBlock = node instanceof HTMLElement && node.dataset.agentActivityBlock === "true";
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      return {
        index,
        type: isBlock ? "activity" : "message",
        id: node instanceof HTMLElement ? node.dataset.chatMessageId || null : null,
        role: node instanceof HTMLElement ? node.dataset.role || null : null,
        visible: node instanceof HTMLElement ? node.getClientRects().length > 0 : false,
        text: text.slice(0, 120),
        hasMarker: text.includes(marker),
        hasWorkedFor: /Worked for/i.test(text)
      };
    });

    const newAssistantIndex = order.findIndex(
      (item) => item.type === "message" && item.role === "assistant" && item.hasMarker
    );
    // The block that belongs to the new run is the activity block immediately
    // preceding the new assistant reply.
    let newRunBlock = null;
    for (let i = newAssistantIndex - 1; i >= 0; i -= 1) {
      if (order[i].type === "activity") {
        newRunBlock = order[i];
        break;
      }
      if (order[i].type === "message") {
        break; // hit the previous message without finding a block
      }
    }

    let runRecords = null;
    try {
      const raw = window.localStorage.getItem("hermes-ui.workspace.v1");
      const state = raw ? JSON.parse(raw) : null;
      const session = state?.sessions?.find((s) => s.id === "session-worked-smoke");
      runRecords = {
        messageIds: (session?.messages || []).map((m) => ({ id: m.id, role: m.role, content: (m.content || "").slice(0, 40) })),
        runs: (session?.runRecords || []).map((run) => ({
        id: run.id,
        status: run.status,
        completedAt: run.completedAt ?? null,
        assistantMessageId: run.assistantMessageId ?? null,
        userMessageId: run.userMessageId ?? null,
        activityEventIds: run.activityEventIds || [],
        activityReplayCount: (run.activityReplay || []).length,
        activityReplayTypes: (run.activityReplay || []).map((e) => e.type)
      }))
      };
    } catch (error) {
      runRecords = { error: String(error) };
    }

    const ticker = document.querySelector('[aria-label="Live token usage"]');
    const readKind = (kind) => {
      const metric = ticker ? ticker.querySelector(`[data-kind="${kind}"]`) : null;
      const spin = metric ? metric.querySelector("[aria-label]") : null;
      return spin ? spin.getAttribute("aria-label") : null;
    };
    const composerTicker = ticker ? { in: readKind("in"), out: readKind("out") } : null;

    return { order, newAssistantIndex, newRunBlock, runRecords, composerTicker };
  }, answerMarker);

  const diagnostic = JSON.stringify(snapshot, null, 2);
  assert(snapshot.newAssistantIndex >= 0, `New assistant reply not found.\n${diagnostic}`);
  assert(
    snapshot.newRunBlock !== null,
    `New run produced no activity block immediately above its reply (it vanished on completion).\n${diagnostic}`
  );
  assert(
    snapshot.newRunBlock.visible,
    `New run activity block is present but not visible after completion.\n${diagnostic}`
  );
  assert(
    snapshot.newRunBlock.hasWorkedFor,
    `New run activity block is missing the "Worked for" summary after completion.\n${diagnostic}`
  );

  // The completed block auto-collapses ~1s after the run ends, so by now it is
  // closed. Verify the chevron points right when closed and rotates 90deg (to
  // down) when opened.
  const readChevron = () =>
    page.evaluate(() => {
      const svg = document.querySelector('[data-agent-activity-block="true"] [data-open] button svg:last-of-type')
        || document.querySelector('[data-agent-activity-block="true"] button svg:last-of-type');
      if (!svg) {
        return { found: false };
      }
      const transform = getComputedStyle(svg).transform;
      // rotate(90deg) => matrix(0,1,-1,0,0,0); rotate(0) => none/identity.
      const rotated90 = /matrix\(\s*-?0(\.0+)?,\s*1,/.test(transform.replace(/\s+/g, ""));
      const identity = transform === "none" || /matrix\(1,0,0,1,/.test(transform.replace(/\s+/g, ""));
      return { found: true, transform, rotated90, identity };
    });

  const closedChevron = await readChevron();
  await page.click('[data-agent-activity-block="true"] button');
  await page.waitForTimeout(400);
  const openChevron = await readChevron();

  const chevronDiag = JSON.stringify({ closedChevron, openChevron }, null, 2);
  assert(closedChevron.found, `Worked chevron not found.\n${chevronDiag}`);
  assert(closedChevron.identity, `Worked chevron should point right (rotate 0deg) when closed.\n${chevronDiag}`);
  assert(openChevron.rotated90, `Worked chevron should rotate to point down (rotate 90deg) when open.\n${chevronDiag}`);

  // The composer live ticker (afterglow) must show the final summed totals
  // (88,659 in / 799 out, displayed compactly), not the next-to-last request's
  // running total.
  assert(snapshot.composerTicker, `Composer live token ticker not found after completion.\n${diagnostic}`);
  assert(
    snapshot.composerTicker.in === "88.7k",
    `Composer "in" should show the final summed total 88.7k, got ${snapshot.composerTicker.in}.\n${JSON.stringify(snapshot.composerTicker)}`
  );
  assert(
    snapshot.composerTicker.out === "799",
    `Composer "out" should show the final summed total 799, got ${snapshot.composerTicker.out}.\n${JSON.stringify(snapshot.composerTicker)}`
  );

  const newAssistant = snapshot.order[snapshot.newAssistantIndex];
  console.log("Worked summary persist smoke passed.");
  console.log(JSON.stringify({
    newRunBlock: snapshot.newRunBlock,
    composerTicker: snapshot.composerTicker,
    messageFooter: newAssistant && newAssistant.text,
    closedChevron,
    openChevron
  }, null, 2));
} catch (error) {
  console.error(`Worked summary persist smoke failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (context) {
    await context.close();
  }
  if (browser) {
    await browser.close();
  }
}

function parseArgs(values) {
  const parsed = { baseUrl: "", headed: false };
  for (let index = 0; index < values.length; index += 1) {
    const arg = values[index];
    if (arg === "--headed") {
      parsed.headed = true;
    } else if (arg === "--base-url") {
      parsed.baseUrl = values[index + 1] || "";
      index += 1;
    } else if (arg.startsWith("--base-url=")) {
      parsed.baseUrl = arg.slice("--base-url=".length);
    }
  }
  return parsed;
}

async function routeMockBff(page) {
  await page.route("**/api/hermes/status", async (route) => {
    await route.fulfill({
      body: JSON.stringify(reachableHermesStatus()),
      contentType: "application/json",
      status: 200
    });
  });
  await page.route("**/api/brain-memory/status", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        baseUrl: null,
        capabilities: null,
        checkedAt: new Date().toISOString(),
        configured: false,
        error: null,
        health: null,
        mode: "mock",
        reachable: false
      }),
      contentType: "application/json",
      status: 200
    });
  });
  await page.route("**/api/model-catalog/openrouter", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ checkedAt: new Date().toISOString(), error: null, models: [], ok: true, source: "openrouter" }),
      contentType: "application/json",
      status: 200
    });
  });
  await page.route("**/api/model-catalog/lmstudio", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ checkedAt: new Date().toISOString(), error: null, models: [], ok: true, source: "lmstudio" }),
      contentType: "application/json",
      status: 200
    });
  });
  await page.route("**/api/lmstudio/models", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ checkedAt: new Date().toISOString(), error: null, models: [], ok: true, source: "lmstudio" }),
      contentType: "application/json",
      status: 200
    });
  });
  await page.route("**/api/hermes/chat/stream", async (route) => {
    await route.fulfill({
      body: streamedChatBody(),
      contentType: "text/event-stream; charset=utf-8",
      headers: { "Cache-Control": "no-store", "X-Hermes-Session-Id": "hermes-session-worked-smoke" },
      status: 200
    });
  });
}

function frame(event) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function streamedChatBody() {
  // Three upstream generations (tool loop) then the final answer, matching the
  // user's OpenRouter logs (3 requests, distinct request ids).
  return [
    frame({ type: "run_event", name: "message.started", status: "running", payload: { event: "message.started" } }),
    frame({ type: "tool_event", name: "memory_search", status: "completed", payload: { query: "model identity", project_key: "p", session_key: "s" } }),
    frame({ type: "message_done", message: { role: "assistant", content: "" }, messageId: "m1", runId: "r1", usage: { promptTokens: 29041, completionTokens: 493, source: "provider", requestId: "req-1" } }),
    frame({ type: "tool_event", name: "run_command", status: "completed", payload: { command: "uname -a", cwd: "/repo", exitCode: 0, stdout: "Linux" } }),
    frame({ type: "message_done", message: { role: "assistant", content: "" }, messageId: "m1", runId: "r1", usage: { promptTokens: 29797, completionTokens: 24, source: "provider", requestId: "req-2" } }),
    frame({ type: "message_delta", delta: "I am Kimi K2.6 via OpenRouter. ", messageId: "m1", runId: "r1" }),
    frame({ type: "message_delta", delta: answerMarker, messageId: "m1", runId: "r1" }),
    frame({ type: "message_done", message: { role: "assistant", content: `I am Kimi K2.6 via OpenRouter. ${answerMarker}` }, messageId: "m1", runId: "r1", usage: { promptTokens: 29821, completionTokens: 282, source: "provider", requestId: "req-3" } }),
    frame({ type: "done" })
  ].join("");
}

function seededWorkspaceState() {
  const now = new Date().toISOString();
  const oldStart = new Date(Date.now() - 120_000).toISOString();
  const oldEnd = new Date(Date.now() - 100_000).toISOString();
  const projectId = "project-worked-smoke";
  const sessionId = "session-worked-smoke";
  return {
    version: 1,
    activeProjectId: projectId,
    activeSessionId: sessionId,
    connectionStatus: { brainMemory: "Mock", hermes: "Real" },
    modelChoices: [],
    projects: [
      {
        createdAt: oldStart,
        description: "Worked summary persistence smoke.",
        icon: "folder",
        id: projectId,
        memoryScope: {
          contextPolicy: "balanced",
          pinnedMemoryIds: [],
          projectId,
          retrievalProfile: "balanced",
          stableProjectKey: "studio:local-dev:project:project-worked-smoke",
          tenantId: "local-dev",
          userVisibleSummary: "Worked smoke project."
        },
        memoryScopeKey: "studio:local-dev:project:project-worked-smoke",
        name: "Worked Summary Smoke",
        updatedAt: now
      }
    ],
    sessions: [
      {
        artifacts: [],
        createdAt: oldStart,
        hermesSessionId: "hermes-session-worked-smoke",
        id: sessionId,
        memoryEvidence: [],
        memoryScope: {
          includeProjectContext: true,
          includeSessionContext: true,
          projectId,
          sessionId,
          stableSessionKey: "studio:local-dev:project:project-worked-smoke:session:session-worked-smoke",
          tenantId: "local-dev",
          userVisibleSummary: "Worked smoke session."
        },
        messages: [
          {
            author: "You",
            content: "previous user turn",
            createdAt: "07:10 PM",
            id: "msg-worked-old-user",
            role: "user",
            status: "complete"
          },
          {
            author: "Hermes",
            content: "Earlier assistant turn in this session.",
            createdAt: "07:11 PM",
            id: "msg-worked-old-assistant",
            role: "assistant",
            status: "complete",
            usage: { completionTokens: 80, promptTokens: 12000, source: "provider" }
          }
        ],
        projectId,
        runRecords: [
          {
            activityEventIds: ["elapsed-worked-old-run"],
            activityReplay: [
              {
                collapsedByDefault: true,
                completedAt: oldEnd,
                durationMs: 20_000,
                id: "elapsed-worked-old-run",
                metadata: { tokenUsage: { completionTokens: 80, promptTokens: 12000, source: "provider" } },
                runId: "run-worked-old",
                source: "ui",
                sourceChannel: "web-ui",
                startedAt: oldStart,
                status: "info",
                title: "Worked for 20s",
                type: "elapsed"
              }
            ],
            activitySummary: { approvalCount: 0, commandCount: 0, errorCount: 0, memoryCount: 0, toolCount: 0 },
            assistantMessageId: "msg-worked-old-assistant",
            completedAt: oldEnd,
            durationMs: 20_000,
            hermesSessionId: "hermes-session-worked-smoke",
            id: "run-worked-old",
            modelLabel: "Kimi K2.6",
            projectId,
            providerLabel: "OpenRouter",
            sessionId,
            sourceChannel: "web-ui",
            startedAt: oldStart,
            status: "completed",
            summary: "Earlier completed run.",
            userMessageId: "msg-worked-old-user"
          }
        ],
        summary: "Worked summary smoke.",
        title: "Worked summary smoke",
        titleSource: "manual",
        toolEvents: [],
        updatedAt: now
      }
    ]
  };
}

function reachableHermesStatus() {
  return {
    baseUrl: "http://127.0.0.1:8642",
    capabilities: null,
    checkedAt: new Date().toISOString(),
    configured: true,
    error: null,
    health: { status: "ok" },
    mode: "real",
    models: null,
    reachable: true,
    uiCapabilities: {
      approvals: { hermesAvailable: false, uiState: "deferred" },
      cancellation: { runStopEndpoint: true, streamAbortSupportedByUi: true, uiState: "available" },
      chat: {
        canSend: true,
        chatCompletions: true,
        chatCompletionsStreaming: true,
        responses: true,
        responsesStreaming: true,
        sessionChat: true,
        sessionStreaming: true
      },
      files: { artifacts: "deferred", uiState: "deferred", uploadSupported: false },
      memory: {
        instructionBridgeActive: true,
        memoryWriteApi: false,
        metadataContextPropagation: "unknown",
        sessionContinuityHeader: null,
        sessionKeyHeader: null
      },
      models: {
        availableModels: [{ id: "kimi-k2.6", label: "Kimi K2.6", provider: "openrouter" }],
        clientSelectable: true,
        currentModelLabel: "Kimi K2.6",
        currentProviderLabel: "OpenRouter",
        explicitOverrideSupported: true,
        fastStreamProfile: "unknown",
        listAvailable: true,
        reason: null,
        selectedModelId: "kimi-k2.6",
        selectionStatus: "available",
        serverAdvertisedModel: "kimi-k2.6",
        serverConfiguredOnly: false,
        sessionModelOverrideCapable: true,
        uiState: "available"
      },
      runs: { eventsSse: true, reconnect: "available", status: true, submission: true },
      status: { configured: true, mode: "real", reachable: true },
      tools: { progressEvents: true, registry: true, skills: false, toolsets: true, uiState: "available" },
      ui: {
        canSendChat: true,
        canShowApprovals: false,
        canShowFiles: false,
        canShowProviderSelector: true,
        canShowToolActivity: true,
        stopControl: "session"
      }
    }
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
