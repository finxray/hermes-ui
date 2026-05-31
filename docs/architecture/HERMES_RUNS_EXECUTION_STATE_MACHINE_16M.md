# Hermes Runs Execution State Machine 16M

Date: 2026-05-31

Base commit before this slice: `c0bba8b test: hydrate experimental Runs replay in UI`

## Purpose

Slice 16M defines the gated production Hermes Runs execution state machine
contract before any production composer switch.

This is an architecture and contract slice only. It does not implement
production Runs execution, does not switch the composer to Runs, and does not
add approval buttons or an Agent access selector.

For this slice, session stream remains the production default.

## Proven Capabilities

Current evidence from Slices 16B through 16L:

| Capability | Evidence | Production meaning |
| --- | --- | --- |
| Basic Runs chat | `POST /api/hermes/runs/probe` and `POST /api/hermes/runs/experimental-chat` passed live prompts. | Runs can execute simple chat through the BFF. |
| Disabled/enabled flag behavior | `HERMES_UI_EXPERIMENTAL_RUNS_MODE` returns HTTP 403 when off and permits local/dev runs when on. | Runs remains opt-in and rollback-friendly. |
| Runs event normalization | `message.delta`, `reasoning.available`, run status, tool, approval, command-like, and unknown events map into `AgentActivityEvent`. | UI can reuse the existing activity model. |
| Brain Memory MCP parity | Runs memory probe stored and read back a scoped marker with wrong-project and wrong-session negative checks. | Runs can preserve Brain Memory scope when env is correct. |
| Server-side stop probe | BFF diagnostic called `/v1/runs/{run_id}/stop` and reconciled final cancellation. | Server-side stop is viable for a future Runs path. |
| Approval probe | BFF diagnostic denied a pending approval through `/v1/runs/{run_id}/approval` and observed `approval.responded`. | Actionable approvals are viable only after BFF-owned Runs lifecycle exists. |
| RunRecord/replay preview | Experimental chat returns `runRecordPreview`, `activityReplayPreview`, `activitySummary`, and `replayExcludedFields`. | Existing local run history shape can carry Runs-derived records. |
| Replay UI hydration | Test-only Playwright smoke hydrated the preview into local workspace state and verified Run history and Persisted replay UI. | Existing UI can render a Runs-backed completed record. |

## Not Production Ready Yet

- Production streaming into the composer from Runs events.
- Production BFF event stream lifecycle for submit, event consume, status poll,
  terminal reconciliation, reconnect, and cleanup.
- Approval action UI and policy enforcement.
- Composer Agent access selector.
- Retry, resume, reconnect, and in-flight run recovery.
- Durable run history beyond local `RunRecord` and bounded replay.
- Failure recovery for partially created runs, lost event streams, stop
  conflicts, approval timeouts, and Brain Memory env failures.
- Release rollback behavior beyond keeping the current session stream as
  default.

## Required Architecture

```text
Browser UI
  -> Next.js BFF
    -> Hermes API server
    -> Brain Memory Gateway UI API
```

Rules:

- Browser code calls only Web UI BFF routes.
- The BFF owns Hermes auth, Brain Memory Gateway auth, validation, redaction,
  memory-scope bridge application, and service calls.
- Hermes remains the agent runtime.
- Brain Memory Gateway remains the memory authority.
- The agent memory path remains UI -> BFF -> Hermes -> Brain Memory MCP/skill
  -> Brain Memory Gateway.
- The UI observability path remains UI -> BFF -> Brain Memory Gateway UI API.
- Project/session stable keys are never rewritten by the Runs path.

## State Machine Summary

```text
idle
  -> preparing_context
  -> creating_run
  -> streaming_events
  -> waiting_for_approval
  -> streaming_events
  -> completed

streaming_events -> stopping -> stopped | cancelled
streaming_events -> failed
creating_run -> failed
streaming_events -> reconnecting -> streaming_events | replaying | failed
completed | stopped | cancelled | failed -> replaying
```

Terminal states:

- `completed`
- `stopped`
- `cancelled`
- `failed`

Display-only state:

- `replaying`

## State Details

| State | Owner | Entry condition | Exit condition | UI display | Allowed user actions | BFF behavior | Events consumed | RunRecord update | Replay update | Failure behavior |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `idle` | Browser | No active send for selected session. | User sends a message through a future flag-gated Runs option. | Composer enabled; no active run indicator. | Send; switch project/session. | None. | None. | None. | None. | None. |
| `preparing_context` | Browser + BFF | Browser has local message/context and calls a future BFF Runs route. | BFF validates context and starts run creation, or rejects. | User message appears; assistant placeholder starts. | Stop may locally mark pending cancel but cannot call Hermes until run id exists. | Validate tenant/project/session, cap body sizes, apply memory-scope bridge, build request. | None. | Create local `RunRecord` as `running` with no `hermesRunId` yet. | None, except optional UI status row. | Bad context fails the local run with redacted error and no Hermes call. |
| `creating_run` | BFF + Hermes | BFF submits `/v1/runs`. | Hermes returns `run_id`, or creation fails. | "Starting" status. | Stop queues a stop-after-create intent if UI supports it later. | Call Hermes with `session_id`, `X-Hermes-Session-Key`, instructions, recent messages, and server config. | Initial create/status response. | Set `hermesRunId`, keep local `RunRecord.id`, status `running`. | Optional `Run started` row if emitted or synthesized. | Creation failure sets `failed`; assistant placeholder explains no run started. |
| `streaming_events` | BFF + Browser | BFF attaches to `/v1/runs/{run_id}/events`. | Terminal event/status, approval request, stop request, stream break, or error. | Assistant deltas stream; activity rows appear; Run history updates. | Stop; future approval only if waiting. | Consume SSE, normalize events, redact details, batch/browser-stream UI events, poll status as needed. | `message.delta`, `reasoning.available`, `tool.*`, `run.*`, `approval.*`, unknown events. | Keep `running`; update message ids, activity ids, counts, final status when known. | Persist bounded non-delta events through `PersistedActivityEvent`; do not persist per-token `message.delta`. | Stream break enters `reconnecting`; unrecoverable errors enter `failed`. |
| `waiting_for_approval` | Hermes + BFF + Browser | BFF observes `approval.request`. | User/BFF responds, policy blocks/denies, timeout, stop, or run fails. | Approval activity block visible and expanded. | Future approval choice only through BFF; Stop. | Hold run correlation, enforce policy, expose safe choices and redacted prompt, never fake availability. | `approval.request`, later `approval.responded`, run status. | Status remains `running`; metadata may include waiting approval count. | Persist approval request row with redacted details. | Timeout or unavailable action records failed/cancelled approval and run failure if Hermes reports terminal failure. |
| `stopping` | Browser + BFF + Hermes | User requests stop for a run with a validated `hermesRunId`. | Hermes stop/status/events reconcile to stopped/cancelled/failed/completed. | Stop button disabled; status "Stopping". | No duplicate stop; no approval actions. | Validate ownership and call `/v1/runs/{run_id}/stop`; continue event/status reconciliation. | `run.stopping`, `run.cancelled`, `run.stopped`, `run.completed`, `run.failed`. | Set `stoppedByUser: true`; temporary status may remain `running` until terminal reconciliation. | Persist `Run stopped` or `Run cancelled` when observed. | If stop call fails, show redacted stop failure; run may continue or enter reconnect/status polling. |
| `stopped` | BFF + Browser | User stop request reconciles to a stop-like terminal state. | User sends another message or selects replay. | Status `stopped`; partial assistant text retained. | Send new message; inspect replay. | Stop lifecycle closed. | None. | `status: "stopped"`, `completedAt`, `durationMs`, `stoppedByUser: true`. | Persist final stopped/cancelled row. | None. |
| `cancelled` | Hermes + BFF + Browser | Hermes reports cancellation without confirmed user stop, or stop reconciles only as cancelled. | User sends another message or selects replay. | Status `cancelled`. | Send new message; inspect replay. | Terminal status closed. | None. | `status: "cancelled"`, terminal timing. | Persist final cancelled row. | None. |
| `completed` | Hermes + BFF + Browser | `run.completed` or final status completed. | User sends another message or selects replay. | Assistant message complete; run status completed. | Send new message; inspect replay. | Close event stream, final status poll if needed, emit final summary. | `run.completed`, final status. | `status: "completed"`, `completedAt`, `durationMs`, summary and counts. | Persist final completed row; retain bounded replay. | If final summary mismatches event stream, prefer BFF terminal reconciliation and log redacted metadata. |
| `failed` | BFF + Browser | Creation, event stream, status poll, approval, stop, or Hermes terminal failure cannot recover. | User sends another message or selects replay. | Error row and run status failed. | Send new message; inspect replay. | Emit redacted error; do not expose secrets or raw payloads. | `run.failed`, BFF error, status poll error. | `status: "failed"`, `completedAt`, error summary. | Persist redacted failure row. | Preserve transcript and local run record for inspection. |
| `reconnecting` | Browser + BFF | Browser/BFF loses event stream before terminal status. | Reattach succeeds, status proves terminal, or timeout. | "Reconnecting" status; composer avoids duplicate send. | Stop if BFF still has run id; no new approval actions unless state is known. | Reattach to events if possible; poll `/v1/runs/{run_id}`; bound retries. | Status snapshots and any replayable events Hermes still exposes. | Keep `running` or move terminal from status. | Avoid duplicate replay rows by event id/correlation. | Timeout enters `failed` unless status shows terminal. |
| `replaying` | Browser | User inspects a completed/stopped/cancelled/failed run. | User selects active chat or another run. | Run detail and Persisted replay only. | Inspect only; no rerun, approval, stop, or mutation. | None unless a future read-only BFF replay endpoint is explicitly designed. | Persisted local replay only. | None. | None. | If local replay missing, show honest empty state. |

