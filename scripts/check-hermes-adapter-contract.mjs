#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const compatibilityUrl = pathToFileURL(
  resolve(root, "packages/hermes-client/src/compatibility.ts")
).href;
const {
  isLocalLmStudioProvider,
  sessionTokenUsageDelta,
  shouldSuppressHermesStreamError
} = await import(compatibilityUrl);
const {
  getHermesSessionMessages,
  getHermesStatus,
  listHermesPlugins,
  normalizeHermesSseEvent,
  streamHermesSessionChat
} = await import(
  pathToFileURL(resolve(root, "packages/hermes-client/src/index.ts")).href
);

const model = "google/gemma-4-26b-a4b";
const provider = "local-lmstudio";
const exactAliasMismatch = {
  message:
    `confirmed model lock runtime mismatch: expected provider=${provider} model=${model}; ` +
    `actual provider=custom model=${model}`
};

assert.equal(isLocalLmStudioProvider("lmstudio"), true);
assert.equal(isLocalLmStudioProvider("local-lmstudio"), true);
assert.equal(isLocalLmStudioProvider("custom:local-lmstudio-main"), true);
assert.equal(isLocalLmStudioProvider("openrouter"), false);

assert.deepEqual(
  sessionTokenUsageDelta(
    {
      promptTokens: 1200,
      completionTokens: 80,
      cachedTokens: 20,
      reasoningTokens: 5,
      costUsd: 0
    },
    {
      promptTokens: 19789,
      completionTokens: 91,
      cachedTokens: 20,
      reasoningTokens: 6,
      costUsd: 0
    }
  ),
  {
    promptTokens: 18589,
    completionTokens: 11,
    totalTokens: 18600,
    cachedTokens: 0,
    reasoningTokens: 1,
    costUsd: 0,
    source: "hermes_usage"
  },
  "missing local stream usage is recovered from the Hermes session counter delta"
);
assert.equal(
  sessionTokenUsageDelta(
    { promptTokens: 100, completionTokens: 20 },
    { promptTokens: 90, completionTokens: 10 }
  ),
  undefined,
  "session counter resets are not presented as turn usage"
);

assert.equal(
  shouldSuppressHermesStreamError({
    compatibility: { model, provider },
    eventName: "error",
    hasAssistantText: true,
    payload: exactAliasMismatch
  }),
  true,
  "the exact Hermes local-provider alias mismatch is compatible after assistant output"
);

for (const testCase of [
  {
    label: "never suppress before assistant output",
    args: {
      compatibility: { model, provider },
      eventName: "error",
      hasAssistantText: false,
      payload: exactAliasMismatch
    }
  },
  {
    label: "never suppress a different model",
    args: {
      compatibility: { model, provider },
      eventName: "error",
      hasAssistantText: true,
      payload: {
        message:
          `confirmed model lock runtime mismatch: expected provider=${provider} model=${model}; ` +
          "actual provider=custom model=another-model"
      }
    }
  },
  {
    label: "never suppress a different provider family",
    args: {
      compatibility: { model, provider: "openrouter" },
      eventName: "error",
      hasAssistantText: true,
      payload: {
        message:
          `confirmed model lock runtime mismatch: expected provider=openrouter model=${model}; ` +
          `actual provider=custom model=${model}`
      }
    }
  },
  {
    label: "never suppress unrelated Hermes errors",
    args: {
      compatibility: { model, provider },
      eventName: "error",
      hasAssistantText: true,
      payload: { message: "The selected model is unavailable." }
    }
  },
  {
    label: "never suppress non-error events",
    args: {
      compatibility: { model, provider },
      eventName: "assistant.completed",
      hasAssistantText: true,
      payload: exactAliasMismatch
    }
  }
]) {
  assert.equal(shouldSuppressHermesStreamError(testCase.args), false, testCase.label);
}

const clientSource = readFileSync(
  resolve(root, "packages/hermes-client/src/index.ts"),
  "utf8"
);
const streamFunction = clientSource.slice(
  clientSource.indexOf("export async function streamHermesSessionChat"),
  clientSource.indexOf("export function isPlaceholderHermesModelId")
);
const streamRoutingFields = streamFunction.slice(
  streamFunction.indexOf("body: JSON.stringify"),
  streamFunction.indexOf("metadata:")
);

assert.ok(
  streamFunction.indexOf("await selectHermesModel") <
    streamFunction.indexOf("/chat/stream"),
  "the selected route must be confirmed before a chat stream starts"
);
assert.equal(
  /\n\s*model:\s*runtimeModelId/.test(streamRoutingFields),
  false,
  "the stream request must not override the verified session model route"
);
assert.equal(
  /\n\s*provider:\s*request\.provider/.test(streamRoutingFields),
  false,
  "the stream request must not override the verified session provider route"
);
assert.ok(
  streamFunction.includes("requested_model: runtimeModelId ?? null") &&
    streamFunction.includes("requested_provider: request.provider ?? null"),
  "requested route metadata must remain available for diagnostics"
);
assert.ok(
  streamFunction.includes("const sessionUsageBaseline = recoverSessionUsage") &&
    streamFunction.includes("sessionTokenUsageDelta(") &&
    clientSource.includes("!streamState.hasAuthoritativePromptUsage") &&
    clientSource.includes("!streamState.hasAuthoritativeCompletionUsage"),
  "local session counters must fill only a missing provider usage event"
);

