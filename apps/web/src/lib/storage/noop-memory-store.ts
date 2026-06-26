import {
  STORAGE_SCHEMA_VERSION,
  searchSessionsForMessages,
  type MemoryStore,
  type MemoryStoreSnapshot,
  type MessageSearchHit,
  type ProjectRecord,
  type SessionRecord,
  type WorkspaceMetaRecord
} from "./memory-store";

/**
 * In-memory fallback used when IndexedDB is unavailable (private browsing,
 * disabled storage, exotic runtimes) or in tests.
 *
 * It fully implements the {@link MemoryStore} contract so the UI keeps working,
 * but nothing survives a reload. The provider surfaces a non-disruptive warning
 * (settings/dev panel only) when this backend is selected. Because it is a
 * complete, dependency-free implementation, it also doubles as the canonical
 * reference store for unit tests.
 */
export class NoopMemoryStore implements MemoryStore {
  readonly kind = "noop" as const;

  private projects = new Map<string, ProjectRecord>();
  private sessions = new Map<string, SessionRecord>();
  private meta: WorkspaceMetaRecord | null = null;

  async init(): Promise<void> {
    // Nothing to open.
  }

  async listSessions(): Promise<SessionRecord[]> {
    return [...this.sessions.values()].map(clone);
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(id);
    return session ? clone(session) : null;
  }

  async saveSession(session: SessionRecord): Promise<void> {
    this.sessions.set(session.id, clone(session));
  }

  async deleteSession(id: string): Promise<void> {
    this.sessions.delete(id);
  }

  async listProjects(): Promise<ProjectRecord[]> {
    return [...this.projects.values()].map(clone);
  }

  async saveProject(project: ProjectRecord): Promise<void> {
    this.projects.set(project.id, clone(project));
  }

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
  }

  async getWorkspaceMeta(): Promise<WorkspaceMetaRecord | null> {
    return this.meta ? clone(this.meta) : null;
  }

  async saveWorkspaceMeta(meta: WorkspaceMetaRecord): Promise<void> {
    this.meta = clone(meta);
  }

  async searchMessages(
    query: string,
    options?: { limit?: number }
  ): Promise<MessageSearchHit[]> {
    return searchSessionsForMessages([...this.sessions.values()], query, options);
  }

  async export(): Promise<MemoryStoreSnapshot> {
    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      meta: this.meta ? clone(this.meta) : null,
      projects: [...this.projects.values()].map(clone),
      sessions: [...this.sessions.values()].map(clone)
    };
  }

  async import(
    snapshot: MemoryStoreSnapshot,
    mode: "replace" | "merge" = "replace"
  ): Promise<void> {
    if (mode === "replace") {
      this.projects.clear();
      this.sessions.clear();
      this.meta = null;
    }
    for (const project of snapshot.projects) {
      this.projects.set(project.id, clone(project));
    }
    for (const session of snapshot.sessions) {
      this.sessions.set(session.id, clone(session));
    }
    if (snapshot.meta) {
      this.meta = clone(snapshot.meta);
    }
  }

  async clear(): Promise<void> {
    this.projects.clear();
    this.sessions.clear();
    this.meta = null;
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
