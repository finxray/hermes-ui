# Hermes Runs Disabled Route Guard 16P

Date: 2026-05-31
Base commit before this slice: `a6460e4 test: add Hermes Runs BFF event fixtures`

## Purpose

Slice 16P adds a production-shaped BFF route skeleton for future Hermes Runs
chat streaming while keeping it disabled by default. The route exists so future
work can anchor request/response guardrails to the final path, but it does not
execute Runs, call Hermes, call Brain Memory Gateway, stream events, or become
the production composer path.

Production chat still uses `/api/hermes/chat/stream`.

## Disabled Route

`POST /api/hermes/runs/chat/stream`

Current response:

- HTTP 501
- JSON, not `text/event-stream`
- `Cache-Control: no-store`
- `ok: false`
- `mode: "disabled"`
- `reason: "production_runs_route_not_enabled"`
- `status: "not_implemented"`
- `sessionStreamDefault: true`
- `sessionStreamRoute: "/api/hermes/chat/stream"`
- `experimentalRoute: "/api/hermes/runs/experimental-chat"`
- `hermesRunCreated: false`
- `hermesCalled: false`
- `brainMemoryCalled: false`
- `eventStreamStarted: false`
- `productionChatUntouched: true`
- `directBrowserHermes: false`
- `directBrowserBrainMemory: false`
- `directStorageAccess: false`
- `approvalCalled: false`
- `stopCalled: false`
- `composerRunsSwitch: false`
- `agentAccessSelector: "future-only"`

The disabled response intentionally does not return `runId` or `hermesRunId`.

## Source Guard Behavior

`npm run smoke:hermes:runs:route-guard` verifies source state by default:

- the disabled route file exists;
- the production session stream route still exists;
- the experimental Runs route still exists;
- the disabled route contains the HTTP 501 disabled response contract;
- the disabled route has no Hermes client import;
- the disabled route has no Brain Memory client/import path;
- the disabled route has no memory scope bridge import;
- the disabled route has no `fetch(` call;
- the disabled route has no `/v1/runs` or `/api/sessions` token;
- the disabled route has no `process.env.HERMES` or `process.env.BRAIN_MEMORY`
  read;
- the disabled route has no direct storage or browser storage token.

When run with `--base-url` or `HERMES_UI_BASE_URL`, the same script sends a
POST to `/api/hermes/runs/chat/stream` and requires HTTP 501 JSON with the
disabled fields above. Without a base URL, live HTTP is skipped rather than
faking success.

`npm run check:hermes-runs-bff-events` now expects this route to exist only as
a disabled skeleton instead of being absent.

`npm run check:ui-structure` now guards the route source and the route guard
script.

## Non-Goals

- No production Runs execution runtime.
- No Hermes run creation.
- No Hermes API call from the new route.
- No Brain Memory Gateway call from the new route.
- No SSE/event stream from the new route.
- No change to `/api/hermes/chat/stream`.
- No production Runs composer switch.
- No composer Agent access selector.
- No approval buttons.
- No provider/model switching.
- No direct browser-to-Hermes path.
- No direct browser-to-Brain Memory Gateway path.
- No direct storage access.
- No Brain Memory BFF change.
- No memory scope bridge change.
- No project/session stable-key change.
- No tenant-check loosening.
- No memory mutation/admin action.
- No Hermes or Brain Memory source change.

## Route Matrix

| Route | Current status |
| --- | --- |
| `POST /api/hermes/chat/stream` | Production default session stream. Unchanged. |
| `POST /api/hermes/runs/chat/stream` | Disabled production-shaped skeleton. Returns HTTP 501 JSON. |
| `POST /api/hermes/runs/experimental-chat` | Existing disabled-by-default experimental route behind `HERMES_UI_EXPERIMENTAL_RUNS_MODE=true`. Unchanged. |
| Runs probe routes | Existing diagnostic-only routes. Unchanged. |

## Files Changed

- `apps/web/src/app/api/hermes/runs/chat/stream/route.ts`
- `scripts/hermes-runs-production-route-guard.mjs`
- `scripts/check-hermes-runs-bff-events.mjs`
- `scripts/check-ui-structure.mjs`
- `package.json`
- `docs/checkpoints/HERMES_RUNS_DISABLED_ROUTE_GUARD_16P.md`
- `docs/checkpoints/HERMES_RUNS_BFF_EVENT_FIXTURES_16O.md`
- `docs/architecture/HERMES_RUNS_BFF_EVENT_CONTRACT_16N.md`
- `docs/architecture/HERMES_RUNS_EXECUTION_STATE_MACHINE_16M.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Next Recommended Slice

Slice 16R: disabled route validation echo contract, still HTTP 501 and no
execution.

Reason: Slice 16Q added pure request schema, fixtures, and validation checks
without changing route behavior. The next safe slice is to optionally connect
that validator to the disabled route as a redacted validation echo while still
returning HTTP 501, creating no run, calling no services, and preserving the
session stream default.

## Slice 16Q Update

Slice 16Q added the future `HermesRunsBffRequest` schema,
`validateHermesRunsBffRequest`, deterministic valid/invalid request fixtures,
and `npm run check:hermes-runs-bff-request`. The disabled route remains HTTP
501 with `reason: "production_runs_route_not_enabled"` and still does not call
Hermes, Brain Memory Gateway, storage, env, or the memory scope bridge.
