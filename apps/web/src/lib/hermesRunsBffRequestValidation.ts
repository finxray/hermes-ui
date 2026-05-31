import {
  HERMES_RUNS_BFF_AGENT_ACCESS_MODES,
  HERMES_RUNS_BFF_REQUEST_SCHEMA_VERSION,
  type HermesRunsBffAgentAccessMode,
  type HermesRunsBffMemoryScope,
  type HermesRunsBffRequest,
  type HermesRunsBffRequestOptions,
  type HermesRunsBffRequestValidationError,
  type HermesRunsBffRequestValidationResult
} from "@/types/hermesRunsBffRequest";

export const HERMES_RUNS_BFF_MAX_MESSAGE_CHARS = 8_000;
export const HERMES_RUNS_BFF_MAX_ID_CHARS = 256;
export const HERMES_RUNS_BFF_MAX_PINNED_MEMORY_IDS = 24;
export const HERMES_RUNS_BFF_MIN_TIMEOUT_MS = 1_000;
export const HERMES_RUNS_BFF_MAX_TIMEOUT_MS = 120_000;

const agentAccessModes = new Set<string>(HERMES_RUNS_BFF_AGENT_ACCESS_MODES);
const forbiddenCredentialKeyPattern =
  /^(api[-_]?key|authorization|bearer|client[-_]?secret|password|secret|service[-_]?token|token)$/i;
const forbiddenCredentialValuePattern = /\bBearer\s+[A-Za-z0-9._~+/=-]+/i;

export function validateHermesRunsBffRequest(input: unknown): HermesRunsBffRequestValidationResult {
  const errors: HermesRunsBffRequestValidationError[] = [];

  if (!isRecord(input)) {
    return failure([error("invalid_body", "$", "Request body must be a JSON object.")]);
  }

  collectForbiddenCredentialFields(input, "$", errors);

  const projectId = cleanString(input.projectId, HERMES_RUNS_BFF_MAX_ID_CHARS);
  const sessionId = cleanString(input.sessionId, HERMES_RUNS_BFF_MAX_ID_CHARS);
  const message = cleanMessage(input.message);
  const memoryScope = readMemoryScope(input.memoryScope, errors);
  const options = readOptions(input.options, errors);
  const agentAccessMode = readAgentAccessMode(input.agentAccessMode, errors);

  if (!projectId) {
    errors.push(error("missing_project_id", "$.projectId", "projectId is required."));
  }
  if (!sessionId) {
    errors.push(error("missing_session_id", "$.sessionId", "sessionId is required."));
  }
  if (!message) {
    errors.push(error("missing_message", "$.message", "message is required."));
  } else if (message.length > HERMES_RUNS_BFF_MAX_MESSAGE_CHARS) {
    errors.push(error("message_too_large", "$.message", "message exceeds the disabled Runs BFF contract limit."));
  }

  if (errors.length > 0 || !memoryScope) {
    return failure(errors);
  }

  return {
    futureFields: {
      agentAccessMode: "metadata_only",
      model: "inert_until_client_selectable",
      provider: "inert_until_supported"
    },
    ok: true,
    request: {
      agentAccessMode,
      clientRunId: cleanOptionalString(input.clientRunId, HERMES_RUNS_BFF_MAX_ID_CHARS),
      hermesSessionId: cleanOptionalString(input.hermesSessionId, HERMES_RUNS_BFF_MAX_ID_CHARS),
      memoryScope,
      message,
      model: cleanOptionalString(input.model, 128),
      options,
      projectId,
      provider: cleanOptionalString(input.provider, 128),
      sessionId
    },
    schemaVersion: HERMES_RUNS_BFF_REQUEST_SCHEMA_VERSION
  };
}

