# Hermes Runs Probe 16B

Date: 2026-05-31

Base commit before this slice: `d246783`

Status: Live BFF-mediated harmless Runs probe passed. No UI execution switch was
implemented.

## Summary

Slice 16B added a diagnostic, BFF-only Hermes Runs probe:

```text
POST /api/hermes/runs/probe
```

The probe creates one short Hermes `/v1/runs` run through server-side BFF code,
reads `/v1/runs/{run_id}/events`, polls `/v1/runs/{run_id}`, and returns a
redacted normalized result. It is not wired to the production composer, chat
send path, stop control, approval controls, or any visible UI surface.

Production chat still uses:

```text
Browser UI -> Next.js BFF /api/hermes/chat/stream -> Hermes session chat stream
```

## Files Changed

- `packages/hermes-client/src/index.ts`
- `packages/hermes-client/src/types.ts`
- `apps/web/src/app/api/hermes/runs/probe/route.ts`
- `scripts/hermes-runs-probe.mjs`
- `package.json`
- `scripts/check-ui-structure.mjs`
- `docs/checkpoints/HERMES_RUNS_PROBE_16B.md`
- `docs/architecture/HERMES_RUNS_MIGRATION_ASSESSMENT_16A.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Probe Behavior

NPM command:

```text
npm run smoke:hermes:runs -- --base-url http://127.0.0.1:3002 --require-hermes
```

BFF route:

```text
POST /api/hermes/runs/probe
```

Hermes endpoints used behind the BFF:

- `GET /v1/capabilities`
- `POST /v1/runs`
- `GET /v1/runs/{run_id}/events`
- `GET /v1/runs/{run_id}`

The route does not call:

- `POST /v1/runs/{run_id}/stop`
- `POST /v1/runs/{run_id}/approval`
- Brain Memory Gateway
- storage backends

The script calls only the Web UI BFF route by default. No browser direct Hermes
call was added.

## Harmless Prompt

Prompt:

```text
Reply exactly: HERMES_RUNS_PROBE_OK
```

Instructions:

```text
Do not use tools, memory, commands, files, web browsing, or external resources. Reply with the exact requested text only.
```

The prompt is intentionally chat-only and avoids tool-triggering language. It
does not request memory storage, memory retrieval, shell commands, file access,
web browsing, approvals, or external work.

## Live Service Status

Local Hermes was reachable before the live probe:

| Probe | Result |
| --- | --- |
| `GET http://127.0.0.1:8642/health` | HTTP 200, `status=ok`, `platform=hermes-agent` |
| `GET http://127.0.0.1:8642/health/detailed` | HTTP 200, `gateway_state=running`, `api_server=connected`, `active_agents=0` |
| `GET http://127.0.0.1:3002/api/hermes/status` | HTTP 200, `mode=real`, `reachable=true` |

Temporary Web UI BFF used for the probe:

```text
http://127.0.0.1:3002
```

## Live Probe Result

Command:

```text
npm run smoke:hermes:runs -- --base-url http://127.0.0.1:3002 --require-hermes
```

Result: passed.

| Field | Result |
| --- | --- |
| Mode | `success` |
| Run id | `run_a3743ab56e10437fb2a722edd8ecbc76` |
| Final status | `completed` |
| Event count | 11 |
| Message delta events | 9 |
| Tool events | 0 |
| Brain Memory tool events | 0 |
| Approval events | 0 |
| Assistant text preview | `HERMES_RUNS_PROBE_OK` |
| Output preview | `HERMES_RUNS_PROBE_OK` |

Observed event types:

- `message.delta`
- `reasoning.available`
- `run.completed`

Brain Memory tools involved: no.

No command, file, web, approval, stop, or Brain Memory tool activity was
observed.

## Event Shape Notes

The Runs event stream differs from the current session stream:

- Runs events arrive as JSON in SSE `data:` frames, not named UI event frames.
- Runs use `event` inside the payload, such as `message.delta` and
  `run.completed`.
- The probe observed `reasoning.available`, which the current production
  session-stream UI does not fully normalize yet.
- `message.delta` carried assistant text deltas.
- `run.completed` carried final output and status data.

These shapes are enough to justify Slice 16C as an event-normalization parity
slice, but they are not enough to switch production chat to Runs.

## Stop And Approval Status

Server-side run stop remains untested in this slice.

Approval actions remain untested in this slice.

This slice does not add:

- BFF stop route;
- BFF approval route;
- approval buttons;
- server-side stop UX;
- Runs execution mode in the composer.

## Future Agent Access Selector

The user likes the idea of a composer `Agent access` selector similar to
Codex's `Full access` control. That is valid future work only after Hermes
Runs approval/control-plane behavior is proven and mapped honestly to real
BFF/Hermes policy.

The composer Agent access selector was not implemented in this slice.

Future requirements before such a selector:

- capability-driven tool/approval policy;
- BFF-owned Runs execution path;
- deterministic approval request/response UX;
- clear labels that map to real Hermes behavior;
- auth/classification plan before risky permissions are exposed.

## Safety Boundaries

Preserved boundaries:

- Browser production chat still calls `/api/hermes/chat/stream`.
- Browser code does not call Hermes directly.
- Browser code does not call Brain Memory Gateway directly.
- BFF owns Hermes auth and does not expose `HERMES_API_KEY`.
- The probe returns only normalized/redacted output.
- No Brain Memory BFF logic changed.
- No memory scope bridge logic changed.
- No project/session stable keys changed.
- No memory mutation/admin UI was added.
- No direct storage access was added.
- No auth/classification behavior was implemented.
- No Hermes source was modified.
- The probe is not included in `release:check`.

## Recommendation

Runs can create a harmless run, stream basic event shape, and return pollable
status through the Web UI BFF. Keep session stream as production default.

Use Slice 16C to build a focused Runs event normalization parity contract with
`AgentActivityEvent`, including `message.delta`, `reasoning.available`,
`run.completed`, `run.failed`, cancellation, tool events, and approval events.

## Next Recommended Slice

Slice 16C: Runs event normalization parity with AgentActivityEvent.
