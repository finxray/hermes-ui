#!/usr/bin/env node

import { chromium } from "playwright";
import { printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 15_000;
const storageKey = "hermes-ui.workspace.v1";
const oldAssistantId = "msg-order-old-assistant";
const oldUserId = "msg-order-old-user";
const newMessageMarker = `ORDER_ANCHOR_SMOKE_${Date.now()}`;
const fallbackText = "Hermes is currently unreachable. Your message stayed in this local session; retry after the status panel reports connected.";

printSelectedBaseUrl({ baseUrl, json: false, label: "Activity anchor order smoke" });

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
  await page.getByText("Old assistant response before the next user turn.", { exact: true }).waitFor({
    state: "visible",
    timeout: timeoutMs
  });

  await page.getByLabel("Message", { exact: true }).fill(newMessageMarker, { timeout: timeoutMs });
  await page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="Send message"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout: timeoutMs });
  await page.getByRole("button", { name: "Send message", exact: true }).click({ timeout: timeoutMs });
  await page.getByText(fallbackText, { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });

  const order = await page.evaluate(({ marker, oldAssistantId, oldUserId }) => {
    const nodes = Array.from(
      document.querySelectorAll('[data-chat-message-id], [data-agent-activity-block="true"]')
    );
    return nodes.map((node, index) => ({
      hasMarker: (node.textContent || "").includes(marker),
      id: node instanceof HTMLElement ? node.dataset.chatMessageId || null : null,
      index,
      role: node instanceof HTMLElement ? node.dataset.role || null : null,
      text: (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 160),
      type: node instanceof HTMLElement && node.dataset.agentActivityBlock === "true"
        ? "activity"
        : "message"
    })).map((item) => ({
      ...item,
      isOldAssistant: item.id === oldAssistantId,
      isOldUser: item.id === oldUserId,
      isNewFallback: item.type === "message" && item.role === "assistant" && item.text.includes("Hermes is currently unreachable")
    }));
  }, { marker: newMessageMarker, oldAssistantId, oldUserId });

  const activityIndex = order.findIndex((item) => item.type === "activity");
  const oldAssistantIndex = order.findIndex((item) => item.isOldAssistant);
  const newUserIndex = order.findIndex((item) => item.hasMarker);
  const newFallbackIndex = order.findIndex((item) => item.isNewFallback);

  const diagnostic = JSON.stringify(order, null, 2);
  assert(activityIndex >= 0, `Expected one old activity block.\n${diagnostic}`);
  assert(oldAssistantIndex >= 0, `Expected old assistant message.\n${diagnostic}`);
  assert(newUserIndex >= 0, `Expected new user message.\n${diagnostic}`);
  assert(newFallbackIndex >= 0, `Expected new unavailable fallback assistant message.\n${diagnostic}`);
  assert(
    activityIndex < oldAssistantIndex,
    `Old activity block should be anchored before the old assistant.\n${diagnostic}`
  );
  assert(
    !(activityIndex > newUserIndex && activityIndex < newFallbackIndex),
    `Old activity block must not appear between the new user message and its fallback reply.\n${diagnostic}`
  );
  assert(
    newUserIndex < newFallbackIndex,
    `New fallback reply should appear directly after the new user turn, not above it.\n${diagnostic}`
  );

  console.log("Activity anchor order smoke passed.");
} catch (error) {
  console.error(`Activity anchor order smoke failed: ${error instanceof Error ? error.message : String(error)}`);
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
  const parsed = {
    baseUrl: "",
    headed: false
  };

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
      body: JSON.stringify(unreachableHermesStatus()),
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
  await page.route("**/api/lmstudio/models", async (route) => {
    await route.fulfill({
      body: JSON.stringify({ checkedAt: new Date().toISOString(), error: null, models: [], ok: true, source: "lmstudio" }),
      contentType: "application/json",
      status: 200
    });
  });
}

