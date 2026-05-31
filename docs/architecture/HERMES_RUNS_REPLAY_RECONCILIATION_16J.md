# Hermes Runs Replay Reconciliation 16J

Date: 2026-05-31

Base commit before this slice: `543e8f3 chore: harden Runs Brain Memory live env diagnostics`

## Purpose

Slice 16J defines how future Hermes Runs execution should reconcile with the
existing Web UI run history and persisted activity replay model. This is an
architecture and contract slice only.

It does not switch production chat to Runs, does not add a production Runs UI
path, and does not implement replay or reconnect behavior.

## Current Web UI RunRecord Model

`Session.runRecords[]` stores compact local metadata for Web UI-created
generation attempts.

Current fields:

| Field | Current role | Runs compatibility |
| --- | --- | --- |
| `id` | UI-generated local run record id. | Keep separate from Hermes `run_id` to avoid collisions and preserve rollback. |
| `projectId` | Local Web UI project id. | Reuse unchanged. |
| `sessionId` | Local Web UI session id. | Reuse unchanged. |
| `hermesSessionId` | Hermes session continuity id. | Reuse when Runs request is associated with the active session. |
| `hermesRunId` | Optional Hermes run id. | Store Hermes Runs `run_id` here. |
| `userMessageId` | Local transcript user message id. | Reuse to correlate prompt text. |
| `assistantMessageId` | Local transcript assistant message id. | Reuse for assistant output assembled from `message.delta` or final output. |
| `sourceChannel` | Origin label: `web-ui`, `telegram`, `cli`, `api`, `unknown`. | Use `web-ui` for Studio-created Runs. |
| `status` | `running`, `completed`, `stopped`, `failed`, or `cancelled`. | Map from Hermes run status and stop/approval outcomes. |
| `startedAt` / `completedAt` / `durationMs` | Local timing and replay display. | Use UI request timing plus safe Hermes timestamps when available. |
| `stoppedByUser` | User stop marker. | True only when the UI calls a stop/cancel path. |
| `modelLabel` / `providerLabel` | Display labels, currently server configured. | Keep labels display-only until runtime switching is proven. |
| `summary` | Compact status summary. | Derive from final status and activity summary. |
| `metadata` | Redacted compact extra info. | May include bounded Runs metadata, not raw payloads. |
| `activityEventIds` | Live page activity correlation. | May include normalized Runs activity ids during active page lifetime. |
| `activitySummary` | Counts of tool, memory, command, approval, and error activity. | Derive from normalized Runs `AgentActivityEvent` objects. |
| `activityReplay` | Bounded persisted replay snapshots. | Store compact redacted replay entries derived from normalized Runs events. |

Compatibility assessment:

- The existing model already has the main fields needed for Hermes Runs.
- No schema change is required for the first run-backed UI option.
- The UI run id should remain separate from Hermes run id.
- Session-stream run records remain compatible because `hermesRunId` is already
  optional and `sourceChannel` remains explicit.
- Full raw Hermes Runs event payloads should not be persisted.

## Current Runs Data Observed

Observed across Slices 16B through 16I:

| Data | Evidence |
| --- | --- |
| Hermes run id | `run_*` ids returned by `/v1/runs` probes. |
| Hermes session id | Supplied by Web UI probe context, for example `hermes-session-session-runs-memory-16d`. |
| Final status | `completed` in basic, memory, and approval probes; `cancelled` in stop probe. |
| Event types | `message.delta`, `reasoning.available`, `run.completed`, `tool.started`, `tool.completed`, `approval.request`, `approval.responded`, `run.cancelled`. |
| Assistant text | Assembled from `message.delta`; final status may also expose output. |
| Brain Memory tools | 2 Brain Memory tool events observed in Runs memory probes. |
| Approval lifecycle | `approval.request` and `approval.responded` observed; deny action resolved through BFF. |
| Server-side stop | `/v1/runs/{run_id}/stop` returned HTTP 200 and final status `cancelled`. |
| Timestamps | Event `timestamp` may be present but is not yet treated as an authoritative ledger. |
| Sequence/order | Probe events preserve observed order; stable sequencing is not yet guaranteed by a documented replay contract. |
| Output preview | Available from final status and/or `run.completed` event. |
| Status polling | Probes poll `/v1/runs/{run_id}` after event reads. |

Known gaps:

- durable event retention window is not documented for production replay;
- reconnect/resume semantics are not proven;
- stable event ids are not guaranteed for every event;
- timestamp presence and ordering need a BFF contract;
- approval id fields need production validation beyond the diagnostic probe;
- artifact/file event fields are not proven;
- relationship between Hermes session id, project stable key, and Runs memory
  scope must remain explicit in every production candidate.

