# Slice 08C-R: Session-Scoped Brain Memory Write Verification

## Summary

Slice 08C-R verified live Hermes UI behavior after Brain Memory
BM-WRITE-SCOPE-01. The goal was to determine whether a memory created through
the normal Hermes UI chat path is now stored with both `projectKey` and
`sessionKey`.

Result: the Hermes UI request did include the active session key, but the live
Hermes/MCP write path did not store the marker in Brain Memory. The streamed
MCP tool arguments did not visibly include `projectKey`, `sessionKey`,
`metadata`, or `context`, and Hermes reported that its Brain Memory Gateway path
was unreachable during the write attempt.

No Hermes UI compatibility fix was made because the UI and BFF already pass the
session scope in the structured request context. No memory mutation/admin UI,
direct browser-to-Gateway calls, direct storage access, schema changes, auth
expansion, or Hermes streaming architecture changes were added.

## Services Tested

- Hermes API: `http://127.0.0.1:8642`
- Brain Memory Gateway UI API: `http://127.0.0.1:8080`
- Temporary Hermes UI production server: `http://127.0.0.1:3005`

Baseline checks:

- `GET http://127.0.0.1:8642/health`: HTTP 200, `status: ok`.
- `GET http://127.0.0.1:8080/health`: HTTP 200, `status: ok`,
  `version: 0.1.0-rc.1`, `storage.postgres: ok`.
- `GET /api/hermes/status` through the BFF: `mode: real`,
  `reachable: true`.
- `GET /api/brain-memory/status` through the BFF: `mode: real`,
  `reachable: true`, `configured: true`.
- Baseline `POST /api/brain-memory/search` through the BFF for `Hermes`:
  `mode: real`, 3 results, scoped search metadata present.
- `npm run studio:doctor` was run with a temporary bundle-ready env overlay:
  Hermes direct health connected, BFF Hermes connected, BFF Brain Memory
  connected, Brain Memory direct health connected. `/ui/capabilities` returned
  HTTP 401 without an optional UI bearer, which is non-fatal for this read
  search path.

## Active Context

- Tenant: `local-dev`
- Project stable key: `brain-memory`
- Active session stable key: `slice-08c-session`
- Hermes session id:
  `slice-08c-session-e2e_session_memory_20260529160123_llfo6e`

The Hermes UI chat request context included:

- `project.id`
- `project.title`
- `project.stableKey`
- `project.tenantId`
- `project.retrievalProfile`
- `project.contextPolicy`
- `session.id`
- `session.title`
- `session.stableKey`
- `session.hermesSessionId`
- `session.includeProjectContext`
- `session.includeSessionContext`
- `ui.source`
- `ui.workspaceVersion`

The server-side chat route validates these fields before forwarding the request
to Hermes.

## Marker

```text
E2E_SESSION_MEMORY_20260529160123_LLFO6E
```

Fact:

```text
E2E_SESSION_MEMORY_20260529160123_LLFO6E means session-scoped Brain Memory writes are working.
```

The marker was sent through:

```text
POST http://127.0.0.1:3005/api/hermes/chat/stream
```

Prompt:

```text
Please remember this session-scoped test fact for the active project and active
session: E2E_SESSION_MEMORY_20260529160123_LLFO6E means session-scoped Brain
Memory writes are working. Reply with E2E_SESSION_MEMORY_STORED after handling
it.
```

## Hermes Response

Hermes accepted the request and streamed a response:

```text
E2E_SESSION_MEMORY_STORED - but with caveats:

Brain Memory Gateway is unreachable (MCP server returning connection failures
after 3 retries), so the write couldn't go to its canonical store. Hermes
native memory also has a file drift issue that prevented a fallback write.

The fact has been noted in this conversation context. If you want to try the
Brain Memory store again, let me know once the Gateway is back up, or I can
attempt a fourth retry now if preferred.
```

## Brain Memory Tool Events

Hermes emitted live tool activity:

- `mcp_brain_memory_memory_store`: 8 normalized tool events
  (started/completed pairs).
- `mcp_brain_memory_memory_health_check`: started/completed.
- `memory`: started/completed.

Visible `memory_store` arguments included combinations of:

- `content_text`
- `privacy_scope`
- `retention_class`
- `role`
- `thread_id`

The visible streamed tool arguments did not include:

- `projectKey`
- `project_key`
- `projectId`
- `sessionKey`
- `session_key`
- `sessionId`
- `metadata`
- `context`

