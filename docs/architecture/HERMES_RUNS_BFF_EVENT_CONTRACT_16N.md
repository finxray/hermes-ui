# Hermes Runs BFF Event Contract 16N

Date: 2026-05-31
Base commit at authoring: `f6d8f98`

## Purpose

This slice defines the future Web UI BFF contract for production Hermes Runs
execution. It specifies request validation, browser-facing stream envelopes,
assistant text mapping, `AgentActivityEvent` mapping, `RunRecord` updates,
`activityReplay` persistence, stop envelopes, approval envelopes, error
envelopes, and replay/reconnect semantics.

No runtime route is implemented in this slice. Production chat still uses
`/api/hermes/chat/stream`, and the production session stream remains the
default.

## Existing Surfaces

| Surface | Current status | Reusable for future Runs path | Not reusable as-is |
| --- | --- | --- | --- |
| `POST /api/hermes/chat/stream` | Production default session stream. | Assistant delta buffering, BFF-only browser boundary, stream parsing, abort cleanup, normalized activity/error concepts. | It is not backed by `/v1/runs`; stop and approvals are not durable run-control actions. |
| `POST /api/hermes/runs/experimental-chat` | Disabled-by-default experimental JSON route behind `HERMES_UI_EXPERIMENTAL_RUNS_MODE=true`. | Memory-scope bridge, bounded request validation, run probe execution, `runRecordPreview`, `activityReplayPreview`. | It is not a production stream route and must not become the composer default by accident. |
| Runs probe routes | Diagnostic only. | Prove create/events, Brain Memory parity, stop, approval, and replay hydration. | They are not user-facing production execution routes. |
| `AgentActivityEvent` | Implemented frontend normalized event model. | Tool, command, memory, approval, reasoning/public signal, status, error display. | It must not carry raw Runs payloads or hidden reasoning text. |
| `RunRecord.activityReplay[]` | Local bounded replay/export shape. | Stores compact redacted activity rows keyed by local `RunRecord.id`. | It must not store per-token `message.delta` rows or raw Runs payloads. |

## Future Route Contract

Future production Runs chat should use a BFF-only route:

```text
POST /api/hermes/runs/chat/stream
```

This route is a contract only in Slice 16N. Slice 16P later adds the final path
as a disabled HTTP 501 skeleton only; it still must not execute Runs until a
future implementation slice explicitly adds execution behind the correct
migration gate.

The browser must never call Hermes directly. No direct browser-to-Hermes,
browser-to-Brain Memory Gateway, or browser-to-storage path is allowed.

### Request Shape

```ts
type HermesRunsChatStreamRequest = {
  projectId: string;
  sessionId: string;
  message: string;
  memoryScope: {
    tenantId: string;
    projectId: string;
    stableProjectKey: string;
    sessionId: string;
    stableSessionKey: string;
    includeProjectContext: boolean;
    includeSessionContext: boolean;
    retrievalProfile?: "default" | "focused" | "broad";
    contextPolicy?: "project_and_session" | "project_only" | "session_only";
    pinnedMemoryIds?: string[];
  };
  hermesSessionId?: string;
  clientRunId?: string;
  recentMessages?: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  agentAccessMode?: "chat_only" | "read_only_tools" | "approval_required" | "full_agent";
  provider?: string;
  model?: string;
  options?: {
    stream?: true;
    includeActivity?: true;
    includeReplayPreview?: boolean;
    timeoutMs?: number;
  };
};
```

`agentAccessMode`, `provider`, and `model` are future-only fields. The Agent
access selector remains future-only and must not appear enabled until the BFF
can enforce policy.

### Validation Rules

The BFF must:

- require project id, session id, message, tenant id, stable project key, and
  stable session key;
- derive or validate the memory scope from existing project/session state
  instead of trusting arbitrary browser-provided storage details;
- reject tenant/project/session mismatches before calling Hermes;
- bound request body size, message length, recent message count, and pinned
  memory id count;
- sanitize `clientRunId` and create a local `RunRecord.id` when needed;
- keep Hermes base URL, Brain Memory Gateway URL, API keys, bearer values, and
  service credentials server-side only;
