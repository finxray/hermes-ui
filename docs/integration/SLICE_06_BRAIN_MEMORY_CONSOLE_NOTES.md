# Slice 06 Brain Memory Console Notes

Date: 2026-05-29

## Scope

Slice 06 adds the first read-only Brain Memory Gateway foundation:

```text
Browser UI -> Next.js BFF -> Brain Memory Gateway UI/read-only endpoints
```

The agent memory path remains unchanged:

```text
Browser UI -> BFF -> Hermes -> Brain Memory MCP/skill/plugin -> Brain Memory Gateway
```

No memory mutation, admin action, storage adapter, or direct browser-to-Gateway call was added.

## Files Changed

- `.env.example`
- `apps/web/package.json`
- `package-lock.json`
- `apps/web/src/app/api/brain-memory/status/route.ts`
- `apps/web/src/app/api/brain-memory/search/route.ts`
- `apps/web/src/lib/brainMemoryClient.ts`
- `apps/web/src/hooks/useBrainMemoryStatus.ts`
- `apps/web/src/hooks/useBrainMemorySearch.ts`
- `apps/web/src/components/AppShell.tsx`
- `apps/web/src/components/ContextPanel.tsx`
- `apps/web/src/components/BrainMemoryConsole.tsx`
- `apps/web/src/components/BrainMemoryStatusPanel.tsx`
- `apps/web/src/app/globals.css`
- `packages/brain-memory-client/package.json`
- `packages/brain-memory-client/README.md`
- `packages/brain-memory-client/src/index.ts`
- `packages/brain-memory-client/src/types.ts`
- `scripts/check-brain-memory-api.mjs`
- `docs/integration/SLICE_06_BRAIN_MEMORY_CONSOLE_NOTES.md`

## BFF Routes

```http
GET /api/brain-memory/status
POST /api/brain-memory/search
```

The browser calls only these local BFF routes. The Gateway URL and API key stay server-side.

## Environment Variables

Added to `.env.example`:

```text
BRAIN_MEMORY_GATEWAY_URL=http://127.0.0.1:8765
BRAIN_MEMORY_API_KEY=
BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=false
```

The default flag is `false`, so the UI stays in mock mode until a real Gateway HTTP UI endpoint is intentionally enabled.

## Normalized Status Shape

```ts
type NormalizedBrainMemoryStatus = {
  mode: "real" | "mock" | "unconfigured" | "error";
  configured: boolean;
  reachable: boolean;
  baseUrl: string | null;
  health: Record<string, unknown> | null;
  capabilities: Record<string, unknown> | null;
  error: { kind: string; message: string } | null;
  checkedAt: string;
};
```

## Normalized Search Shape

```ts
type NormalizedBrainMemorySearchResponse = {
  mode: "real" | "mock" | "unconfigured" | "error";
  query: string;
  results: Array<{
    id: string;
    title?: string;
    content: string;
    snippet?: string;
    layer?: "hot" | "canonical" | "semantic" | "curated" | "raglight" | "unknown";
    score?: number;
    source?: string;
    projectKey?: string;
    sessionKey?: string;
    evidenceCount?: number;
    supersessionStatus?: "active" | "superseded" | "unknown";
    createdAt?: string;
    updatedAt?: string;
    metadata?: Record<string, unknown>;
  }>;
  error: { kind: string; message: string } | null;
  searchedAt: string;
};
```

Search requests include the active project/session memory contract:

```ts
{
  query: string;
  limit: number;
  context: {
    project: {
      id: string;
      title: string;
      stableKey: string;
      tenantId: string;
      retrievalProfile: string;
      contextPolicy: string;
    };
    session: {
      id: string;
      title: string;
      stableKey: string;
      includeProjectContext: boolean;
      includeSessionContext: boolean;
    } | null;
    ui: {
      source: "hermes-ui";
      workspaceVersion: number;
    };
  };
}
```

## Gateway Endpoints Attempted

Status:

```http
GET /health
```

Search:

```http
POST /ui/memory/search
```

Fallback for older local draft contract if POST returns `404` or `405`:

```http
GET /ui/memory/search?tenant_id=&project_id=&session_id=&q=&limit=
```

This fallback is read-only and exists because the repo contained both the newer POST proposal and an older GET draft contract.

## What Is Real

- Typed server-side Brain Memory Gateway client package.
- BFF status/search routes.
- Browser status/search hooks that call only the BFF.
- Memory tab with Gateway status, active scope, search input, and result cards.
- Safe mock/unconfigured mode when the Gateway is disabled or unavailable.
- Sanitized diagnostic script for Gateway health/search checks.

## What Is Mocked

- Memory results are local session `memoryEvidence` when Gateway mode is not real.
- Gateway capabilities are currently `null` unless a future health response includes a `capabilities` object.
- Evidence detail, supersession chains, audit trail, and memory admin actions are not implemented yet.

## Live Gateway Availability

No live Brain Memory HTTP Gateway was reachable at `http://127.0.0.1:8765` during this slice. The diagnostic script returned a network failure, so only mock/disabled mode was verified for Brain Memory.

Important: Hermes detailed health may show a `brain_memory_mcp` process in other environments, but MCP presence is separate from an HTTP Gateway UI endpoint.

## Checks Run

```powershell
npm install
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

All required checks passed. `npm audit` reported 0 vulnerabilities.

Additional route probes:

- `GET /api/brain-memory/status` returned mock/disabled mode.
- `POST /api/brain-memory/search` returned mock/disabled mode with no Gateway call.
- `GET /api/hermes/status` still returned real connected Hermes status.

## Real Chrome Smoke Result

Tested in the user's real Windows Chrome at `http://127.0.0.1:3000`.

- App loaded.
- Hermes showed connected.
- Memory tab was visible.
- Brain Memory status showed Gateway mock mode.
- Memory search stayed local/mock and did not crash.
- Switching from Brain Memory project to Hermes Agent updated the memory scope key.
- One live Hermes message streamed through the existing BFF and returned `BRAIN_MEMORY_CONSOLE_OK`.
- Composer remained visible.
- No horizontal overflow was detected.
- No API secret text was visible.

Screenshot:

```text
C:\Users\Alexey\.cursor\projects\hermes-ui\.codex-log\slice06-brain-memory-console-memory-tab.png
```

## Packaging Compatibility Note

The implementation uses env vars and relative app/package paths only. It does not hardcode machine-specific Gateway paths and keeps the diagnostic script small enough to reuse later in a one-command launcher health check.

## Known Limitations

- No live Brain Memory Gateway HTTP endpoint was available for real status/search validation.
- The Memory tab is read-only and does not fetch evidence details, supersession chains, or audit yet.
- Sidebar still displays the old static Brain Memory mock badge; the richer status now lives in the Memory tab.
- Search result virtualization is deferred until real result volume requires it.

## Next Slice

Recommended next slice: Slice 07A, read-only evidence/audit expansion if Gateway contracts are available. If no Gateway exists yet, the better next slice is Slice 09A packaging health checks so Hermes, Studio, and Brain Memory Gateway startup can be made reproducible before admin actions.
