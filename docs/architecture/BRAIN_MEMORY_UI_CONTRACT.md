# Draft Brain Memory UI API contract

This is a draft for UI planning only. Codex must align it with the actual Brain Memory Gateway implementation.

## Read-only endpoints

```http
GET /health
GET /ui/projects/:projectId/context
GET /ui/memory/search?tenant_id=&project_id=&session_id=&q=&layers=
GET /ui/memory/:memoryId
GET /ui/memory/:memoryId/evidence
GET /ui/memory/:memoryId/supersession-chain
GET /ui/audit?tenant_id=&project_id=&session_id=&memory_id=
GET /ui/layers/status?tenant_id=&project_id=
```

## Controlled admin endpoints, later phase

```http
POST /ui/memory/:memoryId/mark-stale
POST /ui/memory/:memoryId/supersede
POST /ui/memory/:memoryId/pin
POST /ui/memory/:memoryId/unpin
DELETE /ui/memory/:memoryId
POST /ui/diagnostics/retrieve
POST /ui/diagnostics/reindex
```

## Memory result shape

```ts
type MemorySearchResult = {
  id: string;
  tenantId: string;
  projectId?: string;
  sessionId?: string;
  layer: 'canonical' | 'semantic' | 'hot' | 'curated' | 'raglight' | string;
  title?: string;
  contentPreview: string;
  score?: number;
  trustLevel?: 'low' | 'medium' | 'high' | string;
  createdAt: string;
  updatedAt?: string;
  supersededBy?: string;
  sourceAgent?: string;
  sourceSessionId?: string;
  evidenceCount?: number;
};
```

## Rule

The UI contract may be expanded, but it must not expose raw database tables as the public contract.