- call Brain Memory only through existing Gateway-approved BFF/client paths when
  observability is needed;
- add the existing memory-scope bridge to the Hermes request without changing
  stable keys;
- preserve rollback to `POST /api/hermes/chat/stream`.

## Browser-Facing Event Envelope

The future stream response is SSE. Each event data frame contains one
`HermesRunsBffEvent` JSON envelope.

```ts
type HermesRunsBffEvent =
  | { type: "run.started"; run: HermesRunsBffRun; activity?: AgentActivityEvent }
  | { type: "message.delta"; run: HermesRunsBffRun; message: HermesRunsBffMessage }
  | { type: "message.completed"; run: HermesRunsBffRun; message: HermesRunsBffMessage }
  | { type: "activity.event"; run: HermesRunsBffRun; activity: AgentActivityEvent }
  | { type: "approval.request"; run: HermesRunsBffRun; approval: HermesRunsBffApproval; activity: AgentActivityEvent }
  | { type: "approval.responded"; run: HermesRunsBffRun; approval: HermesRunsBffApproval; activity: AgentActivityEvent }
  | { type: "run.stopping"; run: HermesRunsBffRun; activity?: AgentActivityEvent }
  | { type: "run.stopped"; run: HermesRunsBffRun; activity: AgentActivityEvent }
  | { type: "run.completed"; run: HermesRunsBffRun; activity?: AgentActivityEvent; message?: HermesRunsBffMessage }
  | { type: "run.failed"; run: HermesRunsBffRun; error: HermesRunsBffError; activity: AgentActivityEvent }
  | { type: "run.reconnecting"; run: HermesRunsBffRun; reconnect: HermesRunsBffReconnect }
  | { type: "replay.snapshot"; run: HermesRunsBffRun; replay: HermesRunsBffReplaySnapshot }
  | { type: "error"; run?: HermesRunsBffRun; error: HermesRunsBffError }
  | { type: "done"; run: HermesRunsBffRun };

type HermesRunsBffEnvelopeBase = {
  schemaVersion: "hermes-runs-bff-event.v1";
  sequence: number;
  createdAt: string;
  meta?: {
    source: "web-ui-bff";
    rawEventType?: string;
    replayComplete?: boolean;
    experimental?: false;
  };
};
```

Every emitted event must include the base fields above plus its type-specific
payload. `sequence` is monotonically increasing per BFF stream. If the BFF
replays historical or reconstructed events, it must keep ordering stable and
mark replay completeness honestly.

### Run Object

```ts
type HermesRunsBffRun = {
  localRunId: string;
  hermesRunId?: string;
  hermesSessionId?: string;
  projectId: string;
  sessionId: string;
  status:
    | "preparing_context"
    | "creating_run"
    | "streaming_events"
    | "waiting_for_approval"
    | "stopping"
    | "stopped"
    | "completed"
    | "failed"
    | "reconnecting"
    | "replaying"
    | "cancelled";
};
```

`localRunId` is the `RunRecord.id` and remains Web UI-generated. Hermes
`run_id` is stored only in `hermesRunId`.

### Message Object

```ts
type HermesRunsBffMessage = {
  messageId?: string;
  delta?: string;
  fullText?: string;
  finishReason?: string;
};
```

`message.delta` updates assistant text only. It does not become an
`AgentActivityEvent` and must not create per-token `activityReplay` rows.

### Approval Object

```ts
type HermesRunsBffApproval = {
  approvalId: string;
  action?: string;
  prompt?: string;
  choices: Array<"once" | "session" | "always" | "deny">;
  decision?: "once" | "session" | "always" | "deny";
  risk?: "low" | "medium" | "high" | "unknown";
  redactedDetails?: Record<string, unknown>;
};
```

Approval payloads are display-safe only. No raw approval payload, API key,
bearer value, command rerun handle, or unredacted service URL may reach the
browser.

### Replay Snapshot

```ts
type HermesRunsBffReplaySnapshot = {
  runRecord: RunRecord;
  activityReplay: PersistedActivityEvent[];
  complete: boolean;
  source: "live_stream" | "reconnect_poll" | "durable_history" | "best_effort";
  excludedFields: string[];
};
```

