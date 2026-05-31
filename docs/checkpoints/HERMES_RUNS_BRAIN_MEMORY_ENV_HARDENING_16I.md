# Hermes Runs Brain Memory Env Hardening 16I

Date: 2026-05-31

Base commit before this slice: `3678c29 docs: decide Hermes Runs default migration status`

## Purpose

Slice 16I hardens the live environment and runbook path for Hermes Runs + Brain
Memory smokes. It does not migrate production chat to Runs.

## Required Env Posture

Web UI BFF process:

```text
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_UI_ENABLE_REAL_HERMES=true
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true
BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY=<redacted tenant-bound read key>
BRAIN_MEMORY_UI_API_KEY=<optional redacted UI bearer if Gateway requires it>
BRAIN_MEMORY_MCP_API_KEY_SET=<optional redacted diagnostics boolean>
```

Hermes MCP process:

```text
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080
BRAIN_MEMORY_DEFAULT_TENANT_ID=local-dev
BRAIN_MEMORY_API_KEY=<redacted MCP/Gateway key>
BRAIN_MEMORY_CALLER_LABEL=<local caller label>
```

Key roles:

- `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` authorizes tenant-bound Web UI BFF
  search/inspect readback. This is the important key for Runs memory smokes.
- `BRAIN_MEMORY_UI_API_KEY` is only the optional `/ui/**` bearer gate.
- Hermes MCP has its own Brain Memory key posture; the Web UI only exposes the
  redacted boolean `BRAIN_MEMORY_MCP_API_KEY_SET` for diagnostics.
- The canonical local tenant remains `local-dev`.

## Diagnostic Changes

- `POST /api/hermes/runs/memory-probe` now returns `hermesStatus`,
  `brainMemoryStatus`, redacted `envPosture`, `blockerCategory`, and a readable
  `blocker` message.
- `scripts/hermes-runs-memory-probe.mjs` prints Hermes status, Brain Memory BFF
  status, Gateway mode/config booleans, memory key boolean, optional UI bearer
  boolean, marker, run id/status, Brain Memory tool-event count, BFF search
  status, inspect status, and the normalized blocker category.
- `studio:doctor` and `studio:launch` now explain that the UI API key is an
  optional bearer and the tenant memory key authorizes scoped memory reads.
- Runbook and bundle docs now explain the required Runs + Brain Memory live env
  posture and the difference between 401 and 403 failures.

## Blocker Categories

The Runs memory probe can now report:

- `hermes_unreachable`
- `brain_memory_disabled`
- `brain_memory_gateway_unreachable`
- `brain_memory_key_missing`
- `brain_memory_key_unauthorized`
- `brain_memory_ui_bearer_unauthorized`
- `marker_not_stored`
- `marker_not_found`
- `scope_mismatch`
- `runs_mcp_failure`
- `unknown`

Interpretation:

- `brain_memory_disabled` means the Web UI BFF is not in real Gateway mode or
  lacks a configured Gateway URL.
- `brain_memory_gateway_unreachable` means the configured Gateway URL cannot be
  reached from the Web UI BFF.
- `brain_memory_key_missing` means search/inspect needs a tenant-bound memory
  key and the Web UI BFF does not have `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY`.
- `brain_memory_key_unauthorized` means the tenant-bound memory key is set but
  rejected for the active scope.
- `brain_memory_ui_bearer_unauthorized` means the optional UI bearer is missing
  or rejected.
- `marker_not_stored`, `marker_not_found`, `scope_mismatch`, and
  `runs_mcp_failure` distinguish actual Runs/MCP/readback behavior after env
  prerequisites are satisfied.

## Files Changed

