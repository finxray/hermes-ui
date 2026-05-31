# Slice 15B - Live Brain Memory E2E prerequisite recovery

Date: 2026-05-31
Workspace: Hermes UI repo root
Start commit: `ec5252b`

## Purpose

Slice 15B attempted to bring the live prerequisites back online after Slice 15A
correctly recorded the Brain Memory E2E path as blocked.

Target topology:

- Web UI: `http://127.0.0.1:3002`
- Hermes API: `http://127.0.0.1:8642`
- Brain Memory Gateway: `http://127.0.0.1:8080`
- Browser path: browser -> Web UI BFF only.
- Memory observability path: Web UI BFF -> Brain Memory Gateway read-only UI API.
- Agent memory path: Web UI BFF -> Hermes -> Brain Memory MCP/skill -> Gateway.

No direct browser-to-Hermes call, direct browser-to-Gateway call, direct storage
access, memory mutation/admin UI, auth/classification model, export/import, or
secret commit was added.

## Starting repository state

The working tree was clean before Slice 15B changes.

Recent HEAD at the start of the slice:

```text
ec5252b docs: record live Brain Memory reconnect status
3f02f81 docs: refresh MVP RC decision after launcher hardening
773f7f4 docs: consolidate local bundle readiness checklist
b24e21e fix: harden Web UI dev launcher on Windows
c563120 docs: record MVP RC dry run
f2ec0b5 docs: add MVP release notes and RC checklist
3d47467 docs: add packaging readiness release gate
4d218da feat: add optional Web UI dev server launcher
```

## Hermes diagnosis

Direct probes:

| Probe | Result |
| --- | --- |
| `curl http://127.0.0.1:8642/health` | Unreachable |
| `curl http://127.0.0.1:8642/health/detailed` | Unreachable |
| `hermes gateway status` | Not available; `hermes` command was not found in PATH |
| Port `8642` listener | None found |

Web UI BFF status at `http://127.0.0.1:3002/api/hermes/status`:

```text
mode=error
configured=true
reachable=false
baseUrl=http://127.0.0.1:8642
error.kind=network
message=Could not reach Hermes at the configured base URL.
uiCapabilities.chat.canSend=false
```

Result: Hermes remained unavailable. No marker prompt was sent.

Manual recovery command from current Hermes UI docs remains:

```powershell
curl http://127.0.0.1:8642/health
```

The Hermes UI repo does not currently include or install a Hermes service
launcher. Start Hermes Agent/API server from the Hermes Agent environment, then
restart the Web UI process so the BFF can reach `HERMES_API_BASE_URL`.

## Brain Memory Gateway diagnosis and recovery

Initial probes:

| Probe | Result |
| --- | --- |
| `curl http://127.0.0.1:8080/health` | Unreachable before recovery |
| `curl http://127.0.0.1:8765/health` | Unreachable |
| Docker command | Available |
| Running containers before recovery | None |
| Brain Memory repo | Sibling `brain-memory` repo present |
| Startup script | `scripts\start-brain-memory.ps1` present |

The documented Brain Memory startup script was run from the Brain Memory repo:

```powershell
cd <brain-memory-repo>
powershell -ExecutionPolicy Bypass -File .\scripts\start-brain-memory.ps1
```

The script rebuilt the Gateway image if needed, started the compose stack, and
verified `/health`, `/ready`, and UI API route reachability. It did not print
Gateway memory keys.

Post-recovery probes:

| Probe | Result |
| --- | --- |
| `GET http://127.0.0.1:8080/health` | HTTP 200, `service=brain-memory-gateway`, `version=0.1.0-rc.1`, `storage.postgres=ok` |
| `GET http://127.0.0.1:8080/ready` | HTTP 200, `status=READY`, `postgres=ok` |
| `GET http://127.0.0.1:8765/health` | Unreachable; standalone helper was not started |

Brain Memory containers were left running intentionally because the slice goal
was to restore the live prerequisite.

## Tenant-bound key availability

Tenant-bound key availability: available and redacted.

The key was found in the sibling Brain Memory repo `.env` under
`GATEWAY_MEMORY_API_KEYS`. The selected entry:

- has a key value present,
- has caller id `local-dev`,
- allows tenant `*`,
- includes `read` and `write` operations.

Only the presence and authorization shape were printed. The key value was not
printed and was not committed.

## Temporary Web UI env approach

`apps/web/.env.local` was not modified.

A temporary Web UI child process was started on `http://127.0.0.1:3002` with
process-only environment values:

```text
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true
BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY=<redacted>
BRAIN_MEMORY_UI_API_KEY=<unset>
HERMES_API_BASE_URL=http://127.0.0.1:8642
HERMES_UI_ENABLE_REAL_HERMES=true
HERMES_API_KEY=<redacted if already configured>
```

`npm run studio:web -- --port 3002 --dry-run --json` passed before startup.
The Web UI became healthy at `http://127.0.0.1:3002`.

`npm run studio:launch -- --check --base-url http://127.0.0.1:3002` passed
with expected Hermes warnings. The launcher reads `.env.local` for its printed
environment summary, so it still printed Brain Memory env as not set, while the
running BFF process correctly reported Brain Memory as real/reachable.

## BFF live Brain Memory verification

Target: `http://127.0.0.1:3002`

### Status

`GET /api/brain-memory/status`:

```text
HTTP 200
mode=real
configured=true
reachable=true
baseUrl=http://127.0.0.1:8080
health.service=brain-memory-gateway
health.version=0.1.0-rc.1
health.storage.postgres=ok
capabilities=null
error=null
```

