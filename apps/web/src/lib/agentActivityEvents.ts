import type { HermesChatStreamEvent } from "@hermes-ui/hermes-client";
import type {
  AgentActivityEvent,
  AgentActivitySource,
  AgentActivityStatus,
  AgentActivityType
} from "@/types/agentActivity";

type ActivityOptions = {
  id?: string;
  now?: string;
};

type MemoryOperation =
  | "store"
  | "search"
  | "health_check"
  | "retrieve"
  | "update"
  | "delete"
  | "unknown";

const SECRET_KEY_PATTERN = /api[_-]?key|authorization|bearer|credential|password|secret|token/i;
const BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;

export function createActivityEventFromHermesStreamEvent(
  event: HermesChatStreamEvent,
  options: ActivityOptions = {}
): AgentActivityEvent | null {
  if (event.type === "tool_event") {
    return createActivityEventFromHermesToolEvent(event, options);
  }
  if (event.type === "run_event") {
    return createActivityEventFromHermesRunEvent(event, options);
  }
  if (event.type === "error") {
    return createActivityEventFromHermesError(event, options);
  }
  if (event.type === "done") {
    return {
      id: makeActivityId("stream", "done", {}, options),
      type: "stream",
      status: "completed",
      title: "Stream completed",
      collapsedByDefault: true,
      details: redactActivityDetails(event),
      source: "hermes"
    };
  }
  if (event.type === "message_done") {
    return {
      id: makeActivityId("stream", "message_done", { message_id: event.messageId, run_id: event.runId }, options),
      type: "stream",
      status: "completed",
      title: "Assistant message completed",
      collapsedByDefault: true,
      details: redactActivityDetails(event),
      source: "hermes",
      hermes: {
        eventType: "message_done",
        messageId: event.messageId,
        runId: event.runId
      }
    };
  }
  return null;
}

export function createActivityEventFromHermesToolEvent(
  event: Extract<HermesChatStreamEvent, { type: "tool_event" }>,
  options: ActivityOptions = {}
): AgentActivityEvent {
  const payload = event.payload ?? {};
  const classification = classifyToolEventSource(event.name, payload);
  const memoryOperation =
    classification.type === "memory" ? classifyMemoryOperation(event.name, payload) : "unknown";
  const status = normalizeActivityStatus(event.status);
  const occurredAt = getPayloadTime(payload) ?? options.now;
  const title = activityTitleForTool(event.name, classification.type, memoryOperation);
  const details = redactActivityDetails(payload);

  return {
    id: makeActivityId(classification.type, event.name, payload, options),
    type: classification.type,
    status,
    title,
    summary: getPayloadSummary(payload),
    startedAt: status === "running" ? occurredAt : undefined,
    completedAt: status === "completed" || status === "failed" ? occurredAt : undefined,
    collapsedByDefault: true,
    details,
    source: classification.source,
    hermes: {
      eventType: `tool.${event.status}`,
      runId: asString(payload.run_id),
      sessionId: asString(payload.session_id),
      toolCallId: asString(payload.tool_call_id) || asString(payload.toolCallId),
      toolName: event.name
    },
    memory:
      classification.type === "memory"
        ? {
            memoryId: asString(payload.memory_id) || asString(payload.id),
            operation: memoryOperation,
            projectKey: asString(payload.project_key) || asString(payload.projectKey),
            scopeStatus: asString(payload.scope_status) || asString(payload.scopeStatus),
            sessionKey: asString(payload.session_key) || asString(payload.sessionKey)
          }
        : undefined,
    metadata: getActivityMetadata(payload)
  };
}

