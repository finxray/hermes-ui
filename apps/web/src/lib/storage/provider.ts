import { LocalIndexedDbMemoryStore } from "./local-indexeddb-memory-store";
import {
  migrateLocalStorageToIndexedDb,
  type MigrationResult
} from "./migrate-localstorage-to-indexeddb";
import type { MemoryStore, MemoryStoreKind } from "./memory-store";
import { NoopMemoryStore } from "./noop-memory-store";

/**
 * Selects and prepares the active {@link MemoryStore} for the running UI.
 *
 * Order of preference:
 *   1. IndexedDB (durable, the default).
 *   2. In-memory NoopMemoryStore fallback if IndexedDB can't be opened
 *      (private mode, disabled storage, SSR). The UI still works; data just
 *      doesn't survive reload. A non-disruptive warning is exposed via
 *      {@link getStorageDiagnostics} for the settings/dev panel only.
 *
 * Brain Memory is NOT part of this path — it is an optional plugin and the UI
 * never depends on it for persistence (see brain-memory-plugin-store.ts).
 *
 * The store is resolved once and cached for the lifetime of the page. Migration
 * from legacy localStorage runs as part of setup, exactly once.
 */

export type StorageDiagnostics = {
  kind: MemoryStoreKind;
  durable: boolean;
  warning: string | null;
  migration: MigrationResult | null;
};

type ResolvedStore = {
  store: MemoryStore;
  diagnostics: StorageDiagnostics;
};

let resolvePromise: Promise<ResolvedStore> | null = null;

export function getMemoryStore(): Promise<ResolvedStore> {
  if (!resolvePromise) {
    resolvePromise = resolveStore();
  }
  return resolvePromise;
}

/** Convenience: resolve the store and return just the diagnostics. */
export async function getStorageDiagnostics(): Promise<StorageDiagnostics> {
  const { diagnostics } = await getMemoryStore();
  return diagnostics;
}

/** Test-only: drop the cached store so the next call re-resolves. */
export function resetMemoryStoreForTests(): void {
  resolvePromise = null;
}

async function resolveStore(): Promise<ResolvedStore> {
  const storage = safeLocalStorage();

  const indexedStore = new LocalIndexedDbMemoryStore();
  try {
    await indexedStore.init();
    const migration = await migrateLocalStorageToIndexedDb(storage, indexedStore);
    return {
      store: indexedStore,
      diagnostics: {
        kind: "indexeddb",
        durable: true,
        warning:
          migration.status === "failed"
            ? "Some saved data could not be migrated from older browser storage. Recent work is still saved."
            : null,
        migration
      }
    };
  } catch {
    // IndexedDB unavailable — degrade gracefully to in-memory.
    const noop = new NoopMemoryStore();
    await noop.init();
    return {
      store: noop,
      diagnostics: {
        kind: "noop",
        durable: false,
        warning:
          "Local browser storage (IndexedDB) is unavailable, so chats are kept only for this session and will be lost on reload. " +
          "Check that storage is enabled and you are not in a private window.",
        migration: null
      }
    };
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}
