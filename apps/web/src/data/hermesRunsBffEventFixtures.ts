import type { PersistedActivityEvent, RunRecord } from "./types";
import type { AgentActivityEvent } from "@/types/agentActivity";
import {
  HERMES_RUNS_BFF_EVENT_SCHEMA_VERSION,
  type HermesRunsBffEvent,
  type HermesRunsBffEventBase,
  type HermesRunsBffRunRef
} from "@/types/hermesRunsBffEvents";

const startedAt = "2026-05-31T16:00:00.000Z";
const completedAt = "2026-05-31T16:00:02.000Z";
const stoppedAt = "2026-05-31T16:00:01.500Z";

export const hermesRunsBffFixtureProjectId = "project-runs-bff-16o";
export const hermesRunsBffFixtureSessionId = "session-runs-bff-16o";
export const hermesRunsBffFixtureHermesSessionId = "hermes-session-runs-bff-16o";

const baseRun: HermesRunsBffRunRef = {
  localRunId: "run-runs-bff-16o-basic",
  hermesRunId: "run_16o_basic",
  hermesSessionId: hermesRunsBffFixtureHermesSessionId,
  projectId: hermesRunsBffFixtureProjectId,
  sessionId: hermesRunsBffFixtureSessionId,
  status: "streaming_events"
};

const activityRun: HermesRunsBffRunRef = {
  ...baseRun,
  localRunId: "run-runs-bff-16o-activity",
  hermesRunId: "run_16o_activity"
};

const approvalRun: HermesRunsBffRunRef = {
  ...baseRun,
  localRunId: "run-runs-bff-16o-approval",
  hermesRunId: "run_16o_approval",
  status: "waiting_for_approval"
};

const stopRun: HermesRunsBffRunRef = {
  ...baseRun,
  localRunId: "run-runs-bff-16o-stop",
  hermesRunId: "run_16o_stop"
};

const errorRun: HermesRunsBffRunRef = {
  ...baseRun,
  localRunId: "run-runs-bff-16o-error",
  hermesRunId: "run_16o_error"
};

const reconnectRun: HermesRunsBffRunRef = {
  ...baseRun,
  localRunId: "run-runs-bff-16o-reconnect",
  hermesRunId: "run_16o_reconnect",
  status: "reconnecting"
};

const completedRun = (run: HermesRunsBffRunRef): HermesRunsBffRunRef => ({
  ...run,
  status: "completed"
});

const stoppedRun = (run: HermesRunsBffRunRef): HermesRunsBffRunRef => ({
  ...run,
  status: "stopped"
});

const failedRun = (run: HermesRunsBffRunRef): HermesRunsBffRunRef => ({
  ...run,
  status: "failed"
});

const baseEvent = <TType extends HermesRunsBffEvent["type"]>(
  type: TType,
  sequence: number,
  createdAt = startedAt
): HermesRunsBffEventBase<TType> => ({
  schemaVersion: HERMES_RUNS_BFF_EVENT_SCHEMA_VERSION,
  type,
  sequence,
  createdAt,
  meta: {
    source: "web-ui-bff" as const,
    experimental: false as const
  }
});

function makeRunRecord(run: HermesRunsBffRunRef, status: RunRecord["status"]): RunRecord {
  return {
    id: run.localRunId,
    projectId: run.projectId,
    sessionId: run.sessionId,
    hermesSessionId: run.hermesSessionId ?? hermesRunsBffFixtureHermesSessionId,
    hermesRunId: run.hermesRunId,
    assistantMessageId: `assistant-${run.localRunId}`,
    userMessageId: `user-${run.localRunId}`,
    sourceChannel: "web-ui",
    status,
    startedAt,
    completedAt: status === "running" ? undefined : completedAt,
    durationMs: status === "running" ? undefined : 2000,
    stoppedByUser: status === "stopped" ? true : undefined,
    summary: `Fixture ${status} Runs BFF record`,
    metadata: {
      eventSource: "hermes-runs-bff-fixture",
      rawRunsPayloadPersisted: false
    },
    activityEventIds: [],
    activitySummary: {
      approvalCount: 0,
      commandCount: 0,
      errorCount: 0,
      memoryCount: 0,
      toolCount: 0
    },
    activityReplay: []
  };
}