## Browser Responsibilities

The browser should:

- call only Web UI BFF routes;
- maintain local workspace state, transcript messages, active run id, and
  selected Run history state;
- render assistant deltas with batching and without per-token replay rows;
- render normalized activity, approval display rows, errors, run status, and
  persisted replay;
- maintain local `RunRecord` state and bounded `activityReplay[]`;
- keep service credentials out of browser JavaScript;
- never call Hermes, Brain Memory Gateway, or storage directly;
- never treat an Agent access selector as enabled until the BFF can enforce it.

## BFF Responsibilities

The BFF should:

- validate tenant/project/session context and bounded request bodies;
- preserve `projectStableKey`, `sessionStableKey`, and `hermesSessionId`;
- apply the memory-scope bridge unless explicitly disabled by the existing env
  flag;
- create Hermes Runs through `/v1/runs`;
- pass `X-Hermes-Session-Key` using the project stable key;
- consume `/v1/runs/{run_id}/events`;
- poll `/v1/runs/{run_id}` for terminal reconciliation;
- normalize Runs events into the existing UI event model;
- assemble assistant text from `message.delta`;
- redact payload details and protect all service credentials;
- summarize or stream normalized events to the browser;
- call `/v1/runs/{run_id}/stop` only after ownership/session/project
  validation;
- call `/v1/runs/{run_id}/approval` only after ownership/session/project and
  policy validation;
- persist nothing server-side unless a later durable storage slice explicitly
  designs that behavior.

## Hermes Responsibilities

Hermes should:

- own agent execution and tool orchestration;
- produce `run_id`, status, event stream, approval requests, and terminal
  status;
- execute Brain Memory MCP/skill calls through the approved agent memory path;
- enforce its own run lifecycle and stop/approval semantics;
- never receive browser-direct calls from Studio.

## Brain Memory Gateway Responsibilities

Brain Memory Gateway should:

- remain the memory authority;
- provide Gateway-approved read/status/search/inspect behavior through the Web
  UI BFF;
- receive agent memory operations only through Hermes MCP/skill;
- reject unsafe scope or auth postures;
- remain free of direct browser calls and direct storage access.

## Stop Contract

Future Runs stop behavior:

