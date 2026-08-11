import { createHash, randomUUID } from "node:crypto";
import { chmodSync, mkdirSync } from "node:fs";
import { access, mkdir, open, readFile, rename, rm, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const STOIX_DATA_DIR_ENV = "STOIX_DATA_DIR";
const DATABASE_FILE_NAME = "stoix.sqlite3";
const MAX_STORED_OBJECT_BYTES = 512 * 1024 * 1024;
const MAX_INLINE_IMAGE_BYTES = 20 * 1024 * 1024;
const OBJECT_ID_PATTERN = /^att_[a-f0-9]{32}$/;
const ALLOWED_ATTACHMENT_KINDS = new Set([
  "image",
  "pdf",
  "text",
  "spreadsheet",
  "presentation",
  "document",
  "archive",
  "code",
  "unknown"
]);

export type StoredObjectManifest = {
  id: string;
  namespace: string;
  digest: string;
  fileName: string;
  kind: string;
  mimeType: string;
  verifiedMediaType: string | null;
  sizeBytes: number;
  createdAt: string;
};

export type StoredMessageAttachment = {
  id: string;
  storageId: string;
  contentHash: string;
  fileName: string;
  kind: string;
  mimeType: string;
  sizeBytes: number;
  source: "local";
  previewUrl?: string;
  downloadUrl: string;
  status: "ready";
};

export type ReconcileMessage = {
  id: string;
  role: string;
  content: string;
  createdAt?: string;
};

type StoreObjectInput = {
  body: ReadableStream<Uint8Array>;
  fileName: string;
  kind: string;
  mimeType: string;
  namespace?: string;
  maxBytes?: number;
};

type MessageLinkInput = {
  sessionId: string;
  clientMessageId: string;
  content: string;
  objectIds: string[];
};

type ObjectRow = {
  id: string;
  namespace: string;
  digest: string;
  file_name: string;
  kind: string;
  mime_type: string;
  verified_media_type: string | null;
  size_bytes: number;
  created_at: string;
  relative_path?: string;
};

type MessageLinkRow = {
  client_message_id: string;
  hermes_message_id: string | null;
  content: string;
  content_digest: string;
  created_at: string;
};

type MessageObjectRow = ObjectRow & {
  hermes_message_id: string;
  position: number;
};

type LocalDataStoreGlobal = typeof globalThis & {
  __stoixLocalDataStore?: LocalDataStore;
};

export class LocalDataStore {
  readonly rootDirectory: string;
  readonly databasePath: string;
  readonly objectsDirectory: string;
  readonly temporaryDirectory: string;
  private readonly database: DatabaseSync;

  constructor(rootDirectory = resolveStoixDataDirectory()) {
    this.rootDirectory = path.resolve(rootDirectory);
    this.databasePath = path.join(this.rootDirectory, DATABASE_FILE_NAME);
    this.objectsDirectory = path.join(this.rootDirectory, "objects");
    this.temporaryDirectory = path.join(this.rootDirectory, "tmp");
    mkdirSyncSafe(this.rootDirectory);
    mkdirSyncSafe(this.objectsDirectory);
    mkdirSyncSafe(this.temporaryDirectory);
    this.database = new DatabaseSync(this.databasePath);
    if (process.platform !== "win32") {
      chmodSync(this.databasePath, 0o600);
    }
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA synchronous = NORMAL");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.initializeSchema();
  }

  close() {
    this.database.close();
  }

  putRecord(namespace: string, key: string, value: unknown) {
    const now = new Date().toISOString();
    this.database.prepare(`
      INSERT INTO durable_records (namespace, record_key, value_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(namespace, record_key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `).run(cleanNamespace(namespace), cleanRecordKey(key), JSON.stringify(value), now, now);
  }

  getRecord<T>(namespace: string, key: string): T | null {
    const row = this.database.prepare(`
      SELECT value_json FROM durable_records WHERE namespace = ? AND record_key = ?
    `).get(cleanNamespace(namespace), cleanRecordKey(key)) as { value_json?: string } | undefined;
    if (!row?.value_json) {
      return null;
    }
    try {
      return JSON.parse(row.value_json) as T;
    } catch {
      return null;
    }
  }

  deleteRecord(namespace: string, key: string) {
    this.database.prepare(`
      DELETE FROM durable_records WHERE namespace = ? AND record_key = ?
    `).run(cleanNamespace(namespace), cleanRecordKey(key));
  }

  async storeObject(input: StoreObjectInput): Promise<StoredObjectManifest> {
    const namespace = cleanNamespace(input.namespace ?? "chat-attachment");
    const fileName = cleanFileName(input.fileName);
    const kind = cleanAttachmentKind(input.kind);
    const mimeType = cleanMimeType(input.mimeType);
    const maxBytes = Math.min(
      Math.max(1, input.maxBytes ?? MAX_STORED_OBJECT_BYTES),
      MAX_STORED_OBJECT_BYTES
    );
    const temporaryPath = path.join(this.temporaryDirectory, `upload-${randomUUID()}.part`);
    const output = await open(temporaryPath, "wx", 0o600);
    const hash = createHash("sha256");
    const reader = input.body.getReader();
    let sizeBytes = 0;
    let prefix = Buffer.alloc(0);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (!value?.byteLength) {
          continue;
        }
        sizeBytes += value.byteLength;
        if (sizeBytes > maxBytes) {
          throw new LocalDataStoreError("too_large", `Attachment exceeds the ${maxBytes}-byte storage limit.`);
        }
        hash.update(value);
        if (prefix.length < 32) {
          prefix = Buffer.concat([prefix, Buffer.from(value).subarray(0, 32 - prefix.length)]);
        }
        await output.write(value);
      }
      if (sizeBytes === 0) {
        throw new LocalDataStoreError("empty", "Attachment is empty.");
      }
      await output.sync();
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      await output.close().catch(() => undefined);
      await rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    }
    await output.close();

    const digest = hash.digest("hex");
    const relativePath = path.join("objects", digest.slice(0, 2), digest);
    const finalPath = this.resolveStoredPath(relativePath);
    await mkdir(path.dirname(finalPath), { recursive: true });
    if (await fileExists(finalPath)) {
      await rm(temporaryPath, { force: true });
    } else {
      try {
        await rename(temporaryPath, finalPath);
      } catch (error) {
        if (await fileExists(finalPath)) {
          await rm(temporaryPath, { force: true });
        } else {
          throw error;
        }
      }
    }

    const id = `att_${randomUUID().replaceAll("-", "")}`;
    const createdAt = new Date().toISOString();
    const verifiedMediaType = detectVerifiedImageMime(prefix);
    this.inTransaction(() => {
      this.database.prepare(`
        INSERT OR IGNORE INTO stored_blobs (digest, relative_path, size_bytes, created_at)
        VALUES (?, ?, ?, ?)
      `).run(digest, relativePath, sizeBytes, createdAt);
      this.database.prepare(`
        INSERT INTO stored_objects (
          id, namespace, digest, file_name, kind, mime_type,
          verified_media_type, size_bytes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        namespace,
        digest,
        fileName,
        kind,
        mimeType,
        verifiedMediaType,
        sizeBytes,
        createdAt
      );
    });

    return {
      id,
      namespace,
      digest,
      fileName,
      kind,
      mimeType,
      verifiedMediaType,
      sizeBytes,
      createdAt
    };
  }

  getObject(id: string): StoredObjectManifest | null {
    if (!OBJECT_ID_PATTERN.test(id)) {
      return null;
    }
    const row = this.database.prepare(`
      SELECT id, namespace, digest, file_name, kind, mime_type,
             verified_media_type, size_bytes, created_at
      FROM stored_objects WHERE id = ?
    `).get(id) as ObjectRow | undefined;
    return row ? objectRowToManifest(row) : null;
  }

  getObjectFile(id: string): { manifest: StoredObjectManifest; path: string } | null {
    if (!OBJECT_ID_PATTERN.test(id)) {
      return null;
    }
    const row = this.database.prepare(`
      SELECT o.id, o.namespace, o.digest, o.file_name, o.kind, o.mime_type,
             o.verified_media_type, o.size_bytes, o.created_at, b.relative_path
      FROM stored_objects o
      JOIN stored_blobs b ON b.digest = o.digest
      WHERE o.id = ?
    `).get(id) as ObjectRow | undefined;
    if (!row?.relative_path) {
      return null;
    }
    return { manifest: objectRowToManifest(row), path: this.resolveStoredPath(row.relative_path) };
  }

  async readInlineImageDataUrl(id: string): Promise<string | null> {
    const stored = this.getObjectFile(id);
    if (
      !stored?.manifest.verifiedMediaType ||
      stored.manifest.kind !== "image" ||
      stored.manifest.sizeBytes > MAX_INLINE_IMAGE_BYTES
    ) {
      return null;
    }
    const bytes = await readFile(stored.path);
    return `data:${stored.manifest.verifiedMediaType};base64,${bytes.toString("base64")}`;
  }

  linkMessageObjects(input: MessageLinkInput) {
    const sessionId = cleanLinkId(input.sessionId, "session id");
    const clientMessageId = cleanLinkId(input.clientMessageId, "client message id");
    const objectIds = [...new Set(input.objectIds)].filter((id) => OBJECT_ID_PATTERN.test(id));
    if (objectIds.length !== input.objectIds.length || objectIds.length === 0) {
      throw new LocalDataStoreError("invalid_reference", "Every attachment must have a valid stored object id.");
    }
    const placeholders = objectIds.map(() => "?").join(", ");
    const rows = this.database.prepare(`
      SELECT id FROM stored_objects WHERE id IN (${placeholders})
    `).all(...objectIds) as Array<{ id: string }>;
    if (rows.length !== objectIds.length) {
      throw new LocalDataStoreError("missing_object", "One or more stored attachments no longer exist.");
    }

    const now = new Date().toISOString();
    this.inTransaction(() => {
      this.database.prepare(`
        INSERT INTO message_links (
          session_id, client_message_id, hermes_message_id, role, content,
          content_digest, created_at, updated_at
        ) VALUES (?, ?, NULL, 'user', ?, ?, ?, ?)
        ON CONFLICT(session_id, client_message_id) DO UPDATE SET
          content = excluded.content,
          content_digest = excluded.content_digest,
          updated_at = excluded.updated_at
      `).run(
        sessionId,
        clientMessageId,
        input.content.slice(0, 8_000),
        createHash("sha256").update(input.content).digest("hex"),
        now,
        now
      );
      this.database.prepare(`
        DELETE FROM message_objects WHERE session_id = ? AND client_message_id = ?
      `).run(sessionId, clientMessageId);
      const insert = this.database.prepare(`
        INSERT INTO message_objects (session_id, client_message_id, object_id, position)
        VALUES (?, ?, ?, ?)
      `);
      objectIds.forEach((objectId, position) => insert.run(sessionId, clientMessageId, objectId, position));
    });
  }

  getMessageAttachments(
    sessionId: string,
    messages: ReconcileMessage[]
  ): Map<string, StoredMessageAttachment[]> {
    const cleanSessionId = cleanLinkId(sessionId, "session id");
    this.reconcileMessageLinks(cleanSessionId, messages);
    const rows = this.database.prepare(`
      SELECT ml.hermes_message_id, mo.position,
             o.id, o.namespace, o.digest, o.file_name, o.kind, o.mime_type,
             o.verified_media_type, o.size_bytes, o.created_at
      FROM message_links ml
      JOIN message_objects mo
        ON mo.session_id = ml.session_id AND mo.client_message_id = ml.client_message_id
      JOIN stored_objects o ON o.id = mo.object_id
      WHERE ml.session_id = ? AND ml.hermes_message_id IS NOT NULL
      ORDER BY ml.hermes_message_id, mo.position
    `).all(cleanSessionId) as MessageObjectRow[];

    const result = new Map<string, StoredMessageAttachment[]>();
    for (const row of rows) {
      const manifest = objectRowToManifest(row);
      const attachment = manifestToMessageAttachment(manifest);
      result.set(row.hermes_message_id, [...(result.get(row.hermes_message_id) ?? []), attachment]);
    }
    return result;
  }

  async deleteObjectIfUnreferenced(id: string): Promise<boolean> {
    const stored = this.getObjectFile(id);
    if (!stored) {
      return false;
    }
    const reference = this.database.prepare(`
      SELECT 1 AS found FROM message_objects WHERE object_id = ? LIMIT 1
    `).get(id) as { found?: number } | undefined;
    if (reference?.found) {
      return false;
    }

    this.inTransaction(() => {
      this.database.prepare("DELETE FROM stored_objects WHERE id = ?").run(id);
      const remaining = this.database.prepare(`
        SELECT 1 AS found FROM stored_objects WHERE digest = ? LIMIT 1
      `).get(stored.manifest.digest) as { found?: number } | undefined;
      if (!remaining?.found) {
        this.database.prepare("DELETE FROM stored_blobs WHERE digest = ?").run(stored.manifest.digest);
      }
    });
    const remaining = this.database.prepare(`
      SELECT 1 AS found FROM stored_blobs WHERE digest = ? LIMIT 1
    `).get(stored.manifest.digest) as { found?: number } | undefined;
    if (!remaining?.found) {
      await unlink(stored.path).catch(() => undefined);
    }
    return true;
  }

  async deleteSessionMessageLinks(sessionId: string) {
    const cleanSessionId = cleanLinkId(sessionId, "session id");
    const objectRows = this.database.prepare(`
      SELECT DISTINCT mo.object_id
      FROM message_objects mo
      WHERE mo.session_id = ?
    `).all(cleanSessionId) as Array<{ object_id: string }>;
    this.database.prepare("DELETE FROM message_links WHERE session_id = ?").run(cleanSessionId);
    for (const row of objectRows) {
      await this.deleteObjectIfUnreferenced(row.object_id);
    }
  }

  private reconcileMessageLinks(sessionId: string, messages: ReconcileMessage[]) {
    const links = this.database.prepare(`
      SELECT client_message_id, hermes_message_id, content, content_digest, created_at
      FROM message_links WHERE session_id = ? ORDER BY created_at, client_message_id
    `).all(sessionId) as MessageLinkRow[];
    if (links.length === 0) {
      return;
    }

    const userMessages = messages.filter((message) => message.role === "user" && message.id);
    const contentDigests = new Map(
      userMessages.map((message) => [
        message.id,
        createHash("sha256").update(message.content).digest("hex")
      ])
    );
    const usedIds = new Set(
      links.map((link) => link.hermes_message_id).filter((id): id is string => Boolean(id))
    );
    const updates: Array<{ clientMessageId: string; hermesMessageId: string }> = [];

    for (const link of links) {
      if (link.hermes_message_id) {
        continue;
      }
      const linkTime = Date.parse(link.created_at);
      const candidates = userMessages.filter(
        (message) =>
          !usedIds.has(message.id) &&
          (contentDigests.get(message.id) === link.content_digest || message.content === link.content)
      );
      candidates.sort((left, right) => {
        const leftTime = Date.parse(left.createdAt ?? "");
        const rightTime = Date.parse(right.createdAt ?? "");
        const leftDistance = Number.isFinite(leftTime) && Number.isFinite(linkTime)
          ? Math.abs(leftTime - linkTime)
          : Number.MAX_SAFE_INTEGER;
        const rightDistance = Number.isFinite(rightTime) && Number.isFinite(linkTime)
          ? Math.abs(rightTime - linkTime)
          : Number.MAX_SAFE_INTEGER;
        return leftDistance - rightDistance;
      });
      const match = candidates[0];
      if (!match) {
        continue;
      }
      usedIds.add(match.id);
      updates.push({ clientMessageId: link.client_message_id, hermesMessageId: match.id });
    }

    if (updates.length > 0) {
      const statement = this.database.prepare(`
        UPDATE message_links
        SET hermes_message_id = ?, updated_at = ?
        WHERE session_id = ? AND client_message_id = ?
      `);
      const now = new Date().toISOString();
      this.inTransaction(() => {
        updates.forEach((update) => {
          statement.run(update.hermesMessageId, now, sessionId, update.clientMessageId);
        });
      });
    }
  }

  private resolveStoredPath(relativePath: string) {
    const candidate = path.resolve(this.rootDirectory, relativePath);
    const rootWithSeparator = `${this.rootDirectory}${path.sep}`;
    if (candidate !== this.rootDirectory && !candidate.startsWith(rootWithSeparator)) {
      throw new LocalDataStoreError("invalid_path", "Stored object path escaped the Stoix data directory.");
    }
    return candidate;
  }

  private initializeSchema() {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS durable_records (
        namespace TEXT NOT NULL,
        record_key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (namespace, record_key)
      );

      CREATE TABLE IF NOT EXISTS stored_blobs (
        digest TEXT PRIMARY KEY,
        relative_path TEXT NOT NULL UNIQUE,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stored_objects (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL,
        digest TEXT NOT NULL REFERENCES stored_blobs(digest),
        file_name TEXT NOT NULL,
        kind TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        verified_media_type TEXT,
        size_bytes INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_stored_objects_digest ON stored_objects(digest);
      CREATE INDEX IF NOT EXISTS idx_stored_objects_namespace ON stored_objects(namespace, created_at);

      CREATE TABLE IF NOT EXISTS message_links (
        session_id TEXT NOT NULL,
        client_message_id TEXT NOT NULL,
        hermes_message_id TEXT,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        content_digest TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (session_id, client_message_id)
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_message_links_hermes_message
        ON message_links(session_id, hermes_message_id)
        WHERE hermes_message_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS message_objects (
        session_id TEXT NOT NULL,
        client_message_id TEXT NOT NULL,
        object_id TEXT NOT NULL REFERENCES stored_objects(id),
        position INTEGER NOT NULL,
        PRIMARY KEY (session_id, client_message_id, object_id),
        FOREIGN KEY (session_id, client_message_id)
          REFERENCES message_links(session_id, client_message_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_message_objects_object ON message_objects(object_id);
    `);
  }

  private inTransaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

export class LocalDataStoreError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "LocalDataStoreError";
  }
}

