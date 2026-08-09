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
const { normalizeHermesSseEvent } = await import(
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

console.log("Hermes adapter contract: 22 checks passed.");