1. Browser sends a stop request to the BFF with local `RunRecord.id` and the
   associated `hermesRunId` when available.
2. BFF validates tenant, project id, session id, `hermesSessionId`, local run
   correlation, and `hermesRunId`.
3. BFF calls Hermes `POST /v1/runs/{run_id}/stop`.
4. UI transitions active run to `stopping` and prevents duplicate stop clicks.
5. BFF continues consuming events and/or polling status.
6. UI reconciles to `stopped` when the stop is user-confirmed, or `cancelled`
   when Hermes only reports cancellation.
7. `RunRecord` sets `stoppedByUser: true`, terminal status, `completedAt`, and
   `durationMs`.
8. `activityReplay[]` stores a redacted stopped/cancelled row.

Fallback rule:

- If server-side Runs stop fails, the client/BFF stream abort remains the
  session-stream fallback only. It must not be reported as server-side Runs
  stop unless `/v1/runs/{run_id}/stop` was actually called and reconciled.

## Approval Contract

Future Runs approval behavior:

1. BFF observes `approval.request` and transitions the run to
   `waiting_for_approval`.
2. UI renders a redacted approval activity block.
3. Future Agent access policy decides whether the request is auto-denied,
   auto-allowed, displayed for user choice, or blocked as read-only.
4. Browser submits the selected approval choice only to the BFF.
5. BFF validates run ownership, active approval state, allowed choices, and
   policy.
6. BFF calls Hermes `POST /v1/runs/{run_id}/approval`.
7. BFF consumes `approval.responded` and terminal status/events.
8. UI updates the approval activity row and `RunRecord` summary/counts.

Rules:

- No browser direct Hermes call.
- No fake approval controls.
- Approval buttons must not render as actionable unless the BFF can enforce
  policy and submit the action.
- Approval details must be redacted and auditable.
- Brain Memory mutation/admin actions are not implied by approval support.

## Agent Access Selector Future Contract

The composer Agent access selector remains future-only. It must not be
decorative and must only appear enabled when BFF/Hermes policy enforcement
exists.

| Mode | What user sees | Policy meaning | Allowed tools | Approval behavior | Brain Memory behavior | Enforceable now |
| --- | --- | --- | --- | --- | --- | --- |
| Chat only | Agent can answer without tools. | BFF/Hermes tool policy denies all tools. | None. | Auto-deny or never request tools. | Search/store disabled except memory already supplied by safe context. | No. |
| Read-only tools | Agent may inspect/read safe sources. | BFF/Hermes allows read-only tool set. | Search, inspect, status, safe file reads if later supported. | Any write/command action is denied or escalated. | Brain Memory search/inspect allowed; store/update/delete denied. | No. |
| Ask before tools | Agent asks before tool execution. | BFF/Hermes requires approval for tool classes. | Policy-defined tools after approval. | `approval.request` must pause run and wait for user choice. | Brain Memory writes require explicit policy; reads may be allowed. | No. |
| Full access | Agent may use allowed runtime tools without per-action prompts. | BFF/Hermes permits configured tool set for the run. | Policy-defined tools except forbidden storage/admin paths. | High-risk actions may still require approval. | Brain Memory behavior remains Gateway/MCP scoped and audited. | No. |
| Custom | User/admin sees explicit toggles or policy profile. | BFF maps profile to concrete allowed tools and approvals. | Explicit allowlist. | Per-rule. | Per-rule, never direct storage. | No. |

Selector constraints:

- Disabled until enforcement exists.
- Must map to real BFF/Hermes policy, not UI text.
- Must preserve tenant/project/session memory scope.
- Must never enable browser-to-Hermes, browser-to-Gateway, or direct storage
  paths.
- Must not imply auth/classification until that model is implemented.

## Migration Gates

Before a production composer Runs option can appear:

1. Experimental Runs chat passes.
2. Runs Brain Memory MCP parity passes in the intended Web UI env.
3. Runs server-side stop passes and is wired through a BFF route contract.
4. Runs approvals pass and policy behavior is documented.
5. Runs replay UI hydration passes.
6. Production BFF submit/events/status lifecycle is implemented.
7. `RunRecord` and `activityReplay` update behavior is verified from the live
   composer path.
