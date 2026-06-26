import {
  STORAGE_SCHEMA_VERSION,
  WORKSPACE_META_KEY,
  searchSessionsForMessages,
  type MemoryStore,
  type MemoryStoreSnapshot,
  type MessageSearchHit,
  type ProjectRecord,
  type SessionRecord,
  type WorkspaceMetaRecord
} from "./memory-store";

/**
 * IndexedDB-backed UI persistence.
 *
 * Implementation note — why native IndexedDB and not a helper library (idb):
 * the repo pins workspace dependencies tightly and the access pattern here is
 * small (three object stores, get/put/delete/getAll, one upgrade migration).
 * A tiny promise wrapper keeps the bundle lean and avoids adding a dependency
 * for a handful of calls. If access patterns grow (indexes, cursors, multiple
 * versions) switching to `idb` would be reasonable.
 *
 * Layout (normalized, not one blob):
 *   - "projects"  keyPath "id"  — one record per project
 *   - "sessions"  keyPath "id"  — one record per session (carries its messages)
 *   - "meta"      keyPath "key" — single workspace-meta record
 */

export const DB_NAME = "hermes-ui-storage";
export const DB_VERSION = STORAGE_SCHEMA_VERSION;

const PROJECTS_STORE = "projects";
const SESSIONS_STORE = "sessions";
const META_STORE = "meta";
const ALL_STORES = [PROJECTS_STORE, SESSIONS_STORE, META_STORE] as const;

export class IndexedDbUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IndexedDbUnavailableError";
  }
}

export class LocalIndexedDbMemoryStore implements MemoryStore {
  readonly kind = "indexeddb" as const;

  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;
  private readonly factory: IDBFactory | undefined;
  private readonly dbName: string;

  constructor(factory: IDBFactory | undefined = resolveDefaultFactory(), dbName: string = DB_NAME) {
    this.factory = factory;
    this.dbName = dbName;
  }

  async init(): Promise<void> {
    await this.open();
  }

