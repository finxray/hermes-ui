# Slice 09C - Project/Session Saved-State Reliability

Date: 2026-05-29

## Summary

Slice 09C stabilizes the local project/session state now that project and
session stable keys are real Brain Memory scope identifiers.

No memory mutation/admin actions, direct browser-to-Gateway calls, direct
storage access, or full auth/classification work was added.

## Files Changed

- `apps/web/src/lib/workspaceStore.ts`
- `package.json`
- `scripts/check-workspace-state.mjs`
- `docs/integration/SLICE_09C_PROJECT_SESSION_RELIABILITY.md`

## State Model Findings

- LocalStorage key remains `hermes-ui.workspace.v1`.
- LocalStorage schema version remains `1`.
- Project ids and session ids are UUID-based for newly created items.
- Project stable keys are derived from tenant id + project id at creation.
- Session stable keys are derived from tenant id + project id + session id at
  creation.
- `hermesSessionId` is independent from the display title.
- Rename actions already changed display names only; they did not change stable
  keys.
- Active-state repair existed on hydrate but selected the first project by list
  order when the active project was missing.
- New sessions always used `New chat`, so repeated new chats could collide in
  the sidebar.
- Auto-title cleanup only handled the exact title `New chat`, not `New chat N`.

## Stable Key Rules

Confirmed and covered by regression checks:

- Renaming a project does not change `project.memoryScope.stableProjectKey`.
- Renaming a project does not change `project.memoryScopeKey`.
- Renaming a session does not change `session.memoryScope.stableSessionKey`.
- Renaming a session does not change `session.hermesSessionId`.
- New project stable keys remain UUID/id-based, not title-derived.
- New session stable keys remain UUID/id-based, not title-derived.

## LocalStorage Compatibility

No version bump was required.

The existing `hermes-ui.workspace.v1` payload remains compatible. This slice
uses additive normalization only:

- missing project memory scope is filled from stable ids
- missing session memory scope is filled from stable ids
- missing `hermesSessionId` is repaired from the session id
- missing/invalid active ids are repaired to valid visible items where possible

No localStorage wipe occurs unless the user explicitly clicks reset.

## Title Cleanup Behavior

New project titles are now unique and readable:

- `Untitled project`
- `Untitled project 2`

New session titles are now unique within the active project:

- `New chat`
- `New chat 2`

If a session is still `New chat` or `New chat N`, the first user message
renames it locally with a short deterministic title. Example:

```text
Can you verify memory scope?
```

becomes:

```text
Verify memory scope
```

This does not call an AI model, does not change the session stable key, and does
not change the Hermes session id.

## Active State Repair

Hydrate now repairs a missing active project by choosing the most recently
updated valid project instead of blindly taking list order.

Archived active sessions are no longer left active. When the active session is
archived, the reducer selects the most recent visible session in that project or
sets `activeSessionId` to `null` if no visible session remains.

Reset mock data still returns a valid active project/session pair.

## Regression Coverage

Added:

```text
npm run check:workspace-state
```

Script:

```text
scripts/check-workspace-state.mjs
```

The script imports the actual workspace reducer and checks:

- stable keys unchanged after project/session rename
- new project/session default titles are unique
- first user message auto-titles `New chat`
- auto-title does not change stable session key or Hermes session id
- hydrate repairs missing active ids
- normalization fills missing memory scope fields
- archiving active session repairs active state
- reset mock data returns valid state

## Live Smoke

Temporary production server:

```text
http://127.0.0.1:3007
```

Temporary process env pointed to:

- Hermes: `http://127.0.0.1:8642`
- Brain Memory Gateway: `http://127.0.0.1:8080`

Observed:

- `/api/hermes/status`: `mode: real`, `reachable: true`
- `/api/brain-memory/status`: `mode: real`, `reachable: true`
- `/api/brain-memory/search` found the known scoped memory
- `/api/brain-memory/memory/inspect` returned real detail for:
  `6ce086e2-d731-4c11-bf23-27c2e90b13bd`
- detail still reported `projectKey: brain-memory`,
  `sessionKey: slice-08d-scope-bridge`, and
  `scopeStatus: matching-session`
- evidence remained `not_implemented`
- supersession chain remained `not_implemented`

Hermes streaming code was not changed in this slice.

## Real Chrome Smoke

Opened the actual Hermes UI in real Windows Chrome at:

```text
http://127.0.0.1:3007
```

Screenshot capture was not used as evidence. The BFF HTTP smoke above confirms
the live integration state; the reducer script covers create/rename/archive/
reload-style saved-state behavior without requiring browser DOM automation.

## Checks

- `npm run check:workspace-state`: passed
- `npm run check:brain-memory-client`: passed
- `npm run studio:doctor`: passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm audit --audit-level=moderate`: passed

## What Remains

- A future design pass can make stable scope keys easier to inspect without
  making the UI too technical.
- If the app later adopts a test runner, these script checks can become focused
  unit tests.
- Multi-user auth/classification remains intentionally deferred.

## Next Slice

Recommended next slice: Slice 09D - lightweight project/session export and
diagnostics, or the next product-priority slice if packaging remains the focus.