8. Browser smokes cover Runs send, stop, approval display/action policy,
   replay, no hidden reasoning, no secrets, and no overflow.
9. Agent access policy is implemented or the selector remains explicitly
   disabled and hidden.
10. Rollback to `/api/hermes/chat/stream` is available.
11. Source checks prove browser code still calls only BFF routes.
12. Release gate includes the new Runs production-option checks.

Before Runs becomes the default:

1. All production-option gates above pass.
2. Long-session behavior is acceptable with fast event streams.
3. Live Brain Memory scope remains strict under the release env.
4. Approval and stop UX are stable under repeated runs.
5. Reconnect and terminal status reconciliation are covered.
6. RC decision documentation explicitly updates the 16H default decision.

## Rollback Plan

- Keep `/api/hermes/chat/stream` as the production default until a later RC
  decision changes it.
- Keep `HERMES_UI_EXPERIMENTAL_RUNS_MODE` disabled by default.
- Add any future Runs composer option behind a separate explicit production
  option flag.
- On failure, disable the Runs option flag and route the composer back to the
  current session stream path.
- Keep `RunRecord` schema backward compatible: local `RunRecord.id` remains
  primary, Hermes Runs id remains optional `hermesRunId`, and older
  session-stream records remain valid.

## Non-Goals

- No production Runs execution implementation.
- No change to `/api/hermes/chat/stream`.
- No production composer Runs selector.
- No composer Agent access selector.
- No approval buttons.
- No provider/model switching.
- No export/import.
- No direct browser-to-Hermes, browser-to-Gateway, or direct storage path.
- No Brain Memory mutation/admin UI.
- No Hermes or Brain Memory source changes.

## Slice 16N BFF Event Contract Update

Slice 16N adds `docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md`.
That document turns this state machine into a future BFF route and event
envelope contract for `POST /api/hermes/runs/chat/stream`.

The 16N contract keeps the same boundaries: production session stream remains
the default, `/api/hermes/chat/stream` is unchanged, no production Runs route is
implemented, no composer selector is added, No direct browser-to-Hermes path is
allowed, and the Agent access selector remains future-only.

## Slice 16O Fixture Update

Slice 16O adds typed fixture coverage for the browser-facing
`HermesRunsBffEvent` state transitions in this state machine. The pure reducer
checks success, activity, approval, stop, error, reconnect, replay snapshot,
and `done` behavior against local `RunRecord` and `activityReplay` state.

No production Runs execution route, composer selector, approval buttons, direct
browser-to-Hermes path, or Agent access selector was implemented.

## Slice 16P Disabled Route Update

Slice 16P adds the production-shaped route path
`POST /api/hermes/runs/chat/stream` as a disabled HTTP 501 JSON skeleton only.
It returns `reason: "production_runs_route_not_enabled"`,
`sessionStreamDefault: true`, `hermesRunCreated: false`,
`hermesCalled: false`, `brainMemoryCalled: false`, and
`eventStreamStarted: false`.

This still does not implement production Runs execution, change
`/api/hermes/chat/stream`, add a production Runs composer switch, add approval
buttons, call Hermes, call Brain Memory Gateway, or add a direct
browser-to-Hermes path.

## Slice 16Q Request Validation Update

Slice 16Q adds the future disabled-route request schema and a pure
`validateHermesRunsBffRequest` helper. The helper validates project/session
ids, message length, required memory scope, memory scope booleans, future
Agent access metadata, bounded timeout, and forbidden credential-like fields.

The disabled route does not call the validator yet; it still returns HTTP 501,
creates no run, calls no Hermes or Brain Memory Gateway service, reads no
service env values, starts no event stream, and keeps session stream as the
production default.

## Next Recommended Slices

Slice 16R: disabled route validation echo contract, still HTTP 501 and no
execution.

Reason: the pure request validator is now covered by fixtures and source
checks. The next safe step is to expose a redacted disabled-route validation
echo while preserving HTTP 501, no runtime execution, and no composer exposure.
