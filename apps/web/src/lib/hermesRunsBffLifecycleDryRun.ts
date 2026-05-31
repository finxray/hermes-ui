import { HERMES_RUNS_BFF_AGENT_ACCESS_MODES, type HermesRunsBffAgentAccessMode } from "@/types/hermesRunsBffRequest";
import type { HermesRunsBffErrorCode } from "@/types/hermesRunsBffEvents";
import { validateHermesRunsBffRequest } from "./hermesRunsBffRequestValidation";

export const HERMES_RUNS_BFF_LIFECYCLE_DRY_RUN_SCHEMA_VERSION =
  "hermes-runs-bff-lifecycle-dry-run.v1";

export const HERMES_RUNS_BFF_LIFECYCLE_DISABLED_REASON =
  "production_runs_route_not_enabled";

export const HERMES_RUNS_BFF_LIFECYCLE_STAGES = [
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
  "handle_stop_request",
  "finalize_run",
  "emit_done",
  "emit_error"
] as const;

const runtimeStageNames = new Set<HermesRunsBffLifecycleStage>([
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
  "handle_stop_request",
  "finalize_run",
  "emit_done",
  "emit_error"
]);

const agentAccessModes = new Set<string>(HERMES_RUNS_BFF_AGENT_ACCESS_MODES);

export type HermesRunsBffLifecycleStage = (typeof HERMES_RUNS_BFF_LIFECYCLE_STAGES)[number];

export type HermesRunsBffLifecycleDryRunKind =
  | "chat"
  | "stop"
  | "approval"
  | "error";

export type HermesRunsBffLifecycleStageOwner =
  | "browser"
  | "web_ui_bff"
  | "hermes_runs"
  | "brain_memory_gateway";

export type HermesRunsBffLifecycleStagePlan = {
  stage: HermesRunsBffLifecycleStage;
  owner: HermesRunsBffLifecycleStageOwner;
  futureInput: string;
  futureOutput: string;
  currentDisabledRouteStatus:
    | "shape_validation_only"
    | "metadata_only_not_enforced"
    | "not_executed_while_disabled";
  implementedNow: boolean;
  executed: boolean;
  requiredForFuture: boolean;
  safetyRequirement: string;
  failureErrorKind: HermesRunsBffErrorCode;
};

export type HermesRunsBffLifecycleDryRun = {
  schemaVersion: typeof HERMES_RUNS_BFF_LIFECYCLE_DRY_RUN_SCHEMA_VERSION;
  disabledReason: typeof HERMES_RUNS_BFF_LIFECYCLE_DISABLED_REASON;
  routeStatus: "disabled_http_501";
  productionChatRoute: "/api/hermes/chat/stream";
  productionRunsRoute: "/api/hermes/runs/chat/stream";
  requestValidation: {
    attempted: true;
    ok: boolean;
    errorKinds: string[];
    errors: Array<{
      kind: string;
      path: string;
    }>;
  };
  agentAccessMode: {
    requested?: HermesRunsBffAgentAccessMode;
    posture: "metadata_only" | "invalid" | "omitted";
    productionUiEnabled: false;
    enforcementAvailable: false;
  };
  stages: HermesRunsBffLifecycleStagePlan[];
  runtimeExecution: {
    hermesRunCreated: false;
    hermesCalled: false;
    brainMemoryCalled: false;
    eventStreamStarted: false;
    runRecordCreated: false;
    activityReplayUpdated: false;
    approvalCalled: false;
    stopCalled: false;
    storageAccess: false;
  };
  rawRequestEchoed: false;
  serviceSecretsRead: false;
  lifecycleKind: HermesRunsBffLifecycleDryRunKind;
};

type HermesRunsBffLifecycleDryRunInput = {
  lifecycleKind?: HermesRunsBffLifecycleDryRunKind;
  request?: unknown;
};

