# Project And Session Memory Scope

Status: Prepared contract
Date: 2026-05-29

## Purpose

Brain Memory Studio has ChatGPT-like projects and titled sessions. Hermes should
receive enough structured context on each chat turn for future Brain Memory
retrieval and persistence to choose the correct project and session scope.

This document defines the current UI/BFF contract. It is not a Brain Memory
storage schema and it does not authorize direct storage access.

## Project Context

Project context is long-lived and shared by all sessions inside a project.

Current fields:

```ts
type ProjectMemoryScope = {
  tenantId: string;
  projectId: string;
  stableProjectKey: string;
  retrievalProfile: "balanced" | "precise" | "broad" | "minimal";
  pinnedMemoryIds: string[];
  contextPolicy: "balanced" | "project-first" | "session-first" | "minimal";
  userVisibleSummary?: string;
};
```

Project context answers:

- which tenant/workspace owns the request;
- which Studio project is active;
- which stable memory key should scope long-term memory;
- how aggressively future retrieval should use project memory;
- which memory ids should be pinned when Gateway-backed memory arrives.

## Session Context

Session context is the shorter-lived transcript scope under a project.

Current fields:

```ts
type SessionMemoryScope = {
  tenantId: string;
  projectId: string;
  sessionId: string;
  stableSessionKey: string;
  includeProjectContext: boolean;
  includeSessionContext: boolean;
  lastContextRefreshAt?: string;
  userVisibleSummary?: string;
};
```

Session context answers:

- which Studio session is active;
- which Hermes session id should be used for agent transcript continuity;
- whether future retrieval should include project memory, session memory, or both.

## Metadata Flow

Current Slice 05 flow:

```text
Browser UI
  -> POST /api/hermes/chat/stream
    -> packages/hermes-client
      -> Hermes /api/sessions/{hermes_session_id}/chat/stream
```

The browser sends:

```ts
type HermesChatContext = {
  project: {
    id: string;
    title: string;
    stableKey: string;
    tenantId: string;
    retrievalProfile: string;
    contextPolicy: string;
    pinnedMemoryIds?: string[];
    userVisibleSummary?: string;
  };
  session: {
    id: string;
    title: string;
    stableKey: string;
    hermesSessionId: string;
    includeProjectContext: boolean;
    includeSessionContext: boolean;
    lastContextRefreshAt?: string;
    userVisibleSummary?: string;
  };
  ui: {
    source: "hermes-ui";
    workspaceVersion: number;
  };
};
```

The BFF validates and bounds this structure before forwarding to the server-side
Hermes client.

## What Reaches Hermes Now

Implemented now:

- Hermes session continuity uses the path id in
  `/api/sessions/{hermes_session_id}/chat/stream`.
- `X-Hermes-Session-Key` is set to the project stable key, for example
  `studio:tenant-local:project:project-brain-memory`.
- The request body includes a `metadata.context` object with the structured
  project/session/UI metadata.
- Slice 08D adds a temporary BFF memory-scope bridge. When
  `HERMES_UI_ENABLE_MEMORY_SCOPE_BRIDGE` is not `false`, the BFF also sends a
  compact `instructions` block containing `tenantId`, `projectKey`,
  `sessionKey`, `source`, and a safe context subset. This is a compatibility
  bridge for current Hermes session-chat behavior and should be retired once
  Hermes natively propagates `metadata.context` into MCP tool calls.

Important limitation: current Hermes session-chat source ignores unknown
`metadata` fields for agent behavior. The metadata body field is therefore a
preserved contract and observability hook. Until Hermes supports it natively,
the bridge instruction is the path that makes session scope visible to Brain
Memory MCP tool calls.

## How Brain Memory Will Use This Later

When Brain Memory Gateway UI/API integration arrives, the Gateway can use this
metadata to:

- list projects and sessions by `tenantId`;
- map Studio projects to Gateway-approved memory scopes;
- filter retrieval by `projectId`, `sessionId`, and `hermesSessionId`;
- explain whether context came from project memory, session memory, or both;
- enforce `contextPolicy`, `retrievalProfile`, and pinned memory behavior;
- audit project/session scoped reads and future admin actions.

## Implemented Now

- Typed project and session memory scope fields in local state.
- Backward-compatible localStorage normalization for older Slice 02-04 data.
- Structured browser-to-BFF context in chat requests.
- BFF validation for structured context.
- Hermes client forwarding of `X-Hermes-Session-Key`.
- Hermes UI BFF memory-scope bridge through `instructions`.
- Right-panel Active Context Contract preview.

## Not Implemented Yet

- Brain Memory Gateway calls.
- Memory search, retrieval evidence, supersession chains, or audit queries.
- Gateway-backed project/session persistence.
- Server-side Studio auth or multi-user tenancy.
- Real enforcement of retrieval profiles or context policies.
- `/v1/runs` approval/stop/reconnect behavior.

## Forbidden Paths

The UI and BFF must not talk directly to:

- Postgres;
- Redis;
- Qdrant;
- RAGLight;
- SQLite memory internals;
- filesystem memory internals;
- any Brain Memory storage adapter.

All Brain Memory observability and admin actions must go through Gateway-owned
endpoints.

## Migration Path

Current localStorage key remains:

```text
hermes-ui.workspace.v1
```

Slice 05 adds optional fields with runtime defaults instead of creating
`v2`. Older local browser state loads through `normalizeWorkspace`, receives
default memory-scope metadata, and is saved back with the new fields.

Future Gateway-backed projects/sessions should introduce an explicit migration
from local-only ids to Gateway ids:

1. keep local Studio ids as UI ids;
2. add Gateway ids when records are created or reconciled;
3. preserve `hermesSessionId` for Hermes transcript continuity;
4. let Brain Memory Gateway own storage ids and authorization.
