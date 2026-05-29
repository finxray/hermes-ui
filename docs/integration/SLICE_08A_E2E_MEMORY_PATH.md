# Slice 08A: End-To-End Brain Memory Path Verification

## Summary

Slice 08A verified the intended live memory path end to end:

```text
Browser/BFF request
  -> Next.js BFF
    -> Hermes API server
      -> Brain Memory MCP tool
        -> Brain Memory Gateway/storage
```

and then:

```text
Browser/BFF request
  -> Next.js BFF
    -> Brain Memory Gateway UI API
      -> read-only memory search
```

No code compatibility changes were required. No memory mutation/admin UI,
browser-to-Gateway calls, direct storage access, schema changes, or streaming
architecture changes were added.

## Files Changed

- `docs/integration/SLICE_08A_E2E_MEMORY_PATH.md`

## Services Tested

- Hermes API: `http://127.0.0.1:8642`
- Brain Memory Gateway UI API: `http://127.0.0.1:8080`
- Temporary Hermes UI production server: `http://127.0.0.1:3003`

`http://127.0.0.1:8765` was not used because the standalone UI API helper only
listens there while `scripts/start-ui-api.ps1` is running. The live reachable
Gateway for this verification was `8080`.

## Baseline Status

- `GET http://127.0.0.1:8642/health`: HTTP 200, Hermes `status: ok`.
- `GET http://127.0.0.1:8080/health`: HTTP 200, Brain Memory Gateway
  `status: ok`, `version: 0.1.0-rc.1`, `storage.postgres: ok`.
- `GET /api/hermes/status` through the BFF: `mode: real`, `reachable: true`.
- `GET /api/brain-memory/status` through the BFF: `mode: real`,
  `reachable: true`.
- `POST /api/brain-memory/search` through the BFF for `Hermes`: `mode: real`,
  5 canonical results.

## Unique Marker

```text
E2E_MEMORY_20260529_181149_SHP9QR
```

Fact sent through Hermes chat:

```text
E2E_MEMORY_20260529_181149_SHP9QR means the Hermes UI full memory loop is working.
```

## Hermes Chat Write Path

The marker was sent through:

```text
POST http://127.0.0.1:3003/api/hermes/chat/stream
```

The request used the normal Hermes UI BFF chat path and structured
project/session context for the Brain Memory project. It did not call Brain
Memory Gateway directly.

Hermes response:

```text
E2E_MEMORY_STORED

Committed to Brain Memory (thread `6a37295a`, canonical status: committed, semantic indexing queued).
```

Observed Brain Memory/tool events:

- `mcp_brain_memory_memory_store` started/completed
- `mcp_brain_memory_memory_store` started/completed
- `mcp_brain_memory_memory_store` started/completed

Result: Hermes accepted the chat turn and used Brain Memory MCP storage tooling.

## Brain Memory Search Result

The marker was searched through:

```text
POST http://127.0.0.1:3003/api/brain-memory/search
```

Same-project context result:

- HTTP 200
- `mode: real`
- result count: 1
- layer: `canonical`
- source: `brain-memory`
- project key: `brain-memory`
- session key: `slice-08a-e2e`
- snippet:

```text
E2E_MEMORY_20260529_181149_SHP9QR: Hermes UI full memory loop verified working.
```

Result: the fact created through Hermes/Brain Memory MCP became searchable
through the Hermes UI BFF read-only Brain Memory console path.

## Same-Project Retrieval

A fresh Hermes session in the same Studio project asked:

```text
What is the E2E_MEMORY_20260529_181149_SHP9QR verification fact?
```

Hermes response:

```text
E2E_MEMORY_20260529_181149_SHP9QR is a verification fact that confirms the Hermes UI full memory loop is working correctly (an end-to-end test marker).
```

Observed retrieval/tool events:

- `mcp_brain_memory_memory_search_semantic` started/completed
- `session_search` started/completed

Result: same-project retrieval worked through Hermes memory tooling.

## Project-Scope Behavior

The same marker search was repeated through the BFF using a different Studio
project context but the same tenant (`local-dev`).

Observed result:

- result count: 1
- same canonical memory id as the same-project search
- display `projectKey`/`sessionKey` echoed the requested context

This matches the current Brain Memory UI API docs: the endpoint is
tenant-authorized, and project/session context is accepted and echoed, but the
first UI search endpoint does not yet enforce project/session storage filtering.

## Auth And Tenant Behavior

- `GET /health` is open.
- `/ui/capabilities` returned 401 without a configured UI bearer.
- `/ui/memory/search` succeeded when the server-side BFF sent the tenant-bound
  Gateway memory key as `X-Gateway-Memory-Api-Key`.
- The active tenant was `local-dev`.
- No API keys were printed, committed, or returned to the browser.

## Browser Smoke

Real Windows Chrome was opened in app mode against:

```text
http://127.0.0.1:3003
```

Valid screenshot evidence was captured showing the actual Hermes UI app window
with `Brain Memory Studio`, project/session navigation, `Hermes connected`, and
the right context panel. A later screenshot attempt captured Codex UI and was
discarded as invalid evidence.

## Checks

- `npm run studio:doctor`: passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm audit --audit-level=moderate`: passed

## What Worked

- Hermes status through BFF.
- Brain Memory Gateway status/search through BFF.
- Hermes chat streaming through BFF.
- Hermes-to-Brain-Memory MCP storage of a new fact.
- Brain Memory read-only search finding the newly stored fact.
- Fresh same-project Hermes retrieval of the stored fact.

## What Did Not Work / Current Limits

- `/ui/capabilities` requires UI bearer auth or local-dev bypass and returned
  401 in this environment.
- Brain Memory UI search is tenant-authorized but not yet project/session
  storage-filtered.
- The UI screenshot workflow is sensitive to desktop focus; only screenshots
  visibly showing the Hermes UI app should be treated as valid.

## Next Slice

Recommended next slice: **Slice 08B: project/session scoped Brain Memory search
contract hardening**, focused on making Gateway search filtering match the
Studio project/session context once the Brain Memory Gateway supports that
filtering explicitly.