export function getLocalDataStore(): LocalDataStore {
  const globals = globalThis as LocalDataStoreGlobal;
  globals.__stoixLocalDataStore ??= new LocalDataStore();
  return globals.__stoixLocalDataStore;
}

export function resolveStoixDataDirectory(
  environment: NodeJS.ProcessEnv = process.env,
  currentPlatform: NodeJS.Platform = process.platform,
  homeDirectory = homedir()
) {
  const platformPath = currentPlatform === "win32" ? path.win32 : path.posix;
  const explicit = environment[STOIX_DATA_DIR_ENV]?.trim();
  if (explicit) {
    return platformPath.resolve(explicit);
  }
  if (currentPlatform === "win32") {
    const localAppData = environment.LOCALAPPDATA?.trim() || platformPath.join(homeDirectory, "AppData", "Local");
    return platformPath.join(localAppData, "Stoix");
  }
  if (currentPlatform === "darwin") {
    return platformPath.join(homeDirectory, "Library", "Application Support", "Stoix");
  }
  const xdgDataHome = environment.XDG_DATA_HOME?.trim() || platformPath.join(homeDirectory, ".local", "share");
  return platformPath.join(xdgDataHome, "stoix");
}

export function manifestToMessageAttachment(manifest: StoredObjectManifest): StoredMessageAttachment {
  const baseUrl = `/api/attachments/${encodeURIComponent(manifest.id)}`;
  return {
    id: manifest.id,
    storageId: manifest.id,
    contentHash: manifest.digest,
    fileName: manifest.fileName,
    kind: manifest.kind,
    mimeType: manifest.mimeType,
    sizeBytes: manifest.sizeBytes,
    source: "local",
    previewUrl: manifest.kind === "image" && manifest.verifiedMediaType ? baseUrl : undefined,
    downloadUrl: `${baseUrl}?download=1`,
    status: "ready"
  };
}