function seededWorkspaceState() {
  const now = new Date().toISOString();
  const oldStart = new Date(Date.now() - 80_000).toISOString();
  const oldEnd = new Date(Date.now() - 56_000).toISOString();
  const projectId = "project-order-anchor-smoke";
  const sessionId = "session-order-anchor-smoke";
  return {
    version: 1,
    activeProjectId: projectId,
    activeSessionId: sessionId,
    connectionStatus: {
      brainMemory: "Mock",
      hermes: "Mock"
    },
    modelChoices: [],
    projects: [
      {
        createdAt: oldStart,
        description: "Ordering regression smoke project.",
        icon: "folder",
        id: projectId,
        memoryScope: {
          contextPolicy: "balanced",
          pinnedMemoryIds: [],
          projectId,
          retrievalProfile: "balanced",
          stableProjectKey: "studio:local-dev:project:project-order-anchor-smoke",
          tenantId: "local-dev",
          userVisibleSummary: "Ordering smoke project."
        },
        memoryScopeKey: "studio:local-dev:project:project-order-anchor-smoke",
        name: "Order Anchor Smoke",
        updatedAt: now
      }
    ],
    sessions: [
      {
        artifacts: [],
        createdAt: oldStart,
        hermesSessionId: "hermes-session-order-anchor-smoke",
        id: sessionId,
        memoryEvidence: [],
        memoryScope: {
          includeProjectContext: true,
          includeSessionContext: true,
          projectId,
          sessionId,
          stableSessionKey: "studio:local-dev:project:project-order-anchor-smoke:session:session-order-anchor-smoke",
          tenantId: "local-dev",
          userVisibleSummary: "Ordering smoke session."
        },
        messages: [
          {
            author: "You",
            content: "old user turn",
            createdAt: "07:10 PM",
            id: oldUserId,
            role: "user",
            status: "complete"
          },
          {
            author: "Hermes",
            content: "Old assistant response before the next user turn.",
            createdAt: "07:11 PM",
            id: oldAssistantId,
            role: "assistant",
            status: "complete",
            usage: {
              completionTokens: 118,
              promptTokens: 19330,
              source: "provider"
            }
          }
        ],
        projectId,
        runRecords: [
          {
            activityEventIds: ["elapsed-old-run"],
            activityReplay: [
              {
                collapsedByDefault: true,
                completedAt: oldEnd,
                durationMs: 24_000,
                id: "elapsed-old-run",
                metadata: {
                  tokenUsage: {
                    completionTokens: 118,
                    promptTokens: 19330,
                    source: "provider"
                  }
                },
                runId: "run-old-order-anchor",
                source: "ui",
                sourceChannel: "web-ui",
                startedAt: oldStart,
                status: "info",
                title: "Worked for 24s",
                type: "elapsed"
              }
            ],
            activitySummary: {
              approvalCount: 0,
              commandCount: 0,
              errorCount: 0,
              memoryCount: 0,
              toolCount: 0
            },
            assistantMessageId: oldAssistantId,
            completedAt: oldEnd,
            durationMs: 24_000,
            hermesSessionId: "hermes-session-order-anchor-smoke",
            id: "run-old-order-anchor",
            modelLabel: "Hermes default",
            projectId,
            providerLabel: "Hermes server config",
            sessionId,
            sourceChannel: "web-ui",
            startedAt: oldStart,
            status: "completed",
            summary: "Old completed run.",
            userMessageId: oldUserId
          }
        ],
        summary: "Activity ordering smoke.",
        title: "Activity order smoke",
        titleSource: "manual",
        toolEvents: [],
        updatedAt: now
      }
    ]
  };
}

function unreachableHermesStatus() {
  return {
    baseUrl: "http://127.0.0.1:8642",
    capabilities: null,
    checkedAt: new Date().toISOString(),
    configured: true,
    error: {
      kind: "timeout",
      message: "Timed out while checking Hermes status."
    },
    health: null,
    mode: "error",
    models: null,
    reachable: false,
    uiCapabilities: {
      approvals: {
        hermesAvailable: false,
        uiState: "unavailable"
      },
      cancellation: {
        runStopEndpoint: false,
        streamAbortSupportedByUi: true,
        uiState: "unavailable"
      },
      chat: {
        canSend: false,
        chatCompletions: false,
        chatCompletionsStreaming: false,
        responses: false,
        responsesStreaming: false,
        sessionChat: false,
        sessionStreaming: false
      },
      files: {
        artifacts: "deferred",
        uiState: "deferred",
        uploadSupported: false
      },
      memory: {
        instructionBridgeActive: true,
        memoryWriteApi: false,
        metadataContextPropagation: "unknown",
        sessionContinuityHeader: null,
        sessionKeyHeader: null
      },
      models: {
        availableModels: [],
        clientSelectable: false,
        currentModelLabel: "Hermes unavailable",
        currentProviderLabel: "Hermes server config",
        explicitOverrideSupported: false,
        fastStreamProfile: "unknown",
        listAvailable: false,
        reason: "Hermes is unreachable.",
        selectedModelId: null,
        selectionStatus: "unavailable",
        serverAdvertisedModel: null,
        serverConfiguredOnly: true,
        sessionModelOverrideCapable: false,
        uiState: "unavailable"
      },
      runs: {
        eventsSse: false,
        reconnect: "unavailable",
        status: false,
        submission: false
      },
      status: {
        configured: true,
        mode: "error",
        reachable: false
      },
      tools: {
        progressEvents: false,
        registry: false,
        skills: false,
        toolsets: false,
        uiState: "unavailable"
      },
      ui: {
        canSendChat: false,
        canShowApprovals: false,
        canShowFiles: false,
        canShowProviderSelector: false,
        canShowToolActivity: false,
        stopControl: "unavailable"
      }
    }
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
