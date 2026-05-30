# Hermes Event Normalization Plan

Date: 2026-05-30

## Purpose

Hermes UI should not bind React components directly to raw Hermes SSE frames.
The BFF should normalize Hermes session, run, tool, approval, memory, and file
signals into stable frontend events.

This plan is docs-only. No runtime normalization code is changed in Slice 13A.

## Current Normalized Events

Current UI-facing stream events are defined in
`packages/hermes-client/src/types.ts`:

```ts
type HermesChatStreamEvent =
  | { type: "message_delta"; delta: string; messageId?: string; runId?: string }
  | { type: "message_done"; message: { role: "assistant"; content: string }; messageId?: string; runId?: string }
  | { type: "tool_event"; name: string; status: "started" | "completed" | "failed"; payload: object }
  | { type: "run_event"; name: string; status: string; payload: object }
  | { type: "error"; error: { kind: string; message: string } }
  | { type: "done" };
```

Current upstream mapping:

- `assistant.delta` -> `message_delta`
- `assistant.completed` -> `message_done`
- `tool.started`, `tool.completed`, `tool.failed` -> `tool_event`
- `run.*` -> `run_event`
- `error` -> `error`
- `done` -> `done`

## Current Gaps

The current normalizer does not yet fully cover Hermes-native orchestration:

- `message.started` is not mapped.
- `tool.progress` is not mapped.
- `reasoning.available` is only visible indirectly when Hermes maps it to tool
  progress.
- `/v1/runs/{id}/events` is not consumed.
- `approval.request` and `approval.responded` are not represented.
- `run.cancelled` and real stop state are not represented.
- Command stdout/stderr has no structured model.
- Memory retrieval/store tool events are not normalized as memory events.
- File/artifact events are local mock metadata only.
- The right rail and chat timeline share a small `ToolEvent` shape that is not
  rich enough for commercial-grade agent activity.

## Target Normalization Boundary

Future boundary:

```text
Hermes SSE/JSON -> Next.js BFF normalization -> AgentActivityEvent -> React UI
```

The browser should receive:

- stable event types;
- stable statuses;
- sanitized titles/summaries;
- raw payloads under `details` only when safe;
- Hermes ids for correlation;
- memory/artifact metadata when available;
- no API keys or secrets.

## Session Stream Mapping

For `/api/sessions/{session_id}/chat/stream`:

| Hermes event | Target handling |
| --- | --- |
| `run.started` | Emit `AgentActivityEvent` type `status`, status `running`. |
| `message.started` | Start assistant placeholder and optional thinking row. |
| `assistant.delta` | Append to assistant text buffer; not one event per React render. |
| `assistant.completed` | Complete assistant message and emit status if needed. |
| `tool.progress` | Emit `reasoning` or `tool` progress depending on payload. |
| `tool.started` | Emit `tool` running. |
| `tool.completed` | Emit `tool` completed. |
| `tool.failed` | Emit `tool` failed and maybe `error`. |
| `run.completed` | Emit run summary/status completed. |
| `error` | Emit `error` failed. |
| `done` | Close stream; no visible row unless abnormal. |

## Run Event Mapping

For `/v1/runs` and `/v1/runs/{run_id}/events`:

| Hermes event payload field | Target handling |
| --- | --- |
| `event: "message.delta"` | Assistant text buffer plus streaming status. |
| `event: "approval.request"` | Approval activity, status `waiting_for_approval`. |
| `event: "approval.responded"` | Complete approval row with chosen response. |
| `event: "run.completed"` | Run summary, status `completed`. |
| `event: "run.failed"` | Error row, status `failed`. |
| `event: "run.cancelled"` | Cancellation row, status `cancelled`. |
| Tool callback events | Tool rows with running/completed/failed/progress. |

Run event SSE currently sends JSON inside `data:` frames rather than named SSE
event fields. The BFF should parse both styles.

## Approval Mapping

Approval request target:

```ts
{
  type: "approval",
  status: "waiting_for_approval",
  title: "Approval required",
  summary: "...",
  hermes: { runId, eventType: "approval.request" },
  details: { choices, raw }
}
```

Approval response target:

```ts
{
  type: "approval",
  status: "completed",
  summary: "Approved once" | "Denied" | "...",
  hermes: { runId, eventType: "approval.responded" }
}
```

Approval responses must be sent only through a future BFF route.

## Command Execution Mapping

Command events should be detected from Hermes tool events when payloads expose a
command-like shape. The BFF should not invent command rows from arbitrary text.

Required data:

- command;
- working directory;
- start/end timestamps;
- exit code;
- stdout preview;
- stderr preview;
- raw stdout/stderr or fetch handle;
- truncation status;
- source tool name;
- run/session ids.

Default UI:

- compact row in timeline;
- stdout/stderr collapsed;
- failure expanded enough to see the error summary.

## Memory Event Mapping

Memory event sources:

- Hermes Brain Memory MCP tool events;
- BFF Brain Memory search/inspect responses;
- future Gateway-approved memory admin events.

Target memory event fields:

- action: `retrieved`, `stored`, `updated`, `superseded`, `failed`;
- memory id when known;
- project key;
- session key;
- scope status;
- layer/source;
- result count/evidence count;
- raw payload in collapsed details.

Memory store/admin events must remain audited and Gateway-mediated. Do not add
direct storage calls.

## File And Artifact Mapping

Current Hermes API server does not support uploaded file inputs through API
server chat/responses. Future artifact events should come from:

- Hermes tool payloads;
- a future safe BFF artifact store;
- future Hermes-native file/artifact support if added.

Target artifact fields:

- file id;
- path;
- kind;
- action;
- status;
- preview;
- owning run/session/project.

## What Appears Where

Chat timeline:

- user and assistant messages;
- compact tool rows;
- compact memory rows;
- approval requests;
- fatal errors;
- elapsed-time separators for longer runs.

Right rail:

- current Hermes session/run ids;
- capabilities;
- tool registry;
- running/completed tools;
- full command output;
- memory evidence and scope;
- artifact detail;
- approval history;
- logs/retries/failures.

## Collapsed By Default

- raw Hermes event payloads;
- tool args;
- command stdout/stderr beyond preview;
- memory evidence bodies beyond summary;
- stack traces;
- low-level keepalive/status events.

## Visible By Default

- current active tool/action if no assistant text has arrived;
- approval request;
- terminal error summary;
- final run summary;
- elapsed time for long runs.

## Commercial-Grade Requirements

Before the UI can claim Hermes-native orchestration maturity, it needs:

- capability-driven control visibility;
- run-backed activity lifecycle;
- reconnectable run status;
- real stop/cancel;
- approval request/response UX;
- tool and command detail model;
- memory event model;
- artifact model;
- stable event ids and deduplication;
- redaction rules for raw payloads;
- regression tests for event normalization.

## Recommended Implementation Order

1. Add docs-only `AgentActivityEvent` contract.
2. Add runtime type/model with no UI behavior change.
3. Expand session-stream normalization for `message.started` and
   `tool.progress`.
4. Add BFF run submission/status/events routes.
5. Map run events to `AgentActivityEvent`.
6. Render activity blocks in chat and right rail.
7. Add real stop/cancel.
8. Add approvals UX.
9. Add command output and artifact details.
10. Add Brain Memory event timeline.
