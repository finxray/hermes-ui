# Slice 08D: Hermes Memory Scope Bridge

## Summary

Slice 08D adds a small Hermes UI BFF compatibility bridge for Brain Memory
project/session scope. The bridge exists because live tracing showed that
Hermes UI already sent `metadata.context`, but the current Hermes
`/api/sessions/{session_id}/chat/stream` path ignored request-body metadata
when constructing agent/MCP tool calls.

The bridge sends a compact, secret-free Brain Memory scope instruction through
the Hermes `instructions` field, which Hermes already reads as an ephemeral
system prompt. The original `metadata.context` payload is still sent for future
first-class Hermes support.

No Brain Memory core, Hermes source, memory mutation/admin UI, direct browser
to Gateway calls, direct storage access, auth/classification system, or storage
schema changes were added.

## Files Changed

- `apps/web/src/lib/memoryScopeBridge.ts`
- `apps/web/src/app/api/hermes/chat/stream/route.ts`
- `packages/hermes-client/src/index.ts`
- `packages/hermes-client/src/types.ts`
- `.env.example`
- `env/web-ui-only.env.example`
- `env/web-ui-with-hermes.env.example`
- `env/bundle-with-brain-memory.env.example`
- `env/attach-brain-memory-later.env.example`
- `scripts/studio-doctor.mjs`
- `docs/architecture/PROJECT_SESSION_MEMORY_SCOPE.md`
- `docs/integration/SLICE_08D_MEMORY_SCOPE_BRIDGE.md`

## Why The Bridge Is Needed

Live Slice 08C tracing found:

- Hermes UI sends full project/session context in `metadata.context`.
- `metadata.context.session.stableKey` contains the active Studio session key.
- Brain Memory MCP is updated and advertises `projectKey` and `sessionKey`.
- Brain Memory MCP can reach Gateway at `http://127.0.0.1:8080`.
- Hermes session-chat reads `input`, `conversation_history`,
  `system_message`/`instructions`, and `X-Hermes-Session-Key`.
- Hermes session-chat does not currently use request-body `metadata.context`
  for agent/MCP tool arguments.

Therefore the MVP bridge makes scope visible through `instructions`, the field
Hermes already consumes.

## Bridge Behavior

When `HERMES_UI_ENABLE_MEMORY_SCOPE_BRIDGE` is not `false`, the BFF builds an
instruction from the already validated `HermesChatContext`.

The instruction includes:

- `tenantId`
- `projectKey`
- `sessionKey`
- `source: hermes-ui`
- `includeProjectContext`
- `includeSessionContext`
- a safe context subset with project/session stable keys and UI source

The instruction asks Hermes to include these fields when calling Brain Memory
MCP tools that support them:

- `projectKey`
- `sessionKey`
- `source`
- `metadata`
- `context`

The bridge does not include:

- API keys
- Brain Memory tenant keys
- Hermes API keys
- user-visible project/session summaries
- direct storage identifiers
- direct Gateway credentials

## Env Flag

```text
HERMES_UI_ENABLE_MEMORY_SCOPE_BRIDGE=true
```

Default behavior is enabled unless the variable is set to `false`.

The flag was added to `.env.example` and env templates. `studio:doctor` now
reports its configured value.

## Hermes Request Shape

The BFF still calls:

```text
POST /api/sessions/{hermesSessionId}/chat/stream
```

Hermes request body now includes:

```json
{
  "conversation_history": [],
  "input": "user message",
  "instructions": "Active Brain Memory scope for this request: ...",
  "metadata": {
    "context": { "...": "existing structured context" },
    "memory_scope_bridge_enabled": true,
    "project_id": "project-brain-memory",
    "project_title": "Brain Memory",
    "provider": "Hermes default",
    "studio_session_id": "session id"
  }
}
```

`X-Hermes-Session-Key` behavior did not change. It remains the project stable
key, preserving the existing project-level long-term memory semantics.

## Live Services Tested

- Hermes API: `http://127.0.0.1:8642`
- Brain Memory Gateway UI API: `http://127.0.0.1:8080`
- Temporary Hermes UI production server: `http://127.0.0.1:3006`

Baseline checks:

- `GET /api/hermes/status` through BFF: `mode: real`, `reachable: true`.
- `GET /api/brain-memory/status` through BFF: `mode: real`,
  `reachable: true`.
- Baseline `POST /api/brain-memory/search` through BFF: real search succeeded.

## Live Marker

```text
E2E_SCOPE_BRIDGE_20260529164807_KYJTV2
```

Active scope:

- Tenant: `local-dev`
- Project key: `brain-memory`
- Session key: `slice-08d-scope-bridge`
- Hermes session id:
  `slice-08d-scope-bridge-e2e_scope_bridge_20260529164807_kyjtv2`

Prompt:

```text
Please remember this session-scoped test fact for the active project and active
session: E2E_SCOPE_BRIDGE_20260529164807_KYJTV2 means the Hermes UI
memory-scope bridge is working. Reply with E2E_SCOPE_BRIDGE_STORED after
handling it.
```

Hermes response:

```text
E2E_SCOPE_BRIDGE_STORED
```

## Tool Events

Hermes emitted Brain Memory tool events. The visible
`mcp_brain_memory_memory_store` started event included:

- `content_text`
- `metadata`
- `privacy_scope`
- `projectKey`
- `retention_class`
- `role`
- `sessionKey`
- `source`
- `tenant_id`

Observed values:

- `projectKey: brain-memory`
- `sessionKey: slice-08d-scope-bridge`
- `source: hermes-ui`
- `metadata`: present

This confirms the bridge made scope visible at the MCP tool-call boundary.

## Same-Session Search

Search context:

- Project key: `brain-memory`
- Session key: `slice-08d-scope-bridge`

Observed result:

- `mode: real`
- Result count: `1`
- First result id: `6ce086e2-d731-4c11-bf23-27c2e90b13bd`
- First result project key: `brain-memory`
- First result session key: `slice-08d-scope-bridge`
- First result scope status: `matching-session`
- `scope.status: enforced`
- `scope.mode: project-and-session`

Conclusion: session-scoped storage and same-session search worked.

## Same-Project Different-Session Search

Search context:

- Project key: `brain-memory`
- Session key: `slice-08d-other-session`

Observed result:

- `mode: real`
- Result count: `0`
- `scope.status: enforced`
- `scope.mode: project-and-session`
- `scope.mismatchedSessionExcluded: 1`

Conclusion: the session-scoped marker was excluded from another session in the
same project.

## Different-Project Search

Search context:

- Project key: `hermes-agent`
- Session key: `slice-08d-scope-bridge`

Observed result:

- `mode: real`
- Result count: `0`
- `scope.status: enforced`
- `scope.mode: project-and-session`
- `scope.mismatchedProjectExcluded: 1`

Conclusion: the marker was excluded from another project.

## Auth And Tenant Behavior

- Tenant: `local-dev`.
- A tenant-bound Gateway memory key was configured in temporary process env and
  was not printed.
- No 401 or 403 occurred during the live scoped search checks.
- Browser code still calls only Hermes UI BFF routes.
- Brain Memory Gateway remains server-side only from the browser's perspective.

Full user/account authorization, clearance levels, memory classification, and
policy engine work remain deliberately deferred until the end-to-end product
path is stable.

## Real Chrome Smoke

A real Windows Chrome app window was opened against:

```text
http://127.0.0.1:3006
```

The app opened in a clean Chrome profile. BFF HTTP checks verified the same live
Hermes and Brain Memory states used by the UI. No valid screenshot evidence was
captured for this slice.

## Checks

- `npm run studio:doctor`: run with temporary bundle-ready env during live
  verification.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm audit --audit-level=moderate`: passed.

## Limitations

- This is a compatibility bridge, not first-class Hermes metadata propagation.
- The instruction is visible to the model as an ephemeral system instruction.
- Hermes should eventually pass `metadata.context` directly into agent/MCP
  runtime context so this bridge can be removed.
- The bridge relies on the model/tool planner following the instruction when
  invoking Brain Memory MCP tools.

## Recommended Next Slice

Recommended next slice: replace the instruction bridge with first-class Hermes
metadata propagation once Hermes accepts and forwards request-body
`metadata.context` into agent/MCP tool-call context.
