import type { ChatAttachment, ChatAttachmentKind } from "@/data/types";

type UploadResult =
  | { ok: true; attachment: ChatAttachment; error: null }
  | { ok: false; error: { kind: string; message: string } };

export async function uploadAttachmentToVault(
  file: File,
  kind: ChatAttachmentKind
): Promise<ChatAttachment> {
  const query = new URLSearchParams({ name: file.name || fallbackAttachmentName(kind), kind });
  const response = await fetch(`/api/attachments?${query.toString()}`, {
    body: file,
    cache: "no-store",
    headers: { "Content-Type": file.type || fallbackMimeType(kind) },
    method: "POST"
  });
  const result = await response.json() as UploadResult;
  if (!response.ok || !result.ok) {
    throw new Error(result.ok ? "Stoix could not store the attachment." : result.error.message);
  }
  return result.attachment;
}

export async function uploadDataPreviewToVault(
  previewUrl: string,
  fileName: string,
  kind: ChatAttachmentKind
) {
  const response = await fetch(previewUrl);
  if (!response.ok) {
    throw new Error("Stored browser preview is no longer readable.");
  }
  const blob = await response.blob();
  return uploadAttachmentToVault(
    new File([blob], fileName || fallbackAttachmentName(kind), {
      type: blob.type || fallbackMimeType(kind)
    }),
    kind
  );
}

export async function linkVaultAttachmentsToMessage(input: {
  sessionId: string;
  clientMessageId: string;
  content: string;
  objectIds: string[];
}) {
  const response = await fetch("/api/attachments/link", {
    body: JSON.stringify(input),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(result?.error?.message || "Stoix could not link the stored attachments.");
  }
}

export async function deleteUnreferencedVaultAttachment(storageId: string) {
  await fetch(`/api/attachments/${encodeURIComponent(storageId)}`, {
    cache: "no-store",
    method: "DELETE"
  }).catch(() => undefined);
}

function fallbackAttachmentName(kind: ChatAttachmentKind) {
  return kind === "image" ? "pasted-image.png" : "attached-file";
}

function fallbackMimeType(kind: ChatAttachmentKind) {
  if (kind === "image") return "image/png";
  if (kind === "pdf") return "application/pdf";
  if (kind === "text" || kind === "code") return "text/plain";
  return "application/octet-stream";
}
