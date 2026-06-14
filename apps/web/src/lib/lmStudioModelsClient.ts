import type { LmStudioModelCatalogResult } from "@hermes-ui/hermes-client";

export async function fetchLmStudioModels(): Promise<LmStudioModelCatalogResult> {
  try {
    const response = await fetch("/api/model-catalog/lmstudio", {
      cache: "no-store"
    });
    const data = (await response.json().catch(() => null)) as LmStudioModelCatalogResult | null;
    if (!response.ok || !data) {
      return {
        ok: false,
        models: [],
        checkedAt: new Date().toISOString(),
        source: "lmstudio",
        error: {
          kind: "http_error",
          message: `LM Studio catalog route returned HTTP ${response.status}.`
        }
      };
    }
    return data;
  } catch {
    return {
      ok: false,
      models: [],
      checkedAt: new Date().toISOString(),
      source: "lmstudio",
      error: {
        kind: "network",
        message: "Could not reach the local LM Studio catalog route."
      }
    };
  }
}
