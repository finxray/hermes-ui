# Hermes Runs BFF Lifecycle Dry Run 16T

Date: 2026-05-31
Base commit before this slice: `3b8eaeb test: add Agent access policy matrix`

## Purpose

Slice 16T defines the future production Runs BFF lifecycle as a dry-run
contract while keeping `POST /api/hermes/runs/chat/stream` disabled. The route
still returns HTTP 501, validates request shape only, and does not execute any
runtime lifecycle stage.

Production chat still uses `/api/hermes/chat/stream`.

## Files Changed

- `apps/web/src/lib/hermesRunsBffLifecycleDryRun.ts`
- `apps/web/src/data/hermesRunsBffLifecycleFixtures.ts`
- `apps/web/src/app/api/hermes/runs/chat/stream/route.ts`
- `scripts/check-hermes-runs-lifecycle-dry-run.mjs`
- `scripts/hermes-runs-production-route-guard.mjs`
- `scripts/check-ui-structure.mjs`
- `package.json`
- `docs/checkpoints/HERMES_RUNS_BFF_LIFECYCLE_DRY_RUN_16T.md`
- `docs/architecture/HERMES_RUNS_EXECUTION_STATE_MACHINE_16M.md`
- `docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md`
- `docs/architecture/AGENT_ACCESS_APPROVAL_POLICY_16R.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Lifecycle Stages

`HermesRunsBffLifecycleStage` now defines:

- `validate_request`
- `validate_scope`
- `validate_agent_access_policy`
- `prepare_context`
- `create_run`
- `stream_or_poll_events`
- `normalize_event`
- `update_run_record`
- `update_activity_replay`
- `handle_approval_request`
- `submit_approval_response`
- `handle_stop_request`
- `finalize_run`
- `emit_done`
- `emit_error`

Each stage defines owner, future input, future output, current disabled-route
status, whether it is implemented now, whether it executed, safety
requirement, and failure/error kind.

## Dry-Run Helper Behavior

`createHermesRunsBffLifecycleDryRun` is pure. It accepts a request-like fixture
or a lifecycle fixture, runs only `validateHermesRunsBffRequest`, and returns a
safe lifecycle plan:

- `disabledReason: "production_runs_route_not_enabled"`
- `routeStatus: "disabled_http_501"`
- safe validation `ok`, `errorKinds`, and `{ kind, path }` errors
- Agent access posture as `metadata_only`, `invalid`, or `omitted`
- runtime execution flags all false
- `rawRequestEchoed: false`
- `serviceSecretsRead: false`

The helper has no network calls, service calls, env reads, storage access,
Hermes client import, Brain Memory client import, or memory scope bridge
import.

## Disabled Route Lifecycle Posture

The disabled route now includes `lifecycleDryRun` in its HTTP 501 JSON
response. The route response still includes the older disabled flags and
`requestValidation` posture.

Runtime stages remain not executed:

- `create_run`
- `stream_or_poll_events`
- `normalize_event`
- `update_run_record`
- `update_activity_replay`
- `handle_approval_request`
- `submit_approval_response`
- `handle_stop_request`
- `finalize_run`
- `emit_done`
- `emit_error`

`validate_request` is the only implemented stage today, and it is shape
validation only. `validate_scope` and `validate_agent_access_policy` remain
future enforcement stages.

## Fixture Matrix

`apps/web/src/data/hermesRunsBffLifecycleFixtures.ts` defines:

| Fixture | Expected posture |
| --- | --- |
| valid `chat_only` lifecycle dry run | Valid request, future chat lifecycle stages required, runtime false. |
| valid `ask_before_tools` lifecycle dry run | Valid request with Agent access metadata, runtime false. |
| invalid missing scope lifecycle | Validation fails with `missing_memory_scope`, only validation/error planning required. |
| invalid Agent access mode lifecycle | Validation fails with `invalid_agent_access_mode`, only validation/error planning required. |
| stop lifecycle future fixture | Stop stage required for future planning, runtime false. |
| approval lifecycle future fixture | Approval request/response stages required for future planning, runtime false. |
| error lifecycle fixture | Error emission stage required for future planning, runtime false. |

These fixtures are data-only and do not call anything.

## Check Behavior

`npm run check:hermes-runs-lifecycle` verifies:

- all lifecycle stages are defined;
- all fixtures produce expected plans;
- invalid fixtures produce validation errors;
- runtime stages have `executed: false`;
- runtime execution flags remain false;
- dry-run output carries the disabled reason and no secret-like data;
- lifecycle helper and fixtures are source-pure;
- disabled route contains `lifecycleDryRun`;
- disabled route still avoids Hermes/Gateway/fetch/env/storage/memory bridge;
- production session stream route remains present;
- browser composer/chat client has no production Runs path, Agent access
  selector, or approval buttons.

The route guard also verifies the route-level `lifecycleDryRun` response stays
disabled and marks `create_run` as not executed.

## Migration Path

The intended migration path is:

1. Disabled route: HTTP 501, validation echo, lifecycle dry-run posture, no
   execution.
2. Dry-run candidate: still no Hermes/Gateway calls, but route and browser
   checks prove future lifecycle shape and migration gates.
3. Experimental execution: remains behind explicit experimental flag and
   diagnostic/live smoke gates.
4. Production option: only after source checks, browser smokes, Brain Memory
   scope parity, stop/approval enforcement, replay reconciliation, rollback,
   and release gates pass.

Session stream remains the default until a later RC decision explicitly changes
that posture.

## Non-Goals

- No production Runs execution.
- No Hermes run creation from the disabled route.
- No Hermes API call from the disabled route.
- No Brain Memory Gateway call from the disabled route.
- No memory scope bridge import from the disabled route.
- No service env secret read from the disabled route.
- No SSE/event stream from the disabled route.
- No run record creation from the disabled route.
- No activity replay mutation from the disabled route.
- No change to `/api/hermes/chat/stream`.
- No production Runs composer switch.
- No composer Agent access selector UI.
- No approval buttons.
- No provider/model switching.
- No direct browser-to-Hermes path.
- No direct browser-to-Brain Memory Gateway path.
- No direct storage access.
- No Brain Memory BFF change.
- No memory scope bridge behavior change.
- No project/session stable-key change.
- No tenant-check loosening.
- No export/import.
- No secrets committed.
- No Hermes or Brain Memory source change.

## Safety Boundaries

Architecture remains:

```text
Browser UI
  -> Next.js BFF
    -> Hermes API server
    -> Brain Memory Gateway UI API
```

The disabled production route only performs JSON parsing, pure shape
validation, and pure lifecycle planning. It does not cross the service
boundary.

## Checks Run

- `npm run check:hermes-runs-lifecycle`
- `npm run smoke:hermes:runs:route-guard`
- `npm run check:agent-access-policy`
- `npm run check:hermes-runs-bff-request`
- `npm run check:hermes-runs-bff-events`
- `npm run check:ui-structure`
- `npm run check:agent-activity`
- `npm run check:agent-activity-rendering`
- `npm run check:workspace-state`
- `npm run check:brain-memory-client`
- `npm run check:tenant-scope`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`

## Next Recommended Slice

Slice 16U: disabled Runs lifecycle route-response fixture and migration gate
checklist.

Reason: the route now returns a no-runtime lifecycle dry-run posture. The next
safe step is to pin representative route-response fixtures and a migration gate
checklist before any experimental-to-production bridge is attempted.
