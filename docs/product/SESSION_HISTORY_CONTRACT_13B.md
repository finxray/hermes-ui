# Session History Contract 13B

Date: 2026-05-30

## Purpose

Slice 13B tightens the local session/history model so Brain Memory Studio feels
more like a ChatGPT Projects workspace while preserving Hermes-native session
mapping and Brain Memory scope boundaries.

This slice does not change Hermes streaming, Brain Memory BFF logic, memory
scope bridge behavior, backend features, auth, provider selection, stop/cancel,
or memory mutation/admin actions.

## Files Changed

- `apps/web/src/data/types.ts`
- `apps/web/src/data/mockWorkspace.ts`
- `apps/web/src/lib/workspaceStore.ts`
- `apps/web/src/components/shell/Sidebar.tsx`
- `scripts/check-workspace-state.mjs`
- `scripts/ui-interaction-smoke.mjs`
- `docs/product/SESSION_HISTORY_CONTRACT_13B.md`
- `docs/product/AGENT_ORCHESTRATION_SLICE_PLAN.md`
- `ROADMAP.md`

## Audited Current Behavior

Session identity:

- `session.id` is the local Studio session id.
- `session.memoryScope.stableSessionKey` is derived from tenant, project id,
  and session id.
- `session.hermesSessionId` maps the Studio session to Hermes native sessions.
- `session.projectId` owns the project relationship.
- Brain Memory scope uses stable project/session keys, not display titles.

Session title behavior before this slice:

- New sessions already used unique `New chat`, `New chat 2`, etc. titles.
- First user message auto-title cleanup existed for default titles.
- Manual rename changed the display title without changing stable keys.
- Manual rename did not yet have an explicit metadata flag.

History behavior before this slice:

- Session rows were sorted by `updatedAt` inside projects.
- Recent chats were sorted by `updatedAt`.
- `updatedAt` changed on message append, message update, tool event append, and
  archive.
- Sidebar session rows did not display derived updated-time metadata.

## Session Title Lifecycle

New session:

- Created as `New chat`, `New chat 2`, etc.
- Title is unique within the project.
- `titleSource` is `default`.
- `stableSessionKey` and `hermesSessionId` are generated once and do not depend
  on the display title.

First user message:

- If the title is still default and `titleSource` is `default`, the first user
  message becomes a short local title.
- No AI model is called.
- Simple prompt boilerplate and punctuation noise are removed.
- `titleSource` becomes `first-message`.
- `firstUserMessageAt` is recorded.
- Stable keys, Hermes session id, and Brain Memory scope are unchanged.

Manual rename:

- Manual rename always wins.
- Manual rename sets `titleSource` to `manual`.
- Manual rename records `renamedAt`.
- Later messages do not auto-title over a manual title.
- Manual rename does not change:
  - `session.id`
  - `session.memoryScope.stableSessionKey`
  - `session.hermesSessionId`
  - `project.memoryScope.stableProjectKey`
  - Brain Memory scope.

Mock seeded sessions:

- Seeded mock sessions are marked with `titleSource: "mock"`.
- Mock title metadata is additive and compatible with persisted local state.

## Hermes Session Title Behavior

Studio display titles and Hermes internal session titles remain separate.

The BFF/Hermes client still sends a collision-resistant Hermes title when it
ensures the Hermes session. That behavior is unchanged and internal suffixes do
not become Studio display titles.

## Brain Memory Scope Behavior

Memory scope remains stable-key based:

- project scope uses `project.memoryScope.stableProjectKey`;
- session scope uses `session.memoryScope.stableSessionKey`;
- title changes do not change project or session scope;
- title changes do not affect the memory-scope instruction bridge.

Slice 15E tenant alignment keeps these identity rules while aligning the local
MVP tenant with Hermes MCP and Brain Memory Gateway:

- new local/default workspace scopes use tenant `local-dev`;
- legacy local `tenant-local` scopes normalize to `local-dev` only when their
  stable keys match the old local default pattern;
- project ids, session ids, display titles, title metadata, and Hermes session
  ids are preserved;
- custom tenant/stable-key values are not rewritten by the local migration.

## History Ordering

Visible sessions inside a project are sorted by `updatedAt` descending.

Recent chats are also sorted by `updatedAt` descending and are labelled as
`Recent chats` to make their meaning explicit.

`updatedAt` changes when:

- a user message is appended;
- an assistant message is updated/completed;
- a tool event is appended;
- a local Web UI run record is appended or updated;
- a session is renamed;
- a session is archived.

## Run History Extension

Slice 13M adds `Session.runRecords[]` as an additive local session-history
field. It stores compact Web UI-created run metadata for replay/inspection:
message ids, Hermes session id, optional Hermes run id, source channel, status,
timestamps, model/provider labels, linked live activity event ids, and activity
counts.

This extension preserves the Slice 13B identity rules:

- display title changes do not change stable keys;
- run record append/update does not change stable keys;
- run record append/update does not change `hermesSessionId`;
- legacy sessions missing `runRecords` normalize to `[]`;
- localStorage key and version remain unchanged.

## Timestamp Formatting

Sidebar session rows now show a small derived updated-time meta value:

- `now`
- `30min`
- `5h`
- `1d`
- `2d`

The formatter is deterministic and covered by the workspace check script. It
does not rely on hardcoded visual-only times for real sessions.

## Active Repair Rules

Existing active repair rules remain:

- if the active project is missing, choose the most recently updated project;
- if the active session is missing or archived, choose the most recent visible
  session in the active project;
- if a project has no visible sessions, active session becomes `null`;
- reset mock data returns a valid active project/session pair.

The existing empty-state path remains:

- an empty project shows `No chats` in the project tree;
- the transcript shows a clean empty state with a `New chat` action.

## LocalStorage Compatibility

Storage key remains:

```text
hermes-ui.workspace.v1
```

Storage version remains:

```text
1
```

No wipe or migration bump is required. Normalization fills missing title
metadata:

- default-looking titles become `titleSource: "default"`;
- titles matching the first user message cleanup become `first-message`;
- other legacy custom titles are treated as `manual` to avoid overwriting user
  intent.

## Browser Smoke

`npm run smoke:ui` now verifies:

- the app loads;
- project/session sidebar is visible;
- clicking project/session/recent chat rows works;
- the Chat quick action creates an active `New chat` child row under the
  active project;
- no horizontal overflow is introduced;
- composer remains usable.

Default browser smoke still does not send a message. Live Hermes send remains
opt-in through `npm run smoke:ui:send`.

## Regression Coverage

`scripts/check-workspace-state.mjs` now covers:

- default new session title uniqueness;
- first-message auto-title;
- manual rename wins;
- manual rename does not change stable key;
- manual rename does not change `hermesSessionId`;
- auto-title does not change stable key;
- updatedAt changes on message append;
- sorting by `updatedAt`;
- derived timestamp formatting;
- active repair after archived/missing session;
- localStorage normalization fills title metadata;
- session memory scope still uses stable key.
- local run record append/update and normalization preserve stable keys.

## Checks Run

- `npm run check:workspace-state`
- `npm run smoke:ui`
- `npm run typecheck`

Full slice checks are recorded in the final slice response.

## Future Title Improvements

- AI-assisted session titles through Hermes after local title behavior is
  stable.
- Server-side Studio session persistence.
- Hermes session list/history reconciliation.
- Conversation search.
- Session summaries.
- Export/import with stable project/session/memory-scope metadata.
