import { createMockWorkspaceState } from "@/lib/workspaceStore";
import type { WorkspaceState } from "@/data/types";
import {
  STORAGE_SCHEMA_VERSION,
  WORKSPACE_META_KEY,
  type MemoryStore,
  type MemoryStoreSnapshot,
  type WorkspaceMetaRecord
} from "./memory-store";

/**
 * Bridge between the workspace reducer's single {@link WorkspaceState} object
 * and the normalized record layout owned by a {@link MemoryStore}.
 *
 * The reducer keeps working on one in-memory state object (unchanged UX); the
 * store keeps projects/sessions as separate records. These two functions are
 * the only place that translates between the two shapes.
 */

/** Decompose live workspace state into a portable snapshot of records. */
export function workspaceStateToSnapshot(state: WorkspaceState): MemoryStoreSnapshot {
  const meta: WorkspaceMetaRecord = {
    key: WORKSPACE_META_KEY,
    activeProjectId: state.activeProjectId,
    activeSessionId: state.activeSessionId,
    modelChoices: state.modelChoices ?? [],
    connectionStatus: state.connectionStatus ?? { hermes: "", brainMemory: "" },
    schemaVersion: STORAGE_SCHEMA_VERSION,
    updatedAt: new Date().toISOString()
  };

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    exportedAt: meta.updatedAt,
    meta,
    projects: state.projects,
    sessions: state.sessions
  };
}

/** Recompose workspace state from a stored snapshot, filling runtime defaults. */
export function snapshotToWorkspaceState(snapshot: MemoryStoreSnapshot): WorkspaceState | null {
  // A snapshot with no projects is not a restorable workspace; let the caller
  // keep the default mock state instead.
  if (snapshot.projects.length === 0 && snapshot.sessions.length === 0 && !snapshot.meta) {
    return null;
  }

  const defaults = createMockWorkspaceState();
  return {
    activeProjectId: snapshot.meta?.activeProjectId ?? defaults.activeProjectId,
    activeSessionId: snapshot.meta?.activeSessionId ?? null,
    projects: snapshot.projects,
    sessions: snapshot.sessions,
    // modelChoices/connectionStatus are runtime-ish; fall back to mock defaults
    // so a snapshot from an older schema still produces a valid state.
    modelChoices:
      snapshot.meta?.modelChoices && snapshot.meta.modelChoices.length > 0
        ? snapshot.meta.modelChoices
        : defaults.modelChoices,
    connectionStatus: snapshot.meta?.connectionStatus ?? defaults.connectionStatus
  };
}

/** Load and recompose the persisted workspace, or null when none is stored. */
export async function loadWorkspaceFromStore(store: MemoryStore): Promise<WorkspaceState | null> {
  const snapshot = await store.export();
  return snapshotToWorkspaceState(snapshot);
}

/** Persist the whole workspace atomically (faithful to prior save semantics). */
export async function saveWorkspaceToStore(
  store: MemoryStore,
  state: WorkspaceState
): Promise<void> {
  await store.import(workspaceStateToSnapshot(state), "replace");
}
