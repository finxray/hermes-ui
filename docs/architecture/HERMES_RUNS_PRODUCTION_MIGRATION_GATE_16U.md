# Hermes Runs Production Migration Gate 16U

Date: 2026-05-31
Base commit before this slice: `7512c56 test: add Runs BFF lifecycle dry run`

## Purpose

Slice 16U pins the disabled production-shaped Runs route response as fixtures
and defines the checklist that must pass before the route can move from
disabled contract to production implementation.

This is a fixture/checklist slice only. It does not implement production Runs
execution.

## Current Decision

The current decision is: Studio is not ready to implement production Runs default
behavior.

Production chat still uses `/api/hermes/chat/stream`. The route
`POST /api/hermes/runs/chat/stream` remains disabled with HTTP 501,
`reason: "production_runs_route_not_enabled"`, `sessionStreamDefault: true`,
redacted request validation posture, lifecycle dry-run posture, and all
runtime execution flags false.

The experimental Runs route remains
`POST /api/hermes/runs/experimental-chat` behind
`HERMES_UI_EXPERIMENTAL_RUNS_MODE=true`.

## Disabled Response Fixture Gate

`apps/web/src/data/hermesRunsDisabledRouteResponseFixtures.ts` pins five
representative response fixtures:

| Fixture | Expected posture |
| --- | --- |
| Valid minimal request | HTTP 501, validation ok, no run, no stream, lifecycle dry-run only. |
| Valid full future request | HTTP 501, future metadata accepted, no Agent access enforcement claim. |
| Missing memory scope | HTTP 501, `missing_memory_scope`, no raw request echo. |
| Credential-like request field | HTTP 501, `forbidden_credential_field`, no credential echo. |
| Oversized message | HTTP 501, `message_too_large`, no prompt echo. |

`validateHermesRunsDisabledRouteResponse` is the pure contract helper for those
fixtures and for the live route guard. It checks status, disabled reason,
session-stream default, validation posture, lifecycle dry-run posture, runtime
flags, absence of run ids, absence of approval actions, and absence of
secret-like response data.

## Gates Already Green

The following gates are already green for a future production Runs option:

1. Hermes Runs basic probe can execute through the BFF in local/dev conditions.
2. Runs event normalization maps observed Hermes events into
   `AgentActivityEvent`.
3. Brain Memory MCP parity has a scoped diagnostic path and env hardening.
4. Server-side Runs stop has a diagnostic probe and reconciliation evidence.
5. Runs approval response has a diagnostic probe and redaction evidence.
6. Experimental Runs chat remains flag-gated and disabled by default.
7. Runs default decision keeps session stream as production default.
8. RunRecord and activity replay preview can represent Runs-derived records.
9. Test-only replay hydration can render a Runs-backed record in the existing
   UI model.
10. Production Runs state machine and BFF event contract are documented.
11. Event, request, Agent access policy, lifecycle dry-run, and disabled
   response fixtures are source-checked.

## Gates Still Required Before Production Runs Route Implementation

These gates must pass before implementing runtime behavior in
`POST /api/hermes/runs/chat/stream`:

1. A separate implementation ADR or checkpoint explicitly authorizes changing
   the route from disabled contract to runtime execution.
2. Request validation derives or verifies tenant/project/session scope from
   trusted project/session state before any service call.
3. Memory-scope bridge application is proven on the production route without
   changing stable project/session keys.
4. BFF-owned Hermes `/v1/runs` create, event consume, status poll, terminal
   reconciliation, cleanup, and timeout behavior are implemented together.
5. Browser-facing SSE envelopes conform to `HermesRunsBffEvent` and never send
   raw Hermes payloads, hidden reasoning text, credentials, or service URLs.
6. `RunRecord` and `activityReplay` update from the live production route with
   no per-token replay rows.
7. Stop is server-side Runs stop, not just browser stream abort, and validates
   project/session/run ownership.
8. Approval display/action policy is enforceable through the BFF before any
   approval buttons appear.
9. Agent access modes are enforceable through BFF/Hermes policy before any
   composer Agent access selector appears.
10. Brain Memory read/write behavior stays through Hermes MCP/skill and Brain
    Memory Gateway-approved paths only.
11. Source checks prove there is no browser direct call to Hermes, Brain
    Memory Gateway, or storage.
12. Release checks include disabled-response fixture parity, live route smoke,
    session-stream rollback, and secret-redaction coverage.

## Gates Required Before Runs Becomes Default

These gates must pass before Runs can replace `/api/hermes/chat/stream` as the
default composer path:

1. All production-route implementation gates pass in the intended release env.
2. Live Brain Memory scope remains strict for correct, wrong-project, and
   wrong-session cases.
3. Fast stream behavior is smooth for long sessions without per-token React
   state updates.
4. Stop, approval, reconnect, replay, and terminal reconciliation survive
   repeated sends and browser reloads.
5. Run history and persisted replay stay backward compatible with existing
   session-stream records.
6. Rollback to `/api/hermes/chat/stream` is documented, tested, and available
   through a single config switch.
7. Browser smokes cover send, stop, approval policy, replay, no hidden
   reasoning, no secret leakage, and no horizontal overflow.
8. A later RC decision explicitly updates the Slice 16H default decision.

## Non-Goals

- No production Runs execution.
- No Hermes run creation from the disabled route.
- No Hermes API call from the disabled route.
- No Brain Memory Gateway call from the disabled route.
- No memory scope bridge import from the disabled route.
- No service env secret read from the disabled route.
- No SSE/event stream from the disabled route.
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
- No memory mutation/admin action.
- No auth/classification implementation.
- No heavy dependency.
- No secrets committed.

## Next Recommended Slice

Slice 16V: production Runs implementation ADR and feature-flag contract.

Reason: 16U pins the disabled route response and migration checklist. The next
safe step is a docs/check-only ADR that names the exact feature flag,
rollback posture, live smoke gates, and route-implementation acceptance criteria
before any runtime code is added to the production Runs route.