export function createHermesRunsBffLifecycleDryRun(input: unknown): HermesRunsBffLifecycleDryRun {
  const { lifecycleKind, request } = readDryRunInput(input);
  const validation = validateHermesRunsBffRequest(request);
  const validationErrors = validation.ok
    ? []
    : validation.errors.map((item) => ({
        kind: item.kind,
        path: item.path
      }));
  const agentAccessMode = readAgentAccessModePosture(request, validation.ok ? validation.request.agentAccessMode : undefined);

  return {
    agentAccessMode,
    disabledReason: HERMES_RUNS_BFF_LIFECYCLE_DISABLED_REASON,
    lifecycleKind,
    productionChatRoute: "/api/hermes/chat/stream",
    productionRunsRoute: "/api/hermes/runs/chat/stream",
    rawRequestEchoed: false,
    requestValidation: {
      attempted: true,
      errorKinds: Array.from(new Set(validationErrors.map((item) => item.kind))),
      errors: validationErrors,
      ok: validation.ok
    },
    routeStatus: "disabled_http_501",
    runtimeExecution: {
      activityReplayUpdated: false,
      approvalCalled: false,
      brainMemoryCalled: false,
      eventStreamStarted: false,
      hermesCalled: false,
      hermesRunCreated: false,
      runRecordCreated: false,
      stopCalled: false,
      storageAccess: false
    },
    schemaVersion: HERMES_RUNS_BFF_LIFECYCLE_DRY_RUN_SCHEMA_VERSION,
    serviceSecretsRead: false,
    stages: createLifecycleStagePlans(lifecycleKind, validation.ok)
  };
}

function createLifecycleStagePlans(
  lifecycleKind: HermesRunsBffLifecycleDryRunKind,
  validationOk: boolean
): HermesRunsBffLifecycleStagePlan[] {
  return HERMES_RUNS_BFF_LIFECYCLE_STAGES.map((stage) => {
    const runtimeStage = runtimeStageNames.has(stage);
    return {
      ...stageDefinitions[stage],
      currentDisabledRouteStatus: stage === "validate_request"
        ? "shape_validation_only"
        : stage === "validate_agent_access_policy"
          ? "metadata_only_not_enforced"
          : "not_executed_while_disabled",
      executed: stage === "validate_request",
      implementedNow: stage === "validate_request",
      requiredForFuture: isRequiredForFuture(stage, lifecycleKind, validationOk),
      stage
    };
  });
}

function isRequiredForFuture(
  stage: HermesRunsBffLifecycleStage,
  lifecycleKind: HermesRunsBffLifecycleDryRunKind,
  validationOk: boolean
) {
  if (stage === "validate_request") {
    return true;
  }
  if (!validationOk) {
    return stage === "emit_error";
  }
  if (stage === "handle_stop_request") {
    return lifecycleKind === "stop";
  }
  if (stage === "handle_approval_request" || stage === "submit_approval_response") {
    return lifecycleKind === "approval";
  }
  if (stage === "emit_error") {
    return lifecycleKind === "error";
  }
  if (stage === "emit_done") {
    return lifecycleKind !== "error";
  }
  return true;
}

function readDryRunInput(input: unknown): Required<HermesRunsBffLifecycleDryRunInput> {
  if (isRecord(input) && "request" in input) {
    return {
      lifecycleKind: readLifecycleKind(input.lifecycleKind),
      request: input.request
    };
  }
  return {
    lifecycleKind: "chat",
    request: input
  };
}

function readLifecycleKind(value: unknown): HermesRunsBffLifecycleDryRunKind {
  return value === "stop" || value === "approval" || value === "error" ? value : "chat";
}

function readAgentAccessModePosture(
  request: unknown,
  normalizedMode: HermesRunsBffAgentAccessMode | undefined
): HermesRunsBffLifecycleDryRun["agentAccessMode"] {
  if (normalizedMode) {
    return {
      enforcementAvailable: false,
      posture: "metadata_only",
      productionUiEnabled: false,
      requested: normalizedMode
    };
  }
  if (isRecord(request) && typeof request.agentAccessMode === "string") {
    return {
      enforcementAvailable: false,
      posture: agentAccessModes.has(request.agentAccessMode) ? "metadata_only" : "invalid",
      productionUiEnabled: false
    };
  }
  return {
    enforcementAvailable: false,
    posture: "omitted",
    productionUiEnabled: false
  };
}

const stageDefinitions: Record<
  HermesRunsBffLifecycleStage,
  Omit<
    HermesRunsBffLifecycleStagePlan,
    "currentDisabledRouteStatus" | "executed" | "implementedNow" | "requiredForFuture" | "stage"
  >
