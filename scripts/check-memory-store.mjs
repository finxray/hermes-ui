import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { registerWebTsResolver } from "./lib/load-web-ts.mjs";
import { FakeIDBFactory } from "./lib/fake-indexeddb.mjs";

registerWebTsResolver();

const memoryStoreMod = await import(
  pathToFileURL("apps/web/src/lib/storage/memory-store.ts").toString()
);
const { NoopMemoryStore } = await import(
  pathToFileURL("apps/web/src/lib/storage/noop-memory-store.ts").toString()
);
const { LocalIndexedDbMemoryStore } = await import(
  pathToFileURL("apps/web/src/lib/storage/local-indexeddb-memory-store.ts").toString()
);

const { buildMessageSnippet } = memoryStoreMod;

let dbCounter = 0;

const backends = [
  { label: "NoopMemoryStore", make: () => new NoopMemoryStore() },
  {
    label: "LocalIndexedDbMemoryStore",
    make: () => new LocalIndexedDbMemoryStore(new FakeIDBFactory(), `test-db-${dbCounter++}`)
  }
];

for (const backend of backends) {
  await runContractSuite(backend);
}

checkSnippetHelper();

console.log("Memory store checks passed.");

async function runContractSuite({ label, make }) {
  await checkSessionCrud(make, label);
  await checkProjectCrud(make, label);
  await checkWorkspaceMeta(make, label);
  await checkSearchMessages(make, label);
  await checkExportImportReplace(make, label);
  await checkImportMerge(make, label);
  await checkClear(make, label);
}

async function checkSessionCrud(make, label) {
  const store = make();
  await store.init();

  assert.deepEqual(await store.listSessions(), [], `${label}: starts with no sessions`);
  assert.equal(await store.getSession("missing"), null, `${label}: getSession misses null`);

  const session = makeSession("s1", "p1", [message("m1", "user", "Hello world")]);
  await store.saveSession(session);

  const loaded = await store.getSession("s1");
  assert.deepEqual(loaded, session, `${label}: saveSession/getSession round-trips`);

  // Mutating the returned object must not corrupt the store (isolation).
  loaded.title = "mutated";
  const reloaded = await store.getSession("s1");
  assert.equal(reloaded.title, session.title, `${label}: returned records are isolated copies`);

  await store.saveSession(makeSession("s2", "p1", []));
  const all = await store.listSessions();
  assert.equal(all.length, 2, `${label}: listSessions returns all`);

  await store.deleteSession("s1");
  assert.equal(await store.getSession("s1"), null, `${label}: deleteSession removes record`);
  assert.equal((await store.listSessions()).length, 1, `${label}: delete leaves the rest`);
}

async function checkProjectCrud(make, label) {
  const store = make();
  await store.init();

  assert.deepEqual(await store.listProjects(), [], `${label}: starts with no projects`);
  const project = makeProject("p1", "Alpha");
  await store.saveProject(project);
  assert.deepEqual((await store.listProjects())[0], project, `${label}: project round-trips`);

  await store.deleteProject("p1");
  assert.equal((await store.listProjects()).length, 0, `${label}: deleteProject removes record`);
}

async function checkWorkspaceMeta(make, label) {
  const store = make();
  await store.init();

  assert.equal(await store.getWorkspaceMeta(), null, `${label}: meta null by default`);
  const meta = {
    key: "workspace",
    activeProjectId: "p1",
    activeSessionId: "s1",
    modelChoices: [],
    connectionStatus: { hermes: "ok", brainMemory: "off" },
    schemaVersion: 1,
    updatedAt: "2026-06-20T00:00:00.000Z"
  };
  await store.saveWorkspaceMeta(meta);
  assert.deepEqual(await store.getWorkspaceMeta(), meta, `${label}: meta round-trips`);
}

async function checkSearchMessages(make, label) {
  const store = make();
  await store.init();

  await store.saveSession(
    makeSession("s1", "p1", [
      message("m1", "user", "The quick brown fox", "2026-06-01T00:00:00.000Z"),
      message("m2", "assistant", "A lazy DOG sleeps", "2026-06-02T00:00:00.000Z")
    ])
  );
  await store.saveSession(
    makeSession("s2", "p1", [
      message("m3", "user", "Another dog appears", "2026-06-03T00:00:00.000Z")
    ])
  );

  const hits = await store.searchMessages("dog");
  assert.equal(hits.length, 2, `${label}: search finds case-insensitive matches`);
  assert.equal(hits[0].messageId, "m3", `${label}: results sorted by createdAt desc`);
  assert.ok(hits[0].snippet.toLowerCase().includes("dog"), `${label}: snippet includes match`);

  const limited = await store.searchMessages("dog", { limit: 1 });
  assert.equal(limited.length, 1, `${label}: search respects limit`);

  assert.deepEqual(await store.searchMessages("   "), [], `${label}: blank query returns nothing`);
  assert.deepEqual(
    await store.searchMessages("nonexistent-term"),
    [],
    `${label}: no matches returns empty`
  );
}

