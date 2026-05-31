# Hermes Runs Brain Memory Parity 16D

Date: 2026-05-31

Base commit before this slice: `d5b5083`

Status: Runs Brain Memory MCP parity passed through an opt-in BFF diagnostic
probe. Production chat still uses the session-stream path.

## Summary

Slice 16D added an opt-in BFF route and smoke command that test whether Hermes
Runs can store a scoped Brain Memory marker through Hermes MCP and verify it
through the existing Brain Memory BFF read paths:

```text
Browser/script -> Next.js BFF /api/hermes/runs/memory-probe
  -> Hermes /v1/runs
  -> Brain Memory MCP -> Brain Memory Gateway
  -> Brain Memory BFF search/inspect
```

The production composer was not switched to Runs.

## Files Changed

- `packages/hermes-client/src/index.ts`
- `packages/hermes-client/src/types.ts`
- `apps/web/src/app/api/hermes/runs/memory-probe/route.ts`
- `scripts/hermes-runs-memory-probe.mjs`
- `scripts/check-agent-activity-events.mjs`
- `scripts/check-ui-structure.mjs`
- `package.json`
- `docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_PARITY_16D.md`
- `docs/checkpoints/HERMES_RUNS_EVENT_NORMALIZATION_16C.md`
- `docs/architecture/HERMES_RUNS_MIGRATION_ASSESSMENT_16A.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Selected Web UI Base URL

```text
http://127.0.0.1:3002
```

The temporary Web UI process was started with Brain Memory Gateway env supplied
only to the child process. No env files were changed and no secrets were
printed.

## Live Prerequisites

| Service | Result |
| --- | --- |
| Hermes direct `GET http://127.0.0.1:8642/health` | HTTP 200, `status=ok`, `platform=hermes-agent` |
| Brain Memory Gateway `GET http://127.0.0.1:8080/health` | HTTP 200, `status=ok`, Postgres `ok` |
| Brain Memory Gateway `GET http://127.0.0.1:8080/ready` | HTTP 200, `status=READY`, Postgres `ok` |
| Web UI BFF `GET /api/hermes/status` | `mode=real`, `reachable=true`, `configured=true` |
| Web UI BFF `GET /api/brain-memory/status` | `mode=real`, `reachable=true`, `configured=true` |
| Web UI BFF `GET /api/tenant-scope/diagnostics` | redacted posture only, Gateway memory key set, allowed tenants `wildcard` |

## Probe Contract

Route:

```text
POST /api/hermes/runs/memory-probe
```

Smoke:

```text
npm run smoke:hermes:runs:memory -- --base-url http://127.0.0.1:3002 --require-hermes --require-brain-memory
```

Prompt shape:

```text
Store this harmless Hermes Runs memory probe marker in Brain Memory exactly: <marker>. Then reply BM_RUNS_MEMORY_STORED.
```

The route injects the same memory-scope bridge used by the session-stream BFF.
It allows only Brain Memory MCP use for this diagnostic and tells Hermes not to
run commands, read/write files, browse the web, use external network resources,
or request approvals.

## Marker

Passing marker:

```text
BM_RUNS_MEMORY_16D_20260531120408_50ZNHG
```

Probe context:

| Field | Value |
| --- | --- |
| Tenant | `local-dev` |
| Project id | `project-runs-memory-16d` |
| Project key | `studio:local-dev:project:project-runs-memory-16d` |
| Session id | `session-runs-memory-16d` |
| Session key | `studio:local-dev:project:project-runs-memory-16d:session:session-runs-memory-16d` |
| Hermes session id | `hermes-session-session-runs-memory-16d` |

## Runs Result

| Field | Result |
| --- | --- |
| Mode | `success` |
| Run id | `run_9598780e01984716b2676e4c11f7ef2c` |
| Final status | `completed` |
| Assistant/output preview | `BM_RUNS_MEMORY_STORED` |
| Event types | `message.delta`, `reasoning.available`, `run.completed`, `tool.completed`, `tool.started` |
| Message delta events | 6 |
| Tool events | 2 |
| Brain Memory tool events | 2 |
| Approval events | 0 |

## Brain Memory BFF Search And Inspect

Same project/session search:

- `mode=real`
- result count: 1
- first result id: `8806475e-e01e-4b42-8976-cb15f6e18f8b`
- `projectKey=studio:local-dev:project:project-runs-memory-16d`
- `sessionKey=studio:local-dev:project:project-runs-memory-16d:session:session-runs-memory-16d`
- `scopeStatus=matching-session`

Inspect:

- `mode=real`
- detail returned
- tenant: `local-dev`
- `projectKey=studio:local-dev:project:project-runs-memory-16d`
- `sessionKey=studio:local-dev:project:project-runs-memory-16d:session:session-runs-memory-16d`
- `scopeStatus=matching-session`
- `layer=canonical`
- `source=brain-memory`

Scope isolation:

| Check | Result |
| --- | --- |
| Same project + same session | marker found |
| Same project + different session | marker absent |
| Different project | marker absent |
| Inspect project/session | matched expected stable keys |
| Inspect tenant | `local-dev` |

## Normalization Parity

The captured Runs events normalized into `AgentActivityEvent` as expected:

| Check | Result |
| --- | --- |
| Brain Memory tool events | 2 |
| Memory activity events | 2 |
| Unique activity ids | true |
| Hidden reasoning text exposed | false |
| Generic tool synthetic parity | covered by `check:agent-activity` |
| Command-like tool synthetic parity | covered by `check:agent-activity` |
| Redaction checks | covered by `check:agent-activity` and rendering checks |

Slice 16D also fixed the Runs probe summary path so event summaries are not
normalized twice. The double-normalization bug had erased safe event fields
such as raw key lists and tool names from probe output.

## Checks

| Command | Result |
| --- | --- |
| `npm run smoke:hermes:runs -- --base-url http://127.0.0.1:3002 --require-hermes` | passed |
| `npm run smoke:hermes:runs:memory -- --base-url http://127.0.0.1:3002 --require-hermes --require-brain-memory` | passed |
| `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:3002` | passed, 48 passed, 0 warnings |
| `npm run check:agent-activity` | passed, 33 checks |
| `npm run check:agent-activity-rendering` | passed, 35 checks |
| `npm run check:workspace-state` | passed |
| `npm run check:brain-memory-client` | passed |
| `npm run check:tenant-scope` | passed |
| `npm run check:ui-structure` | passed |
| `npm run typecheck` | passed |
| `npm run build` | passed |
| `npm audit --audit-level=moderate` | passed, 0 vulnerabilities |

## Boundaries Preserved

- Production chat still uses `/api/hermes/chat/stream`.
- `/api/hermes/chat/stream` behavior was not changed.
- No direct browser-to-Hermes calls were added.
- No direct browser-to-Brain-Memory calls were added.
- No direct storage access was added.
- No Brain Memory mutation/admin UI was added.
- No tenant authorization was loosened.
- Project/session stable keys were not changed.
- Server-side run stop was not implemented.
- Approval actions were not implemented.
- Composer Agent access selector was not implemented.
- Auth/classification and export/import remain deferred.

## Cleanup

The temporary Web UI child process on port `3002` should be stopped after the
final checks and commit. Hermes on `8642` and Brain Memory Gateway on `8080`
are live services and should be left running.

## Result

Runs Brain Memory MCP parity passed for this local MVP diagnostic.

This is enough evidence to continue the hybrid experimental Runs track, but it
is not enough to switch production chat to Runs. Stop, approvals, reconnect,
replay correlation, and feature flagging remain unproven.

## Next Recommended Slice

Slice 16E: server-side run stop experiment.
