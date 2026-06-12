import type { BrainMemoryClientConfig } from "@hermes-ui/brain-memory-client";

const DEFAULT_READ_TIMEOUT_MS = 7_500;

/**
 * Single source of truth for Brain Memory Gateway configuration in the BFF.
 * Only route handlers (server-side) may import this module; the browser never
 * sees these env values.
 */
export function resolveBrainMemoryGatewayConfig(options?: {
  timeoutMs?: number;
}): BrainMemoryClientConfig {
  return {
    baseUrl: process.env.BRAIN_MEMORY_GATEWAY_URL,
    enabled: process.env.BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY === "true",
    gatewayMemoryApiKey: process.env.BRAIN_MEMORY_GATEWAY_MEMORY_API_KEY,
    legacyApiKey: process.env.BRAIN_MEMORY_API_KEY,
    timeoutMs: options?.timeoutMs ?? DEFAULT_READ_TIMEOUT_MS,
    uiApiKey: process.env.BRAIN_MEMORY_UI_API_KEY
  };
}
