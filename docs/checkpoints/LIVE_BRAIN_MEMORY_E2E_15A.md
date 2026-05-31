# Slice 15A - Live Brain Memory E2E reconnect status

Date: 2026-05-31
Workspace: `C:\Users\Alexey\.cursor\projects\hermes-ui`
Start commit: `3f02f81`

## Purpose

Slice 15A attempted to reconnect the MVP Web UI to a live Brain Memory Gateway
through the existing safe paths:

- Browser UI -> Web UI BFF -> Hermes -> Brain Memory MCP/skill -> Brain Memory Gateway.
- Browser UI -> Web UI BFF -> Brain Memory Gateway read-only UI/Admin API.

No direct browser-to-Hermes call, direct browser-to-Gateway call, direct storage
access, memory mutation/admin UI, auth/classification model, or backend feature
was added.

## Selected Web UI base URL

`http://127.0.0.1:3002`

Port `3002` was selected through the hardened Web UI launcher recovery path.
`npm run studio:web -- --port 3002 --dry-run --json` passed, and the Web UI was
started with the optional `studio:web` wrapper for route and browser smoke
verification.

## Starting repository state

The working tree was clean before Slice 15A changes.

Recent HEAD at the start of the slice:

```text
3f02f81 docs: refresh MVP RC decision after launcher hardening
773f7f4 docs: consolidate local bundle readiness checklist
b24e21e fix: harden Web UI dev launcher on Windows
c563120 docs: record MVP RC dry run
f2ec0b5 docs: add MVP release notes and RC checklist
3d47467 docs: add packaging readiness release gate
4d218da feat: add optional Web UI dev server launcher
6ac585b docs: add healthy Studio server recovery workflow
```

## Environment posture

Secrets were only inspected as present/missing and were not printed.

| Setting | Observed status |
| --- | --- |
| `HERMES_API_BASE_URL` | `http://127.0.0.1:8642` |
| `HERMES_UI_ENABLE_REAL_HERMES` | `true` |
| `HERMES_API_KEY` | set, redacted |
| `BRAIN_MEMORY_GATEWAY_URL` | missing |
| `BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY` | missing/disabled |
| `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` | missing |
| `BRAIN_MEMORY_UI_API_KEY` | missing |
| `BRAIN_MEMORY_API_KEY` | missing |
| `HERMES_UI_ENABLE_MEMORY_SCOPE_BRIDGE` | missing; default bridge remains active |

Tenant-bound Brain Memory key availability: not available in the current Web UI
environment.

## Service matrix

| Service | Probe | Result |
| --- | --- | --- |
| Hermes API | `http://127.0.0.1:8642/health` | Unreachable |
| Brain Memory Gateway candidate | `http://127.0.0.1:8080/health` | Unreachable |
| Brain Memory Gateway candidate | `http://127.0.0.1:8765/health` | Unreachable |
| Brain Memory repo | `C:\Users\Alexey\.cursor\projects\brain-memory` | Present |
| Brain Memory launcher | `scripts\start-brain-memory.ps1` | Present, not executed |
| Brain Memory launcher | `start-brain-memory.bat` | Present, not executed |

Brain Memory was not auto-started. Hermes was not auto-started. No external
service state was mutated.

## Route matrix

Route checks were run against `http://127.0.0.1:3002`.

| Route | Method | Result |
| --- | --- | --- |
| `/` | GET | HTTP 200 |
| `/design/codex-shell` | GET | HTTP 200; route still present |
| `/api/hermes/status` | GET | HTTP 200, normalized `mode=error`, `configured=true`, `reachable=false`, `baseUrl=http://127.0.0.1:8642` |
| `/api/brain-memory/status` | GET | HTTP 200, normalized `mode=mock`, `configured=false`, `reachable=false`, `baseUrl=null` |
| `/api/brain-memory/search` | POST | HTTP 200 with safe structured scope, normalized `mode=mock`, 0 results, `error.kind=disabled` |
| `/api/brain-memory/memory/inspect` | POST | HTTP 200 with safe structured scope, normalized `mode=mock`, no detail, `error.kind=disabled` |

The search and inspect calls used structured local-dev project/session context
and did not claim live Gateway success.

## BFF results

Hermes BFF status:

```text
mode=error
configured=true
reachable=false
baseUrl=http://127.0.0.1:8642
error.kind=network
message=Could not reach Hermes at the configured base URL.
uiCapabilities.chat.canSend=false
uiCapabilities.memory.instructionBridgeActive=true
```

Brain Memory BFF status:

```text
mode=mock
configured=false
reachable=false
baseUrl=null
error.kind=disabled
message=Real Brain Memory Gateway checks are disabled for this UI process.
```

Brain Memory BFF search:

```text
mode=mock
results=0
error.kind=disabled
message=Real Brain Memory Gateway search is disabled; using local mock evidence.
```

Brain Memory BFF inspect:

```text
mode=mock
detail=null
error.kind=disabled
message=Real Brain Memory Gateway inspection is disabled.
```

## Hermes MCP Brain Memory marker

No live marker was created.

The marker step was blocked because Hermes was unreachable and Brain Memory
Gateway was not configured/reachable. Sending a marker through Hermes would have
been misleading in the current environment, and writing directly to Brain Memory
would violate the project boundary.

## Scope verification

Scope verification did not run against live Brain Memory.

Reason: no tenant-bound key was available, no Gateway URL was configured, common
Gateway ports were unreachable, and Hermes could not send through the MCP/skill
memory path. The BFF routes continued to require structured project/session
context and returned mock/disabled responses instead of bypassing the Gateway.

## Timeline result

No live Brain Memory timeline events were produced in this slice. The existing
UI smoke verified the default activity/timeline surfaces and empty or local mock
states without creating Brain Memory evidence.

## Browser smoke

The in-app browser opened `http://127.0.0.1:3002/`.

Observed:

- App loaded with title `Brain Memory Studio`.
- Old green UI was not present.
- Project/session navigation data was visible in the left workspace area.
- Composer was visible with `Message Hermes through the local BFF...`.
- Right rail was visible.
- Panel toggle controls were present for context, memory, tools, and files.
- The current provider/model control honestly showed the unavailable server
  state while Hermes was down.
- No horizontal overflow was detected in the active viewport.
- Browser console had no error-level entries during the root smoke.

Dedicated settings popover behavior was not claimed in this run; no stable
visible settings popover control was required for live Brain Memory reconnect.

## Script and smoke matrix

| Command | Result |
| --- | --- |
| `npm run check:workspace-state` | Pass |
| `npm run check:brain-memory-client` | Pass |
| `npm run studio:doctor` | Exit 0 with diagnostics; default `3000` BFF probes were unreachable, Hermes direct unreachable, Brain Memory direct disabled |
| `npm run check:ui-structure` | Pass |
| `npm run check:agent-activity` | Pass |
| `npm run check:agent-activity-rendering` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm audit --audit-level=moderate` | Pass, 0 vulnerabilities |
| `npm run studio:launch -- --check --base-url http://127.0.0.1:3002` | Pass with expected service warnings |
| `npm run smoke:mvp -- --base-url http://127.0.0.1:3002` | Pass with warnings; Hermes live skipped, Brain Memory mock/unconfigured accepted |
| `node scripts/mvp-smoke.mjs --require-brain-memory --base-url http://127.0.0.1:3002` | Expected failure; live Brain Memory was required but BFF was mock/disabled |
| `npm run smoke:ui -- --base-url http://127.0.0.1:3002` | Pass after smoke harness accepted the current Hermes-unavailable model label |

The UI smoke harness was updated to accept the existing non-client-selectable
model state labels `Server-configured`, `unavailable`, or `unknown`. This is a
test harness correction for offline Hermes states, not a product UI change.

## Live E2E verdict

Live Brain Memory E2E reconnect is blocked in the current environment.

Blocking facts:

- Hermes is configured but unreachable at `http://127.0.0.1:8642`.
- Brain Memory Gateway is not configured for the Web UI process.
- Common Gateway ports `8080` and `8765` are unreachable.
- No tenant-bound Brain Memory read key is available in the current environment.
- The BFF correctly returns mock/disabled Brain Memory responses instead of
  faking a live pass.

## Deferred and unchanged

Still deferred:

- full auth/classification model,
- production one-command CLI,
- durable evidence/supersession storage,
- memory mutation/admin actions,
- real stop/cancel streaming,
- provider/model selector polish,
- further UI polish.

Unchanged by this slice:

- Hermes streaming logic,
- Brain Memory BFF logic,
- memory scope bridge behavior,
- project/session stable keys,
- browser-to-BFF service boundary,
- Gateway-mediated read-only Brain Memory path,
- no direct browser-to-Gateway/storage path.

## Next recommended slice

Slice 15B - Bring up Brain Memory Gateway and tenant-bound read key, then rerun
live E2E reconnect.

Recommended manual prerequisites for Slice 15B:

```powershell
cd C:\Users\Alexey\.cursor\projects\brain-memory
powershell -ExecutionPolicy Bypass -File .\scripts\start-brain-memory.ps1
Invoke-RestMethod http://127.0.0.1:8080/health
Invoke-RestMethod http://127.0.0.1:8080/ready
python scripts\smoke_gateway.py
```

Then configure the Web UI process with a redacted tenant-bound read key and
Gateway URL, restart the Web UI, and rerun the live marker/search/inspect/scope
verification through the BFF and Hermes memory path only.