No raw Runs payload is included in replay snapshots. The snapshot can hydrate
local UI state, but it is not a new durable backend ledger.

## Event Mapping Matrix

| BFF event | Assistant text | `AgentActivityEvent` | `RunRecord` | `activityReplay` |
| --- | --- | --- | --- | --- |
| `run.started` | None. | Optional status/running row. | Create or confirm local record as `running`. | Optional coarse status row. |
| `message.delta` | Append to assistant buffer with batching. | None. | Keep linked assistant message id. | None. |
| `message.completed` | Mark assistant text complete. | Optional status row. | Keep message ids and completion metadata. | Optional coarse status row. |
| `activity.event` | None unless activity carries display text. | Use normalized `AgentActivityEvent`. | Update activity counts and latest status hints. | Persist bounded redacted activity row. |
| `approval.request` | None. | Approval row with `waiting_for_approval`. | Status becomes `running` plus waiting hint, or future `waiting_for_approval` if schema allows. | Persist approval row without action handles. |
| `approval.responded` | None. | Approval row completed or cancelled when denied. | Update activity counts; run remains non-terminal until Hermes terminal status. | Persist response row. |
| `run.stopping` | No new text. | Optional status row. | `stoppedByUser: true`; status remains running/stopping in UI state until terminal reconciliation. | Optional coarse status row. |
| `run.stopped` / `run.cancelled` | Partial assistant text remains. | Status/cancelled row. | `status: "stopped"` or `cancelled`, terminal timestamps set. | Persist terminal row. |
| `run.completed` | Finalize assistant text. | Optional completed status row. | `status: "completed"`, terminal timestamps and duration set. | Persist terminal row if useful. |
| `run.failed` / `error` | Keep any partial text with clear failure state. | Error/failed row. | `status: "failed"` when fatal. | Persist bounded error row. |
| `run.reconnecting` | No text mutation. | Optional stream/status row. | Keep running with reconnect metadata. | Optional reconnect row. |
| `replay.snapshot` | Hydrate or reconcile from snapshot. | Derived from replay rows, not raw events. | Replace/merge local record by `localRunId`. | Replace/merge bounded replay rows. |
| `done` | Stream cleanup only. | None by default. | No state change unless prior terminal event exists. | None. |

## Stop Envelope

Future server-side stop should use a BFF-only route such as:

```text
POST /api/hermes/runs/{localRunId}/stop
```

Request:

```ts
type HermesRunsStopRequest = {
  projectId: string;
  sessionId: string;
  localRunId: string;
  hermesRunId: string;
  hermesSessionId?: string;
  reason?: "user" | "timeout" | "navigation" | "other";
};
```

Response:

```ts
type HermesRunsStopResponse = {
  ok: boolean;
  localRunId: string;
  hermesRunId: string;
  status: "stopping" | "stopped" | "completed" | "cancelled" | "failed";
  event?: Extract<HermesRunsBffEvent, { type: "run.stopping" | "run.stopped" | "error" }>;
  idempotent?: boolean;
};
```

The BFF validates project/session ownership, local/Hermes run correlation, and
active run status before calling `POST /v1/runs/{run_id}/stop`. If the run is
already terminal, the route should return an idempotent terminal response
instead of pretending a new stop happened.

## Approval Envelope

Future approval response should use a BFF-only route such as:

```text
POST /api/hermes/runs/{localRunId}/approval
```

Request:

```ts
type HermesRunsApprovalRequest = {
  projectId: string;
  sessionId: string;
  localRunId: string;
  hermesRunId: string;
  approvalId: string;
  choice: "once" | "session" | "always" | "deny";
  resolveAll?: boolean;
};
```

Response:

```ts
type HermesRunsApprovalResponse = {
  ok: boolean;
  localRunId: string;
  hermesRunId: string;
  approvalId: string;
  choice: "once" | "session" | "always" | "deny";
  resolved?: number;
  event?: Extract<HermesRunsBffEvent, { type: "approval.responded" | "error" }>;
};
```

The BFF must validate ownership, active waiting state, allowed choices, Agent
access policy, and approval id correlation before calling
`POST /v1/runs/{run_id}/approval`. The browser must not receive fake success if
Hermes rejects the approval.

