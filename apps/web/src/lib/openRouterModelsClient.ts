import type { OpenRouterModelCatalogResult } from "@hermes-ui/hermes-client";

export async function fetchOpenRouterModels(): Promise<OpenRouterModelCatalogResult> {
  try {
    const response = await fetch("/api/model-catalog/openrouter", {
      cache: "no-store"
    });
    const data = (await response.json().catch(() => null)) as OpenRouterModelCatalogResult | null;
    if (!response.ok || !data) {
      return {
        ok: false,
        models: [],
        checkedAt: new Date().toISOString(),
        source: "openrouter",
        error: {
          kind: "http_error",
          message: `OpenRouter catalog route returned HTTP ${response.status}.`
        }
      };
    }
    return data;
  } catch {
    return {
      ok: false,
      models: [],
      checkedAt: new Date().toISOString(),
      source: "openrouter",
      error: {
        kind: "network",
        message: "Could not reach the local OpenRouter catalog route."
      }
    };
  }
}
