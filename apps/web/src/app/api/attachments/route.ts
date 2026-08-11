import { NextResponse } from "next/server";
import { isTrustedMutationRequest } from "@/lib/server/requestTrust";
import {
  getLocalDataStore,
  LocalDataStoreError,
  manifestToMessageAttachment
} from "@/server/localDataStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json(
      { ok: false, error: { kind: "forbidden", message: "Cross-origin uploads are not allowed." } },
      { status: 403 }
    );
  }
  if (!request.body) {
    return badRequest("Attachment body is required.");
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { ok: false, error: { kind: "too_large", message: "Attachment exceeds the 512 MB storage limit." } },
      { status: 413 }
    );
  }

  const url = new URL(request.url);
  const fileName = url.searchParams.get("name") ?? "attachment";
  const kind = url.searchParams.get("kind") ?? "unknown";
  const mimeType = request.headers.get("content-type") ?? "application/octet-stream";

  try {
    const manifest = await getLocalDataStore().storeObject({
      body: request.body,
      fileName,
      kind,
      mimeType,
      maxBytes: MAX_UPLOAD_BYTES
    });
    return NextResponse.json(
      { ok: true, attachment: manifestToMessageAttachment(manifest), error: null },
      { status: 201, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof LocalDataStoreError) {
      return NextResponse.json(
        { ok: false, error: { kind: error.code, message: error.message } },
        { status: error.code === "too_large" ? 413 : 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: { kind: "storage_error", message: "Stoix could not store the attachment." } },
      { status: 500 }
    );
  }
}

function badRequest(message: string) {
  return NextResponse.json(
    { ok: false, error: { kind: "invalid_attachment", message } },
    { status: 400 }
  );
}
