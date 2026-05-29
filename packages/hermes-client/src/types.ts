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

export type HermesChatError = {
  kind:
    | "disabled"
    | "unconfigured"
    | "invalid_config"
    | "network"
    | "timeout"
    | "http_error"
    | "bad_response"
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

export type HermesChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

export type HermesChatContext = {
  project: {
    id: string;
    title: string;
    stableKey: string;
    tenantId: string;
    retrievalProfile: string;
    contextPolicy: string;
    pinnedMemoryIds?: string[];
    userVisibleSummary?: string;
  };
  session: {
    id: string;
    title: string;
    stableKey: string;
    hermesSessionId: string;
    includeProjectContext: boolean;
    includeSessionContext: boolean;
    lastContextRefreshAt?: string;
    userVisibleSummary?: string;
  };
  ui: {
    source: "hermes-ui";
    workspaceVersion: number;
  };
};

export type HermesChatRequest = {
  context: HermesChatContext;
  message: string;
  recentMessages?: HermesChatHistoryMessage[];
  model?: string | null;
  provider?: string | null;
};

export type HermesNormalizedMessage = {
  role: "assistant";
  content: string;
};

export type HermesChatStreamEvent =
  | {
      type: "message_delta";
      delta: string;
      messageId?: string;
      runId?: string;
    }
  | {
      type: "message_done";
      message: HermesNormalizedMessage;
      messageId?: string;
      runId?: string;
    }
  | {
      type: "tool_event";
      name: string;
      status: "started" | "completed" | "failed";
      payload: Record<string, unknown>;
    }
  | {
      type: "run_event";
      name: string;
      status: string;
      payload: Record<string, unknown>;
    }
  | {
      type: "error";
      error: HermesChatError;
    }
  | {
      type: "done";
    };

export type HermesChatStreamResult =
  | {
      ok: true;
      stream: ReadableStream<Uint8Array>;
      hermesSessionId: string;
    }
  | {
      ok: false;
      status: number;
      error: HermesChatError;
    };
