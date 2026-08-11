import { getHermesSessionMessages } from "@hermes-ui/hermes-client";
import { NextResponse } from "next/server";
import { resolveHermesClientConfig } from "@/server/hermesClientConfig";
import { getLocalDataStore } from "@/server/localDataStore";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ ok: false, error: { kind: "invalid_config", message: "Session id is required." } }, { status: 400 });
  }

  const config = await resolveHermesClientConfig({ timeoutMs: 8000 });
  const result = await getHermesSessionMessages(
    config,
    id
  );

  if (!result.ok) {
    return NextResponse.json(result, { status: 502 });
  }

  const attachmentsByMessage = getLocalDataStore().getMessageAttachments(id, result.messages);
  const messages = result.messages.map((message) => ({
    ...message,
    attachments: attachmentsByMessage.get(message.id)
  }));

  return NextResponse.json({ ...result, messages }, {
    headers: { "Cache-Control": "no-store" }
  });
}
