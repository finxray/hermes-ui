# Hermes Runs BFF Event Fixtures 16O

Date: 2026-05-31
Base commit before this slice: `627d1a5 docs: define Hermes Runs BFF event contract`

## Purpose

Slice 16O turns the Slice 16N future Runs BFF event contract into typed
fixture-only coverage. It adds browser-facing TypeScript event envelope types,
deterministic event sequences, and a pure reducer/check harness without
implementing the production Runs runtime route.

Production chat still uses `/api/hermes/chat/stream`.

## Files Changed

- `apps/web/src/types/hermesRunsBffEvents.ts`
- `apps/web/src/data/hermesRunsBffEventFixtures.ts`
- `apps/web/src/lib/hermesRunsBffEventReducer.ts`
- `scripts/check-hermes-runs-bff-events.mjs`
- `package.json`
- `scripts/check-ui-structure.mjs`
- `docs/checkpoints/HERMES_RUNS_BFF_EVENT_FIXTURES_16O.md`
- `docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md`
- `docs/architecture/HERMES_RUNS_EXECUTION_STATE_MACHINE_16M.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Event Envelope Types Added

`apps/web/src/types/hermesRunsBffEvents.ts` defines the future
browser-facing BFF envelope:

- `HermesRunsBffEvent`
- `HermesRunsBffRunRef`
- `HermesRunsBffMessagePayload`
- `HermesRunsBffApprovalPayload`
- `HermesRunsBffReplayPayload`
- `HermesRunsBffErrorPayload`
- `HermesRunsBffReconnectPayload`
- future stop and approval request/response envelope types

The event union covers:

- `run.started`
- `message.delta`
- `message.completed`
- `activity.event`
- `approval.request`
- `approval.responded`
- `run.stopping`
- `run.stopped`
- `run.completed`
- `run.failed`
- `run.reconnecting`
- `replay.snapshot`
- `error`
- `done`

The types reuse existing `AgentActivityEvent`, `RunRecord`, and
`PersistedActivityEvent` shapes. They do not require raw Hermes payloads by
default, do not include service credentials, and keep local `RunRecord.id`
separate from Hermes `run_id`.

## Fixture Sequences

`apps/web/src/data/hermesRunsBffEventFixtures.ts` adds deterministic,
secret-free fixture sequences:

| Sequence | Purpose |
| --- | --- |
| `hermesRunsBffBasicSuccessEvents` | `run.started`, two `message.delta` events, `message.completed`, `run.completed`, `done`. |
| `hermesRunsBffActivityToolEvents` | Tool activity events, completed run, replay snapshot, `done`. |
| `hermesRunsBffApprovalDenyEvents` | Approval request, deny response, completed terminal event, `done`. |
| `hermesRunsBffStopEvents` | Partial message delta, stop request, stopped terminal event, `done`. |
| `hermesRunsBffErrorEvents` | Normalized stream error, failed terminal event, `done`. |
| `hermesRunsBffReconnectReplayEvents` | Reconnect marker, best-effort replay snapshot, `done`. |

## Reducer Behavior

`apps/web/src/lib/hermesRunsBffEventReducer.ts` adds a pure fixture reducer:

- no network calls;
- no `localStorage`;
- no React state;
- no production route dependency;
- `message.delta` appends to `assistantText` only;
- `activity.event` appends `AgentActivityEvent` and bounded
  `PersistedActivityEvent`;
- `approval.request` creates a waiting approval draft;
- `approval.responded` updates the same approval draft with the decision;
- stop events mark the local draft run as stopped and `stoppedByUser`;
- errors append normalized error payloads and terminal failure state when
  applicable;
- `replay.snapshot` hydrates a `RunRecord` plus `activityReplay`;
- `done` marks stream completion.

This reducer is a local fixture/check helper, not production state management.

## Checks Added

`npm run check:hermes-runs-bff-events` runs
`scripts/check-hermes-runs-bff-events.mjs`.

The check verifies:

- all required event types exist;
- fixture sequences are deterministic and schema-versioned;
- the basic run assembles assistant text and completes;
- `message.delta` does not create per-token replay rows;
- activity events create activity/replay state;
- approval request/response state is updated correctly;
- stop sequence ends stopped/cancelled;
- error sequence ends failed;
- replay snapshot hydrates replay state;
- no hidden reasoning field exists in the new app source;
- fixture/source data is secret-free;
- production `/api/hermes/chat/stream` remains present;
- production `/api/hermes/runs/chat/stream` has only a disabled HTTP 501
  skeleton after Slice 16P;
- browser source still avoids direct Hermes `/v1/runs` or `/api/sessions`
  calls.

`npm run check:ui-structure` now also requires the 16O types, fixtures,
reducer, script, checkpoint, and package script.

## Non-Goals

- No production Runs execution runtime.
- No production composer Runs switch.
- No production composer Runs selector.
- No composer Agent access selector.
- No approval buttons.
- No direct browser-to-Hermes path.
- No direct browser-to-Brain Memory Gateway path.
- No direct storage access.
- No Brain Memory BFF change.
- No memory scope bridge change.
- No project/session stable-key change.
- No tenant-check loosening.
- No provider/model switching.
- No export/import.
- No Hermes source or Brain Memory source changes.

## Future Production Support

These fixtures let future implementation slices prove reducer expectations
before a live BFF route exists. A later production route can use this coverage
as the local browser contract for assistant text, activity, `RunRecord`,
`activityReplay`, approval, stop, error, replay, and reconnect behavior.

## Next Recommended Slice

Slice 16P: disabled production-shaped Runs BFF route skeleton and contract
response guard.

Reason: 16N defined the route/event contract, and 16O now gives the browser
side typed envelope plus deterministic reducer checks. The next safe step is a
server-side route skeleton that is explicitly disabled by default and returns a
non-runtime contract response, with source checks proving it cannot execute a
run or become the composer default.

## Slice 16P Update

Slice 16P added the disabled route skeleton at
`POST /api/hermes/runs/chat/stream`. The route returns HTTP 501 JSON with
`reason: "production_runs_route_not_enabled"`, `sessionStreamDefault: true`,
`hermesRunCreated: false`, `hermesCalled: false`, `brainMemoryCalled: false`,
and `eventStreamStarted: false`. It still has no production Runs execution
runtime, no composer Runs switch, no direct browser-to-Hermes path, and no
Gateway/storage path.

Next recommended slice: Slice 16Q: disabled Runs BFF request validation
contract and dry-run source checks.
