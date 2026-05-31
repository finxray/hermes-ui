# Slice 15G: Brain Memory Scope Isolation Regression

Date: 2026-05-31

Base commit before this slice: `bb94b47 feat: add tenant scope diagnostics`

Selected Web UI base URL: `http://127.0.0.1:3002`

## Result

Multi-session Brain Memory scope isolation passed for the current live MVP
contract.

The new opt-in browser smoke seeds an isolated local Studio workspace in a
Playwright context with Project A / Session A1, Project A / Session A2, and
Project B / Session B1. It sends a live marker through the real composer in
Session A1, then verifies read-only BFF search/inspect behavior across
same-session, different-session, different-project, and project-only/no-session
contexts.

No tenant checks were loosened. No Brain Memory mutation/admin UI was added. No
direct browser-to-Gateway, browser-to-Hermes, or direct storage path was added.
No Hermes streaming logic, Brain Memory BFF logic, memory-scope bridge logic,
project/session stable keys, env files, Hermes source, Brain Memory repo files,
or secrets were changed.

## Live Prerequisites

| Prerequisite | Result |
| --- | --- |
| Hermes direct health | `http://127.0.0.1:8642/health` returned HTTP 200, `status=ok`, `platform=hermes-agent` |
| Brain Memory Gateway health | `http://127.0.0.1:8080/health` returned HTTP 200, `status=ok`, version `0.1.0-rc.1` |
| Brain Memory Gateway ready | `http://127.0.0.1:8080/ready` returned HTTP 200, `status=READY` |
| Web UI root | `http://127.0.0.1:3002/` returned HTTP 200 after starting a temporary child process |
| Hermes BFF status | `mode=real`, `reachable=true`, `configured=true` |
| Brain Memory BFF status | `mode=real`, `reachable=true`, `configured=true` |
| Tenant diagnostics BFF | redacted posture only; gateway memory key set, allowed tenants summarized as `wildcard` |

The Web UI process used temporary process env only. No env files were edited and
no keys were printed.

## Scenario

Seeded scope:

| Label | Project key | Session key |
| --- | --- | --- |
| A1 | `studio:local-dev:project:project-scope-a` | `studio:local-dev:project:project-scope-a:session:session-scope-a1` |
| A2 | `studio:local-dev:project:project-scope-a` | `studio:local-dev:project:project-scope-a:session:session-scope-a2` |
| B1 | `studio:local-dev:project:project-scope-b` | `studio:local-dev:project:project-scope-b:session:session-scope-b1` |

The smoke verified that all contexts stayed on tenant `local-dev` and that the
stable keys survived hydration unchanged.

## Marker

Final passing marker:

```text
BM_SCOPE_A1_20260531091309_LRKRO1
```

Hermes was asked through the visible composer in Session A1 to store the marker
in the current Studio session memory and reply:

```text
BM_SCOPE_A1_STORED
```

The assistant reply included the acknowledgement, and
`/api/hermes/chat/stream` returned HTTP 200.

## Scope Results

| Check | Result |
| --- | --- |
| Same project + same session | Passed. A1 BFF search found the marker. |
| Same project + different session | Passed. A2 BFF search returned 0 marker results. |
| Different project | Passed. B1 BFF search returned 0 marker results. |
| Inspect detail | Passed. Detail matched Project A, Session A1, `scope=matching-session`, tenant `local-dev`. |
| Stable keys | Passed. A1/A2/B1 stable project/session keys were unchanged. |
| Tenant | Passed. All BFF searches that exposed tenant reported `local-dev`. |

## Project-Only Behavior

Project-level marker creation was not attempted because the current UI/Hermes
path has no safe intentional project-level write mode; the BFF chat route
requires session context and the memory-scope bridge always supplies
`sessionKey`.

The smoke did verify the current no-session read behavior:

- project-only search in Project A, with `session=null`, returned the A1 marker;
- the returned result still carried the A1 `sessionKey`;
- the result was reported as `scopeStatus=matching-project`;
- tenant stayed `local-dev`.

This documents the current Gateway-mediated project-broad read behavior when
session context is omitted. It is not evidence that a project-level marker write
path exists in the Web UI.

## Timeline And Diagnostics

Memory timeline:

- chat activity block showed Brain Memory activity;
- right-rail Memory activity showed a memory item;
- details stayed collapsed by default.

Tenant diagnostics:

- Context rail diagnostics were visible;
- tenant showed `local-dev`;
- no `tenant-local`, tenant mismatch, or drift warning was visible.

Browser safety:

- no API keys or bearer-like values were visible;
- no horizontal overflow was detected at the smoke viewport;
- no browser console/page/network errors were captured.

## Files Changed

- `package.json`
- `scripts/ui-interaction-smoke.mjs`
- `scripts/mvp-smoke.mjs`
- `scripts/check-tenant-scope-diagnostics.mjs`
- `docs/checkpoints/BRAIN_MEMORY_SCOPE_ISOLATION_15G.md`
- `docs/architecture/PROJECT_SESSION_MEMORY_SCOPE.md`
- `docs/runbooks/MVP_LOCAL_LAUNCH_RUNBOOK.md`
- `ROADMAP.md`

## Check Matrix

| Check | Result |
| --- | --- |
| `npm run smoke:ui:memory-scope -- --base-url http://127.0.0.1:3002` | Pass, 88 passed, 0 warnings |
| `npm run check:tenant-scope` | Pass |
| `npm run check:workspace-state` | Pass |
| `npm run check:brain-memory-client` | Pass |
| `npm run check:agent-activity` | Pass, 26 checks |
| `npm run check:agent-activity-rendering` | Pass, 34 checks |
| `STUDIO_WEB_UI_URL=http://127.0.0.1:3002 npm run studio:doctor` | Pass; BFF Hermes and Brain Memory connected |
| `npm run check:ui-structure` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm audit --audit-level=moderate` | Pass, 0 vulnerabilities |
| `npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:3002` | Pass, 84 passed |
| `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:3002` | Pass, 41 passed |
| `npm run smoke:ui:send -- --base-url http://127.0.0.1:3002` | Pass, 67 passed |
| `npm run smoke:ui:stop -- --base-url http://127.0.0.1:3002` | Pass, 70 passed |

## Cleanup

The temporary Web UI process on `3002` should be stopped after final checks and
commit. Hermes on `8642` and Brain Memory Gateway on `8080` are live services
and should be left running.

## Limitations

- The scope isolation smoke writes one harmless live memory marker through
  Hermes; it is opt-in and not part of the default `smoke:ui`.
- Project-level write behavior remains untested because there is no safe
  intentional Web UI path that omits `sessionKey` during storage.
- Project-only read behavior is project-broad in the current Gateway/BFF path
  and can return session-scoped memories from the same project.
- Studio workspace state remains browser localStorage for MVP.

## Next Recommended Slice

Slice 15H: document and, if needed, contract-test project-only read semantics
against Brain Memory Gateway so project-broad reads and future project-level
writes are named separately.
