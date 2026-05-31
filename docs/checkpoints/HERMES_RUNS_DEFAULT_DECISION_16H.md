# Hermes Runs Default Decision 16H

Date: 2026-05-31

Baseline commit audited before this decision: `9224cf2 feat: add experimental Hermes Runs mode gate`

## Decision

Decision: keep session stream as production default.

The production chat path remains `POST /api/hermes/chat/stream`. Hermes Runs
stays behind the disabled-by-default experimental gate
`HERMES_UI_EXPERIMENTAL_RUNS_MODE=true`.

This slice does not migrate the default, does not alter the production session
stream route, and does not add a composer Agent access selector.

## Current Architecture Summary

- Browser code calls Web UI BFF routes.
- The production chat composer still uses the Web UI BFF session-stream route:
  `POST /api/hermes/chat/stream`.
- The experimental Runs diagnostic path uses BFF-only routes under
  `/api/hermes/runs/*`.
- Hermes remains the agent runtime.
- Brain Memory Gateway remains the memory authority.
- Agent memory still flows through Hermes to Brain Memory MCP/skill and then to
  Brain Memory Gateway.
- UI observability/readback still flows through the Web UI BFF to Brain Memory
  Gateway.
- No direct browser-to-Hermes, direct browser-to-Gateway, or direct storage
  path was added.

## Runs Readiness Matrix

| Area | Evidence | Status for default migration |
| --- | --- | --- |
| Basic Runs execution | `npm run smoke:hermes:runs` passed against `http://127.0.0.1:3002`; run `run_c6201c5f750d49a0a170f78b82776d75`; final status `completed`; event types `message.delta`, `reasoning.available`, `run.completed`. | Ready as diagnostic evidence. |
| Experimental mode gate | Flag-off smoke previously returned HTTP 403 with no run. Flag-on smoke passed in 16H; run `run_f3ffc55e5f114fe8a07c4881002c68cf`; output `HERMES_RUNS_EXPERIMENTAL_CHAT_OK`; `productionChatUntouched: true`. | Ready as gated experiment, not default. |
| Brain Memory MCP parity | 16D passed. 16H rerun with full Web UI child env passed; marker `BM_RUNS_MEMORY_16D_20260531130915_LK1DJG`; run `run_914b8f0408aa4726ae2b21478e937b35`; 2 Brain Memory tool events; same-session search and inspect passed; different project/session absent. | Functionally promising, but env/runbook hardening is still required before default migration. |
| Tenant and stable scope | Existing 15E/16D/16H evidence keeps `local-dev`, project stable key, session stable key, and scoped readback explicit. | Needs repeatable release gate under documented env. |
| AgentActivityEvent parity | 16C documented `message.delta`, `reasoning.available`, run status, tool, approval, and unknown-event normalization. | Ready for observed event classes. |
| Server-side stop | 16E passed. 16H rerun passed; run `run_526683b2aa264586bb79cdee3724c223`; stop HTTP 200; final status `cancelled`; `serverSideStopEffective: true`. | Viable for future Runs-backed composer, not wired into production composer yet. |
| Approvals | 16F passed. 16H rerun passed; run `run_525fc41a65624c4689ffff573eeb324c`; observed `approval.request` and `approval.responded`; deny action resolved; no raw secret rendered. | Viable as BFF probe, but production approval UX is not implemented. |
| Replay/history/reconnect | Not proven for a production chat replacement. | Blocking for default migration. |

## 16G Memory Smoke Failure Analysis

The 16G experimental chat route itself passed its basic live prompt and did not
exercise Brain Memory tools. The later 16G memory smoke failure came from the
existing Runs Brain Memory parity probe/readback path under an incomplete
temporary Web UI child environment.

Observed sequence:

- First 16G memory smoke skipped because the temporary Web UI process did not
  have `BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true`.
- A retry reached Hermes and Brain Memory and observed 2 Brain Memory tool
  events, but the Web UI BFF readback returned an unauthorized normalized
  response.
- 16H env inspection found the local Web UI env did not carry the tenant-bound
  Brain Memory Gateway memory key.
- Direct Gateway search with the tenant key from the sibling Brain Memory local
  env returned HTTP 200 without printing the secret.
- 16H started a temporary Web UI child with
  `BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080`,
  `BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true`, and
  `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` set inside the child process.
- Under that full env, `npm run smoke:hermes:runs:memory -- --base-url
  http://127.0.0.1:3002 --require-hermes --require-brain-memory` passed.

Conclusion: the 16G failure was an env/runbook gap for the Web UI BFF readback,
not evidence that Hermes Runs cannot invoke Brain Memory or that
`POST /api/hermes/runs/experimental-chat` broke memory scope.

## Route Matrix

