import type { HermesSessionListResult, HermesSessionMessagesResult, HermesSessionDeleteResult } from "@hermes-ui/hermes-client";

export async function fetchHermesSessions(): Promise<HermesSessionListResult> {
  try {
    const response = await fetch("/api/hermes/sessions", { cache: "no-store" });
    const data = await response.json() as HermesSessionListResult;
    return data;
  } catch {
    return { ok: false, sessions: [], error: { kind: "network", message: "Could not load Hermes sessions." } };
  }
}

export async function fetchHermesSessionMessages(sessionId: string): Promise<HermesSessionMessagesResult> {
  try {
    const response = await fetch(`/api/hermes/sessions/${encodeURIComponent(sessionId)}/messages`, { cache: "no-store" });
    const data = await response.json() as HermesSessionMessagesResult;
    return data;
  } catch {
    return { ok: false, messages: [], sessionId, error: { kind: "network", message: "Could not load session messages." } };
  }
}

export async function deleteHermesSessionBff(sessionId: string): Promise<HermesSessionDeleteResult> {
  try {
    const response = await fetch(`/api/hermes/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      cache: "no-store"
    });
    const data = await response.json() as HermesSessionDeleteResult;
    return data;
  } catch {
    return { ok: false, error: { kind: "network", message: "Could not delete Hermes session." } };
  }
}
