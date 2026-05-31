import type {
  PersistedActivityEvent,
  RunActivitySummary,
  RunRecord,
  RunRecordStatus
} from "@/data/types";
import type { AgentActivityEvent } from "@/types/agentActivity";
import type {
  HermesRunsBffApprovalPayload,
  HermesRunsBffErrorPayload,
  HermesRunsBffEvent,
  HermesRunsBffReplayPayload,
  HermesRunsBffRunRef,
  HermesRunsBffRunStatus
} from "@/types/hermesRunsBffEvents";
import {
  createPersistedActivityEvent,
  limitPersistedActivityEvents
} from "./persistedActivityReplay";

export type HermesRunsBffApprovalDraft = {
  approvalId: string;
  status: "waiting_for_approval" | "responded";
  action?: string;
  choices: HermesRunsBffApprovalPayload["choices"];
  decision?: HermesRunsBffApprovalPayload["decision"];
  risk?: HermesRunsBffApprovalPayload["risk"];
  activityId?: string;
};

export type HermesRunsBffDraftState = {
  assistantText: string;
  messageCompleted: boolean;
  run: HermesRunsBffRunRef | null;
  runRecord: RunRecord | null;
  activityEvents: AgentActivityEvent[];
  activityReplay: PersistedActivityEvent[];
  approvals: HermesRunsBffApprovalDraft[];
  errors: HermesRunsBffErrorPayload[];
  done: boolean;
  reconnecting: boolean;
  replaySnapshot: HermesRunsBffReplayPayload | null;
  eventTypes: HermesRunsBffEvent["type"][];
};

export function createEmptyHermesRunsBffDraftState(): HermesRunsBffDraftState {
  return {
    activityEvents: [],
    activityReplay: [],
    approvals: [],
    assistantText: "",
    done: false,
    errors: [],
    eventTypes: [],
    messageCompleted: false,
    reconnecting: false,
    replaySnapshot: null,
    run: null,
    runRecord: null
  };
}

export function reduceHermesRunsBffEvents(
  events: HermesRunsBffEvent[],
  initialState: HermesRunsBffDraftState = createEmptyHermesRunsBffDraftState()
): HermesRunsBffDraftState {
  return events.reduce(applyHermesRunsBffEvent, initialState);
}

export function applyHermesRunsBffEvent(
  state: HermesRunsBffDraftState,
  event: HermesRunsBffEvent
): HermesRunsBffDraftState {
  const base = {
    ...state,
    eventTypes: [...state.eventTypes, event.type]
  };

  switch (event.type) {
    case "run.started":
      return updateRunState(appendOptionalActivity(base, event.run, event.activity), event.run, event.createdAt);
    case "message.delta":
      return updateRunState(
        {
          ...base,
          assistantText: `${base.assistantText}${event.message.delta ?? ""}`
        },
        event.run,
        event.createdAt
      );
    case "message.completed":
      return updateRunState(
        {
          ...base,
          assistantText: event.message.fullText ?? base.assistantText,
          messageCompleted: true
        },
        event.run,
        event.createdAt,
        { assistantMessageId: event.message.messageId }
      );
    case "activity.event":
      return updateRunState(appendActivity(base, event.run, event.activity), event.run, event.createdAt);
    case "approval.request":
      return updateRunState(
        appendActivity(updateApproval(base, event.approval, "waiting_for_approval", event.activity.id), event.run, event.activity),
        event.run,
        event.createdAt
      );
    case "approval.responded":
      return updateRunState(
        appendActivity(updateApproval(base, event.approval, "responded", event.activity.id), event.run, event.activity),
        event.run,
        event.createdAt
      );
    case "run.stopping":
      return updateRunState(appendOptionalActivity(base, event.run, event.activity), event.run, event.createdAt, {
        stoppedByUser: true
      });
    case "run.stopped":
      return updateRunState(appendActivity(base, event.run, event.activity), event.run, event.createdAt, {
        completedAt: event.createdAt,
        stoppedByUser: true
      });
    case "run.completed":
      return updateRunState(appendOptionalActivity({
        ...base,
        assistantText: event.message?.fullText ?? base.assistantText,
        messageCompleted: true
      }, event.run, event.activity), event.run, event.createdAt, {
        assistantMessageId: event.message?.messageId,
        completedAt: event.createdAt
      });
    case "run.failed":
      return updateRunState(appendActivity({
        ...base,
        errors: [...base.errors, event.error]
      }, event.run, event.activity), event.run, event.createdAt, {
        completedAt: event.createdAt
      });
    case "run.reconnecting":
      return updateRunState(
        {
          ...base,
          reconnecting: true
        },
        event.run,
        event.createdAt
      );
    case "replay.snapshot":
      return {
        ...updateRunState(base, event.run, event.createdAt),
        activityReplay: event.replay.activityReplay,
        reconnecting: false,
        replaySnapshot: event.replay,
        runRecord: event.replay.runRecord
      };
    case "error":
      return event.run
        ? updateRunState(
            {
              ...base,
              errors: [...base.errors, event.error]
            },
            event.run,
            event.createdAt,
            { completedAt: event.error.retryable ? undefined : event.createdAt }
          )
        : {
            ...base,
            errors: [...base.errors, event.error]
          };
    case "done":
      return updateRunState(
        {
          ...base,
          done: true
        },
        event.run,
        event.createdAt
      );
  }
}