> = {
  create_run: {
    failureErrorKind: "run_create_failed",
    futureInput: "validated request, scoped context, agent access policy, and server Hermes config",
    futureOutput: "Hermes run id and initial run status",
    owner: "web_ui_bff",
    safetyRequirement: "call Hermes only from the BFF after scope and policy validation"
  },
  emit_done: {
    failureErrorKind: "unknown",
    futureInput: "terminal run status or honest disabled/error state",
    futureOutput: "browser-facing done event",
    owner: "web_ui_bff",
    safetyRequirement: "emit done only after terminal reconciliation or explicit disabled posture"
  },
  emit_error: {
    failureErrorKind: "unknown",
    futureInput: "validation, stream, stop, approval, or terminal failure",
    futureOutput: "redacted browser-facing error envelope",
    owner: "web_ui_bff",
    safetyRequirement: "redact details and never expose credentials or raw service payloads"
  },
  finalize_run: {
    failureErrorKind: "unknown",
    futureInput: "terminal Hermes status plus buffered assistant text and activity summary",
    futureOutput: "final run status, transcript completion, and summary metadata",
    owner: "web_ui_bff",
    safetyRequirement: "prefer terminal reconciliation and preserve rollback to session stream"
  },
  handle_approval_request: {
    failureErrorKind: "approval_required",
    futureInput: "Hermes approval.request event and active run correlation",
    futureOutput: "display-safe approval activity and paused run posture",
    owner: "web_ui_bff",
    safetyRequirement: "show only BFF-enforceable choices and no raw approval handles"
  },
  handle_stop_request: {
    failureErrorKind: "run_stop_failed",
    futureInput: "local run id, Hermes run id, project/session ownership, and stop reason",
    futureOutput: "stopping posture and later terminal reconciliation",
    owner: "web_ui_bff",
    safetyRequirement: "call stop only after ownership validation and make duplicate stops idempotent"
  },
  normalize_event: {
    failureErrorKind: "unknown",
    futureInput: "Hermes Runs event payload",
    futureOutput: "HermesRunsBffEvent and optional AgentActivityEvent",
    owner: "web_ui_bff",
    safetyRequirement: "redact raw details and never expose hidden reasoning text"
  },
  prepare_context: {
    failureErrorKind: "memory_scope_invalid",
    futureInput: "validated request plus project/session state",
    futureOutput: "bounded context package and memory scope posture",
    owner: "web_ui_bff",
    safetyRequirement: "derive scope from trusted state and preserve stable project/session keys"
  },
  stream_or_poll_events: {
    failureErrorKind: "run_event_stream_failed",
    futureInput: "Hermes run id and BFF stream correlation",
    futureOutput: "ordered BFF event stream or status poll snapshots",
    owner: "web_ui_bff",
    safetyRequirement: "stream only through the BFF and handle reconnect/status polling safely"
  },
  submit_approval_response: {
    failureErrorKind: "approval_submit_failed",
    futureInput: "approval id, choice, local run id, Hermes run id, and policy decision",
    futureOutput: "Hermes approval response and normalized approval.responded event",
    owner: "web_ui_bff",
    safetyRequirement: "submit approvals only through the BFF after active-run and policy validation"
  },
  update_activity_replay: {
    failureErrorKind: "unknown",
    futureInput: "normalized activity event and local run record id",
    futureOutput: "bounded redacted persisted activity replay row",
    owner: "browser",
    safetyRequirement: "persist compact replay only; never persist raw Runs payloads or per-token deltas"
  },
  update_run_record: {
    failureErrorKind: "unknown",
    futureInput: "local run id, Hermes run id, transcript ids, activity summary, and terminal status",
    futureOutput: "updated local RunRecord",
    owner: "browser",
    safetyRequirement: "keep RunRecord.id local and Hermes run id in hermesRunId only"
  },
  validate_agent_access_policy: {
    failureErrorKind: "validation_failed",
    futureInput: "validated agentAccessMode plus project/session policy",
    futureOutput: "enforceable tool and approval policy",
    owner: "web_ui_bff",
    safetyRequirement: "treat Agent access as metadata until policy can be enforced"
  },
  validate_request: {
    failureErrorKind: "validation_failed",
    futureInput: "browser JSON body",
    futureOutput: "safe normalized request or redacted validation errors",
    owner: "web_ui_bff",
    safetyRequirement: "validate shape only and never echo raw prompts or credential-like fields"
  },
  validate_scope: {
    failureErrorKind: "tenant_scope_mismatch",
    futureInput: "project id, session id, tenant id, stable project key, and stable session key",
    futureOutput: "trusted tenant/project/session scope posture",
    owner: "web_ui_bff",
    safetyRequirement: "reject mismatches before any Hermes, Gateway, or memory bridge use"
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