assert.deepEqual(
  normalizeHermesSseEvent("assistant.delta", {
    delta: "Hello",
    future_field: { may_be_added_by_hermes: true },
    message_id: "message-1",
    run_id: "run-1"
  }),
  {
    type: "message_delta",
    delta: "Hello",
    messageId: "message-1",
    runId: "run-1"
  },
  "new fields on known Hermes events must not change normalized behavior"
);
assert.equal(
  normalizeHermesSseEvent("response.output_text.delta", { delta: " however" })?.delta,
  " however",
  "response text deltas must preserve leading spaces"
);
assert.equal(
  normalizeHermesSseEvent("message", {
    type: "response.output_text.delta",
    delta: " between"
  })?.delta,
  " between",
  "nested OpenAI-compatible deltas must preserve leading spaces"
);
assert.deepEqual(
  normalizeHermesSseEvent("assistant.completed", {
    content: "Complete",
    future_usage_detail: "ignored"
  }),
  {
    type: "message_done",
    message: { role: "assistant", content: "Complete" },
    messageId: "",
    runId: ""
  },
  "known completion events must remain stable when Hermes adds fields"
);
assert.equal(
  normalizeHermesSseEvent("future.optional.event", { payload: true }),
  null,
  "unknown optional Hermes events must be ignored without failing the stream"
);

