export type HermesStatusMode = "real" | "mock" | "unconfigured" | "error";

export type HermesStatusError = {
  kind:
    | "disabled"
    | "unconfigured"
    | "invalid_config"
    | "network"
    | "timeout"
    | "http_error"
    | "unknown";
  message: string;
};

export type NormalizedHermesStatus = {
  mode: HermesStatusMode;
  configured: boolean;
  reachable: boolean;
  baseUrl: string | null;
  capabilities: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  models: Record<string, unknown> | null;
  error: HermesStatusError | null;
  checkedAt: string;
};

export type HermesClientConfig = {
  baseUrl?: string | null;
  apiKey?: string | null;
  enabled?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

export type HermesEndpointName = "health" | "healthDetailed" | "capabilities" | "models";

export type HermesEndpointResult = {
  name: HermesEndpointName;
  ok: boolean;
  status: number | null;
  data: Record<string, unknown> | null;
  error: HermesStatusError | null;
};
