# Agent Activity Event Model

Date: 2026-05-30

## Purpose

This document proposes a stable frontend event model for Hermes-native agent
activity. It is a docs-only contract for future implementation.

The model should let the UI render chat text, reasoning, tools, commands,
memory, files, approvals, errors, elapsed time, and status updates without
binding React components directly to raw Hermes event payloads.

## Proposed Type

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
    | "status";
  status:
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "waiting_for_approval";
  title: string;
  summary?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  details?: Record<string, unknown>;
  collapsedByDefault: boolean;
  source: "Hermes" | "Brain Memory" | "UI" | "MCP";
  hermes?: {
    sessionId?: string;
    runId?: string;
    eventType?: string;
    toolName?: string;
    messageId?: string;
    seq?: number;
  };
  memory?: {
    memoryId?: string;
    projectKey?: string;
    sessionKey?: string;
    scopeStatus?: string;
    layer?: string;
    source?: string;
  };
  artifact?: {
    fileId?: string;
    path?: string;
    kind?: string;
    action?: string;
  };
  metadata?: Record<string, unknown>;
};
```

## Event Types

| Type | Purpose | Common source | Default presentation |
| --- | --- | --- | --- |
| `reasoning` | Show thinking/reasoning progress when available and safe. | Hermes `tool.progress`, future reasoning events. | Collapsed after completion. |
| `command` | Show command execution, output, and exit status. | Hermes/MCP command tools. | Collapsed stdout/stderr. |
| `tool` | Show tool lifecycle. | Hermes tool events. | Compact row with expandable args/raw payload. |
| `memory` | Show retrieval/store/update memory activity. | Hermes Brain Memory tool events, Gateway responses. | Scope-visible row with details collapsed. |
| `file` | Show generated/read/updated artifact. | Tool event payloads, future file API. | Link into files rail. |
| `approval` | Ask the user to permit/deny an action. | Hermes `approval.request`. | Expanded while waiting. |
| `error` | Explain failure/retry state. | Hermes `error`, `run.failed`, tool failed events. | Expanded summary, raw collapsed. |
| `elapsed` | Mark time spent. | UI derived from start/end timestamps. | Separator row. |
| `status` | Show lifecycle/status transitions. | Hermes run/session stream events. | Compact row or rail badge. |

## Status Semantics

| Status | Meaning |
| --- | --- |
| `queued` | Work is accepted but not yet running. |
| `running` | Work is active. |
| `completed` | Work completed successfully. |
| `failed` | Work failed and may include retry details. |
| `cancelled` | Hermes or the UI confirmed cancellation. |
| `waiting_for_approval` | Work is blocked on a user approval response. |

## Mapping From Current Hermes UI Events

Current BFF event:

```ts
type HermesChatStreamEvent =
  | { type: "message_delta"; ... }
  | { type: "message_done"; ... }
  | { type: "tool_event"; ... }
  | { type: "run_event"; ... }
  | { type: "error"; ... }
  | { type: "done" };
```

Proposed mapping:

| Current event | AgentActivityEvent mapping |
| --- | --- |
| `message_delta` | Assistant message text buffer, not usually an activity event. |
| `message_done` | Optional `status` event for message completion. |
| `tool_event` status `started` | `type: "tool"`, `status: "running"`. |
| `tool_event` status `completed` | `type: "tool"`, `status: "completed"`. |
| `tool_event` status `failed` | `type: "tool"` or `error`, `status: "failed"`. |
| `run_event` `run.started` | `type: "status"`, `status: "running"`. |
| `run_event` `run.completed` | `type: "status"`, `status: "completed"`. |
| `error` | `type: "error"`, `status: "failed"`. |
| `done` | Stream lifecycle marker, not usually rendered directly. |

## Mapping From Hermes Run Events

Future BFF run events should normalize:

| Hermes run event | AgentActivityEvent mapping |
| --- | --- |
| `message.delta` | Assistant text buffer and optional streaming status. |
| `tool.started` | Tool row running. |
| `tool.completed` | Tool row completed. |
| `tool.failed` | Tool/error row failed. |
| `tool.progress` | Tool progress or reasoning row. |
| `approval.request` | Approval row waiting. |
| `approval.responded` | Approval row completed or denied. |
| `run.completed` | Run summary/status completed. |
| `run.failed` | Error row and run status failed. |
| `run.cancelled` | Cancellation row/status cancelled. |

## Memory Fields

Memory events should always preserve scope:

- `tenantId` in `metadata` when safe to show;
- `projectKey`;
- `sessionKey`;
- `scopeStatus`;
- `memoryId`;
- `layer`;
- `source`;
- `supersessionStatus` when known.

Never render memory mutation/admin controls from these events unless a future
Gateway-approved admin slice explicitly adds audited mutation routes.

## Artifact Fields

Artifact events should distinguish:

- generated file;
- read file;
- modified file;
- uploaded/attached file;
- external URL;
- command output artifact.

Current Hermes API server does not support uploaded file inputs through the API.
The UI should not model uploads as real until a safe BFF/file contract exists.

## Visibility Rules

Render in chat timeline:

- assistant text;
- compact status rows;
- compact tool/memory/file rows;
- approval requests while waiting;
- errors that affect the response.

Render in right rail:

- full run status;
- full tool registry/activity;
- raw event payloads;
- stdout/stderr;
- memory evidence and scopes;
- files/artifacts;
- approval history;
- retries/failures.

Collapsed by default:

- raw Hermes payloads;
- command stdout/stderr beyond a short preview;
- tool args;
- stack traces;
- long memory evidence;
- low-level status chatter.

Expanded by default:

- active approval requests;
- top-level fatal errors;
- current active tool row if there is no assistant text yet.

## Non-Goals For This Slice

- No runtime TypeScript type is added yet.
- No BFF normalization change is made.
- No UI component is changed.
- No approvals, stop/cancel, file upload, or memory mutation is implemented.
