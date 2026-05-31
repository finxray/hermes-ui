# Hermes Runs Stop Experiment 16E

Date: 2026-05-31

Status: server-side stop passed through an opt-in BFF diagnostic probe.
Production chat still uses `/api/hermes/chat/stream`.

## Summary

Slice 16E added a diagnostic-only route and smoke command to test Hermes Runs
server-side stop without wiring it to the composer:

```text
POST /api/hermes/runs/stop-probe
```

```text
Script/browser -> Next.js BFF /api/hermes/runs/stop-probe
  -> Hermes /v1/runs
  -> Hermes /v1/runs/{run_id}/events
  -> Hermes /v1/runs/{run_id}/stop
  -> Hermes /v1/runs/{run_id} status polling
```

No direct browser-to-Hermes path was added.

## Files Changed

- `packages/hermes-client/src/index.ts`
- `packages/hermes-client/src/types.ts`
- `apps/web/src/app/api/hermes/runs/stop-probe/route.ts`
- `scripts/hermes-runs-stop-probe.mjs`
- `scripts/check-agent-activity-events.mjs`
- `scripts/check-ui-structure.mjs`
- `package.json`
- `docs/checkpoints/HERMES_RUNS_STOP_EXPERIMENT_16E.md`
- `docs/product/STOP_CANCEL_STREAMING_13G.md`
- `docs/architecture/HERMES_RUNS_MIGRATION_ASSESSMENT_16A.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Prompt Used

Attempt 1 prompt:

```text
Count from 1 to 2000, one number per line. Do not summarize, skip numbers, or use tools.
```

Server-side instructions also told Hermes not to use tools, memory, commands,
files, web browsing, external resources, or approvals.

## Live Result

Base URL:

```text
http://127.0.0.1:3002
```

Hermes direct health:

```text
GET http://127.0.0.1:8642/health -> HTTP 200, status=ok, platform=hermes-agent
```

Stop probe:

```text
npm run smoke:hermes:runs:stop -- --base-url http://127.0.0.1:3002 --require-hermes
```

| Field | Result |
| --- | --- |
| Mode | `success` |
| Outcome | `server_stop_effective` |
| Run id | `run_ae63c23ca85a456d8ab455e3c3f40ba4` |
| Create status | `started` |
| Stop trigger | `timer` |
| Stop endpoint | HTTP 200 |
| Stop response status | `stopping` |
| Final status | `cancelled` |
| Event types observed | `run.cancelled` |
| Message delta events | 0 |
| Tool events | 0 |
| Brain Memory tool events | 0 |
| Approval events | 0 |
| Completed before stop | false |
| Server-side stop effective | true |

The run was stopped before assistant text deltas were emitted. This is a good
result for control-plane viability because the stop endpoint returned the
documented acknowledgement and status polling/events reconciled to
`cancelled`.

## Normalization Changes

`AgentActivityEvent` normalization now treats these Runs statuses/events as
cancelled activity:

- `run.cancelled`
- `run.canceled`
- `run.stopping`
- `run.stopped`
- `run.interrupted`
- explicit statuses containing `stop` or `interrupt`

Regression coverage verifies that stop details are redacted and bearer-like
values are not preserved in serialized activity output.

## Implications

Server-side Hermes Runs stop is viable for a future run-backed execution path.
The observed behavior matches the upstream source/docs shape:

- `POST /v1/runs/{run_id}/stop` returns `status=stopping`;
- the run later reconciles through event/status as `cancelled`.

This does not change production chat. The current composer stop remains the
Slice 13G client/BFF stream abort path and continues to report
`serverSideRunStop: false`.

## Limitations

- The diagnostic run stopped before text deltas arrived, so this slice did not
  prove partial-output truncation after already-rendered assistant text.
- The probe is not a production Runs stream route.
- No stop route was wired to the composer.
- No approval action route or UI was added.
- No Brain Memory mutation/admin UI was added.
- No direct browser-to-Hermes, browser-to-Brain-Memory, or storage path was
  added.
- The composer Agent access selector was not implemented.

## Checks

| Command | Result |
| --- | --- |
| `npm run smoke:hermes:runs:stop -- --base-url http://127.0.0.1:3002 --require-hermes` | passed |
| `npm run smoke:hermes:runs -- --base-url http://127.0.0.1:3002 --require-hermes` | passed |
| `npm run check:agent-activity` | passed, 35 checks |
| `npm run check:agent-activity-rendering` | passed, 35 checks |
| `npm run check:workspace-state` | passed |
| `npm run check:brain-memory-client` | passed |
| `npm run check:tenant-scope` | passed |
| `npm run check:ui-structure` | passed |
| `npm run typecheck` | passed |
| `npm run build` | passed |
| `npm audit --audit-level=moderate` | passed, 0 vulnerabilities |

## Recommendation

The next safe slice is Slice 16F: approvals action probe.

Reason: Runs now has BFF-only evidence for harmless send, event
normalization, Brain Memory MCP parity, and server-side stop. The remaining
high-risk control-plane capability before any experimental UI execution switch
is approval response behavior through the BFF.