| Route | Current role | 16H status |
| --- | --- | --- |
| `POST /api/hermes/chat/stream` | Production session-stream chat path. | Remains production default. |
| `POST /api/hermes/runs/probe` | BFF-only diagnostic basic Runs probe. | Passed live smoke. |
| `POST /api/hermes/runs/memory-probe` | BFF-only diagnostic Runs + Brain Memory parity probe. | Passed live smoke with full env. |
| `POST /api/hermes/runs/stop-probe` | BFF-only diagnostic server-side Runs stop probe. | Passed live smoke. |
| `POST /api/hermes/runs/approval-probe` | BFF-only diagnostic Runs approval action probe. | Passed live smoke with deny action. |
| `POST /api/hermes/runs/experimental-chat` | Disabled-by-default experimental Runs execution check. | Passed flag-on smoke; flag-off behavior remains HTTP 403. |
| Browser direct Hermes/Gateway/storage | Forbidden architecture path. | Not added. |

## Default Migration Criteria

Do not switch the production default to Hermes Runs until all of these criteria
are met:

1. Basic Runs chat smoke passes against the intended release env.
2. Runs + Brain Memory marker E2E passes under the same Web UI env used by the
   production candidate.
3. Memory scope and tenant isolation are repeatable, including wrong-project
   and wrong-session negative checks.
4. Server-side run stop is wired through the intended production composer path
   and has a rollback story.
5. Approval actions are either fully implemented in production UX or explicitly
   and safely deferred with no action affordances.
6. AgentActivityEvent parity covers all event classes the production UX renders.
7. Run history, replay, reconnect, and status reconciliation have a documented
   contract and smoke coverage.
8. Session stream rollback remains available and documented.
9. The browser still calls only Web UI BFF routes.
10. The release gate includes the Brain Memory live env requirements, especially
    `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY`.

## Migration Decision

Option B is selected: keep session stream as production default and keep Hermes
Runs experimental.

Rationale:

- Runs now has strong diagnostic evidence for basic chat, Brain Memory MCP
  parity, event normalization, server-side stop, and approval denial.
- The production UX is still missing run-backed replay/reconnect history,
  production stop wiring, production approval controls, and a composer Agent
  access selector.
- The 16G/16H Brain Memory readback difference shows that the live env needs a
  tighter runbook before a default migration.
- Keeping session stream as default preserves the known working path while
  allowing targeted Runs hardening.

## Checks Run In This Slice

Live smokes against temporary Web UI `http://127.0.0.1:3002`:

- `npm run smoke:hermes:runs:experimental-chat -- --base-url
  http://127.0.0.1:3002 --require-hermes`: passed.
- `npm run smoke:hermes:runs -- --base-url http://127.0.0.1:3002
  --require-hermes`: passed.
- `npm run smoke:hermes:runs:memory -- --base-url http://127.0.0.1:3002
  --require-hermes --require-brain-memory`: passed.
- `npm run smoke:hermes:runs:stop -- --base-url http://127.0.0.1:3002
  --require-hermes`: passed.
- `npm run smoke:hermes:runs:approval -- --base-url http://127.0.0.1:3002
  --require-hermes`: passed.

Repository checks should remain the release gate after this doc is committed:

- `npm run check:agent-activity`
- `npm run check:agent-activity-rendering`
- `npm run check:workspace-state`
- `npm run check:brain-memory-client`
- `npm run check:tenant-scope`
- `npm run check:ui-structure`
- `npm run typecheck`
- `npm run build`
- `npm audit --audit-level=moderate`

## Known Remaining Issues

- Runs replay/history/reconnect parity is not proven.
- Production composer still does not use server-side Runs stop.
- Production approval buttons are not implemented.
- The composer Agent access selector was not implemented.
- Provider/model selector polish remains deferred.
- The Brain Memory live env needs a reproducible runbook so the Web UI BFF has
  the correct Gateway URL, real-Gateway flag, and tenant memory key.

## Boundaries Confirmed

- Production chat still uses `/api/hermes/chat/stream`.
- No direct browser-to-Hermes path was added.
- No direct browser-to-Brain Memory Gateway path was added.
- No direct browser-to-storage path was added.
- No Brain Memory mutation/admin UI was added.
- No project/session stable keys were changed.
- No Hermes or Brain Memory source was edited.
- No secrets were committed.

## Cleanup Performed

- Temporary Web UI process on port `3002` was used only for smoke tests and
  was stopped after verification; final port check reported no listener on
  `3002`.
- Secrets were not printed; the Gateway memory key was parsed inside the child
  process environment.
- Only decision/checkpoint documentation and check assertions are intended for
  the commit.

## Next Recommended Slice

Slice 16I: Runs Brain Memory live env/runbook hardening.

Reason: before any production default migration, the team needs a repeatable
local/release runbook and guardrail check proving that the Web UI BFF has the
required Brain Memory live env for Runs memory readback.