## Runs To RunRecord Mapping

Future Hermes Runs execution should map to `RunRecord` as follows:

| Hermes Runs field/behavior | Web UI `RunRecord` field |
| --- | --- |
| UI send starts | Create local `RunRecord.id` before or immediately after BFF acknowledgement. |
| Hermes `run_id` | Store in `hermesRunId`. |
| Active UI project/session | Store `projectId`, `sessionId`, `hermesSessionId`, and transcript message ids. |
| Memory scope key | Do not create new fields; preserve project/session stable keys through existing context and metadata only when needed. |
| `started` / submitted | `status: "running"`, `startedAt` from UI request time. |
| `run.completed` / final completed status | `status: "completed"`, `completedAt`, `durationMs`. |
| `run.failed` / error | `status: "failed"`, redacted error summary. |
| `run.cancelled`, `run.stopped`, `run.interrupted` | `status: "cancelled"` or `status: "stopped"` depending on whether user-initiated stop is known. |
| UI stop action | `stoppedByUser: true`; status `stopped` when BFF confirms stop request, `cancelled` when Hermes reports cancelled without UI stop context. |
| Tool/memory/approval/error counts | `activitySummary` from normalized `AgentActivityEvent` objects. |
| Normalized activity rows | `activityEventIds` while live, `activityReplay` for bounded persisted replay. |
| Provider/model | Display labels only, server configured until switching is proven. |
| Extra Runs data | `metadata` with redacted bounded fields such as `runsEventCount`, `runsEventTypes`, `finalStatusName`, and `eventSource: "hermes-runs"`. |

Decision:

- Keep `RunRecord.id` as a Web UI-generated id.
- Store Hermes `run_id` only in `RunRecord.hermesRunId`.
- Do not use Hermes run id as the primary local id.

Rationale:

- It avoids collisions with legacy local records and future cross-channel
  records.
- It preserves session-stream compatibility and rollback.
- It allows a single Web UI record to exist even if Hermes run creation fails
  after the user message is already present.
- It keeps localStorage normalization simple.

## Runs To AgentActivityEvent Mapping

The existing `createActivityEventFromHermesRunsEvent` contract remains the
normalization boundary:

| Runs event | AgentActivityEvent handling |
| --- | --- |
| `message.delta` | No activity event. Append to assistant text buffer. |
| `reasoning.available` | `reasoning` / `info`, generic public signal only; raw reasoning text omitted. |
| `run.completed` | `status` / `completed`. |
| `run.failed` | `error` / `failed`. |
| `run.cancelled`, `run.canceled`, `run.stopped`, `run.interrupted` | `status` / `cancelled`. |
| `tool.started` | `tool`, `memory`, or `command` / `running` after classification. |
| `tool.completed` | `tool`, `memory`, or `command` / `completed` after classification. |
| `tool.failed` | `tool` or `error` / `failed`. |
| `approval.request` | `approval` / `waiting_for_approval`, display-only until production action path exists. |
| `approval.responded` | `approval` / `completed` or `cancelled` depending on decision. |
| Unknown events | compact `status` / `info` with redacted collapsed details. |

Rules:

- The browser must consume BFF-normalized events, not call Hermes directly.
- Raw reasoning text must not be displayed.
- Raw payload details must be redacted and collapsed.
- Tool/memory/command/approval mapping must continue to reuse the existing
  `AgentActivityEvent` model instead of creating a second Runs-only UI model.

## Runs To Persisted Replay Mapping

Future run-backed UI execution should call the existing persisted replay helper
after normalizing Runs events:

```text
Hermes Runs event -> AgentActivityEvent | null
AgentActivityEvent -> createPersistedActivityEvent(event, RunRecord.id)
bounded list -> RunRecord.activityReplay[]
```

Persist:

- compact activity id, type, status, title, summary, source, source channel;
- safe timestamps and durations when available;
- Hermes correlation fields: session id, run id, event type, tool name, tool
  call id;
- Brain Memory display fields: memory id, operation, project key, session key,
  scope status;
- command previews: command, cwd, exit code, stdout/stderr/output preview,
  truncation;
- approval display fields: approval id, decision, requested action, risk;
- artifact display fields when real artifact payloads exist;
- bounded redacted details preview and compact metadata.

Do not persist:

- per-token `message.delta` replay rows;
- full raw Hermes event payloads;
- full stdout/stderr/output streams;
- binary/blob data;
- API keys, bearer values, tokens, secrets, or service credentials;
- direct service URLs with secrets;
- command execution handles, rerun instructions, or approval action handles;
- full hidden/private reasoning text.

`message.delta` should be represented by the persisted assistant transcript
message. Persisted replay can optionally include one coarse stream/status row
for run lifecycle, but not one row per delta.

The current replay schema is enough for the first Runs-backed option because it
already has `hermes`, `memory`, `command`, `approval`, `artifact`, `metadata`,
and `sourceChannel` fields. The main missing piece is runtime wiring, not data
shape.

## Replay, Search, And Detail Requirements

Before a UI-visible Runs option exists, the BFF/UI path needs these fields:

- local UI run record id;
- Hermes run id;
- Hermes session id;
- project id and session id;
- project stable key and session stable key in request context;
- user message id and assistant message id;
- normalized run status;
- event source: session stream or Hermes Runs;
- bounded event type list and counts;
- activity summary counts;
- redacted persisted replay snapshots;
- final assistant output text;
- stop/approval metadata when relevant;
- replay read path that is display-only and never replays or reruns execution.

Optional but useful:

- safe event timestamps;
- Hermes sequence number or event id when available;
- status polling snapshot;
- BFF correlation id for debugging;
- replay completeness marker such as `eventsComplete: true | false`.

## Backward Compatibility

Session-stream records remain valid:

- `hermesRunId` stays optional.
- `sourceChannel` stays explicit.
- `activityReplay` remains bounded and can be empty for older runs.
- `activityEventIds` remain live-page hints, not durable event ledger ids.
- `Session.messages[]` remains the durable transcript source.
- Existing project/session stable keys are not rewritten.
- The session-stream path stays rollback-compatible.

Runs records should be additive. They must not require a localStorage version
bump until a real schema field is added.

## Migration Blockers

Runs should not become UI-visible/default until these blockers are addressed:

1. A BFF-owned Runs execution route can stream or batch events into the existing
   chat UI shape.
2. RunRecord creation and update works from the Runs path.
3. `activityReplay` is built from normalized Runs events during the Runs path.
4. Assistant transcript text is assembled from `message.delta` without per-token
   React state updates or per-token replay rows.
5. Server-side stop is wired to the UI and reconciles final status.
6. Approval action UX and BFF policy are implemented or intentionally hidden.
7. Brain Memory scope parity remains strict under `local-dev` and future tenant
   configs.
8. Reconnect/replay can handle in-flight and completed Hermes Runs.
9. Release gates prove session stream fallback still works.
10. Browser code still calls only Web UI BFF routes.

## Agent Access Selector Future Contract

The composer Agent access selector remains a future idea and was not
implemented in this slice.

Future labels may include:

- Chat only;
- Read-only tools;
- Ask before tools;
- Full access;
- Custom.

Contract:

- The selector must map to real Hermes/BFF/Runs tool and approval policy.
- It must not be decorative UI text.
- It must not imply enforcement until the BFF can enforce tool access,
  approval requirements, and denial behavior.
- It must preserve Brain Memory tenant/project/session scope.
- It must never expose direct browser-to-Hermes, browser-to-Gateway, or direct
  storage paths.

Recommendation: do not implement the selector until the approval enforcement
path and run-backed event/replay path are both proven.

## Recommendation

Keep session stream as the production default. Keep Hermes Runs experimental.

Use the existing `RunRecord` and `PersistedActivityEvent` model for future
Runs UI work. Do not add a parallel Runs-only replay model unless Hermes adds
durable event semantics that cannot fit the current compact replay shape.

Next implementation work should be a gated prototype that creates a local
`RunRecord` from a Runs execution path while preserving the existing session
stream rollback.

## Safety Boundaries

- Production chat still uses `/api/hermes/chat/stream`.
- No direct browser-to-Hermes path was added.
- No direct browser-to-Brain Memory Gateway path was added.
- No direct browser-to-storage path was added.
- No Brain Memory mutation/admin UI was added.
- No approval buttons were added.
- The composer Agent access selector was not implemented.
- No provider/model switching was implemented.
- No project/session stable keys were changed.
- No Hermes source or Brain Memory source was modified.
- No secrets were printed or committed.

## Next Recommended Slices

Slice 16K: experimental Runs RunRecord/replay prototype behind the existing
feature flag.

Reason: 16J establishes that the current local history/replay schema can carry
Runs-derived records. The next safe step is a disabled-by-default prototype
that creates and replays a local Runs-backed `RunRecord` without replacing the
session stream default.