function makeActivityReplay(runId: string, event: AgentActivityEvent): PersistedActivityEvent {
  return {
    id: event.id,
    runId,
    type: event.type,
    status: event.status,
    title: event.title,
    summary: event.summary,
    startedAt: event.startedAt,
    completedAt: event.completedAt,
    durationMs: event.durationMs,
    collapsedByDefault: event.collapsedByDefault,
    source: event.source,
    sourceChannel: "web-ui",
    hermes: event.hermes,
    memory: event.memory,
    command: event.command
      ? {
          commandPreview: event.command.command,
          cwd: event.command.cwd,
          exitCode: event.command.exitCode,
          outputPreview: event.command.outputPreview,
          sourceChannel: event.command.sourceChannel,
          stderrPreview: event.command.stderrPreview,
          stdoutPreview: event.command.stdoutPreview,
          truncated: event.command.truncated
        }
      : undefined,
    approval: event.approval
      ? {
          approvalId: event.approval.approvalId,
          decision: event.approval.decision,
          requestedAction: event.approval.action,
          riskLevel: event.approval.riskLevel
        }
      : undefined,
    metadata: {
      fixture: true,
      rawRunsPayloadPersisted: false
    }
  };
}

const toolStartedActivity: AgentActivityEvent = {
  id: "activity-16o-tool-started",
  type: "tool",
  status: "running",
  title: "Fixture tool started",
  summary: "Reading a safe local fixture input.",
  startedAt,
  collapsedByDefault: true,
  source: "hermes",
  hermes: {
    eventType: "tool.started",
    runId: activityRun.hermesRunId,
    sessionId: activityRun.hermesSessionId,
    toolName: "fixture_reader",
    toolCallId: "tool-call-16o-started"
  },
  metadata: {
    fixture: true,
    rawRunsPayloadPersisted: false
  }
};

const toolCompletedActivity: AgentActivityEvent = {
  ...toolStartedActivity,
  id: "activity-16o-tool-completed",
  status: "completed",
  title: "Fixture tool completed",
  summary: "Safe fixture input read.",
  completedAt,
  durationMs: 2000,
  hermes: {
    ...toolStartedActivity.hermes,
    eventType: "tool.completed",
    toolCallId: "tool-call-16o-completed"
  }
};

const approvalRequestActivity: AgentActivityEvent = {
  id: "activity-16o-approval-request",
  type: "approval",
  status: "waiting_for_approval",
  title: "Approval required",
  summary: "Allow fixture read-only action?",
  startedAt,
  collapsedByDefault: false,
  source: "hermes",
  hermes: {
    eventType: "approval.request",
    runId: approvalRun.hermesRunId,
    sessionId: approvalRun.hermesSessionId
  },
  approval: {
    action: "fixture read-only action",
    actionAvailable: false,
    approvalId: "approval-16o",
    choices: ["once", "session", "always", "deny"],
    prompt: "Allow fixture read-only action?",
    riskLevel: "low",
    unavailableReason: "Fixture-only future BFF approval contract"
  }
};

const approvalRespondedActivity: AgentActivityEvent = {
  ...approvalRequestActivity,
  id: "activity-16o-approval-responded",
  status: "cancelled",
  title: "Approval responded",
  summary: "Fixture approval denied.",
  completedAt,
  approval: {
    ...approvalRequestActivity.approval!,
    decision: "deny",
    respondedAt: completedAt
  }
};

const stoppedActivity: AgentActivityEvent = {
  id: "activity-16o-run-stopped",
  type: "status",
  status: "cancelled",
  title: "Run stopped",
  summary: "Fixture run was stopped by the user.",
  startedAt,
  completedAt: stoppedAt,
  durationMs: 1500,
  collapsedByDefault: true,
  source: "hermes",
  hermes: {
    eventType: "run.stopped",
    runId: stopRun.hermesRunId,
    sessionId: stopRun.hermesSessionId
  },
  metadata: {
    serverSideRunStop: true,
    fixture: true
  }
};

