import {
  HERMES_RUNS_BFF_LIFECYCLE_STAGES,
  type HermesRunsBffLifecycleDryRunKind,
  type HermesRunsBffLifecycleStage
} from "@/lib/hermesRunsBffLifecycleDryRun";
import type { HermesRunsBffRequestValidationErrorKind } from "@/types/hermesRunsBffRequest";
import {
  hermesRunsBffValidMinimalRequest,
  hermesRunsBffValidAgentAccessRequest
} from "./hermesRunsBffRequestFixtures";

export type HermesRunsBffLifecycleFixture = {
  name: string;
  lifecycleKind: HermesRunsBffLifecycleDryRunKind;
  request: unknown;
  expectedValidationOk: boolean;
  expectedErrorKinds: HermesRunsBffRequestValidationErrorKind[];
  expectedRequiredStages: HermesRunsBffLifecycleStage[];
  expectedRuntimeExecuted: false;
};

export const hermesRunsBffValidChatOnlyLifecycleDryRun = {
  expectedErrorKinds: [],
  expectedRequiredStages: [
    "validate_request",
    "validate_scope",
    "validate_agent_access_policy",
    "prepare_context",
    "create_run",
    "stream_or_poll_events",
    "normalize_event",
    "update_run_record",
    "update_activity_replay",
    "finalize_run",
    "emit_done"
  ],
  expectedRuntimeExecuted: false,
  expectedValidationOk: true,
  lifecycleKind: "chat",
  name: "valid-chat-only-lifecycle-dry-run",
  request: {
    ...hermesRunsBffValidMinimalRequest,
    agentAccessMode: "chat_only"
  }
} satisfies HermesRunsBffLifecycleFixture;

export const hermesRunsBffValidAskBeforeToolsLifecycleDryRun = {
  expectedErrorKinds: [],
  expectedRequiredStages: [
    "validate_request",
    "validate_scope",
    "validate_agent_access_policy",
    "prepare_context",
    "create_run",
    "stream_or_poll_events",
    "normalize_event",
    "update_run_record",
    "update_activity_replay",
    "finalize_run",
    "emit_done"
  ],
  expectedRuntimeExecuted: false,
  expectedValidationOk: true,
  lifecycleKind: "chat",
  name: "valid-ask-before-tools-lifecycle-dry-run",
  request: hermesRunsBffValidAgentAccessRequest
} satisfies HermesRunsBffLifecycleFixture;

export const hermesRunsBffInvalidMissingScopeLifecycleDryRun = {
  expectedErrorKinds: ["missing_memory_scope"],
  expectedRequiredStages: ["validate_request", "emit_error"],
  expectedRuntimeExecuted: false,
  expectedValidationOk: false,
  lifecycleKind: "error",
  name: "invalid-missing-scope-lifecycle-dry-run",
  request: {
    projectId: "project-runs-lifecycle-16t",
    sessionId: "session-runs-lifecycle-16t",
    message: "Missing scope dry run."
  }
} satisfies HermesRunsBffLifecycleFixture;

export const hermesRunsBffInvalidAgentAccessLifecycleDryRun = {
  expectedErrorKinds: ["invalid_agent_access_mode"],
  expectedRequiredStages: ["validate_request", "emit_error"],
  expectedRuntimeExecuted: false,
  expectedValidationOk: false,
  lifecycleKind: "error",
  name: "invalid-agent-access-lifecycle-dry-run",
  request: {
    ...hermesRunsBffValidMinimalRequest,
    agentAccessMode: "unbounded_runtime_access"
  }
} satisfies HermesRunsBffLifecycleFixture;

export const hermesRunsBffStopLifecycleFutureFixture = {
  expectedErrorKinds: [],
  expectedRequiredStages: [
    "validate_request",
    "validate_scope",
    "validate_agent_access_policy",
    "prepare_context",
    "create_run",
    "stream_or_poll_events",
    "normalize_event",
    "update_run_record",
    "update_activity_replay",
    "handle_stop_request",
    "finalize_run",
    "emit_done"
  ],
  expectedRuntimeExecuted: false,
  expectedValidationOk: true,
  lifecycleKind: "stop",
  name: "stop-lifecycle-future-fixture",
  request: {
    ...hermesRunsBffValidMinimalRequest,
    agentAccessMode: "ask_before_tools",
    clientRunId: "client-run-stop-lifecycle-16t",
    hermesSessionId: "hermes-session-stop-lifecycle-16t"
  }
} satisfies HermesRunsBffLifecycleFixture;

export const hermesRunsBffApprovalLifecycleFutureFixture = {
  expectedErrorKinds: [],
  expectedRequiredStages: [
    "validate_request",
    "validate_scope",
    "validate_agent_access_policy",
    "prepare_context",
    "create_run",
    "stream_or_poll_events",
    "normalize_event",
    "update_run_record",
    "update_activity_replay",
    "handle_approval_request",
    "submit_approval_response",
    "finalize_run",
    "emit_done"
  ],
  expectedRuntimeExecuted: false,
  expectedValidationOk: true,
  lifecycleKind: "approval",
  name: "approval-lifecycle-future-fixture",
  request: {
    ...hermesRunsBffValidAgentAccessRequest,
    clientRunId: "client-run-approval-lifecycle-16t",
    hermesSessionId: "hermes-session-approval-lifecycle-16t"
  }
} satisfies HermesRunsBffLifecycleFixture;

export const hermesRunsBffErrorLifecycleFixture = {
  expectedErrorKinds: [],
  expectedRequiredStages: [
    "validate_request",
    "validate_scope",
    "validate_agent_access_policy",
    "prepare_context",
    "create_run",
    "stream_or_poll_events",
    "normalize_event",
    "update_run_record",
    "update_activity_replay",
    "finalize_run",
    "emit_error"
  ],
  expectedRuntimeExecuted: false,
  expectedValidationOk: true,
  lifecycleKind: "error",
  name: "error-lifecycle-fixture",
  request: {
    ...hermesRunsBffValidMinimalRequest,
    agentAccessMode: "read_only_tools",
    clientRunId: "client-run-error-lifecycle-16t"
  }
} satisfies HermesRunsBffLifecycleFixture;

export const hermesRunsBffLifecycleDryRunFixtures = [
  hermesRunsBffValidChatOnlyLifecycleDryRun,
  hermesRunsBffValidAskBeforeToolsLifecycleDryRun,
  hermesRunsBffInvalidMissingScopeLifecycleDryRun,
  hermesRunsBffInvalidAgentAccessLifecycleDryRun,
  hermesRunsBffStopLifecycleFutureFixture,
  hermesRunsBffApprovalLifecycleFutureFixture,
  hermesRunsBffErrorLifecycleFixture
] satisfies HermesRunsBffLifecycleFixture[];

export const hermesRunsBffRequiredLifecycleStages = HERMES_RUNS_BFF_LIFECYCLE_STAGES;
