# Slice 05 Project Memory Scope Notes

Date: 2026-05-29

## Scope

Slice 05 prepares project/session context metadata for future Brain Memory
continuity. It does not call Brain Memory Gateway and does not implement memory
retrieval.

## Files Changed

- `apps/web/src/data/types.ts`
- `apps/web/src/data/mockWorkspace.ts`
- `apps/web/src/lib/workspaceStore.ts`
- `apps/web/src/hooks/useWorkspaceState.ts`
- `apps/web/src/components/ChatView.tsx`
- `apps/web/src/components/ContextPanel.tsx`
- `apps/web/src/app/globals.css`
- `apps/web/src/app/api/hermes/chat/stream/route.ts`
- `packages/hermes-client/src/types.ts`
- `packages/hermes-client/src/index.ts`
- `docs/architecture/PROJECT_SESSION_MEMORY_SCOPE.md`
- `docs/integration/SLICE_05_PROJECT_MEMORY_SCOPE_NOTES.md`

## State Model Updates

Projects now carry:

```ts
memoryScope: {
  tenantId: string;
  projectId: string;
  stableProjectKey: string;
  retrievalProfile: "balanced" | "precise" | "broad" | "minimal";
  pinnedMemoryIds: string[];
  contextPolicy: "balanced" | "project-first" | "session-first" | "minimal";
  userVisibleSummary?: string;
}
```

Sessions now carry:

```ts
hermesSessionId: string;
memoryScope: {
  tenantId: string;
  projectId: string;
  sessionId: string;
  stableSessionKey: string;
  includeProjectContext: boolean;
  includeSessionContext: boolean;
  lastContextRefreshAt?: string;
  userVisibleSummary?: string;
}
```

## localStorage Compatibility

The storage key and version stay unchanged:

```text
hermes-ui.workspace.v1
version: 1
```

Decision: keep version 1 because the schema change is additive. Older saved
states are normalized on load with default `memoryScope` and `hermesSessionId`
values, then saved back with the new fields.

## BFF Request Shape

Browser chat sends:

```ts
{
  message: string;
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string | null;
  provider?: string | null;
  context: {
    project: {
      id: string;
      title: string;
      stableKey: string;
      tenantId: string;
      retrievalProfile: string;
      contextPolicy: string;
      pinnedMemoryIds: string[];
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
}
```

The BFF validates required context fields and bounds string lengths before
calling the server-side Hermes client.

## Metadata Passed To Hermes Now

Implemented now:

- Hermes session path id uses `context.session.hermesSessionId`.
- `X-Hermes-Session-Key` uses `context.project.stableKey`.
- The Hermes request body includes `metadata.context` with the structured
  context payload.

Known caveat: Hermes session chat currently ignores arbitrary `metadata` for
agent behavior. The body metadata is preserved for future adapter/Gateway use;
`X-Hermes-Session-Key` is the documented memory-scope path currently relied on.

## UI Updates

The right panel now includes an "Active context contract" section showing:

- tenant;
- project id and stable project key;
- session id and stable session key;
- Hermes session id;
- retrieval profile;
- context policy;
- pinned memory ids;
- project/session context toggles;
- status: prepared, not connected to Brain Memory.

Switching projects or sessions changes this preview because it is derived from
the active project/session state.

## What Remains Future-Only

- Brain Memory Gateway health/status.
- Gateway-backed projects/sessions.
- Memory search and retrieval evidence.
- Supersession chains and audit.
- Admin actions.
- Real enforcement of retrieval profiles or context policies.
- Direct verification that Brain Memory consumes `X-Hermes-Session-Key` through
  a live Hermes instance.

## Checks Run

```powershell
npm run typecheck
npm run build
npm audit --audit-level=moderate
```

Browser smoke verified:

- active context contract is visible;
- project switching changes project scope;
- session switching changes session scope;
- new projects/sessions receive default memory scope;
- unconfigured mock send still works and persists after reload;
- no horizontal overflow.

Additional live Windows Chrome verification:

- opened `http://127.0.0.1:3000` in visible Windows Chrome;
- Hermes status showed configured and connected;
- a real UI send requested `POST /api/hermes/chat/stream` and received HTTP 200;
- a direct BFF streaming probe produced live `message_delta`, `message_done`,
  `run.completed`, and `done` events from Hermes;
- adapter hardening now sends Hermes a collision-resistant session title such
  as `New chat [<session-id-suffix>]` while preserving the Studio title in UI
  metadata, because live Hermes rejects duplicate session titles;
- no `HERMES_API_KEY` value appeared in the visible page;
- localStorage persisted the live smoke message after reload;
- no horizontal overflow was detected.

## Known Limitations

- No live Hermes instance was available for validating memory scoping end to
  end.
- Studio still uses browser localStorage for project/session state.
- `hermesSessionId` is generated locally and will need reconciliation with
  Gateway-backed project/session records later.

## Next Slice

Slice 06 should add the read-only Brain Memory console through Gateway-approved
endpoints only.