const failedActivity: AgentActivityEvent = {
  id: "activity-16o-run-failed",
  type: "error",
  status: "failed",
  title: "Run failed",
  summary: "Fixture run event stream failed.",
  completedAt,
  collapsedByDefault: false,
  source: "hermes",
  hermes: {
    eventType: "run.failed",
    runId: errorRun.hermesRunId,
    sessionId: errorRun.hermesSessionId
  }
};

const replayActivity = makeActivityReplay(reconnectRun.localRunId, toolCompletedActivity);
const replayRunRecord: RunRecord = {
  ...makeRunRecord(reconnectRun, "completed"),
  activityEventIds: [replayActivity.id],
  activityReplay: [replayActivity],
  activitySummary: {
    approvalCount: 0,
    commandCount: 0,
    errorCount: 0,
    memoryCount: 0,
    toolCount: 1
  }
};

export const hermesRunsBffBasicSuccessEvents: HermesRunsBffEvent[] = [
  {
    ...baseEvent("run.started", 1),
    run: baseRun
  },
  {
    ...baseEvent("message.delta", 2),
    run: baseRun,
    message: {
      messageId: "assistant-basic-16o",
      delta: "Hello "
    }
  },
  {
    ...baseEvent("message.delta", 3),
    run: baseRun,
    message: {
      messageId: "assistant-basic-16o",
      delta: "from Runs."
    }
  },
  {
    ...baseEvent("message.completed", 4, completedAt),
    run: completedRun(baseRun),
    message: {
      messageId: "assistant-basic-16o",
      fullText: "Hello from Runs.",
      finishReason: "stop"
    }
  },
  {
    ...baseEvent("run.completed", 5, completedAt),
    run: completedRun(baseRun),
    message: {
      messageId: "assistant-basic-16o",
      fullText: "Hello from Runs.",
      finishReason: "stop"
    }
  },
  {
    ...baseEvent("done", 6, completedAt),
    run: completedRun(baseRun)
  }
];

export const hermesRunsBffActivityToolEvents: HermesRunsBffEvent[] = [
  {
    ...baseEvent("run.started", 1),
    run: activityRun
  },
  {
    ...baseEvent("activity.event", 2),
    run: activityRun,
    activity: toolStartedActivity
  },
  {
    ...baseEvent("activity.event", 3, completedAt),
    run: activityRun,
    activity: toolCompletedActivity
  },
  {
    ...baseEvent("run.completed", 4, completedAt),
    run: completedRun(activityRun)
  },
  {
    ...baseEvent("replay.snapshot", 5, completedAt),
    run: completedRun(activityRun),
    replay: {
      runRecord: {
        ...makeRunRecord(activityRun, "completed"),
        activityEventIds: [toolStartedActivity.id, toolCompletedActivity.id],
        activityReplay: [
          makeActivityReplay(activityRun.localRunId, toolStartedActivity),
          makeActivityReplay(activityRun.localRunId, toolCompletedActivity)
        ],
        activitySummary: {
          approvalCount: 0,
          commandCount: 0,
          errorCount: 0,
          memoryCount: 0,
          toolCount: 2
        }
      },
      activityReplay: [
        makeActivityReplay(activityRun.localRunId, toolStartedActivity),
        makeActivityReplay(activityRun.localRunId, toolCompletedActivity)
      ],
      complete: true,
      source: "live_stream",
      excludedFields: ["per-token message.delta replay rows", "full raw Hermes Runs event payloads"]
    }
  },
  {
    ...baseEvent("done", 6, completedAt),
    run: completedRun(activityRun)
  }
];

