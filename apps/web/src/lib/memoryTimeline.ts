import type { AgentActivityEvent, AgentActivityStatus } from "@/types/agentActivity";

export type MemoryTimelineOperation =
  | "store"
  | "search"
  | "retrieve"
  | "health_check"
  | "update"
  | "delete"
  | "unknown";

export type MemoryTimelineStatus = "running" | "completed" | "failed" | "cancelled" | "info";

export type MemoryTimelineItem = {
  id: string;
  operation: MemoryTimelineOperation;
  status: MemoryTimelineStatus;
  title: string;
  summary?: string;
  projectKey?: string;
  sessionKey?: string;
  memoryId?: string;
  scopeStatus?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  sourceEventId: string;
  details?: unknown;
  collapsedByDefault: true;
};

type TimelineScope = {
  projectKey?: string;
  sessionKey?: string;
};

export function isMemoryActivityEvent(event: AgentActivityEvent) {
  return event.type === "memory" || event.source === "brain-memory" || Boolean(event.memory?.operation);
}

export function createMemoryTimelineItem(
  event: AgentActivityEvent,
  fallbackScope: TimelineScope = {}
): MemoryTimelineItem | null {
  if (!isMemoryActivityEvent(event)) {
    return null;
  }

  const operation = normalizeMemoryOperation(event.memory?.operation);
  const durationMs = event.durationMs ?? computeDuration(event.startedAt, event.completedAt);

  return {
    collapsedByDefault: true,
    completedAt: event.completedAt,
    details: redactTimelineDetails({
      details: event.details,
      hermes: event.hermes,
      memory: event.memory,
      metadata: event.metadata,
      source: event.source,
      status: event.status,
      type: event.type
    }),
    durationMs,
    id: `memory-timeline-${event.id}`,
    memoryId: event.memory?.memoryId,
    operation,
    projectKey: event.memory?.projectKey ?? fallbackScope.projectKey,
    scopeStatus: event.memory?.scopeStatus,
    sessionKey: event.memory?.sessionKey ?? fallbackScope.sessionKey,
    sourceEventId: event.id,
    startedAt: event.startedAt,
    status: normalizeTimelineStatus(event.status),
    summary: event.summary,
    title: event.title || formatMemoryOperation(operation)
  };
}

export function createMemoryTimelineItems(
  events: AgentActivityEvent[],
  fallbackScope: TimelineScope = {}
) {
  return events
    .map((event) => createMemoryTimelineItem(event, fallbackScope))
    .filter((item): item is MemoryTimelineItem => Boolean(item));
}

export function formatMemoryOperation(operation: MemoryTimelineOperation) {
  if (operation === "health_check") {
    return "Health check";
  }
  return operation.charAt(0).toUpperCase() + operation.slice(1);
}

export function formatMemoryScope(projectKey?: string, sessionKey?: string) {
  const parts = [
    projectKey ? `project ${projectKey}` : null,
    sessionKey ? `session ${sessionKey}` : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "scope unknown";
}

export function summarizeMemoryTimeline(items: MemoryTimelineItem[]) {
  const failed = items.filter((item) => item.status === "failed").length;
  const running = items.filter((item) => item.status === "running").length;
  const completed = items.filter((item) => item.status === "completed").length;
  return {
    completed,
    failed,
    latest: items.at(-1),
    running,
    total: items.length
  };
}

function normalizeMemoryOperation(value?: string): MemoryTimelineOperation {
  const operation = (value ?? "").trim().toLowerCase().replace(/[\s.-]+/g, "_");
  if (
    operation === "store" ||
    operation === "search" ||
    operation === "retrieve" ||
    operation === "health_check" ||
    operation === "update" ||
    operation === "delete"
  ) {
    return operation;
  }
  return "unknown";
}

function normalizeTimelineStatus(status: AgentActivityStatus): MemoryTimelineStatus {
  if (status === "running" || status === "queued" || status === "waiting_for_approval") {
    return "running";
  }
  if (status === "completed" || status === "failed" || status === "cancelled") {
    return status;
  }
  return "info";
}

function computeDuration(startedAt?: string, completedAt?: string) {
  if (!startedAt || !completedAt) {
    return undefined;
  }
  const duration = Date.parse(completedAt) - Date.parse(startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : undefined;
}

function redactTimelineDetails(value: unknown): unknown {
  return redactValue(value, 0);
}

function redactValue(value: unknown, depth: number): unknown {
  if (depth > 8) {
    return "[redacted:depth]";
  }
  if (typeof value === "string") {
    return value.replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]");
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    redacted[key] = /api[_-]?key|authorization|bearer|credential|password|secret|token/i.test(key)
      ? "[redacted]"
      : redactValue(child, depth + 1);
  }
  return redacted;
}
