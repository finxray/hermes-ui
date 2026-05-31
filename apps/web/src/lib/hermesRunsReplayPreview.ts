import type {
  HermesRunProbeEvent,
  HermesRunsExperimentalChatResult
} from "@hermes-ui/hermes-client";
import type {
  PersistedActivityEvent,
  RunActivitySummary,
  RunRecord,
  RunRecordStatus
} from "@/data/types";
import type { AgentActivityEvent } from "@/types/agentActivity";
import { createActivityEventFromHermesRunsEvent } from "./agentActivityEvents";
import {
  createPersistedActivityEvent,
  limitPersistedActivityEvents
} from "./persistedActivityReplay";

export const RUNS_REPLAY_EXCLUDED_FIELDS = [
  "per-token message.delta replay rows",
  "full raw Hermes Runs event payloads",
  "full stdout/stderr/output streams",
  "binary/blob data",
  "API keys, bearer tokens, credentials, and secrets",
  "direct service URLs with secrets",
  "command execution handles and rerun instructions",
  "approval action handles",
  "hidden/private reasoning text"
];

export type HermesRunsReplayPrototype = {
  activityReplayPreview: PersistedActivityEvent[];
  activitySummary: RunActivitySummary;
  replayExcludedFields: string[];
  runRecordPreview: RunRecord | null;
};

export function createRunRecordFromHermesRunsResult(
  result: HermesRunsExperimentalChatResult
): HermesRunsReplayPrototype {
  if (!result.runId || !result.context) {
    const emptySummary = createActivitySummary([]);
    return {
      activityReplayPreview: [],
      activitySummary: emptySummary,
      replayExcludedFields: RUNS_REPLAY_EXCLUDED_FIELDS,
      runRecordPreview: null
    };
  }

  const startedAt = safeIso(result.checkedAt) ?? new Date().toISOString();
  const durationMs = safeDuration(result.timings?.durationMs);
  const completedAt = terminalCompletedAt(result.events, startedAt, durationMs);
  const runRecordId = createLocalRunRecordId(result.context.sessionId, startedAt);
  const activityEvents = createActivityEventsFromRunsProbeEvents(result, runRecordId);
  const activityReplay = limitPersistedActivityEvents(
    activityEvents.map((event) => createPersistedActivityEvent(event, runRecordId))
  );
  const activitySummary = createActivitySummary(activityEvents);
  const status = mapRunsStatusToRunRecordStatus(result.status, result.mode);

  const runRecordPreview: RunRecord = {
    id: runRecordId,
    projectId: result.context.projectId,
    sessionId: result.context.sessionId,
    hermesSessionId: result.context.hermesSessionId,
    hermesRunId: result.runId,
    sourceChannel: "web-ui",
    status,
    startedAt,
    completedAt,
    durationMs,
    modelLabel: "Hermes server model",
    providerLabel: "Hermes server config",
    summary: runRecordSummary(status, activityReplay.length),
    metadata: {
      eventSource: "hermes-runs",
      eventsComplete: result.mode === "success" || result.mode === "failed",
      finalStatusName: result.status ?? null,
      messageDeltaEvents: result.counts?.messageDeltaEvents ?? 0,
      rawRunsPayloadPersisted: false,
      excludedMessageDeltaEvents: result.counts?.messageDeltaEvents ?? 0,
      replayEventTypes: Array.from(new Set(activityReplay.map((event) => event.hermes?.eventType).filter(Boolean))),
      replayGeneratedFrom: "normalized-run-probe-events",
      runsEventCount: result.counts?.events ?? result.events.length,
      runsNonDeltaEventTypes: result.eventTypes.filter((eventType) => eventType !== "message.delta")
    },
    activityEventIds: activityEvents.map((event) => event.id),
    activitySummary,
    activityReplay
  };

  return {
    activityReplayPreview: activityReplay,
    activitySummary,
    replayExcludedFields: RUNS_REPLAY_EXCLUDED_FIELDS,
    runRecordPreview
  };
}

function createActivityEventsFromRunsProbeEvents(
  result: HermesRunsExperimentalChatResult,
  localRunRecordId: string
): AgentActivityEvent[] {
  return result.events
    .map((event, index) => createActivityEventFromHermesRunsEvent(
      runProbeEventToRunsPayload(event, result, index),
      {
        id: `activity-runs-preview-${localRunRecordId}-${index}`,
        now: safeIso(result.checkedAt)
      }
    ))
    .filter((event): event is AgentActivityEvent => Boolean(event));
}

function runProbeEventToRunsPayload(
  event: HermesRunProbeEvent,
  result: HermesRunsExperimentalChatResult,
  index: number
): Record<string, unknown> {
  return {
    event: event.event,
    event_id: `runs-preview-${index}`,
    run_id: event.runId ?? result.runId ?? undefined,
    session_id: result.context.hermesSessionId,
    source_channel: "web-ui",
    timestamp: event.timestamp,
    tool: event.toolName,
    output: event.outputPreview,
    delta: event.deltaPreview,
    error: event.errorPreview,
    seq: index
  };
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

function mapRunsStatusToRunRecordStatus(
  status: string | null,
  mode: HermesRunsExperimentalChatResult["mode"]
): RunRecordStatus {
  const normalized = (status ?? "").trim().toLowerCase();
  if (normalized.includes("complete") || normalized === "done" || mode === "success") {
    return "completed";
  }
  if (normalized.includes("cancel") || normalized.includes("interrupt")) {
    return "cancelled";
  }
  if (normalized.includes("stop")) {
    return "stopped";
  }
  if (normalized.includes("fail") || normalized.includes("error") || mode === "failed") {
    return "failed";
  }
  return "running";
}

function runRecordSummary(status: RunRecordStatus, replayCount: number) {
  if (status === "completed") {
    return `Hermes Runs prototype completed with ${replayCount} replay event${replayCount === 1 ? "" : "s"}.`;
  }
  if (status === "failed") {
    return "Hermes Runs prototype failed; replay preview contains the redacted observed activity.";
  }
  if (status === "cancelled" || status === "stopped") {
    return "Hermes Runs prototype was cancelled or stopped.";
  }
  return "Hermes Runs prototype is not terminal.";
}

function createLocalRunRecordId(sessionId: string, startedAt: string) {
  const safeSessionId = sessionId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 96) || "session";
  const timePart = Number.isFinite(Date.parse(startedAt))
    ? Date.parse(startedAt).toString(36)
    : Date.now().toString(36);
  return `run-preview-${safeSessionId}-${timePart}`;
}

function terminalCompletedAt(
  events: HermesRunProbeEvent[],
  startedAt: string,
  durationMs?: number
): string | undefined {
  const terminal = [...events].reverse().find((event) =>
    ["run.completed", "run.failed", "run.cancelled", "run.canceled", "run.stopped", "run.interrupted"].includes(event.event)
  );
  const terminalTimestamp = safeEventTimestamp(terminal?.timestamp);
  if (terminalTimestamp) {
    return terminalTimestamp;
  }
  if (durationMs !== undefined && Number.isFinite(Date.parse(startedAt))) {
    return new Date(Date.parse(startedAt) + durationMs).toISOString();
  }
  return undefined;
}

function safeDuration(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : undefined;
}

function safeEventTimestamp(value: unknown): string | undefined {
  if (typeof value === "string") {
    return safeIso(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const milliseconds = value > 10_000_000_000 ? value : value * 1000;
    return new Date(milliseconds).toISOString();
  }
  return undefined;
}

function safeIso(value: unknown): string | undefined {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : undefined;
}
