import type { HermesRunsBffRequest, HermesRunsBffRequestValidationErrorKind } from "@/types/hermesRunsBffRequest";
import { HERMES_RUNS_BFF_MAX_MESSAGE_CHARS } from "@/lib/hermesRunsBffRequestValidation";

export const hermesRunsBffRequestFixtureProjectId = "project-runs-bff-16q";
export const hermesRunsBffRequestFixtureSessionId = "session-runs-bff-16q";

export const hermesRunsBffValidMinimalRequest = {
  projectId: hermesRunsBffRequestFixtureProjectId,
  sessionId: hermesRunsBffRequestFixtureSessionId,
  message: "Validate the disabled Runs request contract.",
  memoryScope: {
    tenantId: "local-dev",
    stableProjectKey: "project-stable-runs-bff-16q",
    stableSessionKey: "session-stable-runs-bff-16q",
    includeProjectContext: true,
    includeSessionContext: true
  }
} satisfies HermesRunsBffRequest;

export const hermesRunsBffValidAgentAccessRequest = {
  ...hermesRunsBffValidMinimalRequest,
  agentAccessMode: "ask_before_tools",
  clientRunId: "client-run-runs-bff-16q",
  hermesSessionId: "hermes-session-runs-bff-16q",
  options: {
    includeActivity: true,
    includeReplayPreview: true,
    stream: true,
    timeoutMs: 30_000
  }
} satisfies HermesRunsBffRequest;

export const hermesRunsBffProviderModelFutureRequest = {
  ...hermesRunsBffValidMinimalRequest,
  model: "future-model-disabled",
  provider: "future-provider-disabled"
} satisfies HermesRunsBffRequest;

export const hermesRunsBffInvalidRequestFixtures: Array<{
  expectedKinds: HermesRunsBffRequestValidationErrorKind[];
  name: string;
  request: unknown;
}> = [
  {
    expectedKinds: ["missing_project_id"],
    name: "missing-project-id",
    request: {
      ...hermesRunsBffValidMinimalRequest,
      projectId: ""
    }
  },
  {
    expectedKinds: ["missing_memory_scope"],
    name: "missing-memory-scope",
    request: {
      projectId: hermesRunsBffRequestFixtureProjectId,
      sessionId: hermesRunsBffRequestFixtureSessionId,
      message: "Missing memory scope."
    }
  },
  {
    expectedKinds: ["invalid_agent_access_mode"],
    name: "invalid-agent-access-mode",
    request: {
      ...hermesRunsBffValidMinimalRequest,
      agentAccessMode: "unbounded_runtime_access"
    }
  },
  {
    expectedKinds: ["message_too_large"],
    name: "oversized-message",
    request: {
      ...hermesRunsBffValidMinimalRequest,
      message: "x".repeat(HERMES_RUNS_BFF_MAX_MESSAGE_CHARS + 1)
    }
  },
  {
    expectedKinds: ["forbidden_credential_field"],
    name: "forbidden-credential-field",
    request: {
      ...hermesRunsBffValidMinimalRequest,
      apiKey: "fixture-credential-value"
    }
  },
  {
    expectedKinds: ["timeout_out_of_range"],
    name: "timeout-out-of-range",
    request: {
      ...hermesRunsBffValidMinimalRequest,
      options: {
        timeoutMs: 999_999
      }
    }
  },
  {
    expectedKinds: ["invalid_memory_scope_flags"],
    name: "invalid-memory-scope-flags",
    request: {
      ...hermesRunsBffValidMinimalRequest,
      memoryScope: {
        ...hermesRunsBffValidMinimalRequest.memoryScope,
        includeProjectContext: "yes"
      }
    }
  }
];

export const hermesRunsBffValidRequestFixtures = [
  hermesRunsBffValidMinimalRequest,
  hermesRunsBffValidAgentAccessRequest,
  hermesRunsBffProviderModelFutureRequest
];