const sessionMessages = await getHermesSessionMessages(
  {
    apiKey: "test",
    baseUrl: "http://127.0.0.1:8642",
    fetchImpl: async () => new Response(JSON.stringify({
      data: [
        {
          id: 42,
          role: "user",
          content: [
            { type: "text", text: "Inspect this" },
            { type: "image_url", image_url: { url: "data:image/png;base64,AA==" } }
          ],
          timestamp: 1_786_000_000
        }
      ]
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  },
  "session-stable-id"
);
assert.equal(sessionMessages.ok, true);
assert.equal(sessionMessages.messages[0]?.id, "42", "numeric Hermes message ids must remain stable strings");
assert.equal(sessionMessages.messages[0]?.content, "Inspect this", "multimodal history must retain its text part");

let detailedHealthAuthorized = false;
const authenticatedStatus = await getHermesStatus({
  apiKey: "private-api-key",
  baseUrl: "http://127.0.0.1:8642",
  includeModels: false,
  fetchImpl: async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : input).pathname;
    const authorization = new Headers(init?.headers).get("Authorization");
    if (path === "/health") {
      return Response.json({ status: "ok" });
    }
    if (path === "/health/detailed") {
      detailedHealthAuthorized = authorization === "Bearer private-api-key";
      return detailedHealthAuthorized
        ? Response.json({ status: "ok" })
        : Response.json({ error: "invalid API key" }, { status: 401 });
    }
    if (path === "/v1/capabilities") {
      return Response.json({ features: { session_chat_streaming: true } });
    }
    throw new Error(`Unexpected status request: ${path}`);
  }
});
assert.equal(authenticatedStatus.reachable, true);
assert.equal(
  detailedHealthAuthorized,
  true,
  "the detailed Hermes health probe must use the configured API key"
);

const configuredModelStatus = await getHermesStatus({
  apiKey: "private-api-key",
  baseUrl: "http://127.0.0.1:8642",
  includeModels: true,
  fetchImpl: async (input, init) => {
    const path = new URL(input instanceof Request ? input.url : input).pathname;
    const authorization = new Headers(init?.headers).get("Authorization");
    if (path === "/health") {
      assert.equal(authorization, null, "the public basic health probe must not need a credential");
      return Response.json({ status: "ok" });
    }
    assert.equal(authorization, "Bearer private-api-key", `${path} must stay authenticated`);
    if (path === "/health/detailed") {
      return Response.json({ status: "ok" });
    }
    if (path === "/v1/capabilities") {
      return Response.json({
        features: { session_chat_streaming: true },
        endpoints: { model_options: { method: "GET", path: "/api/model/options" } }
      });
    }
    if (path === "/api/model/options") {
      return Response.json({
        model: "upstage/solar-pro4:free",
        provider: "nous",
        providers: [
          { id: "nous", name: "Nous", authenticated: true, models: [] }
        ]
      });
    }
    throw new Error(`Unexpected configured-model request: ${path}`);
  }
});
assert.equal(
  configuredModelStatus.uiCapabilities.models.selectedModelId,
  "upstage/solar-pro4:free",
  "Hermes' configured root model remains authoritative even when the picker inventory omits it"
);
assert.equal(
  configuredModelStatus.uiCapabilities.models.currentProviderLabel,
  "Nous",
  "the Composer provider label must come from Hermes' configured provider"
);

const legacySessionRequests = [];
let sessionCreateCount = 0;
const recoveredLegacySession = await streamHermesSessionChat(
  {
    apiKey: "private-api-key",
    baseUrl: "http://127.0.0.1:8642",
    configuredDefaultModelId: "upstage/solar-pro4:free",
    configuredDefaultProviderId: "nous",
    fetchImpl: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const method = init?.method ?? "GET";
      legacySessionRequests.push(`${method} ${url.pathname}`);
      assert.equal(
        new Headers(init?.headers).get("Authorization"),
        "Bearer private-api-key",
        `${method} ${url.pathname} must stay authenticated`
      );
      if (url.pathname === "/v1/capabilities") {
        return Response.json({ features: { session_chat_streaming: true } });
      }
      if (url.pathname === "/api/sessions" && method === "POST") {
        sessionCreateCount += 1;
        const body = JSON.parse(String(init?.body ?? "{}"));
        assert.equal(body.model, "upstage/solar-pro4:free");
        assert.equal(body.provider, "nous");
        assert.equal(body.require_model_lock, true);
        return Response.json({ error: { message: "Session already exists" } }, { status: 409 });
      }
      if (url.pathname === "/api/sessions/legacy-session" && method === "GET") {
        return Response.json({ session: { id: "legacy-session", model: "Hermes-agent" } });
      }
      if (url.pathname === "/api/sessions/legacy-session/model" && method === "POST") {
        const body = JSON.parse(String(init?.body ?? "{}"));
        assert.deepEqual(body, {
          global: false,
          model: "upstage/solar-pro4:free",
          provider: "nous",
          scope: "session"
        });
        return Response.json({
          session_id: "legacy-session",
          runtime: { model: body.model, provider: body.provider, model_lock: "accepted" }
        });
      }
      if (url.pathname === "/api/sessions/legacy-session/chat/stream" && method === "POST") {
        return new Response("event: done\ndata: {}\n\n", {
          status: 200,
          headers: { "Content-Type": "text/event-stream" }
        });
      }
      throw new Error(`Unexpected legacy session request: ${method} ${url.pathname}`);
    }
  },
  {
    message: "Hello",
    model: null,
    provider: null,
    recentMessages: [],
    context: {
      project: {
        id: "project-1",
        title: "Project",
        stableKey: "project-stable-key",
        userVisibleSummary: "Project context"
      },
      session: {
        id: "local-session",
        title: "Legacy session",
        stableKey: "session-stable-key",
        hermesSessionId: "legacy-session",
        includeProjectContext: true,
        includeSessionContext: true,
        lastContextRefreshAt: null,
        userVisibleSummary: "Session context"
      },
      ui: { source: "hermes-ui", workspaceVersion: 1 }
    }
  }
);
assert.equal(recoveredLegacySession.ok, true, "a legacy virtual-model session must recover before chat");
assert.deepEqual(
  legacySessionRequests.slice(1, 4),
  [
    "POST /api/sessions",
    "GET /api/sessions/legacy-session",
    "POST /api/sessions/legacy-session/model"
  ],
  "Stoix must repair the known-invalid virtual-model session without deleting its transcript"
);
assert.equal(
  legacySessionRequests.at(-1),
  "POST /api/sessions/legacy-session/chat/stream",
  "chat must continue through the recreated default-routed session"
);

let discoveredDashboardToken = false;
let authenticatedDashboardRequest = false;
const plugins = await listHermesPlugins({
  baseUrl: "http://127.0.0.1:8642",
  dashboardSessionToken: "",
  fetchImpl: async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.pathname === "/skills") {
      discoveredDashboardToken = true;
      return new Response('<script>window.__HERMES_SESSION_TOKEN__="local-dashboard-token"</script>', {
        status: 200,
        headers: { "Content-Type": "text/html" }
      });
    }
    if (url.pathname === "/api/dashboard/plugins/hub") {
      authenticatedDashboardRequest = new Headers(init?.headers).get("X-Hermes-Session-Token") === "local-dashboard-token";
      return Response.json({ plugins: [] });
    }
    throw new Error(`Unexpected dashboard request: ${url.pathname}`);
  }
});
assert.equal(plugins.ok, true);
assert.equal(
  discoveredDashboardToken && authenticatedDashboardRequest,
  true,
  "a blank optional dashboard token must trigger local token discovery"
);

const logsViewSource = readFileSync(
  resolve(root, "apps/web/src/components/logs/LogsView.tsx"),
  "utf8"
);
assert.equal(
  logsViewSource.includes("Copy visible logs") && logsViewSource.includes("filteredLines.map"),
  true,
  "Logs must expose a copy control for the currently visible content"
);
assert.equal(
  logsViewSource.includes("navigator.clipboard?.writeText") && logsViewSource.includes("document.execCommand(\"copy\")"),
  true,
  "Logs copy must support both modern clipboard access and the local fallback"
);

console.log("Hermes adapter contract: 31 checks passed.");
