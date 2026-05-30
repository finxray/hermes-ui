# Live Brain Memory Re-check 12C

Date: 2026-05-30

## Summary

Slice 12C re-checked Brain Memory Gateway availability and the Hermes UI BFF
Brain Memory routes after Slice 12B added the MVP smoke harness.

Result: live Brain Memory Gateway could not be verified in this UI process
because no Gateway was listening on the tested local ports and no tenant-bound
memory key was configured for the Web UI. The default MVP smoke still passes in
mock/unconfigured mode, and the live-required smoke now fails honestly when
Brain Memory is required but unavailable.

No secrets were printed or committed.

## Gateway URLs Tested

| URL | Result |
| --- | --- |
| `http://127.0.0.1:8080/health` | Unreachable: unable to connect to remote server. |
| `http://127.0.0.1:8080/ui/capabilities` | Unreachable: unable to connect to remote server. |
| `http://127.0.0.1:8765/health` | Unreachable: unable to connect to remote server. |

The expected common live Gateway URL for previous integration slices remains:

```text
http://127.0.0.1:8080
```

## Temporary Environment

No `apps/web/.env.local` changes were committed.

Observed local Web UI env state, redacted:

| Variable | Observed |
| --- | --- |
| `HERMES_API_BASE_URL` | `http://127.0.0.1:8642` |
| `HERMES_API_KEY` | set |
| `BRAIN_MEMORY_GATEWAY_URL` | missing |
| `BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY` | missing |
| `BRAIN_MEMORY_UI_API_KEY` | missing |
| `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` | missing |
| `BRAIN_MEMORY_API_KEY` | missing |

Required live Brain Memory env shape for a future re-run:

```text
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true
BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY=<redacted tenant-bound key>
BRAIN_MEMORY_UI_API_KEY=<optional redacted UI bearer>
```

Important: `BRAIN_MEMORY_UI_API_KEY` is only the optional UI bearer gate.
Tenant authorization for search/detail comes from
`BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY`.

## BFF Status Result

Target:

```text
GET http://127.0.0.1:3000/api/brain-memory/status
```

Observed:

| Field | Value |
| --- | --- |
| HTTP | `200` |
| `mode` | `mock` |
| `configured` | `false` |
| `reachable` | `false` |
| `error.kind` | `disabled` |
| `error.message` | `Real Brain Memory Gateway checks are disabled for this UI process.` |

## BFF Search Result

Target:

```text
POST http://127.0.0.1:3000/api/brain-memory/search
```

Request used a harmless query:

```text
Hermes
```

Context used:

```text
tenantId: local-dev
project id/key: brain-memory
session id/key: slice-12c-live-recheck
```

Observed:

| Field | Value |
| --- | --- |
| HTTP | `200` |
| `mode` | `mock` |
| results | `0` |
| scope | `null` |
| `error.kind` | `disabled` |
| `error.message` | `Real Brain Memory Gateway search is disabled; using local mock evidence.` |

No live search results could be verified because the Gateway was not reachable
and no tenant-bound memory key was configured.

## BFF Inspect Result

Target:

```text
POST http://127.0.0.1:3000/api/brain-memory/memory/inspect
```

Memory id:

```text
mvp-smoke-nonexistent-memory
```

Observed:

| Field | Value |
| --- | --- |
| HTTP | `200` |
| `mode` | `mock` |
| detail | `null` |
| evidence | `null` |
| supersession | `null` |
| `error.kind` | `disabled` |
| `error.message` | `Real Brain Memory Gateway inspection is disabled.` |

No real detail/evidence/supersession response could be verified in this run.

## Smoke Harness Changes

`scripts/mvp-smoke.mjs` was tightened for live Brain Memory checks:

- uses `tenantId: local-dev` and `brain-memory` project/session-style smoke
  context for Brain Memory route checks;
- reports search result counts;
- uses the first real search result id for inspect when available;
- otherwise uses a harmless nonexistent id for safe inspect normalization;
- treats `--require-brain-memory` as a true live-mode gate:
  - mock/unconfigured search fails,
  - non-real inspect fails,
  - live status without live search fails;
- reports 401 as optional UI bearer failure without printing secrets;
- reports 403 as tenant-bound memory key failure without printing secrets.