async function checkExportImportReplace(make, label) {
  const store = make();
  await store.init();
  await store.saveSession(makeSession("s1", "p1", [message("m1", "user", "hi")]));
  await store.saveProject(makeProject("p1", "Alpha"));

  const snapshot = await store.export();
  assert.equal(snapshot.schemaVersion, 1, `${label}: export carries schema version`);
  assert.equal(snapshot.sessions.length, 1, `${label}: export carries sessions`);
  assert.equal(snapshot.projects.length, 1, `${label}: export carries projects`);

  const target = make();
  await target.init();
  await target.saveSession(makeSession("stale", "pX", []));
  await target.import(snapshot, "replace");

  const sessions = await target.listSessions();
  assert.equal(sessions.length, 1, `${label}: replace import drops pre-existing records`);
  assert.equal(sessions[0].id, "s1", `${label}: replace import installs snapshot records`);
}

async function checkImportMerge(make, label) {
  const store = make();
  await store.init();
  await store.saveSession(makeSession("keep", "p1", []));

  await store.import(
    {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      meta: null,
      projects: [],
      sessions: [makeSession("added", "p1", [])]
    },
    "merge"
  );

  const ids = (await store.listSessions()).map((s) => s.id).sort();
  assert.deepEqual(ids, ["added", "keep"], `${label}: merge import keeps existing + adds new`);
}

async function checkClear(make, label) {
  const store = make();
  await store.init();
  await store.saveSession(makeSession("s1", "p1", []));
  await store.saveProject(makeProject("p1", "Alpha"));
  await store.saveWorkspaceMeta({
    key: "workspace",
    activeProjectId: "p1",
    activeSessionId: "s1",
    modelChoices: [],
    connectionStatus: { hermes: "", brainMemory: "" },
    schemaVersion: 1,
    updatedAt: new Date().toISOString()
  });

  await store.clear();
  assert.equal((await store.listSessions()).length, 0, `${label}: clear empties sessions`);
  assert.equal((await store.listProjects()).length, 0, `${label}: clear empties projects`);
  assert.equal(await store.getWorkspaceMeta(), null, `${label}: clear empties meta`);
}

function checkSnippetHelper() {
  assert.equal(buildMessageSnippet("", "x"), "", "snippet of empty content is empty");
  const snippet = buildMessageSnippet("a".repeat(200) + " needle " + "b".repeat(200), "needle");
  assert.ok(snippet.includes("needle"), "snippet centers on the match");
  assert.ok(snippet.startsWith("…") && snippet.endsWith("…"), "snippet is elided on both ends");
}

// --- fixtures ------------------------------------------------------------

function message(id, role, content, createdAt = "2026-06-20T00:00:00.000Z") {
  return { id, role, author: role === "user" ? "You" : "Hermes", content, createdAt };
}

function makeSession(id, projectId, messages) {
  return {
    id,
    projectId,
    hermesSessionId: `hermes-${id}`,
    title: `Session ${id}`,
    titleSource: "default",
    summary: "",
    memoryScope: {
      tenantId: "local-dev",
      projectId,
      sessionId: id,
      stableSessionKey: `studio:local-dev:project:${projectId}:session:${id}`,
      includeProjectContext: true,
      includeSessionContext: true
    },
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z",
    messages,
    memoryEvidence: [],
    toolEvents: [],
    runRecords: [],
    artifacts: []
  };
}

function makeProject(id, name) {
  return {
    id,
    name,
    description: "",
    icon: "AL",
    memoryScopeKey: `studio:local-dev:project:${id}`,
    memoryScope: {
      tenantId: "local-dev",
      projectId: id,
      stableProjectKey: `studio:local-dev:project:${id}`,
      retrievalProfile: "balanced",
      pinnedMemoryIds: [],
      contextPolicy: "balanced"
    },
    createdAt: "2026-06-20T00:00:00.000Z",
    updatedAt: "2026-06-20T00:00:00.000Z"
  };
}