function appendOptionalActivity(
  state: HermesRunsBffDraftState,
  run: HermesRunsBffRunRef,
  activity?: AgentActivityEvent
): HermesRunsBffDraftState {
  return activity ? appendActivity(state, run, activity) : state;
}

function appendActivity(
  state: HermesRunsBffDraftState,
  run: HermesRunsBffRunRef,
  activity: AgentActivityEvent
): HermesRunsBffDraftState {
  const activityEvents = [...state.activityEvents, activity];
  const replay = createPersistedActivityEvent(activity, run.localRunId);
  return {
    ...state,
    activityEvents,
    activityReplay: limitPersistedActivityEvents([...state.activityReplay, replay])
  };
}

function updateApproval(
  state: HermesRunsBffDraftState,
  approval: HermesRunsBffApprovalPayload,
  status: HermesRunsBffApprovalDraft["status"],
  activityId?: string
): HermesRunsBffDraftState {
  const next: HermesRunsBffApprovalDraft = {
    action: approval.action,
    activityId,
    approvalId: approval.approvalId,
    choices: approval.choices,
    decision: approval.decision,
    risk: approval.risk,
    status
  };
  const approvals = state.approvals.filter((item) => item.approvalId !== approval.approvalId);
  return {
    ...state,
    approvals: [...approvals, next]
  };
}

function updateRunState(
  state: HermesRunsBffDraftState,
  run: HermesRunsBffRunRef,
  eventTime: string,
  patch: Partial<RunRecord> = {}
): HermesRunsBffDraftState {
  const existing = state.runRecord;
  const status = mapBffRunStatusToRunRecordStatus(run.status, existing?.status);
  const runRecord: RunRecord = {
    ...(existing ?? createRunRecord(run, eventTime)),
    activityEventIds: state.activityEvents.map((activity) => activity.id),
    activityReplay: state.activityReplay,
    activitySummary: createActivitySummary(state.activityEvents),
    hermesRunId: run.hermesRunId ?? existing?.hermesRunId,
    hermesSessionId: run.hermesSessionId ?? existing?.hermesSessionId ?? "",
    projectId: run.projectId,
    sessionId: run.sessionId,
    status,
    stoppedByUser: patch.stoppedByUser ?? existing?.stoppedByUser,
    ...patch
  };

  const completedAt = patch.completedAt ?? terminalCompletedAt(status, runRecord.completedAt, eventTime);
  const normalizedRunRecord = completedAt
    ? {
        ...runRecord,
        completedAt,
        durationMs: runRecord.durationMs ?? safeDuration(runRecord.startedAt, completedAt)
      }
    : runRecord;

  return {
    ...state,
    run,
    runRecord: normalizedRunRecord
  };
}

function createRunRecord(run: HermesRunsBffRunRef, startedAt: string): RunRecord {
  return {
    id: run.localRunId,
    projectId: run.projectId,
    sessionId: run.sessionId,
    hermesSessionId: run.hermesSessionId ?? "",
    hermesRunId: run.hermesRunId,
    sourceChannel: "web-ui",
    status: mapBffRunStatusToRunRecordStatus(run.status),
    startedAt,
    summary: "Hermes Runs BFF fixture draft",
    metadata: {
      eventSource: "hermes-runs-bff-fixture",
      rawRunsPayloadPersisted: false
    },
    activityEventIds: [],
    activityReplay: [],
    activitySummary: {
      approvalCount: 0,
      commandCount: 0,
      errorCount: 0,
      memoryCount: 0,
      toolCount: 0
    }
  };
}

function mapBffRunStatusToRunRecordStatus(
  status: HermesRunsBffRunStatus,
  previous: RunRecordStatus = "running"
): RunRecordStatus {
  if (status === "completed") {
    return "completed";
  }
  if (status === "failed") {
    return "failed";
  }
  if (status === "stopped") {
    return "stopped";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  if (previous === "completed" || previous === "failed" || previous === "stopped" || previous === "cancelled") {
    return previous;
  }
  return "running";
}

function terminalCompletedAt(status: RunRecordStatus, current: string | undefined, eventTime: string) {
  if (current) {
    return current;
  }
  return status === "completed" || status === "failed" || status === "stopped" || status === "cancelled"
    ? eventTime
    : undefined;
}

function safeDuration(startedAt: string, completedAt: string) {
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed)) {
    return undefined;
  }
  return Math.max(0, completed - started);
}

function createActivitySummary(events: AgentActivityEvent[]): RunActivitySummary {
  return {
    approvalCount: events.filter((event) => event.type === "approval").length,
    commandCount: events.filter((event) => event.type === "command").length,
    errorCount: events.filter((event) => event.type === "error" || event.status === "failed").length,
    memoryCount: events.filter((event) => event.type === "memory").length,
    toolCount: events.filter((event) => event.type === "tool").length
  };
}
