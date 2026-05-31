# Hermes Runs Migration Assessment 16A

Date: 2026-05-31

Current Hermes UI commit at assessment start: `cf22389`

Status: Architecture assessment only. No production runtime behavior changed.

## Goal

Assess whether Brain Memory Studio should migrate core execution from the
current Hermes session chat stream path to the Hermes Runs API.

Current proven path:

```text
Browser UI
  -> Next.js BFF /api/hermes/chat/stream
  -> Hermes /api/sessions/{session_id}/chat/stream
  -> Hermes tools / Brain Memory MCP
  -> Brain Memory Gateway
```

Required boundary remains:

```text
Browser UI -> Next.js BFF -> Hermes API server
```

## Non-Goals

This slice does not:

- change the production chat streaming path;
- add a Runs-based execution route;
- add server-side run stop;
- add approval action controls or approval action routes;
- change Hermes BFF streaming logic;
- change Brain Memory BFF logic;
- change the memory scope bridge;
- change project/session stable keys;
- add direct browser-to-Hermes calls;
- add direct browser-to-Brain-Memory calls;
- add direct storage access;
- add memory mutation/admin UI;
- loosen tenant authorization;
- implement auth/classification;
- implement export/import;
- modify Hermes source.

## Sources Inspected

Hermes UI source/docs inspected:

- `apps/web/src/app/api/hermes/chat/stream/route.ts`
- `packages/hermes-client/src/index.ts`
- `packages/hermes-client/src/types.ts`
- `apps/web/src/lib/hermesChatClient.ts`
- `apps/web/src/lib/agentActivityEvents.ts`
- `apps/web/src/types/agentActivity.ts`
- `scripts/mvp-smoke.mjs`
- `scripts/ui-interaction-smoke.mjs`
- prior architecture/product docs listed in the 16A prompt

Hermes upstream inspected in a temporary checkout:

```text
%TEMP%\hermes-agent-slice16a
HEAD 1fc7bdc5e64e052bc61d3ddb9e6f96cf6c7461dc
```

Primary upstream files:

- `gateway/platforms/api_server.py`
- `website/docs/user-guide/features/api-server.md`

Live local Hermes probes:

| Probe | Result |
| --- | --- |
| `GET http://127.0.0.1:8642/health` | HTTP 200, `status=ok`, `platform=hermes-agent` |
| `GET http://127.0.0.1:8642/health/detailed` | HTTP 200, `gateway_state=running`, `api_server=connected`, `active_agents=0` |
| `GET http://127.0.0.1:8642/v1/capabilities` without auth | HTTP 401 |
| `GET http://127.0.0.1:8642/v1/capabilities` with local env auth | HTTP 200, sanitized shape only |

No live run was created in this assessment.

## Current Session Stream Architecture

Current BFF route:

```text
POST /api/hermes/chat/stream
```

Current upstream route:

```text
POST /api/sessions/{hermesSessionId}/chat/stream
```

Request flow:

1. Browser calls only the Web UI BFF route through
   `streamHermesChatFromBff`.
2. The BFF validates a bounded JSON body: `message`, `context`,
   `recentMessages`, optional `provider`, optional `model`.
3. The BFF requires structured project/session/UI context.
4. The BFF builds a memory-scope bridge instruction unless
   `HERMES_UI_ENABLE_MEMORY_SCOPE_BRIDGE=false`.
5. `streamHermesSessionChat` checks session streaming capability.
6. The Hermes client ensures the target Hermes session exists via
   `POST /api/sessions`, accepting `409` as "already exists".
7. The Hermes client streams one turn through
   `/api/sessions/{hermesSessionId}/chat/stream`.
8. The BFF normalizes Hermes SSE frames into the current
   `HermesChatStreamEvent` union.

Session identity:

- Studio has local `project.id`, `session.id`, and stable memory keys.
- Studio sessions carry a stable `hermesSessionId`.
- Hermes session id is used as the session-stream path param.
- The BFF returns `X-Hermes-Session-Id` with the active Hermes session id.

Memory scope:

- The BFF derives `X-Hermes-Session-Key` from the project stable key.
- The BFF sends structured `metadata.context`.
- Because session chat metadata propagation into tool context is not yet
  treated as proven, the BFF also injects the explicit memory-scope bridge
  instruction.
- Live Brain Memory E2E in Slice 15C and UI timeline smoke in Slice 15D prove
  the current path can store/search/inspect scoped memories through Hermes MCP
  and Brain Memory Gateway.

Activity events today:

- `assistant.delta` maps to `message_delta`.
- `assistant.completed` maps to `message_done`.
- `tool.started`, `tool.completed`, and `tool.failed` map to `tool_event`.
- `approval.*` frames are preserved as display-only `approval_event` if they
  appear.
- `run.*` maps to `run_event`.
- `error` maps to `error`.
- `done` maps to `done`.

Run records today:

- The UI creates a local `RunRecord` for each Web UI send.
- The record persists local session/project ids, Hermes session id, status,
  timestamps, source channel, transcript message ids, optional Hermes run id
  if observed in stream payloads, activity counts, and bounded persisted
  replay snapshots.
- This is local Web UI run history, not authoritative Hermes `/v1/runs`
  history.

Stop today:

- Stop is client/BFF stream abort.
- The browser aborts the active fetch.
- The BFF propagates `request.signal` into the upstream Hermes session-stream
  fetch.
- The UI records a cancelled `Stopped` activity with
  `stopStrategy: "client_stream_abort"` and `serverSideRunStop: false`.
- No `/v1/runs/{run_id}/stop` route exists in the Web UI BFF.

Approvals today:

- Approval events render display-only if present.
- Approval action buttons are not shown.
- No BFF approval action route exists.
- Reason: Hermes approval responses are run-scoped and require an active
  `/v1/runs` approval session.

Brain Memory events today:

- Brain Memory MCP/tool events arrive as Hermes tool events on the session
  stream.
- Frontend activity mapping classifies Brain Memory-like tool names into
  memory activity.
- The right rail derives a read-only memory timeline from normalized
  `AgentActivityEvent` state.

Smoke coverage today:

- `scripts/mvp-smoke.mjs` verifies BFF status surfaces and optional live
  `/api/hermes/chat/stream`.
- `scripts/ui-interaction-smoke.mjs` verifies UI send, stop, replay, live
  Brain Memory timeline, and memory-scope isolation through the current BFF
  path.

## Hermes Runs API Findings

Live capabilities advertise:

- `run_submission`
- `run_status`
- `run_events_sse`
- `run_stop`
- `run_approval_response`
- `tool_progress_events`
- `approval_events`
- `session_chat`
- `session_chat_streaming`
- `session_key_header: "X-Hermes-Session-Key"`

Upstream route surface:

| Method | Path | Finding |
| --- | --- | --- |
| `POST` | `/v1/runs` | Creates a run and returns immediately with `run_id` and `status`. |
| `GET` | `/v1/runs/{run_id}` | Returns pollable run status. |
| `GET` | `/v1/runs/{run_id}/events` | Streams JSON SSE `data:` frames from an in-memory queue. |
| `POST` | `/v1/runs/{run_id}/approval` | Resolves pending approval by run id. |
| `POST` | `/v1/runs/{run_id}/stop` | Interrupts active run agent/task and returns `status=stopping`. |

Run creation request shape:

- required `input`;
- optional `session_id`;
- optional `instructions`;
- optional `conversation_history`;
- optional `previous_response_id`;
- optional `model`;
- optional `X-Hermes-Session-Key` header.

Input handling:

- `input` may be a string.
- If `input` is an array, the last item becomes the user message and earlier
  role/content items can become conversation history when explicit
  `conversation_history` is absent.
- Explicit `conversation_history` takes precedence over
  `previous_response_id`.

Session/project context:

- Runs accept `session_id` and expose it in status.
- Runs support `X-Hermes-Session-Key`; source comments and docs say Hermes
  threads it to `AIAgent(gateway_session_key=...)`.
- Runs do not currently define a first-class Studio project context object.
  Brain Memory Studio would still need to pass the existing memory-scope bridge
  instruction until structured metadata propagation is proven for the Runs
  path.

Run status lifecycle:

- initial status is `queued`;
- then `running`;
- may become `waiting_for_approval`;
- terminal statuses include `completed`, `failed`, and `cancelled`;
- stop sets `stopping` and relies on interrupt/task cancellation to reconcile;
- terminal statuses are retained for polling for a bounded TTL;
- orphan run streams are swept after a shorter TTL.

Run events:

- `GET /v1/runs/{run_id}/events` streams SSE frames with JSON in `data:`.
- It uses keepalive comments and a final stream-closed comment.
- It does not use named SSE `event:` fields.
- The event stream is backed by an in-memory queue for the active run.
- If the queue is consumed/closed, `run_status` remains pollable for a bounded
  time, but a durable event ledger is not proven.

Observed event types from source:

- `message.delta`
- `tool.started`
- `tool.completed`
- `reasoning.available`
- `approval.request`
- `approval.responded`
- `run.completed`
- `run.failed`
- `run.cancelled`

Tool events:

- Runs wire `tool_progress_callback`.
- The callback forwards `tool.started`, `tool.completed`, and
  `reasoning.available`.
- It intentionally does not forward `_thinking` or subagent progress events.
- The run callback uses field names such as `tool`, `preview`, `duration`, and
  `error`; the current session-stream mapper expects `tool_name` in some paths,
  so parity needs explicit normalization.

Approvals:

- Runs register an approval session key per run.
- `approval.request` includes `run_id`, `timestamp`, and choices
  `once`, `session`, `always`, `deny`.
- Approval response accepts aliases `approve`, `approved`, and `allow` as
  `once`.
- Body supports `choice`, plus `all` or `resolve_all`.
- If there is no active pending approval, the endpoint returns a safe conflict
  response rather than a false success.

Stop:

- `POST /v1/runs/{run_id}/stop` is the first Hermes endpoint that can support
  honest server-side stop semantics for the Studio.
- It calls `agent.interrupt("Stop requested via API")`, cancels the active
  task, waits up to 5 seconds, and returns `{ "run_id": "...",
  "status": "stopping" }`.
- Final cancellation still needs reconciliation from events or status polling.

Brain Memory parity:

- Runs support `X-Hermes-Session-Key`, so the long-term memory scope header is
  available.
- Runs call `_create_agent(... gateway_session_key=gateway_session_key)`.
- The source suggests Brain Memory MCP/tool events should be able to appear as
  tool events, but this was not proven by a live Runs execution in this slice.
- Brain Memory Studio must not switch defaults until live Runs flow proves the
  same project/session scope behavior as the session-stream path.

Provider/model handling:

- Runs accept a `model` field and store/echo it in status.
- Prior source review still applies: actual runtime model selection is
  server-configured unless separately proven.
- Runs do not by themselves make provider/model selector UX ready.

Files/artifacts:

- No new safe file/artifact API was found in the Runs surface.
- Files/artifacts should remain based on tool payloads or a future explicit
  BFF/artifact contract.

## Session Stream vs Runs Comparison

| Dimension | Session stream today | Runs API |
| --- | --- | --- |
| Current maturity | Proven in production UI, live send, stop smoke, Brain Memory E2E, memory timeline smoke | Advertised and implemented upstream, not integrated in Studio |
| Streaming UX | Already batched and rendered; known UI behavior | Needs new BFF parser for `data:` JSON frames and event parity |
| Event richness | Good enough for MVP tool/run/message events; some gaps remain | Better lifecycle shape for run status, stop, approvals, and reconnect |
| Brain Memory tool events | Proven live through Hermes MCP and Gateway | Likely available via tools and scope header, but not proven in Studio |
| Approvals | Display-only; no action route | Run-scoped action endpoint exists |
| Stop/cancel | Client/BFF stream abort only | Server-side run stop endpoint exists |
| Reconnect/resume | Weak; stream is tied to active request | Status polling exists; event stream attach exists, but durable event replay is not proven |
| Run history | Local Web UI `RunRecord`, not authoritative Hermes history | Pollable run status exists; no general run list endpoint found |
| Activity replay | Local bounded persisted replay | Events are richer while active; durable event ledger not proven |
| Provider/model selection | Server-configured, selector disabled | `model` accepted/echoed, runtime switching still unproven |
| Files/artifacts | Local/mock unless tool payloads expose metadata | No distinct artifact endpoint found |
| BFF complexity | Existing and stable | Requires submit/status/events/stop/approval BFF routes and correlation logic |
| Test complexity | Existing smokes cover current path | Needs parity smokes for send, stop, approvals, Brain Memory scope, replay |
| Migration risk | Low if kept | Medium to high until parity is proven |
| Backwards compatibility | Already matches local sessions and stable keys | Must preserve local session ids, Hermes session ids, memory scope, and replay semantics |

## Migration Options

### Option A: Stay On Session Stream For Now

Benefits:

- Lowest risk.
- Keeps the live, tested, Brain Memory-proven path as default.
- Preserves current smokes and user behavior.
- Avoids introducing run lifecycle complexity before parity is proven.

Risks:

- Approvals remain display-only.
- Stop remains client/BFF abort, not server-side run stop.
- Reconnect/resume remains limited.
- Local run history remains non-authoritative.

Required changes:

- None for 16A.
- Continue documenting honest limitations.

