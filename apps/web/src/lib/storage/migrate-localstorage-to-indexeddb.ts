import { WORKSPACE_STORAGE_KEY, loadWorkspaceState } from "@/lib/workspaceStore";
import type { MemoryStore } from "./memory-store";
import { workspaceStateToSnapshot } from "./workspace-storage";

/**
 * One-time migration of legacy localStorage workspace data into the
 * {@link MemoryStore} (IndexedDB in the browser).
 *
 * Contract:
 *  - Runs at most once. A marker in localStorage records completion so we never
 *    re-import on subsequent loads.
 *  - Does NOT delete the legacy localStorage entry — we only stop relying on
 *    it. This keeps a safety net for one release cycle / manual rollback.
 *  - Never overwrites data already present in the store (if the store already
 *    has a workspace, we treat migration as done).
 */

export const MIGRATION_MARKER_KEY = "hermes-ui.storage.migration.v1";

export type MigrationStatus =
  | "migrated" // legacy data found and imported
  | "already-migrated" // marker present, nothing to do
  | "store-not-empty" // store already had data; marked done without import
  | "no-legacy-data" // nothing in localStorage; marked done
  | "skipped" // no storage available
  | "failed"; // import threw; marker left unset so we can retry

export type MigrationResult = {
  status: MigrationStatus;
  error?: Error;
};

export async function migrateLocalStorageToIndexedDb(
  storage: Storage | undefined,
  store: MemoryStore
): Promise<MigrationResult> {
  if (!storage) {
    return { status: "skipped" };
  }

  if (readMarker(storage)) {
    return { status: "already-migrated" };
  }

  try {
    // If the store already holds a workspace (e.g. user has been on IndexedDB
    // already), don't clobber it — just mark migration complete.
    const existingMeta = await store.getWorkspaceMeta();
    const existingSessions = await store.listSessions();
    if (existingMeta || existingSessions.length > 0) {
      writeMarker(storage);
      return { status: "store-not-empty" };
    }

    const legacyState = loadWorkspaceState(storage);
    if (!legacyState) {
      writeMarker(storage);
      return { status: "no-legacy-data" };
    }

    await store.import(workspaceStateToSnapshot(legacyState), "replace");
    writeMarker(storage);
    return { status: "migrated" };
  } catch (error) {
    // Leave the marker unset so a later load can retry the migration.
    return { status: "failed", error: asError(error) };
  }
}

/** Test/diagnostic helper: has the migration marker been set? */
export function isMigrationComplete(storage: Storage | undefined): boolean {
  return Boolean(storage && readMarker(storage));
}

/** Note: intentionally does NOT remove WORKSPACE_STORAGE_KEY (legacy data). */
export const LEGACY_WORKSPACE_KEY = WORKSPACE_STORAGE_KEY;

function readMarker(storage: Storage): boolean {
  try {
    return storage.getItem(MIGRATION_MARKER_KEY) === "complete";
  } catch {
    return false;
  }
}

function writeMarker(storage: Storage): void {
  try {
    storage.setItem(MIGRATION_MARKER_KEY, "complete");
  } catch {
    // Best effort — if we can't persist the marker we may re-run the (idempotent
    // for an empty store) migration next load, which is harmless.
  }
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error("localStorage migration failed.");
}
