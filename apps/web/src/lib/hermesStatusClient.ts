import { normalizeHermesUiCapabilities } from "@hermes-ui/hermes-client";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";

export async function fetchHermesStatus(): Promise<NormalizedHermesStatus> {
  try {
    const response = await fetch("/api/hermes/status", {
      cache: "no-store"
    });

    if (!response.ok) {
      return withUiCapabilities({
        mode: "error",
        configured: false,
        reachable: false,
        baseUrl: null,
        capabilities: null,
        health: null,
        models: null,
        error: {
          kind: "http_error",
          message: `Hermes status route returned HTTP ${response.status}.`
        },
        checkedAt: new Date().toISOString()
      });
    }

    return (await response.json()) as NormalizedHermesStatus;
  } catch {
    return withUiCapabilities({
      mode: "error",
      configured: false,
      reachable: false,
      baseUrl: null,
      capabilities: null,
      health: null,
      models: null,
      error: {
        kind: "network",
        message: "Could not reach the local Hermes status route."
      },
      checkedAt: new Date().toISOString()
    });
  }
}

function withUiCapabilities(
  status: Omit<NormalizedHermesStatus, "uiCapabilities">
): NormalizedHermesStatus {
  return {
    ...status,
    uiCapabilities: normalizeHermesUiCapabilities(status)
  };
}