Tests needed:

- Existing checks and optional live smokes.
- Keep Brain Memory E2E and stop smoke as regression gates.

Rollback plan:

- No rollback needed because no runtime change.

### Option B: Hybrid Experimental Runs Path

Benefits:

- Proves Runs API behavior through the BFF without disrupting the default.
- Enables controlled parity tests for events, Brain Memory scope, stop, and
  approvals.
- Lets the Studio learn exact run event schemas before exposing UI controls.

Risks:

- Adds BFF complexity.
- Requires careful feature flags and no accidental default switch.
- Needs new tests to prevent direct browser-to-Hermes paths.
- Could reveal schema differences in tool and memory events that require
  normalization work.

Required changes:

- BFF-only harmless Runs capability/status probe.
- Later experimental run submit/events route behind a server-side feature flag.
- Event normalization parity layer.
- Scope bridge preserved for Runs until structured context propagation is
  proven.

Tests needed:

- Source/structure check that browser code has no direct Runs fetch.
- BFF route tests for redaction and validation.
- Opt-in live Runs send smoke.
- Opt-in live Runs Brain Memory scope smoke.
- Opt-in server-side stop smoke.
- Approval action smoke only with a deterministic approval-producing workflow.

Rollback plan:

- Disable the feature flag.
- Keep session stream as default.
- Leave local `RunRecord` shape compatible.

### Option C: Full Migration To Runs

Benefits:

- Cleaner Hermes-native control plane.
- Server-side stop and approval actions can become first-class.
- Better fit for future orchestration, cross-channel activity, and reconnect.

Risks:

- Highest risk.
- Could break the currently proven Brain Memory scope path.
- Could regress live send, replay, stop, timeline, or tenant checks.
- Requires new production BFF routes and UI state correlation.
- Durable event replay and run listing are not fully proven.

Required changes:

- Replace default chat execution with run submission/events.
- Implement BFF stop and approval action routes.
- Rework run id correlation, run history, event replay, and error handling.
- Re-prove Brain Memory E2E and scope isolation.

Tests needed:

- Full parity suite with live Hermes and Brain Memory.
- Backward-compatible local workspace migration checks.
- Browser smokes for send, stop, replay, memory timeline, memory scope,
  approvals, and no overflow.

Rollback plan:

- Keep session-stream BFF route and feature flag in place.
- Allow immediate default fallback to session stream.

## Recommendation

Recommendation: **do not migrate immediately.**

Keep the session stream as the default production execution path because it is
live, tested, integrated with Brain Memory, and covered by existing smokes. The
Runs API is the right direction for server-side stop, actionable approvals,
pollable status, and future reconnect/control-plane work, but it must be proven
behind the BFF before it replaces the current path.

Recommended path: **Option B, hybrid experimental Runs path, later.**

The next slice should add only a harmless BFF-mediated Runs API probe and docs
guarding, not a UI execution switch. A later opt-in experimental run execution
path should become eligible only after it proves:

- same or better assistant streaming behavior;
- same project/session stable key behavior;
- same Brain Memory MCP/Gateway scope behavior;
- equivalent or richer activity normalization;
- safe server-side stop reconciliation;
- safe approval response behavior through the BFF;
- no direct browser-to-Hermes calls;
- no memory/admin mutation path.

## Compatibility Requirements Before Any Migration

Any future Runs path must preserve:

- browser only calls Web UI BFF;
- BFF owns Hermes auth and never exposes `HERMES_API_KEY`;
- existing Studio project/session stable keys;
- existing `hermesSessionId` semantics or a documented compatibility bridge;
- `X-Hermes-Session-Key` using the project stable memory key;
- memory-scope bridge instruction until Runs metadata context propagation is
  proven;
- current `AgentActivityEvent` redaction and collapsed-details rules;
- local `RunRecord` and persisted replay compatibility;
- existing send/stop/replay/memory smokes until Runs equivalents pass;
- Gateway-mediated Brain Memory search/inspect only;
- no memory mutation/admin action.

## Tests Required Before Migration

Minimum gates before Runs can become default:

- BFF route validation and redaction checks for run submit/status/events;
- event normalizer tests for run events, tool events, reasoning, errors,
  approvals, and cancellation;
- live opt-in Runs send smoke;
- live opt-in Runs Brain Memory store/search/inspect scope smoke;
- live opt-in Runs server-side stop smoke that confirms final status;
- approval response smoke using a deterministic approval-triggering workflow;
- replay/run-history checks that preserve local workspace state;
- tenant-scope diagnostics;
- no direct browser-to-Hermes source check;
- no direct browser-to-Gateway/storage source check;
- full `typecheck`, `build`, and audit gates.

