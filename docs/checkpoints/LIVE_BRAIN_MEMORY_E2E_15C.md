# Live Brain Memory E2E 15C

Date: 2026-05-31

## Result

Full live Hermes to Brain Memory marker E2E passed.

The verified path was:

```text
Web UI BFF -> Hermes API -> Brain Memory MCP -> Brain Memory Gateway -> Web UI BFF search/inspect
```

No Brain Memory mutation/admin UI was added. No direct browser-to-Gateway,
browser-to-Hermes, or direct storage path was added.

## Files Changed

- `docs/checkpoints/LIVE_BRAIN_MEMORY_E2E_15C.md`
- `ROADMAP.md`

## Baseline

- Starting working tree: clean.
- Starting commit: `95413b2 docs: record live Brain Memory E2E blocker`
- Selected Web UI base URL: `http://127.0.0.1:3002`
- Web UI env approach: temporary child process env only.
- Env files modified: no.
- Secrets printed or committed: no.

## Live Service Status

### Hermes

- Direct `GET http://127.0.0.1:8642/health`: HTTP 200.
- Direct `GET http://127.0.0.1:8642/health/detailed`: HTTP 200.
- Detailed status reported `gateway_state=running`, `platform=hermes-agent`,
  `api_server.state=connected`, and `active_agents=0` at probe time.
- Web UI BFF `GET /api/hermes/status`: `mode=real`, `reachable=true`.

### Hermes Brain Memory MCP Posture

- WSL distro checked: `Ubuntu`.
- `hermes-gateway.service`: active.
- Hermes gateway process observed:
  `/home/alexey/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main gateway run --replace`.
- Brain Memory MCP child process observed:
  `python -m brain_memory_mcp`.
- MCP child env posture, redacted:
  - `BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8080`
  - `BRAIN_MEMORY_API_KEY=set`

### Brain Memory Gateway

- Direct `GET http://127.0.0.1:8080/health`: HTTP 200,
  `status=ok`, `service=brain-memory-gateway`, `version=0.1.0-rc.1`,
  `postgres=ok`.
- Direct `GET http://127.0.0.1:8080/ready`: HTTP 200,
  `status=READY`, `postgres=ok`.
- Web UI BFF `GET /api/brain-memory/status`: `mode=real`,
  `reachable=true`.

### Tenant-Bound Key

- Tenant-bound read key was available in the sibling Brain Memory env.
- The available key posture was wildcard tenant with read-capable operations.
- The key was used only as redacted temporary Web UI process env via
  `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY`.
- No key value was printed or committed.

## Route Matrix

| Route | Result |
| --- | --- |
| `GET /` | HTTP 200, Brain Memory Studio title present |
| `GET /design/codex-shell` | HTTP 200, optional design route still present |
| `GET /api/hermes/status` | HTTP 200, `mode=real`, `reachable=true` |
| `GET /api/brain-memory/status` | HTTP 200, `mode=real`, `reachable=true` |
| `POST /api/brain-memory/search` query `Hermes` | HTTP 200, `mode=real`, 3 result(s) |
| `POST /api/brain-memory/memory/inspect` first search id | HTTP 200, `mode=real`, detail returned |
| `POST /api/hermes/chat/stream` marker prompt | HTTP 200, assistant content and `done` event emitted |

The launcher check passed for the selected base URL with 11 passes, 2 warnings,
and 0 failures. The warnings were expected because the launcher reads
`apps/web/.env.local` for direct Brain Memory env diagnostics while the live
Gateway settings were intentionally supplied only to the temporary Web UI child.
The BFF itself reported Brain Memory real/reachable.

## BFF Brain Memory Search And Inspect

Read-only BFF search/inspect was verified before the marker send:

- Search context: project `brain-memory`, tenant `local-dev`, session
  `slice-15c-live-e2e`.
- Query `Hermes`: `mode=real`, 3 result(s).
- Inspect first result: `mode=real`, detail returned.
- Inspect scope metadata: `projectKey=brain-memory`, `sessionKey=null`,
  `scopeStatus=matching-project`.

## Marker E2E

Marker:

```text
BM_LIVE_E2E_15C_20260531121044_BFEF97
```

Prompt was sent through the Web UI BFF route
`POST /api/hermes/chat/stream` with project/session scope:

- Project stable key: `brain-memory`
- Tenant id: `local-dev`
- Session stable key: `slice-15c-live-e2e`
- Hermes session id: `hermes-session-slice-15c-live-e2e`

Result:

- Stream HTTP status: 200.
- Hermes assistant reply contained `BM_LIVE_E2E_STORED`.
- Stream contained the marker.
- Stream emitted `mcp_brain_memory_memory_store` started and completed
  `tool_event` frames.
- Stream emitted `message_done` and `done`.
- No stream error event was observed.
- BFF search found the marker in Brain Memory.
- BFF inspect returned detail for the stored marker.

Stored marker inspect metadata:

- Memory id: `0dc2f97a-4580-48bb-b7cd-093923ac4f13`
- `projectKey=brain-memory`
- `sessionKey=slice-15c-live-e2e`
- `scopeStatus=matching-session`
- `layer=canonical`
- `source=brain-memory`

## Scope Verification

Scope behavior passed.

- Same project and same session search returned 1 result and included the
  marker.
- Different project search returned 0 results.
- Same project and different session search returned 0 results.
- Inspect detail matched the expected project and session keys.

This confirms the marker was stored and retrieved with the current explicit
project/session scope. Scope was not loosened.

## Timeline Result

The marker stream emitted Brain Memory-classified tool events:

- `mcp_brain_memory_memory_store` started
- `mcp_brain_memory_memory_store` completed

Because the marker was sent through a direct BFF POST for deterministic E2E
verification, the already-open browser React state was not the source of truth
for this marker run. Existing UI smokes still verified the read-only Memory
timeline surface and its honest empty/display states. A follow-up UI-driven
marker smoke can assert the visible right-rail Memory timeline row from the
same emitted event class.

## Smoke Results

All requested smoke commands passed against `http://127.0.0.1:3002`.

| Command | Result |
| --- | --- |
| `npm run smoke:mvp -- --base-url http://127.0.0.1:3002` | pass |
| `node scripts/mvp-smoke.mjs --require-hermes --base-url http://127.0.0.1:3002` | pass |
| `node scripts/mvp-smoke.mjs --require-brain-memory --base-url http://127.0.0.1:3002` | pass |
| `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:3002` | pass |
| `npm run smoke:ui -- --base-url http://127.0.0.1:3002` | pass, 54 passed, 1 expected optional-send warning, 0 failed |
| `npm run smoke:ui:send -- --base-url http://127.0.0.1:3002` | pass, 64 passed, 0 failed |
| `npm run smoke:ui:stop -- --base-url http://127.0.0.1:3002` | pass, 67 passed, 0 failed |

## Check Results

| Command | Result |
| --- | --- |
| `npm run check:brain-memory-client` | pass |
| `npm run check:workspace-state` | pass |
| `npm run check:agent-activity` | pass, 26 checks |
| `npm run check:agent-activity-rendering` | pass, 34 checks |
| `npm run studio:doctor` | pass |
| `npm run check:ui-structure` | pass |
| `npm run typecheck` | pass |
| `npm run build` | pass |
| `npm audit --audit-level=moderate` | pass, 0 vulnerabilities |

`studio:doctor` reported `mode=web-ui-only` from env-file posture, but it also
reported Web UI BFF Hermes status connected real and Web UI BFF Brain Memory
status connected real. This is expected for the temporary-env run because the
live Brain Memory values were supplied to the already-running Web UI child, not
persisted into `apps/web/.env.local`.

## Cleanup

- Temporary Web UI child on `3002` was stopped after verification.
- Hermes user service was left running.
- Brain Memory compose/Gateway was left running.
- Env files were not modified.
- Temporary stream/log files were left only under the local temp directory and
  were not committed.

## Deferred Work

- Add an opt-in UI-driven marker smoke that asserts the visible Memory timeline
  row after a Brain Memory store event.
- Keep full auth/classification, durable evidence/supersession storage, memory
  mutation/admin actions, production one-command CLI, export/import, and
  provider/model selector polish deferred.

## Next Recommended Slice

Slice 15D: add an opt-in UI-driven Brain Memory timeline smoke for live
Hermes-to-Brain-Memory store/search events, using the existing BFF path and
read-only UI surfaces only.
