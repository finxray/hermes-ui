# Architecture

## Core boundary

The UI is not the agent and not the memory authority.

```text
Browser UI
  -> Web UI Backend/BFF
    -> Hermes Agent API
      -> Hermes runtime/tools/skills
        -> Brain Memory MCP/skill
          -> Brain Memory Gateway
            -> storage layers
```

For memory inspection/admin:

```text
Browser UI
  -> Web UI Backend/BFF
    -> Brain Memory Gateway UI/Admin API
      -> controlled read/admin endpoints
        -> storage layers
```

## Why a BFF/proxy

The browser should not directly hold Hermes or Brain Memory API keys. The BFF can:

- attach secrets server-side,
- normalize errors,
- enforce project/session scope,
- stream events to the browser,
- combine Hermes and Brain Memory health status,
- keep browser code focused on UI.

## Proposed app layers

```text
UI components
  -> feature modules
    -> typed client adapters
      -> BFF route handlers/API server
        -> Hermes client / Brain Memory client
```

## Hermes session strategy

Prefer current Hermes session endpoints if available:

- list/create/update/delete sessions,
- read messages,
- chat with a persisted session,
- stream session chat,
- fork/branch session.

Fallback to OpenAI-compatible endpoints only when richer endpoints are unavailable.

Use explicit headers/metadata for continuity and memory scoping when supported:

- `X-Hermes-Session-Id`,
- `X-Hermes-Session-Key`,
- `X-Hermes-Model`,
- idempotency key for duplicate-request protection if supported.

## Brain Memory strategy

Start with read-only Gateway UI endpoints:

- health,
- project context,
- search,
- evidence by id,
- supersession chain,
- audit events,
- layer status.

Later admin endpoints:

- mark stale,
- supersede,
- pin/unpin,
- delete if policy allows,
- rebuild/reindex diagnostics if policy allows.

All admin actions must be audited.