export function isStoredObjectId(value: string) {
  return OBJECT_ID_PATTERN.test(value);
}

function objectRowToManifest(row: ObjectRow): StoredObjectManifest {
  return {
    id: row.id,
    namespace: row.namespace,
    digest: row.digest,
    fileName: row.file_name,
    kind: row.kind,
    mimeType: row.mime_type,
    verifiedMediaType: row.verified_media_type,
    sizeBytes: Number(row.size_bytes),
    createdAt: row.created_at
  };
}

function cleanNamespace(value: string) {
  const clean = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/.test(clean)) {
    throw new LocalDataStoreError("invalid_namespace", "Storage namespace is invalid.");
  }
  return clean;
}

function cleanRecordKey(value: string) {
  const clean = value.replace(/[\r\n\x00]/g, "").trim();
  if (!clean || clean.length > 512) {
    throw new LocalDataStoreError("invalid_key", "Storage record key is invalid.");
  }
  return clean;
}

function cleanLinkId(value: string, label: string) {
  const clean = value.replace(/[\r\n\x00]/g, "").trim();
  if (!clean || clean.length > 512) {
    throw new LocalDataStoreError("invalid_reference", `${label} is invalid.`);
  }
  return clean;
}

function cleanFileName(value: string) {
  const clean = value
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\r\n\x00]/g, "")
    .trim()
    .slice(0, 240);
  return clean || "attachment";
}