  private open(): Promise<IDBDatabase> {
    if (this.db) {
      return Promise.resolve(this.db);
    }
    if (this.openPromise) {
      return this.openPromise;
    }
    if (!this.factory) {
      return Promise.reject(
        new IndexedDbUnavailableError("IndexedDB is not available in this environment.")
      );
    }

    this.openPromise = new Promise<IDBDatabase>((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = this.factory!.open(this.dbName, DB_VERSION);
      } catch (error) {
        reject(asError(error));
        return;
      }

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
          db.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
          db.createObjectStore(SESSIONS_STORE, { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: "key" });
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        this.db.onversionchange = () => this.db?.close();
        resolve(request.result);
      };
      request.onerror = () => reject(asError(request.error));
      request.onblocked = () =>
        reject(new IndexedDbUnavailableError("IndexedDB open request is blocked."));
    });

    return this.openPromise;
  }

  async listSessions(): Promise<SessionRecord[]> {
    return this.getAll<SessionRecord>(SESSIONS_STORE);
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    return (await this.get<SessionRecord>(SESSIONS_STORE, id)) ?? null;
  }

  async saveSession(session: SessionRecord): Promise<void> {
    await this.put(SESSIONS_STORE, session);
  }

  async deleteSession(id: string): Promise<void> {
    await this.deleteKey(SESSIONS_STORE, id);
  }

  async listProjects(): Promise<ProjectRecord[]> {
    return this.getAll<ProjectRecord>(PROJECTS_STORE);
  }

  async saveProject(project: ProjectRecord): Promise<void> {
    await this.put(PROJECTS_STORE, project);
  }

  async deleteProject(id: string): Promise<void> {
    await this.deleteKey(PROJECTS_STORE, id);
  }

  async getWorkspaceMeta(): Promise<WorkspaceMetaRecord | null> {
    return (await this.get<WorkspaceMetaRecord>(META_STORE, WORKSPACE_META_KEY)) ?? null;
  }

  async saveWorkspaceMeta(meta: WorkspaceMetaRecord): Promise<void> {
    await this.put(META_STORE, meta);
  }

  async searchMessages(
    query: string,
    options?: { limit?: number }
  ): Promise<MessageSearchHit[]> {
    const sessions = await this.listSessions();
    return searchSessionsForMessages(sessions, query, options);
  }

  async export(): Promise<MemoryStoreSnapshot> {
    const [projects, sessions, meta] = await Promise.all([
      this.listProjects(),
      this.listSessions(),
      this.getWorkspaceMeta()
    ]);
    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      meta,
      projects,
      sessions
    };
  }

  async import(
    snapshot: MemoryStoreSnapshot,
    mode: "replace" | "merge" = "replace"
  ): Promise<void> {
    const db = await this.open();
    await runWrite(db, ALL_STORES, (tx) => {
      const projectsStore = tx.objectStore(PROJECTS_STORE);
      const sessionsStore = tx.objectStore(SESSIONS_STORE);
      const metaStore = tx.objectStore(META_STORE);

      if (mode === "replace") {
        projectsStore.clear();
        sessionsStore.clear();
        metaStore.clear();
      }
      for (const project of snapshot.projects) {
        projectsStore.put(project);
      }
      for (const session of snapshot.sessions) {
        sessionsStore.put(session);
      }
      if (snapshot.meta) {
        metaStore.put(snapshot.meta);
      }
    });
  }

  async clear(): Promise<void> {
    const db = await this.open();
    await runWrite(db, ALL_STORES, (tx) => {
      tx.objectStore(PROJECTS_STORE).clear();
      tx.objectStore(SESSIONS_STORE).clear();
      tx.objectStore(META_STORE).clear();
    });
  }

  // --- low-level helpers --------------------------------------------------

  private async get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
    const db = await this.open();
    return runRequest<T | undefined>(db, storeName, "readonly", (store) => store.get(key));
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.open();
    return runRequest<T[]>(db, storeName, "readonly", (store) => store.getAll());
  }

  private async put<T>(storeName: string, value: T): Promise<void> {
    const db = await this.open();
    await runWrite(db, [storeName], (tx) => {
      tx.objectStore(storeName).put(value as unknown as IDBValidKey);
    });
  }

  private async deleteKey(storeName: string, key: IDBValidKey): Promise<void> {
    const db = await this.open();
    await runWrite(db, [storeName], (tx) => {
      tx.objectStore(storeName).delete(key);
    });
  }
}

/**
 * Issue a single request and resolve with its result once the transaction
 * *commits*. The result is read from the request inside `oncomplete`, which the
 * spec guarantees fires after the request succeeded — avoiding any reliance on
 * microtask ordering between request and transaction callbacks.
 */
function runRequest<T>(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
  open: (store: IDBObjectStore) => IDBRequest
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    let request: IDBRequest;
    try {
      tx = db.transaction([storeName], mode);
      request = open(tx.objectStore(storeName));
    } catch (error) {
      reject(asError(error));
      return;
    }
    request.onerror = () => reject(asError(request.error));
    tx.oncomplete = () => resolve(request.result as T);
    tx.onerror = () => reject(asError(tx.error));
    tx.onabort = () => reject(asError(tx.error) ?? new Error("IndexedDB transaction aborted."));
  });
}

/**
 * Run one or more write operations synchronously inside a transaction and
 * resolve once it commits. The executor must register its requests
 * synchronously so they are part of the transaction before it auto-commits.
 */
function runWrite(
  db: IDBDatabase,
  storeNames: readonly string[],
  executor: (tx: IDBTransaction) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(storeNames as string[], "readwrite");
      executor(tx);
    } catch (error) {
      reject(asError(error));
      return;
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(asError(tx.error));
    tx.onabort = () => reject(asError(tx.error) ?? new Error("IndexedDB transaction aborted."));
  });
}

function resolveDefaultFactory(): IDBFactory | undefined {
  return typeof globalThis !== "undefined" && "indexedDB" in globalThis
    ? (globalThis.indexedDB as IDBFactory | undefined) ?? undefined
    : undefined;
}

function asError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }
  return new Error(typeof value === "string" ? value : "IndexedDB operation failed.");
}
