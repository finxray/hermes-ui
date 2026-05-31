export const HERMES_RUNS_BFF_REQUEST_SCHEMA_VERSION = "hermes-runs-bff-request.v1";

export const HERMES_RUNS_BFF_AGENT_ACCESS_MODES = [
  "chat_only",
  "read_only_tools",
  "ask_before_tools",
  "full_access",
  "custom"
] as const;

export type HermesRunsBffRequestSchemaVersion = typeof HERMES_RUNS_BFF_REQUEST_SCHEMA_VERSION;

export type HermesRunsBffAgentAccessMode = (typeof HERMES_RUNS_BFF_AGENT_ACCESS_MODES)[number];

export type HermesRunsBffMemoryScope = {
  tenantId: string;
  stableProjectKey: string;
  stableSessionKey: string;
  includeProjectContext: boolean;
  includeSessionContext: boolean;
  retrievalProfile?: "default" | "focused" | "broad";
  contextPolicy?: "project_and_session" | "project_only" | "session_only";
  pinnedMemoryIds?: string[];
};

export type HermesRunsBffRequestOptions = {
  stream?: boolean;
  includeActivity?: boolean;
  includeReplayPreview?: boolean;
  timeoutMs?: number;
};

export type HermesRunsBffRequest = {
  projectId: string;
  sessionId: string;
  message: string;
  memoryScope: HermesRunsBffMemoryScope;
  hermesSessionId?: string;
  clientRunId?: string;
  agentAccessMode?: HermesRunsBffAgentAccessMode;
  model?: string;
  provider?: string;
  options?: HermesRunsBffRequestOptions;
};

export type HermesRunsBffRequestValidationErrorKind =
  | "invalid_body"
  | "missing_project_id"
  | "missing_session_id"
  | "missing_message"
  | "message_too_large"
  | "missing_memory_scope"
  | "missing_tenant_id"
  | "missing_stable_project_key"
  | "missing_stable_session_key"
  | "invalid_memory_scope_flags"
  | "invalid_agent_access_mode"
  | "invalid_options"
  | "timeout_out_of_range"
  | "forbidden_credential_field";

export type HermesRunsBffRequestValidationError = {
  kind: HermesRunsBffRequestValidationErrorKind;
  path: string;
  message: string;
};

export type HermesRunsBffRequestValidationResult =
  | {
      ok: true;
      request: HermesRunsBffRequest;
      schemaVersion: HermesRunsBffRequestSchemaVersion;
      futureFields: {
        agentAccessMode: "metadata_only";
        model: "inert_until_client_selectable";
        provider: "inert_until_supported";
      };
    }
  | {
      ok: false;
      errors: HermesRunsBffRequestValidationError[];
      schemaVersion: HermesRunsBffRequestSchemaVersion;
    };
