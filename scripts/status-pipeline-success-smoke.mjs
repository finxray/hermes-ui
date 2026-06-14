#!/usr/bin/env node

import { chromium } from "playwright";
import { printSelectedBaseUrl, selectedBaseUrl } from "./smoke-base-url.mjs";

const args = parseArgs(process.argv.slice(2));
const baseUrl = selectedBaseUrl(args.baseUrl);
const timeoutMs = 15_000;
const staleSessionError =
  "Hermes chat stream did not open before the request timeout or was cancelled before streaming began.";
const streamedReply = "UI_STATUS_PIPELINE_OK streamed assistant response.";

printSelectedBaseUrl({ baseUrl, json: false, label: "Status pipeline success smoke" });

let browser;
let context;
let sessionDetailReads = 0;

try {
  browser = await chromium.launch({ headless: !args.headed });
  context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
  await context.addInitScript(() => {
    window.localStorage.clear();
  });
  const page = await context.newPage();

  await page.route("**/api/hermes/status", async (route) => {
    await route.fulfill({
      body: JSON.stringify(connectedHermesStatus()),
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
      body: JSON.stringify({
        checkedAt: new Date().toISOString(),
        error: null,
        models: [],
        ok: true,
        source: "openrouter"
      }),
      contentType: "application/json",
      status: 200
    });
  });

  await page.route("**/api/lmstudio/models", async (route) => {
    await route.fulfill({
      body: JSON.stringify({
        checkedAt: new Date().toISOString(),
        error: null,
        models: [],
        ok: true,
        source: "lmstudio"
      }),
      contentType: "application/json",
      status: 200
    });
  });

  await page.route("**/api/hermes/sessions/*", async (route) => {
    const url = new URL(route.request().url());
    if (/\/api\/hermes\/sessions\/[^/]+$/.test(url.pathname)) {
      sessionDetailReads += 1;
      await route.fulfill({
        body: JSON.stringify({
          error: { kind: "timeout", message: staleSessionError },
          ok: false,
          session: null,
          sessionId: decodeURIComponent(url.pathname.split("/").pop() || "")
        }),
        contentType: "application/json",
        status: 502
      });
      return;
    }
    await route.fallback();
  });

  await page.route("**/api/hermes/chat/stream", async (route) => {
    await route.fulfill({
      body: sse([
        {
          type: "message_delta",
          delta: "UI_STATUS_PIPELINE_OK streamed "
        },
        {
          type: "message_delta",
          delta: "assistant response."
        },
        {
          type: "message_done",
          message: { role: "assistant", content: streamedReply },
          runId: "run-status-pipeline-success",
          usage: {
            completionTokens: 12,
            promptTokens: 42,
            source: "provider",
            totalTokens: 54
          }
        }
      ]),
      contentType: "text/event-stream; charset=utf-8",
      headers: {
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
        "X-Hermes-Session-Id": "hermes-smoke-session"
      },
      status: 200
    });
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.getByLabel("Message", { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForFunction(
    (message) => document.body.innerText.includes(message),
    staleSessionError,
    { timeout: timeoutMs }
  );
  const readsBeforeSend = sessionDetailReads;

  const message = `UI_STATUS_PIPELINE_${Date.now()} please answer briefly.`;
  await page.getByLabel("Message", { exact: true }).fill(message, { timeout: timeoutMs });
  await page.waitForFunction(() => {
    const button = document.querySelector('button[aria-label="Send message"]');
    return button instanceof HTMLButtonElement && !button.disabled;
  }, null, { timeout: timeoutMs });
  await page.getByRole("button", { name: "Send message", exact: true }).click({ timeout: timeoutMs });
  await page.getByText(streamedReply, { exact: true }).waitFor({ state: "visible", timeout: timeoutMs });
  await page.waitForTimeout(500);

  const result = await page.evaluate((staleMessage) => {
    const text = document.body.innerText;
    return {
      hasAttention: text.includes("ATTENTION") || text.includes("attention"),
      hasServerDefaultCopy: text.includes("Using Hermes server default until the session model is verified."),
      hasStaleError: text.includes(staleMessage),
      hasStreamedReply: text.includes("UI_STATUS_PIPELINE_OK streamed assistant response."),
      statusExcerpt: excerptAround(text, "Session model pipeline", 600)
    };

    function excerptAround(value, needle, radius) {
      const index = value.indexOf(needle);
      if (index < 0) {
        return value.slice(0, radius);
      }
      return value.slice(Math.max(0, index - 80), index + radius);
    }
  }, staleSessionError);
  const readsAfterSend = sessionDetailReads;
  const diagnostic = JSON.stringify({ readsAfterSend, readsBeforeSend, result }, null, 2);

  assert(result.hasStreamedReply, `The mocked streamed assistant reply did not render.\n${diagnostic}`);
  assert(
    result.hasServerDefaultCopy,
    `The session pipeline did not settle to server-default verified-by-stream copy.\n${diagnostic}`
  );
  assert(!result.hasAttention, `The session pipeline still shows attention after a successful stream.\n${diagnostic}`);
  assert(!result.hasStaleError, `The stale stream-open timeout remained visible after a successful stream.\n${diagnostic}`);
  assert(
    readsAfterSend === readsBeforeSend,
    `Expected no immediate session-detail refresh after successful stream.\n${diagnostic}`
  );

  console.log(
    `Status pipeline success smoke passed: ${readsBeforeSend} pre-send session-detail read(s), ${readsAfterSend} after send.`
  );
} catch (error) {
  console.error(`Status pipeline success smoke failed: ${error instanceof Error ? error.message : String(error)}`);
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

function sse(events) {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function connectedHermesStatus() {
  const modelState = {
    availableModels: [],
    clientSelectable: false,
    currentModelLabel: "Hermes default",
    currentProviderLabel: "Hermes server config",
    explicitOverrideSupported: false,
    fastStreamProfile: "unknown",
    listAvailable: false,
    reason: "Mocked connected status for status pipeline smoke.",
    selectedModelId: null,
    selectionStatus: "server-configured",
    serverAdvertisedModel: null,
    serverConfiguredOnly: true,
    sessionModelOverrideCapable: false,
    uiState: "deferred"
  };

  return {
    baseUrl: "http://127.0.0.1:8642",
    capabilities: {
      chat: true,
      session_chat_streaming: true
    },
    checkedAt: new Date().toISOString(),
    configured: true,
    error: null,
    health: { ok: true },
    mode: "real",
    models: null,
    reachable: true,
    uiCapabilities: {
      approvals: {
        hermesAvailable: true,
        uiState: "deferred"
      },
      cancellation: {
        runStopEndpoint: true,
        streamAbortSupportedByUi: true,
        uiState: "available"
      },
      chat: {
        canSend: true,
        chatCompletions: true,
        chatCompletionsStreaming: true,
        responses: false,
        responsesStreaming: false,
        sessionChat: true,
        sessionStreaming: true
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
        sessionContinuityHeader: "X-Hermes-Session-Id",
        sessionKeyHeader: "X-Hermes-Session-Key"
      },
      models: modelState,
      runs: {
        eventsSse: true,
        reconnect: "available",
        status: true,
        submission: true
      },
      status: {
        configured: true,
        mode: "real",
        reachable: true
      },
      tools: {
        progressEvents: true,
        registry: true,
        skills: true,
        toolsets: true,
        uiState: "available"
      },
      ui: {
        canSendChat: true,
        canShowApprovals: true,
        canShowFiles: false,
        canShowProviderSelector: false,
        canShowToolActivity: true,
        stopControl: "available"
      }
    }
  };
}
