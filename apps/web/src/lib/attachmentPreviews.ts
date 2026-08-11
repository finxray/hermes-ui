import type { ChatAttachment } from "@/data/types";

export function removeTransientAttachmentPreviews(
  attachments: ChatAttachment[] | undefined
): ChatAttachment[] | undefined {
  if (!attachments) {
    return attachments;
  }

  return attachments.map((attachment) => {
    if (attachment.storageId) {
      return {
        ...attachment,
        downloadUrl: attachment.downloadUrl ?? `/api/attachments/${encodeURIComponent(attachment.storageId)}?download=1`,
        previewUrl: attachment.previewUrl,
        status: "ready"
      };
    }
    if (attachment.previewUrl?.startsWith("blob:")) {
      return { ...attachment, previewUrl: undefined, status: "unavailable" };
    }
    if (attachment.kind === "image" && !attachment.previewUrl && attachment.status !== "too-large") {
      return { ...attachment, status: "unavailable" };
    }
    return attachment;
  });
}
