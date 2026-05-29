# Slice 08F - Brain Memory Read-Only Detail Drawer

Date: 2026-05-29

## Summary

Slice 08F adds a read-only memory inspection path to Hermes UI / Brain Memory
Studio. The browser still calls only the Next.js BFF. The BFF calls the Brain
Memory Gateway UI API and never exposes Gateway keys or storage details to the
browser.

No mutation, admin action, direct storage access, direct browser-to-Gateway
call, or full auth/classification system was added.

## Files Changed

- `packages/brain-memory-client/src/types.ts`
- `packages/brain-memory-client/src/index.ts`
- `apps/web/src/app/api/brain-memory/memory/inspect/route.ts`
- `apps/web/src/lib/brainMemoryClient.ts`
- `apps/web/src/hooks/useMemoryInspection.ts`
- `apps/web/src/components/BrainMemoryConsole.tsx`
- `apps/web/src/app/globals.css`
- `docs/integration/SLICE_08F_MEMORY_DETAIL_DRAWER.md`

## BFF Route

Added:

```text
POST /api/brain-memory/memory/inspect
```

The browser request shape is:

```json
{
  "memoryId": "memory-id",
  "context": {
    "project": {
      "id": "brain-memory",
      "title": "Brain Memory",
      "stableKey": "brain-memory",
      "tenantId": "local-dev",
      "retrievalProfile": "balanced",
      "contextPolicy": "project-and-session"
    },
    "session": {
      "id": "slice-08d-scope-bridge",
      "title": "Slice 08D scope bridge",
      "stableKey": "slice-08d-scope-bridge",
      "includeProjectContext": true,
      "includeSessionContext": true
    },
    "ui": {
      "source": "hermes-ui",
      "workspaceVersion": 1
    }
  }
}
```

The BFF response shape is:

```json
{
  "mode": "real",
  "memoryId": "memory-id",
  "detail": {},
  "evidence": {},
  "supersession": {},
  "error": null,
  "checkedAt": "2026-05-29T17:21:49.144Z"
}
```

## Gateway Calls

The BFF calls these Gateway UI API endpoints:

```text
GET /ui/memory/{memory_id}
GET /ui/memory/{memory_id}/evidence
GET /ui/memory/{memory_id}/supersession-chain
```

Query parameters use the BM-READ-DETAIL-01 camel-case contract:

- `tenantId`
- `projectKey`
- `projectId`
- `projectTitle`
- `sessionKey`
- `sessionId`
- `sessionTitle`
- `includeSessionContext`

## Auth Behavior

Server-side only:

- Sends `Authorization: Bearer <BRAIN_MEMORY_UI_API_KEY>` when configured.
- Sends `X-Gateway-Memory-Api-Key: <BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY>` when
  configured.
- Keeps legacy `BRAIN_MEMORY_API_KEY` only as the existing UI bearer alias.

The browser receives normalized status and error messages only. No API keys,
raw stack traces, database URLs, or storage credentials are returned.

## UI Behavior

The Memory Console search results are now clickable. Selecting a Gateway result
opens a read-only detail panel in the existing right console area. It shows:

- full content
- snippet
- memory id
- layer/source
- project key
- session key
- scope status
- supersession status
- evidence count
- created/updated timestamps
- metadata JSON behind a collapsed disclosure
- request scope summary
- evidence status
- supersession-chain status

When the Gateway is unconfigured, clicking a mock/local result opens a local
mock detail card and clearly labels it `mock/local`.

## Live Verification

Services tested:

- Hermes API: `http://127.0.0.1:8642`
- Brain Memory Gateway UI API: `http://127.0.0.1:8080`
- Temporary Hermes UI production server: `http://127.0.0.1:3007`

Initial finding: the Compose Gateway on `8080` was reachable but served an old
image. Its OpenAPI listed only `/ui/memory/search`. Running the Brain Memory
startup script rebuilt/recreated the Gateway container, after which OpenAPI
listed:

- `/ui/memory/{memory_id}`
- `/ui/memory/{memory_id}/evidence`
- `/ui/memory/{memory_id}/supersession-chain`
- `/ui/memory/search`

Live memory inspected:

```text
6ce086e2-d731-4c11-bf23-27c2e90b13bd
```

Marker:

```text
E2E_SCOPE_BRIDGE_20260529164807_KYJTV2
```

Context:

- Tenant: `local-dev`
- Project key: `brain-memory`
- Session key: `slice-08d-scope-bridge`

Detail result:

- `mode: real`
- `detail.id: 6ce086e2-d731-4c11-bf23-27c2e90b13bd`
- `detail.projectKey: brain-memory`
- `detail.sessionKey: slice-08d-scope-bridge`
- `detail.scopeStatus: matching-session`
- `detail.scope.status: enforced`
- `detail.scope.mode: project-and-session`
- metadata contained `contentJsonb.projectKey` and
  `contentJsonb.sessionKey`

Evidence result:

- `status: not_implemented`
- `evidence: []`

Supersession-chain result:

- `status: not_implemented`
- `chain: []`

Wrong-session scope check:

- Same memory id with session key `slice-08d-other-session` returned a safe
  normalized 404:
  `Memory is not available in the current project/session scope...`

## Error Handling

Normalized user-facing cases:

- `400`: request context or memory id rejected
- `401`: UI bearer missing/invalid or required
- `403`: tenant-bound Gateway memory key missing or unauthorized
- `404`: memory unavailable in current project/session scope, or endpoint absent
- network/timeout: Gateway unreachable or timed out

## Real Chrome Smoke

The app was opened in real Windows Chrome at:

```text
http://127.0.0.1:3007
```

The production server loaded with the new BFF route. The browser-open check was
used together with BFF HTTP verification for the actual detail/evidence/
supersession payloads. Screenshot capture was not used as final evidence in
this slice.

## Checks

- `npm run typecheck`: passed
- `npm run build`: passed
- `npm audit --audit-level=moderate`: passed
- `npm run studio:doctor`: passed with current checked-in local env; Brain
  Memory is still disabled in `apps/web/.env.local`, while the live verification
  used a temporary server env pointing to `http://127.0.0.1:8080`.

## Limitations

- Evidence storage is not implemented in Brain Memory yet; the UI shows the
  honest `not_implemented` state.
- Supersession-chain storage is not implemented in Brain Memory yet; the UI
  shows the honest `not_implemented` state.
- The BFF uses one combined inspect endpoint for now. Separate browser-facing
  endpoints can be added later if the UI needs independent lazy loading.
- Full auth/classification, user accounts, clearance levels, and policy engine
  remain deferred until the end-to-end product is stable.

## Next Slice

Recommended next slice: Slice 08G - polish scoped memory inspection UX and add
small regression coverage for the Brain Memory read-only BFF client.
