import type { PersistedActivityEvent, RunRecord, Session } from "@/data/types";
import type { AgentActivityEvent } from "@/types/agentActivity";

export const MAX_PERSISTED_ACTIVITY_EVENTS_PER_RUN = 40;
export const MAX_PERSISTED_PREVIEW_CHARS = 900;
export const MAX_PERSISTED_DETAILS_CHARS = 1400;
export const MAX_PERSISTED_METADATA_KEYS = 16;

const SECRET_KEY_PATTERN = /api[_-]?key|authorization|bearer|credential|password|secret|token/i;
const BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_ASSIGNMENT_PATTERN =
  /\b(api[_-]?key|authorization|credential|password|secret|token)\s*[:=]\s*["']?[^"'\s,;]+/gi;

export type SessionExportPreview = {
  exportVersion: 1;
  exportedAt: string;
  session: {
    id: string;
    projectId: string;
    hermesSessionId: string;
    title: string;
    summary: string;
    createdAt: string;
    updatedAt: string;
  };
  memoryScope: Session["memoryScope"];
  messages: Session["messages"];
  runs: Array<{
    record: RunRecord;
    activityReplay: PersistedActivityEvent[];
  }>;
  excluded: string[];
};

export function createPersistedActivityEvent(
  event: AgentActivityEvent,
  runId: string
): PersistedActivityEvent {
  const sourceChannel = normalizeSourceChannel(
    event.command?.sourceChannel ??
      stringFromMetadata(event.metadata, "source_channel") ??
      stringFromMetadata(event.metadata, "channel") ??
      stringFromMetadata(event.metadata, "caller")
  );
  const persisted: PersistedActivityEvent = {
    id: event.id,
    runId,
    type: event.type,
    status: event.status,
    title: compactText(event.title, 160) || "Activity",
    summary: compactText(event.summary, MAX_PERSISTED_PREVIEW_CHARS),
    startedAt: safeTimestamp(event.startedAt),
    completedAt: safeTimestamp(event.completedAt),
    durationMs: normalizeDuration(event.durationMs),
    collapsedByDefault: event.collapsedByDefault !== false,
    source: event.source,
    sourceChannel,
    hermes: compactObject({
      eventType: event.hermes?.eventType,
      runId: event.hermes?.runId,
      sessionId: event.hermes?.sessionId,
      toolCallId: event.hermes?.toolCallId,
      toolName: event.hermes?.toolName
    }),
    memory: compactObject({
      memoryId: event.memory?.memoryId,
      operation: event.memory?.operation,
      projectKey: event.memory?.projectKey,
      scopeStatus: event.memory?.scopeStatus,
      sessionKey: event.memory?.sessionKey
    }),
    command: event.command
      ? compactObject({
          commandPreview: compactText(event.command.command, MAX_PERSISTED_PREVIEW_CHARS),
          cwd: compactText(event.command.cwd, 512),
          exitCode: normalizeNumber(event.command.exitCode),
          outputPreview: compactText(event.command.outputPreview, MAX_PERSISTED_PREVIEW_CHARS),
          sourceChannel: normalizeSourceChannel(event.command.sourceChannel),
          stderrPreview: compactText(event.command.stderrPreview, MAX_PERSISTED_PREVIEW_CHARS),
          stdoutPreview: compactText(event.command.stdoutPreview, MAX_PERSISTED_PREVIEW_CHARS),
          truncated: event.command.truncated === true
        })
      : undefined,
    approval: event.approval
      ? compactObject({
          approvalId: event.approval.approvalId,
          decision: event.approval.decision,
          requestedAction: event.approval.action,
          riskLevel: event.approval.riskLevel
        })
      : undefined,
    artifact: event.artifact
      ? compactObject({
          fileId: event.artifact.fileId ?? event.artifact.artifactId,
          kind: event.artifact.kind,
          path: event.artifact.path
        })
      : undefined,
    detailsPreview: compactActivityDetails(event),
    metadata: compactMetadata(event.metadata)
  };

  return redactPersistedActivityEvent(persisted);
}

export function compactActivityDetails(event: AgentActivityEvent): string | undefined {
  if (event.details === undefined) {
    return undefined;
  }
  return compactText(safeJson(redactValue(event.details)), MAX_PERSISTED_DETAILS_CHARS);
}

export function redactPersistedActivityEvent(
  event: PersistedActivityEvent
): PersistedActivityEvent {
  return redactValue(event) as PersistedActivityEvent;
}

export function limitPersistedActivityEvents(
  events: PersistedActivityEvent[],
  maxPerRun = MAX_PERSISTED_ACTIVITY_EVENTS_PER_RUN
): PersistedActivityEvent[] {
  const limit = Math.max(0, Math.min(maxPerRun, MAX_PERSISTED_ACTIVITY_EVENTS_PER_RUN));
  const deduped = new Map<string, PersistedActivityEvent>();
  for (const event of events) {
    deduped.set(event.id, event);
  }
  return Array.from(deduped.values()).slice(-limit);
}

export function restoreActivityEventFromPersisted(
  event: PersistedActivityEvent
): AgentActivityEvent {
  return {
    id: event.id,
    type: event.type,
    status: event.status,
    title: event.title,
    summary: event.summary,
    startedAt: event.startedAt,
    completedAt: event.completedAt,
    durationMs: event.durationMs,
    collapsedByDefault: event.collapsedByDefault,
    source: event.source,
    hermes: event.hermes,
    memory: event.memory,
    approval: event.approval
      ? {
          action: event.approval.requestedAction,
          actionAvailable: false,
          approvalId: event.approval.approvalId,
          decision: event.approval.decision,
          riskLevel: event.approval.riskLevel,
          unavailableReason: "Persisted replay is display-only"
        }
      : undefined,
    command: event.command
      ? {
          command: event.command.commandPreview,
          cwd: event.command.cwd,
          exitCode: event.command.exitCode,
          outputPreview: event.command.outputPreview,
          sourceChannel: event.command.sourceChannel,
          stderrPreview: event.command.stderrPreview,
          stdoutPreview: event.command.stdoutPreview,
          truncated: event.command.truncated
        }
      : undefined,
    artifact: event.artifact
      ? {
          fileId: event.artifact.fileId,
          kind: event.artifact.kind,
          path: event.artifact.path,
          source: event.source,
          status: event.status
        }
      : undefined,
    details: event.detailsPreview
      ? {
          preview: event.detailsPreview,
          replay: true
        }
      : undefined,
    metadata: event.metadata
  };
}

export function createRunReplaySummary(
  run: RunRecord,
  events: PersistedActivityEvent[] = run.activityReplay ?? []
) {
  return {
    approvalCount: events.filter((event) => event.type === "approval").length,
    commandCount: events.filter((event) => event.type === "command").length,
    errorCount: events.filter((event) => event.type === "error" || event.status === "failed").length,
    eventCount: events.length,
    memoryCount: events.filter((event) => event.type === "memory").length,
    stopped:
      run.stoppedByUser === true ||
      run.status === "stopped" ||
      events.some((event) => event.status === "cancelled"),
    toolCount: events.filter((event) => event.type === "tool").length
  };
}

export function createSessionExportPreview(
  session: Session,
  exportedAt = new Date().toISOString()
): SessionExportPreview {
  const preview: SessionExportPreview = {
    exportVersion: 1,
    exportedAt,
    session: {
      createdAt: session.createdAt,
      hermesSessionId: session.hermesSessionId,
      id: session.id,
      projectId: session.projectId,
      summary: session.summary,
      title: session.title,
      updatedAt: session.updatedAt
    },
    memoryScope: session.memoryScope,
    messages: session.messages,
    runs: session.runRecords.map((run) => ({
      record: run,
      activityReplay: run.activityReplay ?? []
    })),
    excluded: [
      "api keys and credentials",
      "full raw Hermes payloads",
      "full stdout/stderr/output beyond previews",
      "binary/blob data",
      "direct service URLs with secrets"
    ]
  };

  return redactValue(preview) as SessionExportPreview;
}

function compactMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .slice(0, MAX_PERSISTED_METADATA_KEYS)
    .map(([key, child]) => [key, compactMetadataValue(child)] as const)
    .filter(([, child]) => child !== undefined);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function compactMetadataValue(value: unknown): unknown {
  if (typeof value === "string") {
    return compactText(value, MAX_PERSISTED_PREVIEW_CHARS);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 12).map((item) => compactMetadataValue(item));
  }
  if (value && typeof value === "object") {
    return compactText(safeJson(value), MAX_PERSISTED_PREVIEW_CHARS);
  }
  return undefined;
}

