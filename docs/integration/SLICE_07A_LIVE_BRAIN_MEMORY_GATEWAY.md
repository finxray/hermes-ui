# Slice 07A: Live Brain Memory Gateway Verification

## Summary

Slice 07A updated Hermes UI's Brain Memory BFF/client adapter for the current
Gateway UI API auth model and verified the reachable local Gateway state.

The prior Slice 06 behavior used one `BRAIN_MEMORY_API_KEY` value as a bearer
token for both status and search. The updated behavior separates:

- optional UI/BFF bearer auth: `BRAIN_MEMORY_UI_API_KEY`
- tenant-bound memory search auth: `BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY`
- legacy alias: `BRAIN_MEMORY_API_KEY`, kept only for older local configs

No browser-to-Gateway calls, memory mutations, direct storage access, or forced
Brain Memory installation were added.

## Files Changed

- `.env.example`
- `README.md`
- `env/web-ui-only.env.example`
- `env/web-ui-with-hermes.env.example`
- `env/bundle-with-brain-memory.env.example`
- `env/attach-brain-memory-later.env.example`
- `packages/brain-memory-client/src/types.ts`
- `packages/brain-memory-client/src/index.ts`
- `apps/web/src/app/api/brain-memory/status/route.ts`
- `apps/web/src/app/api/brain-memory/search/route.ts`
- `apps/web/src/components/BrainMemoryStatusPanel.tsx`
- `apps/web/src/components/BrainMemoryConsole.tsx`
- `scripts/studio-doctor.mjs`
- `scripts/check-brain-memory-api.mjs`
- `docs/integration/SLICE_06_BRAIN_MEMORY_CONSOLE_NOTES.md`
- `docs/packaging/LOCAL_STARTUP_GUIDE.md`
- `docs/packaging/PACKAGING_MODES.md`
- `docs/integration/SLICE_07A_LIVE_BRAIN_MEMORY_GATEWAY.md`

## Env Vars

```env
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8765
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true

# Optional /ui/** bearer gate. Sent as Authorization: Bearer <value>.
BRAIN_MEMORY_UI_API_KEY=

# Tenant-bound read key. Sent as X-Gateway-Memory-Api-Key for /ui/memory/search.
BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY=

# Legacy alias for older local configs.
BRAIN_MEMORY_API_KEY=
```

`BRAIN_MEMORY_UI_API_KEY` and `BRAIN_MEMORY_API_KEY` do not grant tenant memory
access by themselves. Search authorization is based on the active
`context.project.tenantId` and the tenant allowlist for
`BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY` in Brain Memory Gateway.

## BFF Routes

- `GET /api/brain-memory/status`
- `POST /api/brain-memory/search`

The browser still calls only these BFF routes.

## Gateway Endpoints Called

Status:

- `GET <gateway>/health`
- `GET <gateway>/ui/capabilities`

Search:

- `POST <gateway>/ui/memory/search`
- fallback `GET <gateway>/ui/memory/search?...` only when POST returns 404/405

## Auth Behavior

Status sends `Authorization: Bearer <BRAIN_MEMORY_UI_API_KEY>` only when the UI
API key is configured. It does not send the tenant memory key.

Search sends:

- `Authorization: Bearer <BRAIN_MEMORY_UI_API_KEY>` when configured
- `X-Gateway-Memory-Api-Key: <BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY>` when configured

Search keeps the existing structured UI context:

```json
{
  "query": "Hermes",
  "limit": 8,
  "context": {
    "project": {
      "id": "project-brain-memory",
      "title": "Brain Memory",
      "stableKey": "brain-memory",
      "tenantId": "local-dev",
      "retrievalProfile": "balanced",
      "contextPolicy": "project-and-session"
    },
    "session": {
      "id": "session-hermes-ui-roadmap",
      "title": "Hermes UI roadmap",
      "stableKey": "hermes-ui-roadmap",
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

## Error Normalization

- `401` becomes `kind: "unauthorized"` with a UI/Gateway auth guidance message.
- `403` becomes `kind: "forbidden"` with tenant-bound memory key guidance.
- other HTTP failures remain `kind: "http_error"`.

Raw stack traces and secrets are not returned to the browser.

## Live Verification

Observed local Gateway state:

- `http://127.0.0.1:8765/health`: not reachable
- `http://127.0.0.1:8080/health`: reachable, HTTP 200
- `http://127.0.0.1:8080/ui/capabilities`: HTTP 404
- `http://127.0.0.1:8080/ui/memory/search`: HTTP 404

A temporary `apps/web/.env.local` overlay and production server on
`http://127.0.0.1:3001` were used for BFF verification, then the original
env file was restored.

Results:

- `GET /api/brain-memory/status` returned `mode: "real"` with Gateway health
  from `http://127.0.0.1:8080`.
- `POST /api/brain-memory/search` returned a clean normalized error because
  the running Gateway did not expose `/ui/memory/search`.
- 401/403 auth-specific paths were not live-tested because the running Gateway
  returned 404 before auth handling on the UI API path.
- Hermes live streaming through `/api/hermes/chat/stream` still returned SSE
  `message_delta` and `message_done` events.

## Browser Smoke

Real Windows Chrome was opened against the temporary app URL. Process inspection
confirmed a Chrome window titled `Brain Memory Studio`. A reliable foreground
screenshot could not be captured from this desktop session, but the BFF smoke
checks above verified the same temporary app server used for the browser open.

## Checks

- `npm run typecheck`: passed
- `npm run build`: passed
- `npm audit --audit-level=moderate`: passed
- `npm run studio:doctor`: passed; in the temporary bundle check it reported
  Hermes connected, Brain Memory `/health` connected, `/ui/capabilities` 404,
  and missing tenant memory key guidance.

## Known Limitations

- The current reachable local service on port `8080` exposes `/health` but not
  the read-only UI API paths.
- Live canonical memory results could not be verified until a Gateway exposing
  `/ui/memory/search` is running on `8765` or `8080`.
- The UI remains read-only; memory detail, evidence, audit, supersession-chain,
  and admin mutation endpoints are still future work.

## Next Slice

Recommended next slice: **Slice 07B: Brain Memory UI endpoint compatibility
hardening and live canonical search once `/ui/memory/search` is reachable**.