## Error Taxonomy

```ts
type HermesRunsBffError = {
  code:
    | "validation_failed"
    | "tenant_scope_mismatch"
    | "memory_scope_invalid"
    | "hermes_unreachable"
    | "brain_memory_unavailable"
    | "run_create_failed"
    | "run_event_stream_failed"
    | "run_poll_failed"
    | "run_stop_failed"
    | "approval_required"
    | "approval_submit_failed"
    | "approval_invalid_choice"
    | "timeout"
    | "cancelled"
    | "unknown";
  message: string;
  retryable: boolean;
  httpStatus?: number;
  detailCode?: string;
  redactedDetails?: Record<string, unknown>;
};
```

| Code | Retryable | Notes |
| --- | --- | --- |
| `validation_failed` | No | Bad shape, oversize body, missing scope, or unsupported future-only option. |
| `tenant_scope_mismatch` | No | Browser request does not match configured tenant/project/session scope. |
| `memory_scope_invalid` | No | Stable project/session key mismatch or unsupported memory policy. |
| `hermes_unreachable` | Yes | Hermes API server unavailable or auth/config failure. |
| `brain_memory_unavailable` | Conditional | Retryable for transient Gateway outage; non-retryable for missing required config. |
| `run_create_failed` | Conditional | Retry if transient; not retryable for validation/policy rejection. |
| `run_event_stream_failed` | Yes | Browser may reconnect by `localRunId`/`hermesRunId`. |
| `run_poll_failed` | Yes | Poll/status recovery failed after stream loss. |
| `run_stop_failed` | Conditional | Retry only while run is still active. |
| `approval_required` | No | Not an error for the run; used only when a non-approval path cannot continue. |
| `approval_submit_failed` | Conditional | Retry only while the approval is still active and policy permits. |
| `approval_invalid_choice` | No | Browser sent a choice outside the allowed set. |
| `timeout` | Yes | Retry or reconnect may be possible. |
| `cancelled` | No | User or runtime cancellation was confirmed. |
| `unknown` | No | Redacted fallback; investigate server logs. |

## Replay And Reconnect Semantics

The future browser may reconnect using `localRunId`, `hermesRunId`,
`projectId`, and `sessionId`.

Reconnect flow:

1. Browser opens the future stream route with reconnect metadata or calls a
   future BFF reconnect endpoint.
2. BFF validates project/session/run ownership and stable memory scope.
3. BFF polls Hermes run status and reads event history if Hermes exposes it.
4. BFF emits `run.reconnecting`.
5. BFF emits `replay.snapshot` when it can reconstruct a safe local
   `RunRecord` and bounded `activityReplay`.
6. BFF resumes live event streaming if the run is still active.
7. BFF emits `done` only after a terminal event or an honest unrecoverable
   error.

Deduplication:

- prefer BFF `sequence` during one stream;
- prefer stable event ids if Hermes provides them;
- otherwise dedupe by `(rawEventType, createdAt, localRunId, hermesRunId,
  normalized title/status)` with conservative preservation of terminal events;
- never create duplicate per-token replay rows because `message.delta` is text
  buffer data.

Completeness:

- `complete: true` only when the BFF observed a terminal run status and all
  replay rows come from live stream or durable history;
- `complete: false` for poll-only, partial, or best-effort reconstruction;
- the UI must label incomplete replay as incomplete rather than implying a full
  audited event ledger.

## Agent Access Integration Point

The Agent access selector remains future-only. In this contract it appears only
as a request field and a validation/policy hook. It must not be rendered as an
enabled composer control until:

- the BFF enforces each mode;
- Hermes request payloads/toolsets can be constrained or rejected accordingly;
- approvals can be auto-denied, displayed, or submitted according to policy;
- Brain Memory read/write behavior is explicit for each mode;
- source checks prove the selector is not decorative.

## Source Guard Requirements

`npm run check:ui-structure` should guard this contract by verifying:

- this document exists;
- it says production session stream remains the default;
- it says No direct browser-to-Hermes;
- it says Agent access selector remains future-only;
- `/api/hermes/chat/stream` remains present;
- `apps/web/src/app/api/hermes/runs/chat/stream/route.ts` exists only as a
  disabled HTTP 501 skeleton after Slice 16P;
