# Hermes Runs Event Normalization 16C

Date: 2026-05-31

Base commit before this slice: `953800d`

Status: Runs event normalization parity added for the frontend
`AgentActivityEvent` model. Production chat still uses the existing session
stream path.

## Summary

Slice 16C adds a dedicated frontend normalization adapter for raw Hermes Runs
events:

```text
Hermes /v1/runs/{run_id}/events JSON payload
  -> createActivityEventFromHermesRunsEvent
  -> AgentActivityEvent | null
```

This is not a production execution switch. The browser composer still sends
through:

```text
Browser UI -> Next.js BFF /api/hermes/chat/stream -> Hermes session chat stream
```

The only live Runs route remains the diagnostic BFF probe:

```text
POST /api/hermes/runs/probe
```

## Files Changed

- `apps/web/src/lib/agentActivityEvents.ts`
- `scripts/check-agent-activity-events.mjs`
- `scripts/check-agent-activity-rendering.mjs`
- `scripts/hermes-runs-probe.mjs`
- `scripts/check-ui-structure.mjs`
- `docs/architecture/HERMES_EVENT_NORMALIZATION_PLAN.md`
- `docs/product/AGENT_ACTIVITY_EVENT_MODEL.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `docs/checkpoints/HERMES_RUNS_EVENT_NORMALIZATION_16C.md`
- `docs/checkpoints/HERMES_RUNS_PROBE_16B.md`
- `ROADMAP.md`

## Normalization Contract

| Hermes Runs event | AgentActivityEvent handling |
| --- | --- |
| `message.delta` | Returns `null`; assistant text buffer only, not one activity row per delta. |
| `reasoning.available` | `type: "reasoning"`, `status: "info"`, title `Thinking signal received`, with raw reasoning-like text omitted. |
| `run.completed` | `type: "status"`, `status: "completed"`, title `Run completed`, completed timestamp and duration when present. |
| `run.failed` | `type: "error"`, `status: "failed"`, title `Run failed`, details collapsed except failure summary. |
| `run.cancelled` / `run.canceled` | `type: "status"`, `status: "cancelled"`, title `Run cancelled`. |
| `run.queued` / `run.started` / `run.running` | Status lifecycle rows with `queued` or `running`. |
| `tool.started` / `tool.completed` / `tool.failed` | Reuses existing tool, memory, command, artifact classification. |
| `approval.request` / `approval.responded` | Reuses existing display-only approval mapping; no action route or buttons. |
| unknown run events | Compact informational status rows with collapsed redacted details. |

## Message Delta Decision

Runs `message.delta` is intentionally not converted into an activity row. It is
assistant text stream data, and rendering one activity event per token/delta
would be noisy and would undermine the existing fast-stream batching contract.

Future Runs execution should route `message.delta` into the assistant text
buffer and may emit a separate coarse streaming status if needed.

## Reasoning Safety Policy

Runs `reasoning.available` is treated as a public progress signal only. The UI
does not render hidden/private chain-of-thought, does not invent reasoning
text, and does not show raw reasoning-like payload fields in expanded details.

The normalizer replaces top-level or nested reasoning-like keys such as `text`,
`content`, `delta`, `reasoning`, `reasoning_text`, `thoughts`, and
`chain_of_thought` with:

```text
[omitted: reasoning text not rendered]
```

The visible title is generic: `Thinking signal received`.

## Probe Script Update

`npm run smoke:hermes:runs` still calls only the Web UI BFF probe route. It now
prints a small `normalizedActivity` policy summary for observed event types,
for example:

```text
message.delta -> assistant text buffer only
reasoning.available -> safe public reasoning signal
run.completed -> completed AgentActivityEvent status
```

This is reporting only. It does not add a browser-to-Hermes path, production
Runs execution, run stop, or approval action.

## Regression Coverage

Added checks:

- `runs-message-delta-ignored`
- `runs-reasoning-safe`
- `runs-completed-status`
- `runs-tool-and-approval-parity`
- `runs-unknown-fallback`
- `runs-event-helper-render-shape`

Focused checks passed during implementation:

| Command | Result |
| --- | --- |
| `npm run check:agent-activity` | passed, 31 checks |
| `npm run check:agent-activity-rendering` | passed, 35 checks |
| `npm run check:workspace-state` | passed |
| `npm run check:brain-memory-client` | passed |
| `npm run check:tenant-scope` | passed |
| `npm run check:ui-structure` | passed |
| `npm run typecheck` | passed |
| `npm run build` | passed |
| `npm audit --audit-level=moderate` | passed, 0 vulnerabilities |

## Live Runs Probe

Hermes was reachable at `http://127.0.0.1:8642/health`.

A temporary Web UI BFF server was started at:

```text
http://127.0.0.1:3002
```

Command:

```text
npm run smoke:hermes:runs -- --base-url http://127.0.0.1:3002 --require-hermes
```

Result: passed.

| Field | Result |
| --- | --- |
| Mode | `success` |
| Run id | `run_c9d23539b4d94461958562ce133789b5` |
| Final status | `completed` |
| Event count | 11 |
| Message delta events | 9 |
| Tool events | 0 |
| Brain Memory tool events | 0 |
| Approval events | 0 |
| Assistant text preview | `HERMES_RUNS_PROBE_OK` |
| Output preview | `HERMES_RUNS_PROBE_OK` |

Observed normalization policy:

- `message.delta x9 -> assistant text buffer only`
- `reasoning.available x1 -> safe public reasoning signal`
- `run.completed x1 -> completed AgentActivityEvent status`

## Boundaries Preserved

- Production chat was not switched to Runs.
- `/api/hermes/chat/stream` behavior was not changed.
- No `/api/hermes/runs/stream`, stop, approval, or production run route was added.
- No server-side run stop was implemented.
- No approval action controls were implemented.
- The composer Agent access selector was not implemented.
- Browser source still calls the Web UI BFF, not Hermes directly.
- Brain Memory BFF logic was not changed.
- Memory scope bridge behavior and project/session stable keys were not changed.
- No Brain Memory mutation/admin action was added.
- No direct browser-to-Gateway, direct browser-to-Hermes, or direct storage path was added.
- No auth/classification behavior was implemented.

## Remaining Risks

- Brain Memory MCP/tool event parity on the Runs path is still unproven live.
- Server-side run stop remains untested from the Studio.
- Approval response actions remain untested and unimplemented.
- Runs event stream replay durability is still not proven beyond active stream
  consumption plus status polling.
- Production UI still depends on the session-stream BFF path by design.

## Next Recommended Slice

Slice 16D: Brain Memory MCP parity test in Runs flow.

The next slice should keep the production session stream as default and add an
opt-in, BFF-mediated live probe that proves whether Runs with the existing
memory scope header and bridge instruction can invoke Brain Memory MCP tools
with the same project/session scoping as the current session-stream path.
