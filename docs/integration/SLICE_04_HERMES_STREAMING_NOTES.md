# Slice 04 Hermes Streaming Notes

Date: 2026-05-29

## Scope

Slice 04 adds the first real chat-send path through the BFF:

```text
Browser UI -> Next.js BFF -> server-side Hermes client -> Hermes API server
```

The browser still never calls Hermes directly and never receives
`HERMES_API_KEY`.

## Endpoint Chosen

Initial Hermes endpoint:

```http
POST /api/sessions/{session_id}/chat/stream
```

Why this endpoint:

- It is session-specific and matches the ChatGPT-like Studio session model.
- Hermes discovery verified it emits SSE events such as `assistant.delta`,
  `tool.started`, `tool.completed`, and `run.completed`.
- It is narrower than `/v1/runs`, so Slice 04 can add real streaming without
  taking on full approval, reconnect, and stop/interrupt management yet.
- `/v1/runs` remains the better future endpoint for long-running work,
  approvals, cancellation, and reconnect-friendly status.

The adapter checks `/v1/capabilities` first. If Hermes explicitly reports
`session_chat_streaming: false`, the request is rejected with a normalized
error. If capabilities are unavailable but the configured Hermes server is
otherwise reachable, the adapter attempts the documented endpoint so local
development remains tolerant.

## BFF Route

Browser route:

```http
POST /api/hermes/chat/stream
```

File:

```text
apps/web/src/app/api/hermes/chat/stream/route.ts
```

The route:

- runs in the Next.js Node runtime;
- reads `HERMES_API_BASE_URL`, `HERMES_API_KEY`, and
  `HERMES_UI_ENABLE_REAL_HERMES` server-side;
- validates and bounds request body size;
- accepts current project/session metadata and limited recent history;
- returns normalized SSE to the browser;
- returns safe JSON errors when Hermes is disabled, unconfigured, invalid, or
  unreachable.

## Request Shape

```ts
type HermesChatRequest = {
  projectId: string;
  projectTitle: string;
  sessionId: string;
  sessionTitle: string;
  memoryScopeKey?: string | null;
  message: string;
  recentMessages?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  model?: string | null;
  provider?: string | null;
};
```

Studio currently maps `sessionId` directly to the Hermes session id. The BFF
first calls `POST /api/sessions` with that id and treats HTTP `409` as "already
exists". This gives stable local continuity without adding a separate backend
persistence layer yet.

`memoryScopeKey` is forwarded as `X-Hermes-Session-Key`. This preserves the
project-scope hook for Slice 05, but no Brain Memory Gateway calls are made in
Slice 04.

## Normalized Stream Events

The BFF converts Hermes SSE into UI-facing events:

```ts
type HermesChatStreamEvent =
  | { type: "message_delta"; delta: string; messageId?: string; runId?: string }
  | { type: "message_done"; message: { role: "assistant"; content: string }; messageId?: string; runId?: string }
  | { type: "tool_event"; name: string; status: "started" | "completed" | "failed"; payload: object }
  | { type: "run_event"; name: string; status: string; payload: object }
  | { type: "error"; error: { kind: string; message: string } }
  | { type: "done" };
```

Hermes event mapping:

- `assistant.delta` -> `message_delta`
- `assistant.completed` -> `message_done`
- `tool.started`, `tool.completed`, `tool.failed` -> `tool_event`
- `run.*` -> `run_event`
- `error` -> `error`
- `done` or stream close -> `done`

## UI Behavior

- The composer is now enabled when a local session is selected.
- User messages are appended immediately to the active local session.
- An assistant placeholder appears while generating.
- When Hermes is connected, assistant content updates progressively from the
  BFF stream.
- Tool and run events are appended to the right-side tool activity panel.
- When Hermes is unconfigured, disabled, or unreachable, the UI stores the user
  message and writes a clear local mock fallback response.
- Messages remain persisted in browser `localStorage`.

## Fast Streaming Strategy

The browser stream reader does not update React state for every token. Incoming
`message_delta` chunks accumulate in a mutable string buffer and flush to the
workspace reducer with `requestAnimationFrame`.

This is intentionally simple for Slice 04, but it keeps the path compatible
with later Cerebras/Kimi-style high-throughput streams. Slice 08 should add
virtualized transcripts, dev throughput metrics, and stronger batching controls.

## Environment Variables

No new variables were added.

```text
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_API_KEY=
HERMES_UI_ENABLE_REAL_HERMES=true
```

## What Is Real

- BFF chat stream route.
- Server-side Hermes chat stream adapter.
- Hermes session ensure/create call.
- `X-Hermes-Session-Key` forwarding from project memory scope.
- Normalized SSE parsing and UI streaming.
- Local persistence of resulting user/assistant messages.

## What Remains Mocked

- Brain Memory Gateway calls.
- Memory retrieval/evidence.
- Memory admin.
- Provider/model switching behavior.
- File upload.
- Tool approvals UI.
- Stop/cancel.
- Multi-user server-side Studio persistence.

## Testing With Hermes Running

1. Start Hermes with the API server enabled on loopback.
2. Configure `.env.local`:

```text
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_API_KEY=your-local-key
HERMES_UI_ENABLE_REAL_HERMES=true
```

3. Restart Studio:

```powershell
npm run dev
```

4. Confirm the status panel reports Hermes connected.
5. Send a message in the active session.
6. Confirm assistant text streams and tool/run events appear if Hermes emits
   them.

## Checks Run

```powershell
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

Additional smoke checks cover:

- unconfigured Hermes fallback;
- invalid Hermes base URL route error;
- local message send without a live Hermes process;
- localStorage persistence after sending;
- no horizontal overflow.

## Known Limitations

- No live Hermes process was available during implementation, so connected-mode
  behavior is implemented against the verified Hermes source/docs and normalized
  stream parser.
- Studio currently maps local session ids directly to Hermes session ids. Slice
  05 should introduce an explicit `hermes_session_id` mapping.
- `/v1/runs` approval, stop, and reconnect behavior are deferred.
- Markdown rendering is still plain paragraphs; expensive markdown/syntax
  rendering should remain throttled when added later.

## Slice 05

Slice 05 should make project/session scope explicit:

- add `hermes_session_id` and memory-scope metadata to the state model;
- verify `X-Hermes-Session-Id` and `X-Hermes-Session-Key` behavior with a live
  Hermes instance;
- add a Brain Memory Gateway client skeleton for read-only project context;
- keep all Brain Memory access Gateway-mediated.