## Risks

- Runs event schema differs from current session-stream schema and needs BFF
  normalization.
- Runs event stream is active-queue based; durable event history beyond status
  polling is not proven.
- No general `/v1/runs` list endpoint was found, so cross-channel run discovery
  still needs a separate contract.
- Server-side stop returns `stopping`; final reconciliation must come from
  status/events.
- Approval actions are powerful and need auth/classification policy before
  broad exposure.
- Brain Memory scope parity is likely but unproven without an opt-in live Runs
  E2E.
- Model selection remains server-configured until runtime switching is proven.

## Future Slice Plan

1. Slice 16B: Runs API harmless probe via BFF, no UI execution switch.
2. Slice 16C: Runs event normalization parity with `AgentActivityEvent`.
3. Slice 16D: Brain Memory MCP parity test in Runs flow.
4. Slice 16E: server-side run stop experiment.
5. Slice 16F: approvals action UX gated by Runs.
6. Slice 16G: feature flag / experimental Runs mode.
7. Slice 16H: decision to switch default or keep session stream.

## Final Decision

Session stream remains default until proven otherwise. The Runs API is
promising and likely necessary for the next tier of orchestration, but the
Studio should migrate only through a BFF-only, feature-flagged, parity-tested
path.

## Slice 16B Probe Update

Slice 16B added the BFF-only diagnostic route
`POST /api/hermes/runs/probe` and `npm run smoke:hermes:runs`. The live probe
completed one harmless run with prompt `Reply exactly: HERMES_RUNS_PROBE_OK`,
observed `message.delta`, `reasoning.available`, and `run.completed`, and
reported 0 tool events, 0 Brain Memory tool events, and 0 approval events. See
`docs/checkpoints/HERMES_RUNS_PROBE_16B.md`.

This does not change the 16A decision: session stream remains the production
default until Runs proves full event, Brain Memory scope, stop, approval, and
replay parity.

## Slice 16D Brain Memory Parity Update

Slice 16D added an opt-in BFF-only Runs Brain Memory probe at
`POST /api/hermes/runs/memory-probe` and `npm run smoke:hermes:runs:memory`.
The live probe stored marker `BM_RUNS_MEMORY_16D_20260531120408_50ZNHG`
through Hermes Runs -> Brain Memory MCP, observed `tool.started` and
`tool.completed` Brain Memory events, found the marker through the Web UI BFF
search route, inspected the detail through the Web UI BFF inspect route, and
verified different-project and different-session isolation.

This improves the Runs parity evidence, but it still does not switch the
production default. Server-side run stop, approval actions, reconnect/replay
correlation, and feature-flagged experimental UI execution remain unproven.

## Slice 16E Server-Side Stop Update

Slice 16E added the BFF-only diagnostic route
`POST /api/hermes/runs/stop-probe` and `npm run smoke:hermes:runs:stop`.
The live probe created run `run_ae63c23ca85a456d8ab455e3c3f40ba4` with a
harmless counting prompt, called `POST /v1/runs/{run_id}/stop` through the
server-side Hermes client, received HTTP 200 with `status=stopping`, and then
observed final status `cancelled` plus `run.cancelled`.

This proves server-side stop is viable for a future run-backed execution path,
but it still does not switch the production default. Production chat remains
on `/api/hermes/chat/stream`, and the composer stop control remains the
Slice 13G client/BFF stream abort behavior until a feature-flagged Runs
execution path exists.

Approval actions, reconnect/replay correlation, and an experimental Runs UI
mode remain unproven.

## Slice 16F Approval Probe Update

Slice 16F added the BFF-only diagnostic route
`POST /api/hermes/runs/approval-probe` and
`npm run smoke:hermes:runs:approval`. The live probe created run
`run_e345b064a8a94067bfa611df280b134c`, observed `approval.request`, sent
`choice=deny` through `POST /v1/runs/{run_id}/approval`, received HTTP 200
with `resolved=1`, observed `approval.responded`, and reconciled the run to
final status `completed` with output `HERMES_RUNS_APPROVAL_PROBE_DONE`.

This proves approval rejection actions are viable through the BFF for a future
run-backed execution path. It still does not switch the production default.
Production chat remains on `/api/hermes/chat/stream`, and no production
approval buttons were added.

Approval approve-and-execute behavior, reconnect/replay correlation, and an
experimental Runs UI mode remain unproven.