- the disabled route source contains no Hermes client import, Gateway call,
  memory scope bridge import, `fetch(` call, `/v1/runs`, or `/api/sessions`
  token until a later production migration slice.

## Non-Goals

- No production Runs route implementation.
- No change to `/api/hermes/chat/stream`.
- No production composer Runs selector.
- No composer Agent access selector.
- No approval buttons.
- No provider/model switching.
- No direct browser-to-Hermes path.
- No direct browser-to-Brain Memory Gateway path.
- No direct browser-to-storage path.
- No Brain Memory BFF change.
- No memory scope bridge change.
- No project/session stable-key change.
- No memory mutation/admin action.
- No Hermes or Brain Memory source change.

## Slice 16O Fixture Update

Slice 16O adds typed, fixture-only coverage for this contract:

- `apps/web/src/types/hermesRunsBffEvents.ts` defines `HermesRunsBffEvent` and
  the supporting run, message, approval, replay, error, stop, and approval
  envelope types.
- `apps/web/src/data/hermesRunsBffEventFixtures.ts` provides deterministic
  secret-free sequences for success, activity/tool, approvals, stop, error,
  reconnect, replay snapshot, and `done`.
- `apps/web/src/lib/hermesRunsBffEventReducer.ts` applies those events to a
  local in-memory draft state for assistant text, `RunRecord`,
  `AgentActivityEvent`, `activityReplay`, approvals, errors, replay snapshot,
  and done state.
- `npm run check:hermes-runs-bff-events` verifies the fixture contract.

This does not implement `POST /api/hermes/runs/chat/stream`. Production chat
still uses `/api/hermes/chat/stream`, and the Agent access selector remains
future-only.

## Slice 16P Disabled Route Update

Slice 16P adds `apps/web/src/app/api/hermes/runs/chat/stream/route.ts` as a
disabled production-shaped skeleton. `POST /api/hermes/runs/chat/stream`
returns HTTP 501 JSON with `reason: "production_runs_route_not_enabled"`,
`sessionStreamDefault: true`, `hermesRunCreated: false`,
`hermesCalled: false`, `brainMemoryCalled: false`,
`eventStreamStarted: false`, and `agentAccessSelector: "future-only"`.

The skeleton does not call Hermes or Brain Memory Gateway, does not import the
memory scope bridge, does not start SSE, does not change
`/api/hermes/chat/stream`, and does not add a production composer Runs switch.

## Slice 16Q Request Validation Update

Slice 16Q adds a pure future request contract for
`POST /api/hermes/runs/chat/stream`:

- `apps/web/src/types/hermesRunsBffRequest.ts` defines
  `HermesRunsBffRequest`, `HermesRunsBffMemoryScope`,
  `HermesRunsBffRequestOptions`, `HermesRunsBffAgentAccessMode`, and safe
  validation result/error types.
- `apps/web/src/lib/hermesRunsBffRequestValidation.ts` adds
  `validateHermesRunsBffRequest` for shape-only validation of project/session
  ids, message, required memory scope, booleans, known future agent access
  modes, bounded timeout, and forbidden credential-like fields.
- `apps/web/src/data/hermesRunsBffRequestFixtures.ts` covers valid minimal,
  future agent access, provider/model future fields, missing scope/id,
  invalid agent access, oversized message, forbidden credential field,
  invalid timeout, and invalid memory scope flags.
- `npm run check:hermes-runs-bff-request` verifies the contract and source
  purity.

The disabled route does not call the validator in Slice 16Q. It still returns
HTTP 501 with `reason: "production_runs_route_not_enabled"`, creates no run,
calls no Hermes/Gateway service, reads no service env values, starts no event
stream, and leaves `/api/hermes/chat/stream` as the production default.

## Next Recommended Slice

Slice 16R: disabled route validation echo contract, still HTTP 501 and no
execution.

Reason: 16Q adds the pure validator and fixtures without changing route
behavior. The next safe step is a disabled-route validation echo that returns
only redacted validation metadata while preserving HTTP 501, no run creation,
no Hermes/Gateway call, and no composer switch.