- `.env.example`
- `env/attach-brain-memory-later.env.example`
- `env/bundle-with-brain-memory.env.example`
- `env/web-ui-only.env.example`
- `env/web-ui-with-hermes.env.example`
- `apps/web/src/app/api/hermes/runs/memory-probe/route.ts`
- `scripts/hermes-runs-memory-probe.mjs`
- `scripts/studio-doctor.mjs`
- `scripts/studio-launch.mjs`
- `scripts/check-ui-structure.mjs`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `docs/packaging/LOCAL_BUNDLE_CHECKLIST_14O.md`
- `docs/checkpoints/HERMES_RUNS_BRAIN_MEMORY_ENV_HARDENING_16I.md`
- `docs/architecture/HERMES_RUNS_MIGRATION_ASSESSMENT_16A.md`
- `ROADMAP.md`

## Live Verification

Selected Web UI base URL: `http://127.0.0.1:3002`

Hermes direct health and Brain Memory Gateway direct health were reachable
before the Web UI child process was started.

The temporary Web UI child process was started with:

- `BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080`
- `BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true`
- `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` parsed into the child process without
  printing the secret
- `BRAIN_MEMORY_MCP_API_KEY_SET=true`

Live Runs memory smoke:

```powershell
npm run smoke:hermes:runs:memory -- --base-url http://127.0.0.1:3002 --require-hermes --require-brain-memory
```

Result: passed.

- marker: `BM_RUNS_MEMORY_16D_20260531132559_UWE5CQ`
- run id: `run_c8da6218c99a4410b0a9acfd051083f1`
- Hermes status: real, reachable, configured
- Brain Memory status: real, reachable, configured
- Gateway memory key set: true
- optional UI bearer set: false
- MCP key posture observed by Web UI: true
- Brain Memory tool events: 2
- same-session search: real, no error
- inspect: real, no error
- same-session found: true
- inspect matched project/session: true
- different-project/different-session absent: true
- blocker category: none

Broader live smokes:

- First parallel broad-smoke attempt caused transient Hermes contention:
  `mvp-smoke` timed out on `/api/hermes/chat/stream` and
  `smoke:ui:memory-live` timed out waiting for assistant text.
- Sequential rerun passed:
  `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory
  --base-url http://127.0.0.1:3002`: 48 passed, 0 warnings, 0 failed.
- Sequential rerun passed:
  `npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:3002`:
  94 passed, 0 warnings, 0 failed.

## Check Matrix

| Command | Result |
| --- | --- |
| `npm run smoke:hermes:runs:memory -- --base-url http://127.0.0.1:3002 --require-hermes --require-brain-memory` | Pass |
| `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:3002` | Pass, 48 passed, 0 warnings |
| `npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:3002` | Pass, 94 passed, 0 warnings |
| `npm run check:brain-memory-client` | Pass |
| `npm run check:tenant-scope` | Pass |
| `npm run check:ui-structure` | Pass |
| `npm run check:workspace-state` | Pass |
| `npm run check:agent-activity` | Pass, 36 checks |
| `npm run check:agent-activity-rendering` | Pass, 35 checks |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm audit --audit-level=moderate` | Pass, 0 vulnerabilities |

## Cleanup

The temporary Web UI child process on port `3002` was stopped after live
verification. Final port check reported no listener on `3002`. Hermes on
`8642` and Brain Memory Gateway on `8080` were left running.

## Safety Boundaries

- The session stream remains the production default.
- experimental Runs remains flag-gated behind
  `HERMES_UI_EXPERIMENTAL_RUNS_MODE=true`.
- No direct browser-to-Hermes path was added.
- No direct browser-to-Brain Memory Gateway path was added.
- No direct browser-to-storage path was added.
- No Brain Memory mutation/admin UI was added.
- No approval buttons, composer Agent access selector, or provider/model
  switching were added.
- No Hermes source or Brain Memory source was modified.
- No secrets were printed or committed.

## Next Recommended Slice

Slice 16J: Runs replay/history reconciliation plan.

Reason: the live env/runbook path now has clearer diagnostics. Replay/history
and reconnect behavior remain the largest Runs default-migration blocker after
env posture.