function cleanAttachmentKind(value: string) {
  const clean = value.trim().toLowerCase();
  return ALLOWED_ATTACHMENT_KINDS.has(clean) ? clean : "unknown";
}

function cleanMimeType(value: string) {
  const clean = value.split(";", 1)[0]?.trim().toLowerCase();
  return clean && /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(clean)
    ? clean.slice(0, 120)
    : "application/octet-stream";
}

function detectVerifiedImageMime(prefix: Buffer): string | null {
  if (prefix.length >= 8 && prefix.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (prefix.length >= 3 && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff) {
    return "image/jpeg";
  }
  const ascii = prefix.toString("ascii");
  if (ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a")) {
    return "image/gif";
  }
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") {
    return "image/webp";
  }
  if (ascii.startsWith("BM")) {
    return "image/bmp";
  }
  if (prefix.length >= 12 && ascii.slice(4, 8) === "ftyp" && /^(avif|avis)$/.test(ascii.slice(8, 12))) {
    return "image/avif";
  }
  return null;
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function mkdirSyncSafe(directory: string) {
  // DatabaseSync opens synchronously, so the small startup directory creation
  // must complete before its constructor. Avoid a dependency for this one call.
  mkdirSync(directory, { mode: 0o700, recursive: true });
  if (process.platform !== "win32") {
    chmodSync(directory, 0o700);
  }
}
