import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const {
  LocalDataStore,
  manifestToMessageAttachment,
  resolveStoixDataDirectory
} = await import("../apps/web/src/server/localDataStore.ts");

assert.equal(
  resolveStoixDataDirectory({ LOCALAPPDATA: "C:\\Users\\Test\\AppData\\Local" }, "win32", "C:\\Users\\Test"),
  "C:\\Users\\Test\\AppData\\Local\\Stoix"
);
assert.equal(
  resolveStoixDataDirectory({}, "darwin", "/Users/test"),
  "/Users/test/Library/Application Support/Stoix"
);
assert.equal(
  resolveStoixDataDirectory({ XDG_DATA_HOME: "/var/test-data" }, "linux", "/home/test"),
  "/var/test-data/stoix"
);

const root = await mkdtemp(path.join(tmpdir(), "stoix-data-store-"));
const store = new LocalDataStore(root);

try {
  if (process.platform !== "win32") {
    assert.equal((await stat(root)).mode & 0o777, 0o700);
    assert.equal((await stat(path.join(root, "stoix.sqlite3"))).mode & 0o777, 0o600);
  }
  store.putRecord("test.records", "portable", { durable: true });
  assert.deepEqual(store.getRecord("test.records", "portable"), { durable: true });

  const png = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10,
    0, 0, 0, 13, 73, 72, 68, 82,
    0, 0, 0, 1, 0, 0, 0, 1
  ]);
  const first = await store.storeObject({
    body: bytesStream(png),
    fileName: "capture.png",
    kind: "image",
    mimeType: "image/png"
  });
  const duplicate = await store.storeObject({
    body: bytesStream(png),
    fileName: "copy.png",
    kind: "image",
    mimeType: "image/png"
  });

  assert.notEqual(first.id, duplicate.id);
  assert.equal(first.digest, duplicate.digest);
  assert.equal(first.verifiedMediaType, "image/png");
  const digestDirectory = path.join(root, "objects", first.digest.slice(0, 2));
  assert.deepEqual(await readdir(digestDirectory), [first.digest]);

  store.linkMessageObjects({
    sessionId: "session-1",
    clientMessageId: "client-1",
    content: "hello",
    objectIds: [first.id]
  });
  const attachments = store.getMessageAttachments("session-1", [
    { id: "42", role: "user", content: "hello", createdAt: new Date().toISOString() }
  ]);
  assert.equal(attachments.get("42")?.[0]?.storageId, first.id);
  assert.equal(attachments.get("42")?.[0]?.previewUrl, `/api/attachments/${first.id}`);
  assert.equal(await store.deleteObjectIfUnreferenced(first.id), false);
  assert.equal(await store.deleteObjectIfUnreferenced(duplicate.id), true);
  await store.deleteSessionMessageLinks("session-1");
  assert.equal(store.getObject(first.id), null);

  const longMessage = "long attachment prompt ".repeat(600);
  const longMessageObject = await store.storeObject({
    body: bytesStream(png),
    fileName: "long.png",
    kind: "image",
    mimeType: "image/png"
  });
  store.linkMessageObjects({
    sessionId: "session-long",
    clientMessageId: "client-long",
    content: longMessage,
    objectIds: [longMessageObject.id]
  });
  const longAttachments = store.getMessageAttachments("session-long", [
    { id: "long-hermes-message", role: "user", content: longMessage }
  ]);
  assert.equal(longAttachments.get("long-hermes-message")?.[0]?.storageId, longMessageObject.id);

  const unverifiedImage = await store.storeObject({
    body: bytesStream(new TextEncoder().encode("<svg onload='alert(1)'></svg>")),
    fileName: "not-really-an-image.svg",
    kind: "image",
    mimeType: "image/svg+xml"
  });
  assert.equal(unverifiedImage.verifiedMediaType, null);
  assert.equal(manifestToMessageAttachment(unverifiedImage).previewUrl, undefined);

  const linkRoute = await readFile(
    path.resolve("apps/web/src/app/api/attachments/link/route.ts"),
    "utf8"
  );
  assert(!linkRoute.includes(".slice(0, 8_000)"));
  assert(linkRoute.includes("MAX_LINKED_ATTACHMENTS"));

  const previewHelpers = await readFile(
    path.resolve("apps/web/src/lib/attachmentPreviews.ts"),
    "utf8"
  );
  const messageBubble = (await readFile(
    path.resolve("apps/web/src/components/chat/MessageBubble.tsx"),
    "utf8"
  )).replaceAll("\r\n", "\n");
  const streamRoute = (await readFile(
    path.resolve("apps/web/src/app/api/hermes/chat/stream/route.ts"),
    "utf8"
  )).replaceAll("\r\n", "\n");
  assert(!previewHelpers.includes('previewUrl ?? `/api/attachments/${encodeURIComponent(attachment.storageId)}`'));
  assert(!messageBubble.includes('attachment.storageId\n      ? `/api/attachments/'));
  assert(streamRoute.includes("if (!dataUrl) {\n      continue;\n    }"));
} finally {
  store.close();
  await rm(root, { recursive: true, force: true });
}

console.log("Local durable-data store checks passed.");

function bytesStream(bytes) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    }
  });
}
