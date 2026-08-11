import type { HermesChatContext } from "@hermes-ui/hermes-client";

export type GenerateChatTitleRequest = {
  context: HermesChatContext;
  message: string;
  model?: string | null;
  provider?: string | null;
};

export async function generateChatTitleFromBff(
  request: GenerateChatTitleRequest
): Promise<string | null> {
  try {
    const response = await fetch("/api/hermes/chat/title", {
      body: JSON.stringify(request),
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return null;
    }
    const title = (body as { title?: unknown }).title;
    return typeof title === "string" && title.trim() ? title.trim() : null;
  } catch {
    return null;
  }
}
