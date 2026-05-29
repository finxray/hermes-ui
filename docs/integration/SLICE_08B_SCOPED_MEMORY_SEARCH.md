# Slice 08B-R: Scoped Brain Memory Search Verification

## Summary

Slice 08B-R verified Hermes UI against the BM-SCOPE-01 read contract for
explicit project/session-scoped Brain Memory UI search.

The new scoped marker was written through the normal Hermes chat path and then
found through the Hermes UI BFF Brain Memory search route in the same project.
The same marker was excluded when searched from another project. The old Slice
08A marker is now correctly excluded from project-scoped UI search as a
legacy/unscoped memory.

No memory mutation/admin UI, direct browser-to-Gateway calls, direct storage
access, schema changes, forced Brain Memory install, or Hermes streaming
architecture changes were added.

## Files Changed

- `packages/brain-memory-client/src/types.ts`
- `packages/brain-memory-client/src/index.ts`
- `apps/web/src/components/BrainMemoryConsole.tsx`
- `docs/integration/SLICE_08B_SCOPED_MEMORY_SEARCH.md`

## Services Tested

- Hermes API: `http://127.0.0.1:8642`
- Brain Memory Gateway UI API: `http://127.0.0.1:8080`
- Temporary Hermes UI production server: `http://127.0.0.1:3004`

Baseline checks:

- `GET http://127.0.0.1:8642/health`: HTTP 200, `status: ok`.
- `GET http://127.0.0.1:8080/health`: HTTP 200, `status: ok`,
  `version: 0.1.0-rc.1`, `storage.postgres: ok`.
- `GET /api/hermes/status` through the BFF: `mode: real`,
  `reachable: true`, `configured: true`.
- `GET /api/brain-memory/status` through the BFF: `mode: real`,
  `reachable: true`, `configured: true`.
- Baseline `POST /api/brain-memory/search` for `Hermes`: `mode: real`,
  5 results. Response included scoped-search counters.

The live Gateway was tested on `8080`. `8765` was not needed for this run.

## Old Marker Behavior

Old Slice 08A marker:

```text
E2E_MEMORY_20260529_181149_SHP9QR
```

Search context:

- Tenant: `local-dev`
- Project key: `brain-memory`
- Session key: `slice-08b-scoped`

Observed BFF search result:

- `mode: real`
- Result count: `0`
- `scope.mode: project-and-session`
- `scope.status: enforced`
- `scope.legacyUnscopedExcluded: 1`
- `scope.mismatchedProjectExcluded: 0`
- `scope.mismatchedSessionExcluded: 0`

This is the expected BM-SCOPE-01 behavior: the old marker was stored
tenant-only/unscoped and is now excluded from project-scoped UI search by
default.

## New Scoped Marker

New marker:

```text
E2E_SCOPED_MEMORY_20260529_184352_WR20VS
```

Fact:

```text
E2E_SCOPED_MEMORY_20260529_184352_WR20VS means scoped Brain Memory search is working.
```

The marker was sent through:

```text
POST http://127.0.0.1:3004/api/hermes/chat/stream
```

The chat request used the normal Hermes UI BFF route with the active UI context
contract:

- Tenant: `local-dev`
- Project key: `brain-memory`
- Session key: `slice-08b-scoped`
- Hermes session id:
  `slice-08b-scoped-e2e_scoped_memory_20260529_184352_wr20vs`

Prompt:

```text
Please remember this project-scoped test fact for the active project:
E2E_SCOPED_MEMORY_20260529_184352_WR20VS means scoped Brain Memory search is
working. Use your Brain Memory memory tools if available and preserve the
active project context. Reply with E2E_SCOPED_MEMORY_STORED after handling it.
```

Hermes response:

```text
E2E_SCOPED_MEMORY_STORED

Fact persisted to Brain Memory (tenant: local-dev, thread:
1c9964ff-5abd-4f7f-9ad3-6d1a1a541636, message:
b8018305-f012-4a13-b75c-bc52bcb175b9). Canonical status: committed. Semantic
index: queued for background upsert.

Note: The Brain Memory Gateway was temporarily down when the request arrived
but recovered during the wait window, allowing the write to succeed.
```

## Brain Memory Tool Events

