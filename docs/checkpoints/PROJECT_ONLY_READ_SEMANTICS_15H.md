# Slice 15H: Project-Only Memory Read Semantics

Date: 2026-05-31

Base commit before this slice: `a3e250a test: add Brain Memory scope isolation smoke`

Selected Web UI base URL: `http://127.0.0.1:3002`

## Result

Slice 15H separated and contract-tested three Brain Memory scope concepts:

- session-scoped writes through the current Web UI -> BFF -> Hermes -> Brain
  Memory path;
- project-only reads through the existing read-only BFF search route;
- future project-level writes, which remain deferred and unimplemented.

No production UI wording change was needed. Existing visible labels continue to
say `Memory scope`, `Project key`, `Session key`, `Project context`, `Session
context`, `Memory search`, and `read-only`.

No tenant checks were loosened. No Brain Memory mutation/admin UI was added. No
direct browser-to-Gateway, browser-to-Hermes, or direct storage path was added.
No project-level write behavior was added.

## Current Semantics

### Session-scoped write

Current Web UI chat sends require an active session. The browser sends project
and session context to the BFF, the BFF calls Hermes, and the memory-scope
bridge supplies both `projectKey` and `sessionKey`. When Hermes stores memory
through Brain Memory MCP/skill, the current expected result is a session-scoped
memory under the active project and active session.

### Project-only read

Current project-only reads are read-only Gateway-mediated searches where the BFF
context includes project context and omits session context (`session=null`, so
the current Brain Memory client does not send `session_id`). This is
project-broad read behavior.

A project-only read can return a session-scoped memory from the same project.
When it does, the result must still carry the original stored session key and
report `scopeStatus=matching-project`. This is not a project-level write.

### Future project-level write

Future project-level writes remain a separate deferred capability. They require
an explicit UI/BFF/Gateway contract, audit behavior, tenant authorization, and
regression checks before implementation. They must not be inferred from the
current project-only read path.

## Contract Test Added

`npm run smoke:ui:memory-scope` now asserts the project-only read behavior
separately from same-session, different-session, and different-project checks:

- `memory-scope-project-only-query` requires the marker to be found by a
  project-only read;
- `memory-scope-project-only-original-session-key` requires the returned result
  to preserve the original A1 session key;
- `memory-scope-project-only-scope-status` requires
  `scopeStatus=matching-project`;
- `memory-scope-project-only-project-key` requires the result to stay in the
  original project;
- `memory-scope-project-only-query-tenant` requires the exposed tenant, when
  present, to remain `local-dev`.

Developer/source checks now also assert that the architecture contract names
`Session-scoped write`, `Project-only read`, and `Future project-level write`,
and that the Memory console does not expose obvious mutation/admin controls.

## Live Prerequisites

| Prerequisite | Result |
| --- | --- |
| Hermes direct health | `http://127.0.0.1:8642/health` returned HTTP 200, `status=ok`, `platform=hermes-agent` |
| Brain Memory Gateway health | `http://127.0.0.1:8080/health` returned HTTP 200, `status=ok`, version `0.1.0-rc.1` |
| Brain Memory Gateway ready | `http://127.0.0.1:8080/ready` returned HTTP 200, `status=READY` |
| Web UI root | `http://127.0.0.1:3002/` returned HTTP 200 from a temporary child process |
| Hermes BFF status | `mode=real`, `reachable=true`, `configured=true` |
| Brain Memory BFF status | `mode=real`, `reachable=true`, `configured=true` |

The Web UI process used temporary process env only. No env files were edited and
no keys were printed.

## Live Smoke Evidence

Final passing scope marker:

```text
BM_SCOPE_A1_20260531092617_JSUCDH
```

The smoke wrote the marker through the visible composer in Project A / Session
A1, then verified:

| Read path | Result |
| --- | --- |
| Same project + same session | Found the marker. |
| Same project + different session | Returned 0 marker results. |
| Different project | Returned 0 marker results. |
| Inspect detail | Matched Project A, Session A1, tenant `local-dev`, `scope=matching-session`. |
| Project-only no-session read | Found the marker, preserved Session A1 key, reported `scopeStatus=matching-project`, tenant `local-dev`. |

## Route Matrix

| Route | Result |
| --- | --- |
| `GET /` | Pass, HTTP 200, app loaded. |
| `GET /design/codex-shell` | Pass, HTTP 200. |
| `GET /api/hermes/status` | Pass, `mode=real`, `reachable=true`. |
| `GET /api/brain-memory/status` | Pass, `mode=real`, `reachable=true`. |
| `POST /api/brain-memory/search` | Pass, normalized real response. |
| `POST /api/brain-memory/memory/inspect` | Pass, safe normalized scoped 404 when MVP smoke had no search result to inspect; live scope inspect returned detail. |
| `POST /api/hermes/chat/stream` | Pass, emitted assistant content and done event. |

## Browser Smoke

`npm run smoke:ui -- --base-url http://127.0.0.1:3002` passed with 57 checks,
1 warning, and 0 failures. The warning was the expected skipped optional send in
the default non-mutating browser smoke.

Observed browser state:

- app loads;
- old green UI markers are absent;
- project/session sidebar is visible;
- composer is visible and enables send after typing;
- right rail is visible;
- settings popover opens and closes;
- left/right panel toggles work;
- no horizontal overflow at the smoke viewport;
- no browser console, page, or network errors were captured.

## Check Matrix

| Check | Result |
| --- | --- |
| `npm run check:tenant-scope` | Pass |
| `npm run check:workspace-state` | Pass |
| `npm run check:brain-memory-client` | Pass |
| `npm run check:agent-activity` | Pass, 26 checks |
| `npm run check:agent-activity-rendering` | Pass, 34 checks |
| `STUDIO_WEB_UI_URL=http://127.0.0.1:3002 npm run studio:doctor` | Pass; Web UI BFF Hermes and Brain Memory connected; direct Brain Memory probe intentionally disabled in the check shell |
| `npm run check:ui-structure` | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |
| `npm audit --audit-level=moderate` | Pass, 0 vulnerabilities |
| `npm run smoke:ui -- --base-url http://127.0.0.1:3002` | Pass, 57 passed, 1 expected warning, 0 failed |
| `npm run smoke:ui:memory-scope -- --base-url http://127.0.0.1:3002` | Pass, 91 passed, 0 warnings, 0 failed |
| `npm run smoke:ui:memory-live -- --base-url http://127.0.0.1:3002` | Pass, 84 passed, 0 warnings, 0 failed |
| `node scripts/mvp-smoke.mjs --require-hermes --require-brain-memory --base-url http://127.0.0.1:3002` | Pass, 41 passed, 0 warnings, 0 failed |

## Files Changed

- `docs/architecture/PROJECT_SESSION_MEMORY_SCOPE.md`
- `docs/checkpoints/PROJECT_ONLY_READ_SEMANTICS_15H.md`
- `scripts/check-tenant-scope-diagnostics.mjs`
- `scripts/mvp-smoke.mjs`
- `scripts/ui-interaction-smoke.mjs`
- `ROADMAP.md`

## Cleanup

The temporary Web UI process on `3002` was stopped after final checks. Hermes on
`8642` and Brain Memory Gateway on `8080` were left running.

## Remaining Issues

- Project-only read behavior is project-broad and can return session-scoped
  memories from the same project.
- Project-level writes are not implemented.
- Memory mutation/admin actions remain deferred.
- Full auth/classification, durable evidence/supersession storage, and
  production one-command packaging remain deferred.

## Next Recommended Slice

Slice 15I: define the read-only Memory detail/evidence/supersession/audit
contract for Gateway-backed results, keeping mutation/admin controls deferred.
