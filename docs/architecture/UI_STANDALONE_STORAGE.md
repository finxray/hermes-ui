# Hermes UI Standalone Storage Architecture

Status: implemented
Owner: Hermes UI

## Goal

Brain Memory is an **optional, independent plugin**. The Hermes UI must work
fully without it, persisting its own chat/session/workspace state in the
browser — but **not** in `localStorage`. Persistence now lives in **IndexedDB**
behind a small storage abstraction, with graceful fallback when IndexedDB is
unavailable.

## Layers

```
useWorkspaceState (hook)
        │  WorkspaceState  ⇄  records
        ▼
workspace-storage.ts        ← compose/decompose bridge
        │  MemoryStore
        ▼
provider.ts                 ← picks + caches the active store, runs migration
        │
        ├── LocalIndexedDbMemoryStore   (default, durable)
        ├── NoopMemoryStore             (in-memory fallback; non-durable)
        └── BrainMemoryPluginStore      (adapter boundary placeholder — NOT wired)
```

All files live in `apps/web/src/lib/storage/`.

### `MemoryStore` interface (`memory-store.ts`)

The persistence seam. Supports `listSessions` / `getSession` / `saveSession` /
`deleteSession`, project CRUD, workspace meta, `searchMessages`, and
export/import + `clear`. The data model is **normalized** into separate record
kinds (one record per project, one per session, one workspace-meta record)
rather than a single blob, so sessions are independently loadable. Every record
carries `createdAt`/`updatedAt` (reused from the existing `Project`/`Session`
types). `STORAGE_SCHEMA_VERSION` is tracked from the start.

### `LocalIndexedDbMemoryStore` (default)

Native IndexedDB via a tiny promise wrapper — **no new dependency**. Justified:
the access pattern is small (3 object stores, get/getAll/put/delete/clear, one
upgrade migration) and the repo pins workspace deps tightly, so `idb` would add
weight for little gain. The factory is injectable so it can be unit-tested in
Node with a fake.

### `NoopMemoryStore` (fallback)

Full in-memory implementation of the contract. Selected automatically when
IndexedDB can't be opened (private mode, disabled storage, SSR). The UI keeps
working; data just doesn't survive reload. The provider exposes a
non-disruptive warning for a settings/dev panel via `getStorageDiagnostics()`.

### `BrainMemoryPluginStore` (boundary only)

Placeholder adapter that fixes the shape of a future Brain-Memory-backed store.
It throws if used without a delegate, so it can never be silently selected. The
UI never depends on it for persistence.

## Migration from localStorage

`migrate-localstorage-to-indexeddb.ts` runs once on first load (invoked by the
provider during setup):

- Reads the legacy `hermes-ui.workspace.v1` localStorage blob via the existing
  parser and imports it into IndexedDB.
- Writes a completion marker (`hermes-ui.storage.migration.v1`) so it never
  re-runs.
- **Does not delete** the legacy localStorage entry — we only stop relying on
  it (safety net for rollback).
- Never clobbers a store that already holds data.

## What was intentionally left on localStorage

Best-effort, ephemeral UI-only state that is not chat/session/workspace data and
carries no migration concern:

- Composer draft text (`Composer.tsx`).
- Sidebar expand/collapse string sets (`Sidebar.tsx`).

These are out of scope for durable workspace persistence; moving them was not
required and would risk unrelated UX churn.

## Known limitation

IndexedDB writes are asynchronous, so the `pagehide`/`beforeunload` flush is
best-effort and may not complete during teardown. The 500ms debounced save runs
after every state change, so unsaved data at unload is rare in practice.

## Automated tests

- `npm run check:memory-store` — contract suite run against **both**
  `NoopMemoryStore` and `LocalIndexedDbMemoryStore` (with a fake IndexedDB),
  plus the snippet helper.
- `npm run check:storage-migration` — legacy-snapshot → IndexedDB migration,
  idempotency, non-deletion of legacy data, no-clobber, and workspace
  compose/decompose round-trip.

Both are wired into `npm run release:check`.

## Manual smoke checklist

1. **Create new chat** — open the app, create a chat, send/append a message.
2. **Reload page** — refresh the browser.
3. **Session restored from IndexedDB** — the chat and its messages reappear.
   Confirm in DevTools → Application → IndexedDB → `hermes-ui-storage`
   (`projects`, `sessions`, `meta` stores populated). `localStorage` should
   **not** be the source (only the migration marker + preserved legacy blob).
4. **Brain Memory disabled** — with `BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY` unset
   / `false`, the UI loads, persists, and restores normally.
5. **Hermes streaming still works** — send a live message; streaming and run
   activity behave as before.
6. **Old localStorage data migrates once** — with a pre-existing
   `hermes-ui.workspace.v1` entry, first load imports it into IndexedDB and sets
   `hermes-ui.storage.migration.v1=complete`; subsequent loads do not re-import,
   and the legacy entry remains present.
7. **IndexedDB-unavailable fallback** (optional) — block IndexedDB (e.g. private
   window) and confirm the app still runs on the in-memory store; the
   diagnostics warning is available but not disruptive.
