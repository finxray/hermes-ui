import {
  type MemoryStore,
  type MemoryStoreSnapshot,
  type MessageSearchHit,
  type ProjectRecord,
  type SessionRecord,
  type WorkspaceMetaRecord
} from "./memory-store";

/**
 * Adapter boundary for a future Brain Memory plugin acting as the UI
 * persistence backend.
 *
 * IMPORTANT: This is intentionally NOT a working implementation. Brain Memory
 * is an optional, independent plugin and the UI must function fully without it
 * (it falls back to IndexedDB — see provider.ts). This class only fixes the
 * shape of the seam so that, when/if a Brain Memory storage plugin ships, it
 * can be dropped in here without touching the rest of the app.
 *
 * A real implementation would:
 *   - delegate reads/writes to the Brain Memory gateway via the existing BFF
 *     routes (see lib/brainMemoryClient.ts), respecting the
 *     BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY feature boundary, and
 *   - typically wrap a local store (IndexedDB) for offline-first behavior,
 *     treating Brain Memory as the source of truth when reachable.
 *
 * Until then, constructing it without a delegate is a no-op-ish guard: it
 * throws on use so it can never be silently selected as the active store.
 */
export type BrainMemoryPluginStoreOptions = {
  /**
   * Optional delegate the adapter forwards to. When omitted, every operation
   * throws — the provider must not select this store without a delegate.
   */
  delegate?: MemoryStore;
};

export class BrainMemoryPluginStore implements MemoryStore {
  readonly kind = "brain-memory-plugin" as const;

  private readonly delegate?: MemoryStore;

  constructor(options: BrainMemoryPluginStoreOptions = {}) {
    this.delegate = options.delegate;
  }

  /** True once a real Brain Memory storage delegate has been wired in. */
  get isReady(): boolean {
    return Boolean(this.delegate);
  }

  async init(): Promise<void> {
    await this.require().init();
  }

  listSessions(): Promise<SessionRecord[]> {
    return this.require().listSessions();
  }

  getSession(id: string): Promise<SessionRecord | null> {
    return this.require().getSession(id);
  }

  saveSession(session: SessionRecord): Promise<void> {
    return this.require().saveSession(session);
  }

  deleteSession(id: string): Promise<void> {
    return this.require().deleteSession(id);
  }

  listProjects(): Promise<ProjectRecord[]> {
    return this.require().listProjects();
  }

  saveProject(project: ProjectRecord): Promise<void> {
    return this.require().saveProject(project);
  }

  deleteProject(id: string): Promise<void> {
    return this.require().deleteProject(id);
  }

  getWorkspaceMeta(): Promise<WorkspaceMetaRecord | null> {
    return this.require().getWorkspaceMeta();
  }

  saveWorkspaceMeta(meta: WorkspaceMetaRecord): Promise<void> {
    return this.require().saveWorkspaceMeta(meta);
  }

  searchMessages(query: string, options?: { limit?: number }): Promise<MessageSearchHit[]> {
    return this.require().searchMessages(query, options);
  }

  export(): Promise<MemoryStoreSnapshot> {
    return this.require().export();
  }

  import(snapshot: MemoryStoreSnapshot, mode?: "replace" | "merge"): Promise<void> {
    return this.require().import(snapshot, mode);
  }

  clear(): Promise<void> {
    return this.require().clear();
  }

  private require(): MemoryStore {
    if (!this.delegate) {
      throw new Error(
        "BrainMemoryPluginStore is a placeholder adapter; no Brain Memory storage delegate is wired in. " +
          "The UI uses IndexedDB locally and does not depend on Brain Memory for persistence."
      );
    }
    return this.delegate;
  }
}