Hermes emitted Brain Memory tool activity during the run:

- `mcp_brain_memory_memory_store`: started/completed multiple times.
- `memory`: started/completed.
- `mcp_brain_memory_memory_health_check`: started/completed.

The first store attempt included tenant-level fields only. Later store attempts
included project metadata through `new_thread.project: brain-memory`. No
explicit UI session key metadata was visible in the tool arguments captured by
the stream.

This means the marker was stored with project scope, but not session scope.

## Same-Project Search

Search route:

```text
POST http://127.0.0.1:3004/api/brain-memory/search
```

Query:

```text
E2E_SCOPED_MEMORY_20260529_184352_WR20VS
```

Context:

- Tenant: `local-dev`
- Project key: `brain-memory`
- Session key: `slice-08b-scoped`

Observed result:

- `mode: real`
- Result count: `1`
- First result id: `b8018305-f012-4a13-b75c-bc52bcb175b9`
- First result layer: `canonical`
- First result project key: `brain-memory`
- First result session key: not set
- First result scope status: `matching-project`
- `scope.mode: project-and-session`
- `scope.status: partial`
- `scope.legacyUnscopedExcluded: 0`
- `scope.mismatchedProjectExcluded: 0`
- `scope.mismatchedSessionExcluded: 0`

Conclusion: same-project scoped search works. The marker was stored
project-scoped rather than session-scoped.

## Other-Project Search

The same marker was searched with a different project context:

- Tenant: `local-dev`
- Project key: `hermes-agent`
- Session key: `other-project-scope-check`

Observed result:

- `mode: real`
- Result count: `0`
- `scope.mode: project-and-session`
- `scope.status: enforced`
- `scope.legacyUnscopedExcluded: 0`
- `scope.mismatchedProjectExcluded: 1`
- `scope.mismatchedSessionExcluded: 0`

Conclusion: BM-SCOPE-01 project isolation worked. The result was excluded from
the other project as a project mismatch.

## UI Compatibility

The Brain Memory client and console were updated to understand the new scoped
response fields:

- Response-level `scope`.
- Result-level `scopeStatus`.
- `scope.legacyUnscopedExcluded`.
- `scope.mismatchedProjectExcluded`.
- `scope.mismatchedSessionExcluded`.

The Memory console now shows a concise scope summary when real Gateway search
returns scope metadata, and result cards prefer `scopeStatus` in the pill label
when present.

No layout redesign or new memory actions were added.

## Auth And Tenant Behavior

- Tenant used for search: `local-dev`.
- Tenant-bound Gateway memory key was configured in the temporary server
  environment and was not printed.
- Status and search were both successful through the BFF.
- No 401 or 403 was observed in this verification run.
- Browser code still calls only Hermes UI BFF routes, never the Gateway
  directly.

## Real Chrome Smoke

A real Windows Chrome app window was opened against:

```text
http://127.0.0.1:3004
```

The app loaded for visual smoke testing. BFF HTTP checks verified the same live
Hermes and Brain Memory states used by the UI. Screenshot capture was attempted,
but the captured image showed the Codex UI instead of Hermes UI, so it was
treated as invalid smoke evidence and was not kept.

## Checks

- `npm run studio:doctor`: run for local diagnostics.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm audit --audit-level=moderate`: passed.

## What Worked

- Hermes API was reachable.
- Brain Memory Gateway UI API was reachable.
- Old unscoped Slice 08A marker was excluded from scoped search.
- New scoped marker was accepted by live Hermes chat.
- Hermes emitted Brain Memory tool events.
- New marker was found from the same project with `matching-project`.
- New marker was excluded from another project with
  `mismatchedProjectExcluded: 1`.
- UI can now display scoped search status and exclusion counters.

## What Did Not Work Or Remains Partial

- The new marker was stored project-scoped, not session-scoped.
- The Hermes/Brain Memory write path did not visibly propagate the UI session
  stable key into Brain Memory metadata.
- Screenshot evidence for this slice was invalid because capture selected the
  Codex UI, not the Hermes UI app.

## Recommended Next Slice

Recommended next slice: verify and harden write-path metadata propagation from
Hermes/Brain Memory MCP so stored memories include both project key and session
key when the UI context contract provides them.
