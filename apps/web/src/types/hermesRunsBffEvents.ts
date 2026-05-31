import type { PersistedActivityEvent, RunRecord } from "@/data/types";
import type { AgentActivityEvent } from "./agentActivity";

export const HERMES_RUNS_BFF_EVENT_SCHEMA_VERSION = "hermes-runs-bff-event.v1";

export type HermesRunsBffEventSchemaVersion = typeof HERMES_RUNS_BFF_EVENT_SCHEMA_VERSION;

export type HermesRunsBffEventType =
  | "run.started"
  | "message.delta"
  | "message.completed"
  | "activity.event"
  | "approval.request"
  | "approval.responded"
  | "run.stopping"
  | "run.stopped"
  | "run.completed"
  | "run.failed"
  | "run.reconnecting"
  | "replay.snapshot"
  | "error"
  | "done";

export type HermesRunsBffRunStatus =
  | "preparing_context"
  | "creating_run"
  | "streaming_events"
  | "waiting_for_approval"
  | "stopping"
  | "stopped"
  | "completed"
  | "failed"
  | "reconnecting"
  | "replaying"
  | "cancelled";

export type HermesRunsBffRunRef = {
  localRunId: string;
  hermesRunId?: string;
  hermesSessionId?: string;
  projectId: string;
  sessionId: string;
  status: HermesRunsBffRunStatus;
};

export type HermesRunsBffMessagePayload = {
  messageId?: string;
  delta?: string;
  fullText?: string;
  finishReason?: string;
};

export type HermesRunsBffApprovalChoice = "once" | "session" | "always" | "deny";

export type HermesRunsBffApprovalPayload = {
  approvalId: string;
  action?: string;
  prompt?: string;
  choices: HermesRunsBffApprovalChoice[];
  decision?: HermesRunsBffApprovalChoice;
  risk?: "low" | "medium" | "high" | "unknown";
  redactedDetails?: Record<string, unknown>;
};

export type HermesRunsBffReplayPayload = {
  runRecord: RunRecord;
  activityReplay: PersistedActivityEvent[];
  complete: boolean;
  source: "live_stream" | "reconnect_poll" | "durable_history" | "best_effort";
  excludedFields: string[];
};

export type HermesRunsBffErrorCode =
  | "validation_failed"
  | "tenant_scope_mismatch"
  | "memory_scope_invalid"
  | "hermes_unreachable"
  | "brain_memory_unavailable"
  | "run_create_failed"
  | "run_event_stream_failed"
  | "run_poll_failed"
  | "run_stop_failed"
  | "approval_required"
  | "approval_submit_failed"
  | "approval_invalid_choice"
  | "timeout"
  | "cancelled"
  | "unknown";

export type HermesRunsBffErrorPayload = {
  code: HermesRunsBffErrorCode;
  message: string;
  retryable: boolean;
  httpStatus?: number;
  detailCode?: string;
  redactedDetails?: Record<string, unknown>;
};

export type HermesRunsBffReconnectPayload = {
  attempt: number;
  reason: "stream_lost" | "browser_reconnect" | "status_poll" | "unknown";
  lastSequence?: number;
  retryAfterMs?: number;
};

export type HermesRunsBffEventMeta = {
  source: "web-ui-bff";
  rawEventType?: string;
  replayComplete?: boolean;
  experimental?: false;
};

export type HermesRunsBffEventBase<TType extends HermesRunsBffEventType> = {
  schemaVersion: HermesRunsBffEventSchemaVersion;
  type: TType;
  sequence: number;
  createdAt: string;
  meta?: HermesRunsBffEventMeta;
};

export type HermesRunsBffEvent =
  | (HermesRunsBffEventBase<"run.started"> & {
      run: HermesRunsBffRunRef;
      activity?: AgentActivityEvent;
    })
  | (HermesRunsBffEventBase<"message.delta"> & {
      run: HermesRunsBffRunRef;
      message: HermesRunsBffMessagePayload;
    })
  | (HermesRunsBffEventBase<"message.completed"> & {
      run: HermesRunsBffRunRef;
      message: HermesRunsBffMessagePayload;
    })
  | (HermesRunsBffEventBase<"activity.event"> & {
      run: HermesRunsBffRunRef;
      activity: AgentActivityEvent;
    })
  | (HermesRunsBffEventBase<"approval.request"> & {
      run: HermesRunsBffRunRef;
      approval: HermesRunsBffApprovalPayload;
      activity: AgentActivityEvent;
    })
  | (HermesRunsBffEventBase<"approval.responded"> & {
      run: HermesRunsBffRunRef;
      approval: HermesRunsBffApprovalPayload;
      activity: AgentActivityEvent;
    })
  | (HermesRunsBffEventBase<"run.stopping"> & {
      run: HermesRunsBffRunRef;
      activity?: AgentActivityEvent;
    })
  | (HermesRunsBffEventBase<"run.stopped"> & {
      run: HermesRunsBffRunRef;
      activity: AgentActivityEvent;
    })
  | (HermesRunsBffEventBase<"run.completed"> & {
      run: HermesRunsBffRunRef;
      activity?: AgentActivityEvent;
      message?: HermesRunsBffMessagePayload;
    })
  | (HermesRunsBffEventBase<"run.failed"> & {
      run: HermesRunsBffRunRef;
      error: HermesRunsBffErrorPayload;
      activity: AgentActivityEvent;
    })
  | (HermesRunsBffEventBase<"run.reconnecting"> & {
      run: HermesRunsBffRunRef;
      reconnect: HermesRunsBffReconnectPayload;
    })
  | (HermesRunsBffEventBase<"replay.snapshot"> & {
      run: HermesRunsBffRunRef;
      replay: HermesRunsBffReplayPayload;
    })
  | (HermesRunsBffEventBase<"error"> & {
      run?: HermesRunsBffRunRef;
      error: HermesRunsBffErrorPayload;
    })
  | (HermesRunsBffEventBase<"done"> & {
      run: HermesRunsBffRunRef;
    });

export type HermesRunsStopRequest = {
  projectId: string;
  sessionId: string;
  localRunId: string;
  hermesRunId: string;
  hermesSessionId?: string;
  reason?: "user" | "timeout" | "navigation" | "other";
};

export type HermesRunsStopResponse = {
  ok: boolean;
  localRunId: string;
  hermesRunId: string;
  status: "stopping" | "stopped" | "completed" | "cancelled" | "failed";
  event?: Extract<HermesRunsBffEvent, { type: "run.stopping" | "run.stopped" | "error" }>;
  idempotent?: boolean;
};

export type HermesRunsApprovalRequest = {
  projectId: string;
  sessionId: string;
  localRunId: string;
  hermesRunId: string;
  approvalId: string;
  choice: HermesRunsBffApprovalChoice;
  resolveAll?: boolean;
};

export type HermesRunsApprovalResponse = {
  ok: boolean;
  localRunId: string;
  hermesRunId: string;
  approvalId: string;
  choice: HermesRunsBffApprovalChoice;
  resolved?: number;
  event?: Extract<HermesRunsBffEvent, { type: "approval.responded" | "error" }>;
};
