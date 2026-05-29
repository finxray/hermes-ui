# Slice 08G - Memory Inspection UX Polish

Date: 2026-05-29

## Summary

Slice 08G stabilizes the read-only Brain Memory inspection experience added in
Slice 08F. It keeps the existing product layout and BFF architecture intact:

```text
Browser UI -> Next.js BFF -> Brain Memory Gateway UI API
```

No memory mutation/admin actions, direct browser-to-Gateway calls, direct
storage access, or full auth/classification features were added.

## Files Changed

- `apps/web/src/components/BrainMemoryConsole.tsx`
- `apps/web/src/app/globals.css`
- `packages/brain-memory-client/src/index.ts`
- `scripts/check-brain-memory-client-shapes.mjs`
- `package.json`
- `docs/integration/SLICE_08G_MEMORY_INSPECTION_POLISH.md`

## UX Improvements

- Added a subtle selected state for clicked memory search results.
- Clearing and changing project/session now clears the selected detail state.
- Starting a new search clears stale selection/detail state.
- Added concise scope guidance:
  `Project/session scope is enforced by Brain Memory Gateway. Legacy unscoped memories are excluded by default.`
- Kept full memory content scrollable and wrapped to avoid horizontal overflow.
- Kept metadata behind a collapsed `details` block.
- Kept evidence and supersession-chain fallback states quiet and read-only.

## Error Copy Polish

Normalized client messages now use clearer user-facing text:

- `401`: `Brain Memory UI API bearer is required or invalid.`
- `403`: `Tenant key is not authorized for this memory scope.`
- `404`: `Memory is not available in the current project/session scope (HTTP 404).`
- unconfigured inspect: `Brain Memory Gateway is not configured. Showing local/mock memory only.`

No raw stack traces or secrets are returned.

## Regression Coverage

Added:

```text
npm run check:brain-memory-client
```

Script:

```text
scripts/check-brain-memory-client-shapes.mjs
```

The script imports the real `@hermes-ui/brain-memory-client` package and uses a
small mocked `fetch` implementation. It checks:

- unconfigured inspect behavior
- `401`, `403`, and `404` error normalization
- no API key leakage in normalized responses
- inspect detail parsing
- `scopeStatus: matching-session`
- `supersessionStatus: active`
- evidence `status: not_implemented`
- supersession-chain `status: not_implemented`
- camel-case detail query scope parameters
- search scope exclusion counters

No heavy test framework was added.

## BFF Safety Review

Reviewed:

- Browser client still calls only `/api/brain-memory/memory/inspect`.
- BFF route reads Gateway URL and keys server-side only.
- BFF route requires structured project/session context.
- Request size remains capped at `32_000` bytes.
- Memory id is trimmed and capped before being passed to the client.
- Gateway path segments are URL-encoded by the server-side client.
- Gateway API keys are sent only as server-side headers.
- Browser responses contain normalized data/errors only.

## Live Verification

Services tested:

- Hermes API: `http://127.0.0.1:8642`
- Brain Memory Gateway UI API: `http://127.0.0.1:8080`
- Temporary Hermes UI production server: `http://127.0.0.1:3007`

Gateway route check confirmed:

- `/ui/memory/{memory_id}`
- `/ui/memory/{memory_id}/evidence`
- `/ui/memory/{memory_id}/supersession-chain`
- `/ui/memory/search`

Live memory inspected:

```text
6ce086e2-d731-4c11-bf23-27c2e90b13bd
```

Result:

- `mode: real`
- `detail.projectKey: brain-memory`
- `detail.sessionKey: slice-08d-scope-bridge`
- `detail.scopeStatus: matching-session`
- `detail.supersessionStatus: active`
- `detail.scope.status: enforced`
- `detail.scope.mode: project-and-session`

Evidence:

- `status: not_implemented`
- `evidence: []`

Supersession chain:

- `status: not_implemented`
- `chain: []`

Wrong-session inspect:

- Same memory id under `slice-08d-other-session` returned:
  `Memory is not available in the current project/session scope (HTTP 404).`

Hermes streaming was not changed in this slice. Hermes health remained
reachable at `http://127.0.0.1:8642/health`.

## Real Chrome Smoke

Opened the actual Hermes UI app in real Windows Chrome at:

```text
http://127.0.0.1:3007
```

Screenshot capture was not used as final evidence. BFF HTTP checks confirmed the
live detail, evidence, supersession, and scoped 404 behavior.

## Checks

- `npm run check:brain-memory-client`: passed
- `npm run studio:doctor`: passed
- `npm run typecheck`: passed
- `npm run build`: passed
- `npm audit --audit-level=moderate`: passed

## Remaining Future Work

- A later design pass can refine the detail panel once real evidence and
  supersession-chain storage exist.
- The full auth/classification system remains intentionally deferred.
- Evidence and supersession-chain UI should render real items when Brain Memory
  exposes durable backing data.

## Next Slice

Recommended next slice: Slice 08H - prepare read-only evidence/supersession UI
fixtures or move to the next product-priority slice if Brain Memory storage for
those objects is not ready yet.
