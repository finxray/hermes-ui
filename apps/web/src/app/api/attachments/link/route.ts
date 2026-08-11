import { NextResponse } from "next/server";
import { isTrustedMutationRequest } from "@/lib/server/requestTrust";
import { getLocalDataStore, LocalDataStoreError } from "@/server/localDataStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_LINKED_ATTACHMENTS = 20;
const MAX_MESSAGE_CHARS = 8_000_000;

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json(
      { ok: false, error: { kind: "forbidden", message: "Cross-origin mutations are not allowed." } },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("Attachment link body must be valid JSON.");
  }
  const input = readObject(body);
  const sessionId = cleanString(input?.sessionId, 512);
  const clientMessageId = cleanString(input?.clientMessageId, 512);
  const content = typeof input?.content === "string" ? input.content : "";
  const rawObjectIds = Array.isArray(input?.objectIds) ? input.objectIds : [];
  const objectIds = rawObjectIds.map((value) => cleanString(value, 128));
  if (!sessionId || !clientMessageId || objectIds.length === 0 || objectIds.some((id) => !id)) {
    return badRequest("Session, client message, and stored attachment ids are required.");
  }
  if (content.length > MAX_MESSAGE_CHARS) {
    return badRequest("The message is too large to link local attachments safely.");
  }
  if (objectIds.length > MAX_LINKED_ATTACHMENTS) {
    return badRequest(`A message can link up to ${MAX_LINKED_ATTACHMENTS} attachments.`);
  }

  try {
    getLocalDataStore().linkMessageObjects({ sessionId, clientMessageId, content, objectIds });
    return NextResponse.json({ ok: true, error: null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LocalDataStoreError) {
      return NextResponse.json(
        { ok: false, error: { kind: error.code, message: error.message } },
        { status: error.code === "missing_object" ? 404 : 400 }
      );
    }
    return NextResponse.json(
      { ok: false, error: { kind: "storage_error", message: "Stoix could not link the attachments." } },
      { status: 500 }
    );
  }
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function cleanString(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.replace(/[\r\n\x00]/g, "").trim().slice(0, maxLength)
    : "";
}

function badRequest(message: string) {
  return NextResponse.json(
    { ok: false, error: { kind: "invalid_attachment_link", message } },
    { status: 400 }
  );
}
