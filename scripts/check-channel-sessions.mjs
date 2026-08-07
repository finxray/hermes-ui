#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const { listHermesSessions } = await import(
  pathToFileURL("packages/hermes-client/src/index.ts").toString()
);
const {
  getChannelDescriptor,
  isExternalChannelSource,
  makeSessionChannel,
  normalizeHermesMessages
} = await import(pathToFileURL("apps/web/src/lib/sessionChannels.ts").toString());

const requestedUrls = [];
const startedAt = Date.parse("2026-08-06T18:40:00.000Z") / 1000;
const lastActiveAt = Date.parse("2026-08-06T18:50:00.000Z") / 1000;
const result = await listHermesSessions({
  baseUrl: "http://127.0.0.1:8642",
  fetchImpl: async (input) => {
    requestedUrls.push(String(input));
    return new Response(JSON.stringify({
      sessions: [
        {
          id: "telegram-session-1",
          title: "Launch planning",
          source: "telegram",
          model: "test-model",
          started_at: startedAt,
          last_active: lastActiveAt,
          parent_session_id: "telegram-parent-1",
          preview: "Continue on desktop",
          message_count: 2
        }
      ]
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  }
});

assert.equal(result.ok, true);
assert.equal(requestedUrls.length, 1);
assert.match(requestedUrls[0], /\/api\/sessions\?limit=200$/);
assert.equal(result.sessions[0].id, "telegram-session-1");
assert.equal(result.sessions[0].source, "telegram");
assert.equal(result.sessions[0].lastActiveAt, "2026-08-06T18:50:00.000Z");
assert.equal(result.sessions[0].parentSessionId, "telegram-parent-1");

const channel = makeSessionChannel(result.sessions[0]);
assert.deepEqual(channel, {
  source: "telegram",
  label: "Telegram",
  external: true,
  lastActiveAt: "2026-08-06T18:50:00.000Z",
  parentSessionId: "telegram-parent-1"
});
assert.equal(getChannelDescriptor("whatsapp_cloud").label, "WhatsApp");
assert.equal(getChannelDescriptor("msgraph-webhook").label, "Microsoft Teams");
assert.equal(getChannelDescriptor("custom_support").label, "Custom Support");
assert.equal(isExternalChannelSource("custom_support"), true);
assert.equal(isExternalChannelSource("api_server"), false);

const messages = normalizeHermesMessages([
  {
    id: "message-1",
    role: "user",
    content: "Continue this channel conversation.",
    createdAt: "2026-08-06T18:49:00.000Z"
  },
  {
    id: "message-2",
    role: "system",
    content: "Internal event",
    createdAt: "2026-08-06T18:49:30.000Z"
  },
  {
    id: "message-3",
    role: "assistant",
    content: "This remains the same Hermes session.",
    createdAt: "2026-08-06T18:50:00.000Z"
  },
  {
    id: "message-4",
    role: "assistant",
    content: "This remains the same Hermes session.",
    createdAt: "2026-08-06T18:50:01.000Z"
  }
]);
assert.equal(messages.length, 2);
assert.equal(messages[0].author, "You");
assert.equal(messages[1].author, "Hermes");
assert(!messages[0].createdAt.includes("T"));

const appShell = readFileSync("apps/web/src/components/shell/AppShell.tsx", "utf8");
const sidebar = readFileSync("apps/web/src/components/shell/Sidebar.tsx", "utf8");
const chatView = readFileSync("apps/web/src/components/chat/ChatView.tsx", "utf8");
const channelIcon = readFileSync("apps/web/src/components/ui/ChannelIcon.tsx", "utf8");
const chatRoute = readFileSync("apps/web/src/app/api/hermes/chat/stream/route.ts", "utf8");
const channelRelay = readFileSync("apps/web/src/server/hermesChannelRelay.ts", "utf8");
assert(appShell.includes("hermesSessionId: summary.id"));
assert(appShell.includes("normalizeHermesMessages(result.messages)"));
assert(appShell.includes("ensureHermesSession(summary, { activate: false })"));
assert(sidebar.includes("groupChannelSessions"));
assert(sidebar.includes("label={group.label}"));
assert(sidebar.includes('icon={<ChannelIcon source={group.source} size={15} />}'));
assert(!sidebar.includes("meta={formatSessionUpdatedAt(displaySession.updatedAt)}"));
assert(sidebar.includes("<span>{formatSessionUpdatedAt(session.updatedAt)}</span>"));
assert(sidebar.includes("onEnsureHermesSession?.(summary)"));
assert(sidebar.includes("<ChannelIcon"));
assert(!sidebar.includes('label="Channels"'));
assert(channelIcon.includes("telegram: Send"));
assert(chatView.includes("hermesSessionId: resolveHermesSessionId(session)"));
assert(chatRoute.includes("relayExternalChannelCompletion"));
assert(chatRoute.includes("relayHermesSessionReply"));
assert(channelRelay.includes('getHermesSession(config, sessionId)'));
assert(channelRelay.includes('["send", "--to", channel, "--file", "-", "--json"]'));
assert(channelRelay.includes('child.stdin.end(text, "utf8")'));
assert(!channelRelay.includes("TELEGRAM_BOT_TOKEN"));

console.log("Cross-channel session checks passed.");