export function createActivityEventFromHermesRunEvent(
  event: Extract<HermesChatStreamEvent, { type: "run_event" }>,
  options: ActivityOptions = {}
): AgentActivityEvent {
  const payload = event.payload ?? {};
  const status = normalizeActivityStatus(event.status || event.name);
  const eventType = asString(payload.event) || event.name;
  const occurredAt = getPayloadTime(payload) ?? options.now;
  const type = activityTypeForRunEvent(eventType, status);

  return {
    id: makeActivityId(type, eventType, payload, options),
    type,
    status,
    title: titleFromEventType(eventType, type),
    summary: getPayloadSummary(payload),
    startedAt: status === "running" ? occurredAt : undefined,
    completedAt: status === "completed" || status === "failed" || status === "cancelled" ? occurredAt : undefined,
    collapsedByDefault: type !== "approval" && status !== "failed",
    details: redactActivityDetails(payload),
    source: "hermes",
    hermes: {
      eventType,
      runId: asString(payload.run_id),
      sessionId: asString(payload.session_id),
      toolName: asString(payload.tool_name)
    },
    metadata: getActivityMetadata(payload)
  };
}

export function createActivityEventFromHermesError(
  event: Extract<HermesChatStreamEvent, { type: "error" }>,
  options: ActivityOptions = {}
): AgentActivityEvent {
  return {
    id: makeActivityId("error", event.error.kind, event.error as unknown as Record<string, unknown>, options),
    type: "error",
    status: "failed",
    title: "Hermes stream error",
    summary: event.error.message,
    completedAt: options.now,
    collapsedByDefault: false,
    details: redactActivityDetails(event.error),
    source: "hermes",
    hermes: {
      eventType: "error"
    },
    metadata: {
      errorKind: event.error.kind
    }
  };
}

export function makeElapsedActivityEvent(args: {
  id?: string;
  title?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  source?: AgentActivitySource;
  hermes?: AgentActivityEvent["hermes"];
}): AgentActivityEvent {
  return {
    id: args.id ?? `elapsed-${args.startedAt}-${args.completedAt}`,
    type: "elapsed",
    status: "info",
    title: args.title ?? `Worked for ${formatDuration(args.durationMs)}`,
    startedAt: args.startedAt,
    completedAt: args.completedAt,
    durationMs: args.durationMs,
    collapsedByDefault: true,
    source: args.source ?? "ui",
    hermes: args.hermes
  };
}

export function formatActivityDuration(durationMs: number) {
  return formatDuration(durationMs);
}

export function classifyToolEventSource(
  toolName: string,
  payload: Record<string, unknown> = {}
): { type: Extract<AgentActivityType, "command" | "memory" | "tool">; source: AgentActivitySource } {
  const normalized = normalizeName(toolName);
  if (isMemoryTool(normalized, payload)) {
    return { source: "brain-memory", type: "memory" };
  }
  if (isCommandTool(normalized, payload)) {
    return { source: "mcp", type: "command" };
  }
  return { source: "hermes", type: "tool" };
}

export function classifyMemoryOperation(
  toolName: string,
  payload: Record<string, unknown> = {}
): MemoryOperation {
  const explicit = normalizeName(asString(payload.operation) || asString(payload.action));
  const name = normalizeName(toolName);
  const combined = `${name} ${explicit}`.trim();

  if (combined.includes("health")) {
    return "health_check";
  }
  if (combined.includes("search") || combined.includes("query") || combined.includes("find")) {
    return "search";
  }
  if (combined.includes("store") || combined.includes("write") || combined.includes("remember") || combined.includes("add")) {
    return "store";
  }
  if (combined.includes("retrieve") || combined.includes("read") || combined.includes("get")) {
    return "retrieve";
  }
  if (combined.includes("update") || combined.includes("supersede") || combined.includes("pin")) {
    return "update";
  }
  if (combined.includes("delete") || combined.includes("remove")) {
    return "delete";
  }
  return "unknown";
}

export function normalizeActivityStatus(value: string): AgentActivityStatus {
  const status = normalizeName(value);
  if (status.includes("approval") || status.includes("waiting") || status.includes("blocked")) {
    return "waiting_for_approval";
  }
  if (status.includes("cancelled") || status.includes("canceled")) {
    return "cancelled";
  }
  if (status.includes("fail") || status.includes("error")) {
    return "failed";
  }
  if (status.includes("complete") || status.includes("success") || status === "done") {
    return "completed";
  }
  if (status.includes("start") || status.includes("running") || status.includes("progress")) {
    return "running";
  }
  if (status.includes("queued") || status.includes("pending")) {
    return "queued";
  }
  return "info";
}

