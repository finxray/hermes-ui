# Hermes Runs Approval Probe 16F

Date: 2026-05-31

Status: Runs approval request and rejection action passed through an opt-in BFF
diagnostic probe. Production chat still uses `/api/hermes/chat/stream`.

## Summary

Slice 16F added a diagnostic-only route and smoke command to test Hermes Runs
approval actions without wiring them to the composer:

```text
POST /api/hermes/runs/approval-probe
```

```text
Script/browser -> Next.js BFF /api/hermes/runs/approval-probe
  -> Hermes /v1/runs
  -> Hermes /v1/runs/{run_id}/events
  -> Hermes /v1/runs/{run_id}/approval
  -> Hermes /v1/runs/{run_id} status polling
```

No direct browser-to-Hermes path was added.

## Files Changed

- `packages/hermes-client/src/index.ts`
- `packages/hermes-client/src/types.ts`
- `apps/web/src/app/api/hermes/runs/approval-probe/route.ts`
- `scripts/hermes-runs-approval-probe.mjs`
- `apps/web/src/lib/agentActivityEvents.ts`
- `scripts/check-agent-activity-events.mjs`
- `scripts/check-ui-structure.mjs`
- `package.json`
- `docs/checkpoints/HERMES_RUNS_APPROVAL_PROBE_16F.md`
- `docs/architecture/HERMES_RUNS_MIGRATION_ASSESSMENT_16A.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Probe Shape

Default action choice:

```text
deny
```

The probe intentionally uses denial by default. This proves the BFF can resolve
a pending approval while preventing the diagnostic command from executing.

Prompt:

```text
This is a controlled Hermes Runs approval diagnostic.
Use the terminal tool to attempt exactly this command: rm -rf /tmp/hermes-ui-approval-probe-nonexistent
Do not use any other tool or command.
After the approval decision is resolved, reply exactly:
HERMES_RUNS_APPROVAL_PROBE_DONE
```

The command targets a non-existent `/tmp` path and is denied by the BFF action.
The route remains diagnostic-only and is not wired to the production composer.

## Live Result

Base URL:

```text
http://127.0.0.1:3002
```

Hermes direct health:

```text
GET http://127.0.0.1:8642/health -> HTTP 200, status=ok, platform=hermes-agent
```

Approval probe:

```text
npm run smoke:hermes:runs:approval -- --base-url http://127.0.0.1:3002 --require-hermes
```

| Field | Result |
| --- | --- |
| Mode | `success` |
| Outcome | `approval_denied_and_reconciled` |
| Run id | `run_e345b064a8a94067bfa611df280b134c` |
| Create status | `started` |
| Final status | `completed` |
| Approval required observed | true |
| Approval event types | `approval.request`, `approval.responded` |
| Approval action attempted | `reject` |
| Approval choice | `deny` |
| Approval endpoint | HTTP 200 |
| Approval resolved count | 1 |
| Event types observed | `approval.request`, `approval.responded`, `message.delta`, `reasoning.available`, `run.completed`, `tool.completed`, `tool.started` |
| Message delta events | 14 |
| Tool events | 2 |
| Brain Memory tool events | 0 |
| Approval events | 2 |
| Approval activity events | 2 |
| Waiting approval activity | 1 |
| Cancelled approval activity | 1 |
| Raw secret rendered | false |
| Assistant/output preview | `HERMES_RUNS_APPROVAL_PROBE_DONE` |

## Normalization And Redaction

No new UI-facing approval status was needed. Existing
`AgentActivityEvent` approval mapping handled:

- `approval.request` -> `approval` / `waiting_for_approval`
- `approval.responded` with `choice=deny` -> `approval` / `cancelled`
- non-deny approval responses -> `approval` / `completed`

Slice 16F tightened approval redaction so approval prompts/details also redact:

- bearer-like values;
- token-like URL query values such as `?token=...`;
- secret-like object keys such as `Authorization`.

Regression coverage includes `runs-approval-secret-redaction`.

## Implications

Runs approval actions are viable through the BFF for a future run-backed
execution path. The observed behavior matches the upstream source/docs shape:

- `approval.request` appears on `/v1/runs/{run_id}/events`;
- `POST /v1/runs/{run_id}/approval` accepts `choice=deny`;
- Hermes emits `approval.responded`;
- the run can then continue and reconcile to a terminal status.

This does not change production chat. The current composer remains
session-stream based and does not expose live approval buttons.

## Limitations

- The smoke proves the rejection path, not approving and executing a command.
- The diagnostic command relies on Hermes choosing the terminal tool as
  instructed; this is deterministic enough for the local live probe but still
  model/tool-behavior dependent.
- The probe is not a production Runs execution route.
- No approval buttons were added to the production composer.
- No Brain Memory mutation/admin UI was added.
- No direct browser-to-Hermes, browser-to-Brain-Memory, or storage path was
  added.
- The composer Agent access selector was not implemented.

## Checks

| Command | Result |
| --- | --- |
| `npm run smoke:hermes:runs:approval -- --base-url http://127.0.0.1:3002 --require-hermes` | passed |
| `npm run smoke:hermes:runs -- --base-url http://127.0.0.1:3002 --require-hermes` | passed |
| `npm run smoke:hermes:runs:stop -- --base-url http://127.0.0.1:3002 --require-hermes` | passed |
| `npm run check:agent-activity` | passed, 36 checks |
| `npm run check:agent-activity-rendering` | passed, 35 checks |
| `npm run check:workspace-state` | passed |
| `npm run check:brain-memory-client` | passed |
| `npm run check:tenant-scope` | passed |
| `npm run check:ui-structure` | passed |
| `npm run typecheck` | passed |
| `npm run build` | passed |
| `npm audit --audit-level=moderate` | passed, 0 vulnerabilities |

## Recommendation

The next safe slice is Slice 16G: experimental Runs mode feature flag.

Reason: Runs now has BFF-only evidence for harmless send, event normalization,
Brain Memory MCP parity, server-side stop, and approval rejection. The next
step should still avoid switching defaults, but can define a feature-flagged
experimental Runs execution path contract and guardrails.