No BFF route, Hermes streaming, Brain Memory client, memory scope bridge, or
project/session stable key logic was changed.

## Commands Run

Gateway probes:

```text
GET http://127.0.0.1:8080/health
GET http://127.0.0.1:8080/ui/capabilities
GET http://127.0.0.1:8765/health
```

BFF probes:

```text
GET  http://127.0.0.1:3000/api/brain-memory/status
POST http://127.0.0.1:3000/api/brain-memory/search
POST http://127.0.0.1:3000/api/brain-memory/memory/inspect
```

Smoke commands:

```text
npm run smoke:mvp
node scripts/mvp-smoke.mjs --require-hermes
node scripts/mvp-smoke.mjs --require-brain-memory
node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory
```

Full check matrix:

```text
npm run check:workspace-state
npm run check:brain-memory-client
npm run studio:doctor
npm run check:ui-structure
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

## Pass/Fail Summary

| Check | Result |
| --- | --- |
| Default `npm run smoke:mvp` | Passed with expected Brain Memory mock warning. |
| `--require-hermes` | Passed with expected Brain Memory mock warning. |
| `--require-brain-memory` | Failed honestly: Brain Memory required but BFF status/search/inspect were mock. |
| `--require-hermes --require-brain-memory` | Failed honestly for the same Brain Memory reason; Hermes stream passed. |
| `npm run check:workspace-state` | Passed. |
| `npm run check:brain-memory-client` | Passed. |
| `npm run studio:doctor` | Passed; web-ui-only mode, Brain Memory attach-later. |
| `npm run check:ui-structure` | Passed. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed. |
| `npm audit --audit-level=moderate` | Passed, 0 vulnerabilities. |

## Browser Smoke

Opened:

```text
http://127.0.0.1:3000/
```

Observed:

- document title: `Brain Memory Studio`;
- app loaded;
- Brain Memory UI text was visible;
- real Brain Memory status was not visible because the UI process is still
  mock/unconfigured;
- mock/prepared Brain Memory state was visible;
- no secret variable names, bearer tokens, or Gateway memory key headers were
  visible in page text/HTML;
- no horizontal overflow at desktop width.

## How To Start Gateway For Re-run

The sibling Brain Memory repository was found at:

```text
C:\Users\Alexey\.cursor\projects\brain-memory
```

From that repository root, the documented Windows startup commands are:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-brain-memory.ps1
```

or:

```powershell
.\start-brain-memory.bat
```

The Brain Memory repo also documents the explicit recreate/probe path:

```powershell
docker compose up -d --force-recreate gateway
Invoke-RestMethod http://127.0.0.1:8080/health
Invoke-RestMethod http://127.0.0.1:8080/ready
python scripts\smoke_gateway.py
```

After Gateway is reachable, configure the Hermes UI process with redacted live
Brain Memory variables, restart the Web UI process so Next.js reads them, then
run:

```powershell
node scripts/mvp-smoke.mjs --require-brain-memory
node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory
```

## Auth/Tenant Behavior

Observed in this run:

- no optional UI bearer was configured;
- no tenant-bound memory key was configured;
- because Gateway was not reachable and real mode was disabled, the BFF returned
  mock/disabled normalization instead of 401/403.

Expected in a live re-run:

- missing or invalid `BRAIN_MEMORY_UI_API_KEY`, when Gateway requires it, should
  normalize to `unauthorized`;
- missing or unauthorized `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` should normalize
  to `forbidden`;
- the smoke harness now labels those cases without printing any secret values.

## Remaining Work

- Start or recreate Brain Memory Gateway on `127.0.0.1:8080`.
- Provide a tenant-bound read key authorized for the `local-dev` smoke context,
  or adjust the smoke context to match the authorized tenant.
- Restart the Web UI process with live Brain Memory env enabled.
- Re-run `node scripts/mvp-smoke.mjs --require-brain-memory`.

## Next Recommended Slice

Recommended next slice: Slice 12D - Launch runbook.

The runbook should consolidate startup order, env modes, how to launch Brain
Memory Gateway, how to restart Hermes UI with live Brain Memory env, and which
smoke commands gate web-ui-only versus bundle-ready modes.
