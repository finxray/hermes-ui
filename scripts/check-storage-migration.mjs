import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { registerWebTsResolver } from "./lib/load-web-ts.mjs";
import { FakeIDBFactory } from "./lib/fake-indexeddb.mjs";

registerWebTsResolver();

const { LocalIndexedDbMemoryStore } = await import(
  pathToFileURL("apps/web/src/lib/storage/local-indexeddb-memory-store.ts").toString()
);
const {
  migrateLocalStorageToIndexedDb,
  isMigrationComplete,
  MIGRATION_MARKER_KEY
} = await import(
  pathToFileURL("apps/web/src/lib/storage/migrate-localstorage-to-indexeddb.ts").toString()
);
const { loadWorkspaceFromStore, workspaceStateToSnapshot, snapshotToWorkspaceState } = await import(
  pathToFileURL("apps/web/src/lib/storage/workspace-storage.ts").toString()
);
const { WORKSPACE_STORAGE_KEY, createMockWorkspaceState, saveWorkspaceState, workspaceReducer } =
  await import(pathToFileURL("apps/web/src/lib/workspaceStore.ts").toString());

let dbCounter = 0;
const makeStore = () =>
  new LocalIndexedDbMemoryStore(new FakeIDBFactory(), `migration-db-${dbCounter++}`);

// Map-backed Storage stand-in implementing the Web Storage surface we use.
class FakeStorage {
  constructor() {
    this._map = new Map();
  }
  getItem(key) {
    return this._map.has(key) ? this._map.get(key) : null;
  }
  setItem(key, value) {
    this._map.set(key, String(value));
  }
  removeItem(key) {
    this._map.delete(key);
  }
  clear() {
    this._map.clear();
  }
  key(index) {
    return [...this._map.keys()][index] ?? null;
  }
  get length() {
    return this._map.size;
  }
}

await checkMigratesLegacySnapshot();
await checkDoesNotDeleteLegacyData();
await checkRunsOnlyOnce();
await checkNoLegacyData();
await checkDoesNotClobberExistingStore();
checkWorkspaceRoundTrip();

console.log("Storage migration checks passed.");

// Build an authentic legacy localStorage blob using the real save path.
function seedLegacyWorkspace(storage) {
  let state = createMockWorkspaceState();
  state = workspaceReducer(state, { type: "createSession" });
  const session = state.sessions[0];
  state = workspaceReducer(state, {
    type: "appendMessage",
    sessionId: session.id,
    message: {
      id: "msg-1",
      role: "user",
      author: "You",
      content: "Migrate me into IndexedDB",
      createdAt: "2026-06-20T00:00:00.000Z"
    }
  });
  saveWorkspaceState(storage, state);
  return state;
}

async function checkMigratesLegacySnapshot() {
  const storage = new FakeStorage();
  const expected = seedLegacyWorkspace(storage);
  const store = makeStore();
  await store.init();

  const result = await migrateLocalStorageToIndexedDb(storage, store);
  assert.equal(result.status, "migrated", "legacy data migrates");
  assert.ok(isMigrationComplete(storage), "marker is set after migration");

  const restored = await loadWorkspaceFromStore(store);
  assert.ok(restored, "store now yields a workspace");
  assert.deepEqual(
    restored.sessions.map((s) => s.id).sort(),
    expected.sessions.map((s) => s.id).sort(),
    "all sessions migrated"
  );
  assert.deepEqual(
    restored.projects.map((p) => p.id).sort(),
    expected.projects.map((p) => p.id).sort(),
    "all projects migrated"
  );
  assert.equal(restored.activeSessionId, expected.activeSessionId, "active session preserved");
  const migratedMsg = restored.sessions
    .flatMap((s) => s.messages)
    .find((m) => m.id === "msg-1");
  assert.ok(migratedMsg, "messages migrated with their session");
}

async function checkDoesNotDeleteLegacyData() {
  const storage = new FakeStorage();
  seedLegacyWorkspace(storage);
  const store = makeStore();
  await store.init();

  await migrateLocalStorageToIndexedDb(storage, store);
  assert.ok(
    storage.getItem(WORKSPACE_STORAGE_KEY),
    "legacy localStorage entry is preserved (not deleted)"
  );
}

async function checkRunsOnlyOnce() {
  const storage = new FakeStorage();
  seedLegacyWorkspace(storage);
  const store = makeStore();
  await store.init();

  const first = await migrateLocalStorageToIndexedDb(storage, store);
  assert.equal(first.status, "migrated", "first run migrates");

  // Even if legacy data changes, a completed migration never re-imports.
  storage.setItem(WORKSPACE_STORAGE_KEY, storage.getItem(WORKSPACE_STORAGE_KEY));
  const second = await migrateLocalStorageToIndexedDb(storage, store);
  assert.equal(second.status, "already-migrated", "second run is a no-op");
}

async function checkNoLegacyData() {
  const storage = new FakeStorage();
  const store = makeStore();
  await store.init();

  const result = await migrateLocalStorageToIndexedDb(storage, store);
  assert.equal(result.status, "no-legacy-data", "no legacy data is handled");
  assert.equal(storage.getItem(MIGRATION_MARKER_KEY), "complete", "marker set so we don't re-check");
}

async function checkDoesNotClobberExistingStore() {
  const storage = new FakeStorage();
  seedLegacyWorkspace(storage); // legacy data present, but...
  const store = makeStore();
  await store.init();
  // ...the store already holds a session (user already on IndexedDB).
  await store.saveSession({
    id: "existing",
    projectId: "p1",
    hermesSessionId: "hermes-existing",
    title: "Existing",
    summary: "",
    memoryScope: {
      tenantId: "local-dev",
      projectId: "p1",
      sessionId: "existing",
      stableSessionKey: "k",
      includeProjectContext: true,
      includeSessionContext: true
    },
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    messages: [],
    memoryEvidence: [],
    toolEvents: [],
    runRecords: [],
    artifacts: []
  });

  const result = await migrateLocalStorageToIndexedDb(storage, store);
  assert.equal(result.status, "store-not-empty", "existing store data is not clobbered");
  const sessions = await store.listSessions();
  assert.deepEqual(sessions.map((s) => s.id), ["existing"], "store retains its own data");
}

function checkWorkspaceRoundTrip() {
  const state = createMockWorkspaceState();
  const snapshot = workspaceStateToSnapshot(state);
  const restored = snapshotToWorkspaceState(snapshot);
  assert.ok(restored, "round-trip yields a state");
  assert.equal(restored.activeProjectId, state.activeProjectId, "active project round-trips");
  assert.equal(restored.activeSessionId, state.activeSessionId, "active session round-trips");
  assert.deepEqual(
    restored.projects.map((p) => p.id),
    state.projects.map((p) => p.id),
    "projects round-trip"
  );
  assert.equal(
    snapshotToWorkspaceState({
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      meta: null,
      projects: [],
      sessions: []
    }),
    null,
    "empty snapshot yields null (keeps default mock state)"
  );
}