`capabilities=null` because `/ui/capabilities` is protected without a UI bearer
or local-dev bypass, but `/health` was enough for real Gateway reachability.

### Search

`POST /api/brain-memory/search` with query `Hermes` and structured
`local-dev` / `brain-memory` / `slice-15b-live-reconnect` context:

```text
HTTP 200
mode=real
results=5
scope.tenantId=local-dev
scope.projectKey=brain-memory
scope.sessionKey=slice-15b-live-reconnect
scope.status=partial
scope.legacyUnscopedExcluded=2
scope.mismatchedProjectExcluded=19
scope.mismatchedSessionExcluded=1
error=null
```

The checkpoint intentionally does not record returned memory content because
live memory can contain user/private data.

### Inspect

`POST /api/brain-memory/memory/inspect` using the first live search result id:

```text
HTTP 200
mode=real
detail.present=true
detail.projectKey=brain-memory
detail.scopeStatus=matching-project
evidence.status=not_implemented
supersession.status=not_implemented
error=null
```

## Marker E2E result

No live marker was created.

Reason: Hermes was not reachable, so the required
Web UI BFF -> Hermes -> Brain Memory MCP/skill -> Gateway memory path could not
be exercised. Writing a marker directly to Brain Memory would bypass Hermes and
violate the E2E goal.

## Scope verification

Read-only scope verification was performed through the Web UI BFF using an
existing live memory marker already present in Brain Memory.

Query marker: an existing `HERMES_MAGIC_MEMORY_E2E_*` marker.

| Search context | Result |
| --- | --- |
| Same tenant and same project `brain-memory` | `mode=real`, 2 results, `scope.status=partial`, first result `projectKey=brain-memory` |
| Same tenant and different project `hermes-ui` | `mode=real`, 0 results, `scope.status=enforced`, `mismatchedProjectExcluded=2` |
| Same project and different session | `mode=real`, 2 results, `scope.status=partial` |

Interpretation: project scoping is enforced. The different-session search still
returned project-level rows because the matched memories do not carry stored
session metadata, which matches the current UI API contract for
`matching-project` / partial scope behavior.

## Timeline result

No new Brain Memory timeline event was created because no Hermes marker prompt
was sent. The browser/UI smoke still verified the read-only memory activity
timeline empty state and did not add memory mutation/admin behavior.

## Smoke and check matrix

| Command | Result |
| --- | --- |
| `npm run studio:launch -- --check --base-url http://127.0.0.1:3002` | Pass with expected Hermes warnings and Brain Memory BFF real/reachable |
| `npm run smoke:mvp -- --base-url http://127.0.0.1:3002` | Pass, `38 passed`, `1 warning`; Hermes live skipped |
| `node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:3002` | Expected failure; Hermes BFF not real/reachable |
| `node scripts/mvp-smoke.mjs --require-brain-memory --base-url http://127.0.0.1:3002` | Pass after smoke harness accepted real search plus safe scoped 404 when no fixed-query result exists |
| `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:3002` | Expected failure only because Hermes was not real/reachable |
| `npm run smoke:ui -- --base-url http://127.0.0.1:3002` | Pass, `54 passed`, `1 warning`; optional send skipped |
| `npm run smoke:ui:send -- --base-url http://127.0.0.1:3002` | Skipped; requires live Hermes |
| `npm run smoke:ui:stop -- --base-url http://127.0.0.1:3002` | Skipped; requires live Hermes |
| `npm run check:brain-memory-client` | Pass |
| `npm run check:workspace-state` | Pass |
| `npm run check:agent-activity` | Pass |
| `npm run check:agent-activity-rendering` | Pass |
| `npm run studio:doctor` with `STUDIO_WEB_UI_URL=http://127.0.0.1:3002` | Exit 0; Hermes direct unreachable, BFF Brain Memory real |
| `npm run check:ui-structure` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm audit --audit-level=moderate` | Pass, 0 vulnerabilities |

Smoke harness change:

- `scripts/mvp-smoke.mjs` now treats a live Brain Memory status/search plus a
  safe normalized scoped 404 from fake-id inspect as acceptable when the smoke
  query has no search result to inspect.
- If search returns a real id, `--require-brain-memory` still requires real
  inspect.

## Live E2E verdict

Live Brain Memory BFF reconnect passed.

Full live Hermes -> Brain Memory E2E remains blocked.

Exact blocker:

```text
Hermes API is not running/reachable at http://127.0.0.1:8642, and no hermes
gateway command is available in PATH from this environment.
```

## Cleanup

The temporary Web UI child process on port `3002` was stopped at the end of
this slice. The Brain Memory compose stack was intentionally left running
because it is the restored live prerequisite.

No temporary env file was created, and `apps/web/.env.local` was not modified.

## Files changed

- `docs/checkpoints/LIVE_BRAIN_MEMORY_E2E_15B.md`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `ROADMAP.md`
- `scripts/mvp-smoke.mjs`

## Next recommended slice

Slice 15C - Start or attach Hermes Agent API, then rerun full Hermes -> Brain
Memory marker E2E.

Acceptance for Slice 15C:

- `GET http://127.0.0.1:8642/health` returns Hermes `status=ok`.
- Web UI BFF `/api/hermes/status` reports `mode=real`, `reachable=true`.
- Live Brain Memory BFF remains `mode=real`, `reachable=true`.
- A unique marker is sent through the Web UI/BFF/Hermes path.
- The marker is found via `/api/brain-memory/search`.
- Detail inspect succeeds if a memory id is returned.
- Scope behavior is documented without loosening project/session rules.
