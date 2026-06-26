import type {
  ChatMessage,
  ModelChoice,
  Project,
  Session
} from "@/data/types";

/**
 * UI persistence abstraction for the Hermes UI workspace.
 *
 * Brain Memory is an *optional* plugin. The UI must persist its own
 * chat/session/workspace state locally so that it works fully without any
 * Brain Memory gateway. This interface is the seam between the React shell and
 * whatever local store backs it (IndexedDB in the browser, an in-memory noop
 * fallback, or — in the future — a Brain Memory plugin adapter).
 *
 * The data model is intentionally normalized into separate record kinds
 * (projects, sessions, workspace meta) rather than one giant blob so the store
 * can read/write individual sessions and grow without rewriting everything.
 */

/** Bumped when the persisted record shape changes in a non-backward way. */
export const STORAGE_SCHEMA_VERSION = 1;

/** Stable identifier for the meta record inside the store. */
export const WORKSPACE_META_KEY = "workspace";

export type MemoryStoreKind = "indexeddb" | "noop" | "brain-memory-plugin";

/**
 * A project is persisted exactly as the workspace reducer models it. The store
 * does not reshape it; it only owns durability + indexing concerns.
 */
export type ProjectRecord = Project;

/**
 * A session record carries its own messages, run records and tool events. This
 * is the normalization boundary: one record per session keeps each chat
 * independently loadable instead of forcing a single workspace blob.
 */
export type SessionRecord = Session;

/**
 * Top-level pointers and small workspace-wide values that are not owned by any
 * single project or session. Persisted as a single keyed record.
 */
export type WorkspaceMetaRecord = {
  key: typeof WORKSPACE_META_KEY;
  activeProjectId: string;
  activeSessionId: string | null;
  modelChoices: ModelChoice[];
  connectionStatus: { hermes: string; brainMemory: string };
  schemaVersion: number;
  updatedAt: string;
};

/** A single message match returned by {@link MemoryStore.searchMessages}. */
export type MessageSearchHit = {
  sessionId: string;
  projectId: string;
  messageId: string;
  role: ChatMessage["role"];
  snippet: string;
  createdAt: string;
};

/**
 * Export/import-friendly snapshot of the entire store. Used for the hot-path
 * whole-workspace save/load (see workspace-storage.ts) and for explicit
 * backup/restore. Normalized into record arrays rather than a nested blob.
 */
export type MemoryStoreSnapshot = {
  schemaVersion: number;
  exportedAt: string;
  meta: WorkspaceMetaRecord | null;
  projects: ProjectRecord[];
  sessions: SessionRecord[];
};

export type MemoryStore = {
  /** Which concrete backend this is (useful for diagnostics/settings panel). */
  readonly kind: MemoryStoreKind;

  /** Open/prepare the underlying storage. Safe to call more than once. */
  init(): Promise<void>;

  // --- sessions -----------------------------------------------------------
  listSessions(): Promise<SessionRecord[]>;
  getSession(id: string): Promise<SessionRecord | null>;
  saveSession(session: SessionRecord): Promise<void>;
  deleteSession(id: string): Promise<void>;

  // --- projects -----------------------------------------------------------
  listProjects(): Promise<ProjectRecord[]>;
  saveProject(project: ProjectRecord): Promise<void>;
  deleteProject(id: string): Promise<void>;

  // --- workspace meta -----------------------------------------------------
  getWorkspaceMeta(): Promise<WorkspaceMetaRecord | null>;
  saveWorkspaceMeta(meta: WorkspaceMetaRecord): Promise<void>;

  // --- search -------------------------------------------------------------
  searchMessages(query: string, options?: { limit?: number }): Promise<MessageSearchHit[]>;

  // --- bulk / export-import ----------------------------------------------
  /** Read the whole store as a portable snapshot. */
  export(): Promise<MemoryStoreSnapshot>;
  /**
   * Write a snapshot. `mode: "replace"` (default) atomically replaces all
   * persisted records; `mode: "merge"` upserts records and leaves others.
   */
  import(snapshot: MemoryStoreSnapshot, mode?: "replace" | "merge"): Promise<void>;
  /** Remove all persisted records (projects, sessions, meta). */
  clear(): Promise<void>;
};

/** Build a message snippet for search hits without leaking huge bodies. */
export function buildMessageSnippet(content: string, query: string, radius = 60): string {
  const clean = content.replace(/\s+/g, " ").trim();
  if (!clean) {
    return "";
  }
  const index = clean.toLowerCase().indexOf(query.trim().toLowerCase());
  if (index < 0 || !query.trim()) {
    return clean.length > radius * 2 ? `${clean.slice(0, radius * 2)}…` : clean;
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(clean.length, index + query.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < clean.length ? "…" : "";
  return `${prefix}${clean.slice(start, end)}${suffix}`;
}

/**
 * Shared search implementation reused by every backend so all stores rank
 * results identically. Operates over already-loaded session records.
 */
export function searchSessionsForMessages(
  sessions: SessionRecord[],
  query: string,
  options?: { limit?: number }
): MessageSearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [];
  }
  const limit = options?.limit ?? 50;
  const hits: MessageSearchHit[] = [];

  for (const session of sessions) {
    for (const message of session.messages ?? []) {
      if (message.content.toLowerCase().includes(needle)) {
        hits.push({
          sessionId: session.id,
          projectId: session.projectId,
          messageId: message.id,
          role: message.role,
          snippet: buildMessageSnippet(message.content, query),
          createdAt: message.createdAt
        });
      }
    }
  }

  return hits
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
