# Slice 15D: UI Live Brain Memory Timeline Smoke

Date: 2026-05-31

Base commit before this slice: `142d33d test: verify Hermes Brain Memory live E2E`

Selected Web UI base URL: `http://127.0.0.1:3002`

## Summary

Slice 15D added an opt-in browser smoke that drives the real Web UI, asks
Hermes to store a unique Brain Memory marker, verifies the chat activity block
and right-rail Memory timeline, then confirms the marker through the Web UI BFF
search and inspect routes.

This is a test and documentation slice. It does not add Brain Memory
mutation/admin UI, does not change Hermes streaming logic, does not change the
Brain Memory BFF implementation, does not change the memory scope bridge, and
does not add direct browser-to-Gateway, browser-to-Hermes, or direct storage
access.

## Files Changed

- `scripts/ui-interaction-smoke.mjs`
- `package.json`
- `apps/web/src/lib/agentActivityEvents.ts`
- `apps/web/src/components/chat/AgentActivityBlock.tsx`
- `docs/checkpoints/UI_MEMORY_TIMELINE_LIVE_SMOKE_15D.md`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `ROADMAP.md`

## Architecture Boundary

The live marker path remains:

Browser UI -> Web UI BFF -> Hermes -> Brain Memory MCP/skill -> Brain Memory Gateway

The verification path remains:

Browser smoke -> Web UI BFF -> Brain Memory Gateway read-only status/search/inspect

The browser smoke never calls Brain Memory Gateway, Hermes, or storage directly.

## Live Services

| Service | URL | Result |
| --- | --- | --- |
| Hermes direct health | `http://127.0.0.1:8642/health` | HTTP 200, `status=ok`, `platform=hermes-agent` |
| Hermes BFF status | `http://127.0.0.1:3002/api/hermes/status` | HTTP 200, `mode=real`, `reachable=true` |
| Brain Memory Gateway health | `http://127.0.0.1:8080/health` | HTTP 200, `status=ok`, version `0.1.0-rc.1`, Postgres `ok` |
| Brain Memory BFF status | `http://127.0.0.1:3002/api/brain-memory/status` | HTTP 200, `mode=real`, `reachable=true` |

## Marker Smoke

Command:

```powershell
npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:3002
```

Result:

- Passed: `76`
- Warnings: `1`
- Failed: `0`

Marker used:

```text
BM_UI_MEMORY_TIMELINE_15D_20260531083257_6JMTW1
```

Browser send result:

- The smoke typed a live prompt through the visible composer.
- Hermes replied with `BM_UI_MEMORY_TIMELINE_STORED`.
- `/api/hermes/chat/stream` returned HTTP 200.

Chat activity block result:

- The transcript showed Brain Memory activity:
  `Stored memory completed Worked for <1s 2 events`.
- Brain Memory activity details were collapsed by default.

Right-rail Memory timeline result:

- The Memory rail tab opened successfully.
- The session Memory activity section was visible.
- A memory timeline item was visible.
- Redacted details were collapsed by default.

## BFF Search And Inspect

The smoke found the marker through the Web UI BFF search route, inspected the
matching detail through the Web UI BFF inspect route, and verified that a
different project search returned zero results for the same marker.

Inspect detail:

- ID: `0a487c13-6739-4dba-b24b-b53dc1fde9da`
- Project: `studio:tenant-local:project:project-brain-memory`
- Session: `studio:tenant-local:project:project-brain-memory:session:session-7f2c28f1-ab6b-47fb-a34f-fe24d8d7eb72`
- Scope label: `matching-session`

Known tenant note:

- The UI workspace tenant is `tenant-local`.
- Hermes MCP stored the live memory under Gateway tenant `local-dev`.
- The smoke treats this as a warning, then verifies the same UI
  project/session stable keys under `local-dev`.
- This preserves the important launch-readiness invariant for this slice:
  the marker is scoped to the UI project/session keys and is absent from a
  different project search.

## Route Matrix

| Route | Result |
| --- | --- |
| `GET /` | HTTP 200 |
| `GET /design/codex-shell` | HTTP 200 |
| `GET /api/hermes/status` | HTTP 200, real/reachable |
| `GET /api/brain-memory/status` | HTTP 200, real/reachable |
| `POST /api/brain-memory/search` | HTTP 200, normalized real response |
| `POST /api/brain-memory/memory/inspect` | HTTP 200 for the marker detail; safe normalized 404 for nonexistent IDs |
| `POST /api/hermes/chat/stream` | HTTP 200, assistant content and done event observed |

## Regression Matrix

| Check | Result |
| --- | --- |
| `npm run smoke:mvp -- --base-url http://127.0.0.1:3002` | Pass, 39 passed |
| `npm run smoke:ui -- --base-url http://127.0.0.1:3002` | Pass, 54 passed, 1 skipped warning for optional send |
| `npm run smoke:ui:send -- --base-url http://127.0.0.1:3002` | Pass, 64 passed |
| `npm run smoke:ui:stop -- --base-url http://127.0.0.1:3002` | Pass, 67 passed |
| `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:3002` | Pass, 39 passed |
| `npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:3002` | Pass, 76 passed, 1 tenant warning |
| `node --check scripts/ui-interaction-smoke.mjs` | Pass |
| `npm run check:agent-activity` | Pass, 26 checks |
| `npm run check:agent-activity-rendering` | Pass, 34 checks |
| `npm run check:brain-memory-client` | Pass |
| `npm run check:workspace-state` | Pass |
| `STUDIO_WEB_UI_URL=http://127.0.0.1:3002 npm run studio:doctor` | Pass; BFF Hermes and Brain Memory connected |
| `npm run check:ui-structure` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm audit --audit-level=moderate` | Pass, 0 vulnerabilities |

## UI Status

- App loads in the browser.
- Old green UI markers are absent.
- Project/session sidebar is visible and interactive.
- Composer is visible.
- Right rail is visible and tabs can be switched.
- Settings popover opens and closes.
- Panel toggles for left and right rails work.
- No horizontal overflow was detected at the smoke viewport.
- No browser console errors or page errors were captured.
- No credential-like values were visible in smoke output.

## Cleanup

The temporary Web UI process used for this slice should be stopped after the
checkpoint is committed. Hermes on `8642` and Brain Memory Gateway on `8080`
are live services and should be left running.

## Deferred Features

- Full auth/classification model.
- Production one-command CLI.
- Durable evidence/supersession storage.
- Memory mutation/admin actions.
- Real server-side stop/cancel semantics beyond the UI abort and available
  Hermes run stop capability checks.
- Provider/model selector polish.
- Further UI polish.
- Tenant alignment between the UI mock workspace tenant and the live Hermes MCP
  Brain Memory tenant.

## Next Recommended Slice

Slice 15E: align the live Brain Memory tenant/scope contract between the Web UI
workspace context and Hermes MCP, then reduce the 15D tenant fallback warning to
a strict same-tenant assertion.