export function redactActivityDetails(value: unknown): unknown {
  return redactValue(value, 0);
}

function activityTitleForTool(
  toolName: string,
  type: Extract<AgentActivityType, "command" | "memory" | "tool">,
  operation: MemoryOperation
) {
  if (type === "memory") {
    if (operation === "store") {
      return "Stored memory";
    }
    if (operation === "search") {
      return "Searched memory";
    }
    if (operation === "health_check") {
      return "Checked memory health";
    }
    if (operation === "retrieve") {
      return "Retrieved memory";
    }
    if (operation === "update") {
      return "Updated memory";
    }
    if (operation === "delete") {
      return "Deleted memory";
    }
    return "Memory activity";
  }
  if (type === "command") {
    return getCommandTitle(toolName);
  }
  return toolName || "Hermes tool";
}

function activityTypeForRunEvent(eventType: string, status: AgentActivityStatus): AgentActivityType {
  const normalized = normalizeName(eventType);
  if (normalized.includes("approval")) {
    return "approval";
  }
  if (status === "failed") {
    return "error";
  }
  return "status";
}

function titleFromEventType(eventType: string, type: AgentActivityType): string {
  if (type === "approval") {
    return normalizeName(eventType).includes("responded") ? "Approval responded" : "Approval required";
  }
  if (type === "error") {
    return "Run failed";
  }
  const raw = eventType.replace(/^run\./, "Run ");
  return raw
    .replaceAll(".", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isMemoryTool(normalizedToolName: string, payload: Record<string, unknown>) {
  const source = normalizeName(asString(payload.source) || asString(payload.server) || asString(payload.tool_source));
  return (
    normalizedToolName.includes("brain_memory") ||
    normalizedToolName.includes("memory_") ||
    normalizedToolName.startsWith("memory") ||
    source.includes("brain_memory") ||
    source.includes("brain memory")
  );
}

function isCommandTool(normalizedToolName: string, payload: Record<string, unknown>) {
  return (
    normalizedToolName.includes("shell") ||
    normalizedToolName.includes("terminal") ||
    normalizedToolName.includes("powershell") ||
    normalizedToolName.includes("bash") ||
    normalizedToolName.includes("command") ||
    normalizedToolName.includes("exec") ||
    typeof payload.command === "string" ||
    typeof payload.cmd === "string" ||
    typeof payload.cwd === "string" ||
    typeof payload.stdout === "string" ||
    typeof payload.stderr === "string" ||
    typeof payload.exit_code === "number"
  );
}

function getPayloadSummary(payload: Record<string, unknown>) {
  for (const key of ["preview", "summary", "message", "detail", "error"]) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return redactText(value.trim());
    }
  }
  return undefined;
}

function getPayloadTime(payload: Record<string, unknown>) {
  return asString(payload.ts) || asString(payload.timestamp) || asString(payload.time) || undefined;
}

function getActivityMetadata(payload: Record<string, unknown>): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = {};
  for (const key of ["seq", "message_id", "layer", "memory_layer", "result_count", "exit_code"]) {
    if (payload[key] !== undefined) {
      metadata[key] = redactActivityDetails(payload[key]);
    }
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function getCommandTitle(toolName: string) {
  return toolName ? `Ran ${toolName}` : "Ran command";
}

function makeActivityId(
  type: AgentActivityType,
  name: string,
  payload: Record<string, unknown>,
  options: ActivityOptions
) {
  if (options.id) {
    return options.id;
  }
  const stable =
    asString(payload.event_id) ||
    asString(payload.id) ||
    asString(payload.tool_call_id) ||
    asString(payload.message_id) ||
    asString(payload.seq);
  if (stable) {
    return `activity-${type}-${stable}`;
  }
  const suffix = options.now ?? Date.now().toString(36);
  return `activity-${type}-${normalizeName(name) || "event"}-${suffix}`;
}

function redactValue(value: unknown, depth: number): unknown {
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
  return value.replace(BEARER_VALUE_PATTERN, "Bearer [redacted]");
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/[\s.-]+/g, "_");
}

function formatDuration(durationMs: number) {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