export const hermesRunsBffApprovalDenyEvents: HermesRunsBffEvent[] = [
  {
    ...baseEvent("run.started", 1),
    run: approvalRun
  },
  {
    ...baseEvent("approval.request", 2),
    run: approvalRun,
    approval: {
      approvalId: "approval-16o",
      action: "fixture read-only action",
      prompt: "Allow fixture read-only action?",
      choices: ["once", "session", "always", "deny"],
      risk: "low",
      redactedDetails: {
        fixtureOnly: true
      }
    },
    activity: approvalRequestActivity
  },
  {
    ...baseEvent("approval.responded", 3, completedAt),
    run: approvalRun,
    approval: {
      approvalId: "approval-16o",
      action: "fixture read-only action",
      choices: ["once", "session", "always", "deny"],
      decision: "deny",
      risk: "low",
      redactedDetails: {
        resolved: 1
      }
    },
    activity: approvalRespondedActivity
  },
  {
    ...baseEvent("run.completed", 4, completedAt),
    run: completedRun(approvalRun)
  },
  {
    ...baseEvent("done", 5, completedAt),
    run: completedRun(approvalRun)
  }
];

export const hermesRunsBffStopEvents: HermesRunsBffEvent[] = [
  {
    ...baseEvent("run.started", 1),
    run: stopRun
  },
  {
    ...baseEvent("message.delta", 2),
    run: stopRun,
    message: {
      messageId: "assistant-stop-16o",
      delta: "Partial fixture text."
    }
  },
  {
    ...baseEvent("run.stopping", 3, stoppedAt),
    run: {
      ...stopRun,
      status: "stopping"
    }
  },
  {
    ...baseEvent("run.stopped", 4, stoppedAt),
    run: stoppedRun(stopRun),
    activity: stoppedActivity
  },
  {
    ...baseEvent("done", 5, stoppedAt),
    run: stoppedRun(stopRun)
  }
];

export const hermesRunsBffErrorEvents: HermesRunsBffEvent[] = [
  {
    ...baseEvent("run.started", 1),
    run: errorRun
  },
  {
    ...baseEvent("error", 2, completedAt),
    run: errorRun,
    error: {
      code: "run_event_stream_failed",
      message: "Fixture stream ended before terminal status.",
      retryable: true,
      redactedDetails: {
        fixtureOnly: true
      }
    }
  },
  {
    ...baseEvent("run.failed", 3, completedAt),
    run: failedRun(errorRun),
    error: {
      code: "run_event_stream_failed",
      message: "Fixture stream ended before terminal status.",
      retryable: true
    },
    activity: failedActivity
  },
  {
    ...baseEvent("done", 4, completedAt),
    run: failedRun(errorRun)
  }
];

export const hermesRunsBffReconnectReplayEvents: HermesRunsBffEvent[] = [
  {
    ...baseEvent("run.reconnecting", 1),
    run: reconnectRun,
    reconnect: {
      attempt: 1,
      lastSequence: 8,
      reason: "stream_lost",
      retryAfterMs: 250
    }
  },
  {
    ...baseEvent("replay.snapshot", 2, completedAt),
    run: {
      ...reconnectRun,
      status: "replaying"
    },
    replay: {
      runRecord: replayRunRecord,
      activityReplay: [replayActivity],
      complete: false,
      source: "best_effort",
      excludedFields: ["full raw Hermes Runs event payloads"]
    }
  },
  {
    ...baseEvent("done", 3, completedAt),
    run: completedRun(reconnectRun)
  }
];

export const hermesRunsBffFixtureSequences = {
  basicSuccess: hermesRunsBffBasicSuccessEvents,
  activityTool: hermesRunsBffActivityToolEvents,
  approvalDeny: hermesRunsBffApprovalDenyEvents,
  stop: hermesRunsBffStopEvents,
  error: hermesRunsBffErrorEvents,
  reconnectReplay: hermesRunsBffReconnectReplayEvents
};

export const hermesRunsBffRequiredEventTypes: HermesRunsBffEvent["type"][] = [
  "run.started",
  "message.delta",
  "message.completed",
  "activity.event",
  "approval.request",
  "approval.responded",
  "run.stopping",
  "run.stopped",
  "run.completed",
  "run.failed",
  "run.reconnecting",
  "replay.snapshot",
  "error",
  "done"
];
