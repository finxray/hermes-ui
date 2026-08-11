import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { isTrustedMutationRequest } from "@/lib/server/requestTrust";
import { getLocalDataStore, isStoredObjectId } from "@/server/localDataStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!isStoredObjectId(id)) {
    return NextResponse.json({ ok: false, error: { kind: "not_found", message: "Attachment was not found." } }, { status: 404 });
  }
  const stored = getLocalDataStore().getObjectFile(id);
  if (!stored) {
    return NextResponse.json({ ok: false, error: { kind: "not_found", message: "Attachment was not found." } }, { status: 404 });
  }

  try {
    const fileStat = await stat(stored.path);
    const download = new URL(request.url).searchParams.get("download") === "1";
    const safeInline = Boolean(stored.manifest.verifiedMediaType) && !download;
    const mediaType = safeInline
      ? stored.manifest.verifiedMediaType ?? "application/octet-stream"
      : stored.manifest.mimeType;
    const disposition = safeInline ? "inline" : "attachment";
    const body = Readable.toWeb(createReadStream(stored.path)) as ReadableStream<Uint8Array>;
    return new Response(body, {
      headers: {
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(stored.manifest.fileName)}`,
        "Content-Length": String(fileStat.size),
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Type": mediaType,
        ETag: `"sha256-${stored.manifest.digest}"`,
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: { kind: "storage_error", message: "Attachment bytes are unavailable." } },
      { status: 410 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json(
      { ok: false, error: { kind: "forbidden", message: "Cross-origin mutations are not allowed." } },
      { status: 403 }
    );
  }
  const { id } = await params;
  if (!isStoredObjectId(id)) {
    return NextResponse.json({ ok: true, deleted: false, error: null });
  }
  const deleted = await getLocalDataStore().deleteObjectIfUnreferenced(id);
  return NextResponse.json({ ok: true, deleted, error: null }, { headers: { "Cache-Control": "no-store" } });
}