function readMemoryScope(
  value: unknown,
  errors: HermesRunsBffRequestValidationError[]
): HermesRunsBffMemoryScope | null {
  if (!isRecord(value)) {
    errors.push(error("missing_memory_scope", "$.memoryScope", "memoryScope is required."));
    return null;
  }

  const tenantId = cleanString(value.tenantId, HERMES_RUNS_BFF_MAX_ID_CHARS);
  const stableProjectKey = cleanString(value.stableProjectKey, HERMES_RUNS_BFF_MAX_ID_CHARS);
  const stableSessionKey = cleanString(value.stableSessionKey, HERMES_RUNS_BFF_MAX_ID_CHARS);
  const includeProjectContext = value.includeProjectContext;
  const includeSessionContext = value.includeSessionContext;

  if (!tenantId) {
    errors.push(error("missing_tenant_id", "$.memoryScope.tenantId", "memoryScope.tenantId is required."));
  }
  if (!stableProjectKey) {
    errors.push(
      error("missing_stable_project_key", "$.memoryScope.stableProjectKey", "memoryScope.stableProjectKey is required.")
    );
  }
  if (!stableSessionKey) {
    errors.push(
      error("missing_stable_session_key", "$.memoryScope.stableSessionKey", "memoryScope.stableSessionKey is required.")
    );
  }
  if (typeof includeProjectContext !== "boolean" || typeof includeSessionContext !== "boolean") {
    errors.push(
      error(
        "invalid_memory_scope_flags",
        "$.memoryScope",
        "memoryScope includeProjectContext and includeSessionContext must be booleans."
      )
    );
  }

  return {
    contextPolicy: readEnum(value.contextPolicy, ["project_and_session", "project_only", "session_only"]),
    includeProjectContext: includeProjectContext === true,
    includeSessionContext: includeSessionContext === true,
    pinnedMemoryIds: readStringArray(value.pinnedMemoryIds, HERMES_RUNS_BFF_MAX_PINNED_MEMORY_IDS),
    retrievalProfile: readEnum(value.retrievalProfile, ["default", "focused", "broad"]),
    stableProjectKey,
    stableSessionKey,
    tenantId
  };
}

function readOptions(
  value: unknown,
  errors: HermesRunsBffRequestValidationError[]
): HermesRunsBffRequestOptions | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    errors.push(error("invalid_options", "$.options", "options must be an object when provided."));
    return undefined;
  }

  const timeoutMs = Number(value.timeoutMs);
  if (
    value.timeoutMs !== undefined &&
    (!Number.isInteger(timeoutMs) ||
      timeoutMs < HERMES_RUNS_BFF_MIN_TIMEOUT_MS ||
      timeoutMs > HERMES_RUNS_BFF_MAX_TIMEOUT_MS)
  ) {
    errors.push(error("timeout_out_of_range", "$.options.timeoutMs", "timeoutMs is outside the allowed dry-run range."));
  }

  return {
    includeActivity: typeof value.includeActivity === "boolean" ? value.includeActivity : undefined,
    includeReplayPreview: typeof value.includeReplayPreview === "boolean" ? value.includeReplayPreview : undefined,
    stream: typeof value.stream === "boolean" ? value.stream : undefined,
    timeoutMs: value.timeoutMs === undefined || !Number.isInteger(timeoutMs) ? undefined : timeoutMs
  };
}

function readAgentAccessMode(
  value: unknown,
  errors: HermesRunsBffRequestValidationError[]
): HermesRunsBffAgentAccessMode | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string" && agentAccessModes.has(value)) {
    return value as HermesRunsBffAgentAccessMode;
  }
  errors.push(
    error("invalid_agent_access_mode", "$.agentAccessMode", "agentAccessMode must be a known future policy value.")
  );
  return undefined;
}

function collectForbiddenCredentialFields(
  value: unknown,
  path: string,
  errors: HermesRunsBffRequestValidationError[]
) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenCredentialFields(item, `${path}[${index}]`, errors));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === "string" && forbiddenCredentialValuePattern.test(value)) {
      errors.push(error("forbidden_credential_field", path, "Request must not include bearer-style credential values."));
    }
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = `${path}.${key}`;
    if (forbiddenCredentialKeyPattern.test(key)) {
      errors.push(error("forbidden_credential_field", nestedPath, "Request must not include credential-like fields."));
    }
    collectForbiddenCredentialFields(nestedValue, nestedPath, errors);
  }
}

function failure(errors: HermesRunsBffRequestValidationError[]): HermesRunsBffRequestValidationResult {
  return {
    errors,
    ok: false,
    schemaVersion: HERMES_RUNS_BFF_REQUEST_SCHEMA_VERSION
  };
}

function error(
  kind: HermesRunsBffRequestValidationError["kind"],
  path: string,
  message: string
): HermesRunsBffRequestValidationError {
  return { kind, message, path };
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(/[\r\n\x00]/g, " ").trim().slice(0, maxLength) : "";
}

function cleanMessage(value: unknown): string {
  return typeof value === "string" ? value.replace(/\x00/g, "").trim() : "";
}

function cleanOptionalString(value: unknown, maxLength: number): string | undefined {
  const cleaned = cleanString(value, maxLength);
  return cleaned || undefined;
}

function readStringArray(value: unknown, maxItems: number): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items = value
    .map((item) => cleanString(item, HERMES_RUNS_BFF_MAX_ID_CHARS))
    .filter(Boolean)
    .slice(0, maxItems);
  return items.length > 0 ? items : undefined;
}

function readEnum<TValue extends string>(value: unknown, allowed: TValue[]): TValue | undefined {
  return typeof value === "string" && (allowed as string[]).includes(value) ? (value as TValue) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