function compactText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const redacted = redactText(value).replace(/\r\n/g, "\n").trim();
  if (!redacted) {
    return undefined;
  }
  return redacted.length > maxLength
    ? `${redacted.slice(0, Math.max(0, maxLength - 14))}\n... truncated`
    : redacted;
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> | undefined {
  const entries = Object.entries(value).filter(([, child]) => child !== undefined && child !== "");
  return entries.length > 0 ? Object.fromEntries(entries) as Partial<T> : undefined;
}

function normalizeSourceChannel(value: unknown): PersistedActivityEvent["sourceChannel"] {
  const normalized = typeof value === "string" ? value.trim().toLowerCase().replace(/[\s_]+/g, "-") : "";
  if (
    normalized === "web-ui" ||
    normalized === "telegram" ||
    normalized === "cli" ||
    normalized === "api" ||
    normalized === "unknown"
  ) {
    return normalized;
  }
  return "unknown";
}

function normalizeDuration(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function safeTimestamp(value: unknown): string | undefined {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : undefined;
}

function stringFromMetadata(metadata: unknown, key: string): string | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" ? value : undefined;
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? "";
  } catch {
    return "[unserializable]";
  }
}

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return "[redacted:depth]";
  }
  if (typeof value === "string") {
    return redactText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    redacted[key] = SECRET_KEY_PATTERN.test(key) ? "[redacted]" : redactValue(child, depth + 1);
  }
  return redacted;
}

function redactText(value: string) {
  return value
    .replace(BEARER_VALUE_PATTERN, "Bearer [redacted]")
    .replace(SECRET_ASSIGNMENT_PATTERN, "$1=[redacted]");
}