This means the UI session key was sent to Hermes, but it was not visible at the
MCP tool-call boundary in this run.

## Same-Session Search

Search route:

```text
POST http://127.0.0.1:3005/api/brain-memory/search
```

Query:

```text
E2E_SESSION_MEMORY_20260529160123_LLFO6E
```

Context:

- Project key: `brain-memory`
- Session key: `slice-08c-session`

Observed result:

- `mode: real`
- Result count: `0`
- `scope.mode: project-and-session`
- `scope.status: enforced`
- `scope.projectKey: brain-memory`
- `scope.sessionKey: slice-08c-session`
- `scope.legacyUnscopedExcluded: 0`
- `scope.mismatchedProjectExcluded: 0`
- `scope.mismatchedSessionExcluded: 0`

Conclusion: same-session search did not find the marker. It did not return a
`matching-session` result.

## Same-Project Different-Session Search

Context:

- Project key: `brain-memory`
- Session key: `slice-08c-other-session`

Observed result:

- `mode: real`
- Result count: `0`
- `scope.mode: project-and-session`
- `scope.status: enforced`
- `scope.projectKey: brain-memory`
- `scope.sessionKey: slice-08c-other-session`
- `scope.legacyUnscopedExcluded: 0`
- `scope.mismatchedProjectExcluded: 0`
- `scope.mismatchedSessionExcluded: 0`

Conclusion: the marker was not present, so this did not prove session exclusion
for a stored session-scoped row.

## Different-Project Search

Context:

- Project key: `hermes-agent`
- Session key: `slice-08c-session`

Observed result:

- `mode: real`
- Result count: `0`
- `scope.mode: project-and-session`
- `scope.status: enforced`
- `scope.projectKey: hermes-agent`
- `scope.sessionKey: slice-08c-session`
- `scope.legacyUnscopedExcluded: 0`
- `scope.mismatchedProjectExcluded: 0`
- `scope.mismatchedSessionExcluded: 0`

Conclusion: the marker was not present, so this did not prove project exclusion
for a stored row.

## Diagnosis

What is confirmed:

- Hermes UI sends `session.stableKey` in the browser-to-BFF request.
- The BFF requires `session.stableKey` and `session.hermesSessionId`.
- The server-side Hermes client forwards the full structured context to Hermes
  under `metadata.context`.
- Brain Memory UI search is reachable and authorized through the BFF.

What did not happen:

- The marker was not found in Brain Memory UI search.
- The streamed MCP `memory_store` arguments did not show session scope fields.
- Hermes reported that its MCP Brain Memory Gateway path was unreachable.

Most likely current loss point:

- The UI context reaches Hermes BFF and is forwarded to Hermes metadata, but the
  active Hermes agent/MCP write path did not expose or use that metadata when it
  called `mcp_brain_memory_memory_store`.

The run also suggests the Hermes-side Brain Memory MCP process may still be
misconfigured or stale relative to the reachable Gateway UI API on `8080`,
because the UI API was reachable while Hermes reported its MCP Gateway path was
unreachable.

## Auth And Tenant Behavior

- Tenant used for UI search: `local-dev`.
- Tenant-bound Gateway memory key was configured in the temporary server
  environment and was not printed.
- Brain Memory UI search through the BFF succeeded for baseline queries.
- No 401 or 403 occurred once the temporary server was launched with the
  correctly parsed tenant key.
- Browser code still calls only Hermes UI BFF routes, never Brain Memory
  Gateway directly.

## Real Chrome Smoke

A real Windows Chrome app window was opened against:

```text
http://127.0.0.1:3005
```

The app opened for the user in a clean Chrome profile. The live BFF HTTP checks
above verified the same service state the UI uses. No valid screenshot evidence
was captured for this slice.

## Checks

- `npm run studio:doctor`: passed local diagnostics with a temporary
  bundle-ready env overlay; `/ui/capabilities` returned HTTP 401 without the
  optional UI bearer.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm audit --audit-level=moderate`: passed.

## Files Changed

- `docs/integration/SLICE_08C_SESSION_SCOPED_WRITES.md`

## Recommended Next Slice

Recommended next slice: Hermes/Hermes-MCP context propagation hardening. Verify
that the live Hermes process has restarted with the BM-WRITE-SCOPE-01 MCP tool
schema, align the Hermes MCP Gateway URL with the reachable Brain Memory
Gateway, and ensure Hermes passes `metadata.context.session.stableKey` or
explicit `sessionKey` into `mcp_brain_memory_memory_store`.
