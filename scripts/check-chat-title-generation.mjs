#!/usr/bin/env node

import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const { generateHermesSessionTitle } = await import(
  pathToFileURL("packages/hermes-client/src/index.ts").toString()
);

const requests = [];
const model = "deepseek/deepseek-v4-flash";
const provider = "openrouter";
const fetchImpl = async (input, init = {}) => {
  const url = new URL(String(input));
  const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
  requests.push({ body, method: init.method ?? "GET", pathname: url.pathname });

  if (url.pathname === "/v1/capabilities") {
    return Response.json({ features: { session_chat_streaming: true } });
  }
  if (url.pathname === "/api/sessions") {
    return Response.json({ ok: true });
  }
  if (init.method === "DELETE" && decodeURIComponent(url.pathname).endsWith("::utility")) {
    return Response.json({ ok: true });
  }
  if (url.pathname.endsWith("/model")) {
    return Response.json({ runtime: { model, provider }, scope: "session" });
  }
  if (url.pathname.endsWith("/chat/stream")) {
    return new Response(
      'event: assistant.completed\ndata: {"content":"Title: \\"Aviation Industry Investment Outlook.\\""}',
      { headers: { "Content-Type": "text/event-stream" } }
    );
  }
  return Response.json({ error: { message: "Unexpected test route" } }, { status: 404 });
};

const result = await generateHermesSessionTitle(
  {
    baseUrl: "http://127.0.0.1:8642",
    enabled: true,
    fetchImpl,
    timeoutMs: 2_000
  },
  {
    context: {
      project: { id: "project-1", title: "Chats", stableKey: "stoix:local:project:project-1" },
      session: {
        id: "session-1",
        title: "New chat",
        stableKey: "stoix:local:project:project-1:session:session-1",
        hermesSessionId: "hermes-session-1",
        includeProjectContext: true,
        includeSessionContext: true
      },
      ui: { source: "hermes-ui", workspaceVersion: 1 }
    },
    message: "What do you think about the airplane industry as an investment?",
    model,
    provider
  }
);

assert.deepEqual(result, { ok: true, title: "Aviation Industry Investment Outlook" });

const utilityRequests = requests.filter((request) =>
  decodeURIComponent(request.pathname).includes("hermes-session-1::utility")
);
assert(utilityRequests.length >= 2, "title generation must use a hidden utility session");
const createRequest = requests.find((request) => request.pathname === "/api/sessions");
assert.match(
  createRequest?.body?.title ?? "",
  /hermes-session-1/,
  "each hidden utility session must have a source-chat-specific Hermes title"
);
assert(
  requests.every((request) => !decodeURIComponent(request.pathname).includes("hermes-session-1/chat")),
  "the visible Hermes session must not receive the title prompt"
);

const modelRequest = requests.find((request) => request.pathname.endsWith("/model"));
assert.equal(modelRequest?.body?.model, model);
assert.equal(modelRequest?.body?.provider, provider);

const chatRequest = requests.find((request) => request.pathname.endsWith("/chat/stream"));
assert.match(chatRequest?.body?.input ?? "", /^TITLE GENERATION TASK/);
assert.match(chatRequest?.body?.input ?? "", /airplane industry as an investment/);
assert.match(chatRequest?.body?.input ?? "", /TITLE ONLY:$/);
assert.match(chatRequest?.body?.instructions ?? "", /Return only the title/);
assert.equal(chatRequest?.body?.conversation_history?.length ?? 0, 0);
assert(
  requests.some(
    (request) => request.method === "DELETE" && decodeURIComponent(request.pathname).endsWith("::utility")
  ),
  "the title utility session must be removed after generation"
);

console.log("Chat title generation checks passed.");
