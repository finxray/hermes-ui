# Agent Activity Event Model 13D

Date: 2026-05-30

## Purpose

Slice 13D adds the first runtime frontend `AgentActivityEvent` model and a
mapping layer for current Hermes stream events. It prepares Codex-like activity
surfaces without changing Hermes streaming behavior, Brain Memory BFF logic,
memory scope bridge behavior, project/session stable keys, approvals, stop,
provider selection, file/artifact UI, auth, or memory mutation/admin actions.

## Files Changed

- `apps/web/src/types/agentActivity.ts`
- `apps/web/src/lib/agentActivityEvents.ts`
- `apps/web/src/components/chat/ChatView.tsx`
- `scripts/check-agent-activity-events.mjs`
- `package.json`
- `docs/product/AGENT_ACTIVITY_EVENT_MODEL_13D.md`
- `docs/product/AGENT_ACTIVITY_EVENT_MODEL.md`
- `docs/architecture/HERMES_EVENT_NORMALIZATION_PLAN.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Current Stream Handling Audit

Current UI-facing BFF stream events remain:

- `message_delta`
- `message_done`
- `tool_event`
- `run_event`
- `error`
- `done`

Current BFF upstream mapping remains:

- `assistant.delta` -> `message_delta`
- `assistant.completed` -> `message_done`
- `tool.started`, `tool.completed`, `tool.failed` -> `tool_event`
- `run.*` -> `run_event`
- `error` -> `error`
- `done` -> `done`

Current limitations still present after this slice:

- `message.started` is not mapped.
- `tool.progress` is not mapped.
- Run-event endpoint consumption is not implemented.
- Approval UX is not implemented.
- Real stop/cancel is not implemented.
- Raw Hermes payloads are not persisted into workspace state.

Before this slice, `ChatView` turned `tool_event` and `run_event` directly into
small `Session.toolEvents[]` entries. Those entries are stored separately from
chat messages in session state. They preserve stream order by append order, but
they generate client-side ids and keep only a short detail string, discarding
raw payload details.

## Runtime Type

The runtime model lives in:

```text
apps/web/src/types/agentActivity.ts
```

Top-level shape:

```ts
type AgentActivityEvent = {
  id: string;
  type:
    | "reasoning"
    | "command"
    | "tool"
    | "memory"
    | "file"
    | "approval"
    | "error"
    | "elapsed"
    | "status"
    | "stream";
  status:
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "waiting_for_approval"
    | "info";
  title: string;
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  collapsedByDefault: boolean;
  details?: unknown;
  source: "hermes" | "brain-memory" | "ui" | "mcp" | "unknown";
  hermes?: { sessionId?: string; runId?: string; eventType?: string; messageId?: string; toolName?: string; toolCallId?: string };
  memory?: { memoryId?: string; operation?: string; projectKey?: string; sessionKey?: string; scopeStatus?: string };
  artifact?: { fileId?: string; path?: string; kind?: string };
  metadata?: Record<string, unknown>;
};
```

The type is intentionally additive and tolerant. It is not tied to one Hermes
payload shape.

## Mapping Helpers

The mapping layer lives in:

```text
apps/web/src/lib/agentActivityEvents.ts
```

Helpers added:

- `createActivityEventFromHermesStreamEvent`
- `createActivityEventFromHermesToolEvent`
- `createActivityEventFromHermesRunEvent`
- `createActivityEventFromHermesError`
- `classifyToolEventSource`
- `classifyMemoryOperation`
- `normalizeActivityStatus`
- `makeElapsedActivityEvent`
- `redactActivityDetails`

## Mapping Rules

| Input | Agent activity output |
| --- | --- |
| `tool_event` from a Brain Memory-like tool | `type: "memory"`, `source: "brain-memory"` |
| generic `tool_event` | `type: "tool"`, `source: "hermes"` |
| command-like tool payload/name | `type: "command"`, `source: "mcp"` |
| `run_event` | `type: "status"` unless approval/error semantics are detected |
| `run_event` with approval semantics | `type: "approval"` |
| failed run event | `type: "error"`, `status: "failed"` |
| stream `error` | `type: "error"`, expanded by default |
| stream `done` | `type: "stream"`, compact completed event |
| `message_done` | optional compact stream-completed event |
| `message_delta` | no activity event; remains assistant text buffering |

Status normalization:

- `started`, `running`, `progress` -> `running`
- `completed`, `success`, `done` -> `completed`
- `failed`, `error` -> `failed`
- `cancelled`, `canceled` -> `cancelled`
- `approval`, `waiting`, `blocked` -> `waiting_for_approval`
- `queued`, `pending` -> `queued`
- unknown statuses -> `info`

## Brain Memory Tool Classification

Tool names or payload sources that look Brain Memory-related map to memory
activity. Current recognized operations include:

- `memory_store`, `brain_memory_store`, write/add/remember semantics ->
  `operation: "store"`, title `Stored memory`
- `memory_search`, query/find semantics -> `operation: "search"`, title
  `Searched memory`
- `memory_health_check`, health semantics -> `operation: "health_check"`,
  title `Checked memory health`
- retrieve/read/get semantics -> `operation: "retrieve"`
- update/supersede/pin semantics -> `operation: "update"`
- delete/remove semantics -> `operation: "delete"`

These are classification labels only. This slice does not add memory
mutation/admin controls.

## Redaction Behavior

`redactActivityDetails` recursively redacts secret-like keys:

- `api_key`
- `authorization`
- `bearer`
- `credential`
- `password`
- `secret`
- `token`

Bearer-looking string values are also rewritten to:

```text
Bearer [redacted]
```

The mapper stores redacted raw details on the `AgentActivityEvent`. The current
UI bridge still persists only a compact `ToolEvent` row, not the raw details.

## Current Integration

`ChatView` now maps current `tool_event` and `run_event` stream events through
`createActivityEventFromHermesStreamEvent`, then projects the result back into
the existing compact `Session.toolEvents[]` shape.

This gives the current right rail better source classification without creating
a new visual timeline or changing localStorage schema.

Slice 13E later added `AgentActivityBlock` rendering for live
`AgentActivityEvent` objects while preserving this compact `Session.toolEvents[]`
compatibility path.

## Persisted State

Persisted workspace state did not change.

No `AgentActivityEvent[]` is stored in `Session` yet. The existing
`Session.toolEvents[]` array remains the only persisted activity-like state.

## Regression Coverage

Added:

```text
npm run check:agent-activity
```

The check validates:

- `memory_store` started -> running memory event
- `memory_store` completed -> completed memory event
- `memory_search` -> memory search event
- generic tool -> tool event
- command-like tool -> command event
- run event -> status event
- stream error -> error event
- unknown run event -> informational fallback
- elapsed helper -> elapsed event
- secret-like fields and bearer strings are redacted

## Remaining Work

Future visual/activity slices still need:

- map `message.started`
- map `tool.progress`
- persist or replay normalized activity events when appropriate
- render compact activity blocks in chat
- render expanded details in the right rail
- add command stdout/stderr preview
- add memory event timeline
- add artifact events when a safe source exists
- add approvals after BFF run/approval routes exist
- add real stop/cancel after a run-backed path exists

## Next Recommended Slice

Slice 13E: render Hermes tool/memory events as Codex-like activity blocks.

Reason: the stable event model and mapper now exist. The next step is to render
real mapped events more usefully without changing Hermes streaming mechanics.
