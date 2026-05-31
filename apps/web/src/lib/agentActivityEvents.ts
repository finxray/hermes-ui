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

type CommandDetails = NonNullable<AgentActivityEvent["command"]>;

const SECRET_KEY_PATTERN = /api[_-]?key|authorization|bearer|credential|password|secret|token/i;
const BEARER_VALUE_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const COMMAND_OUTPUT_PREVIEW_LIMIT = 1200;

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
  if (event.type === "approval_event") {
    return createActivityEventFromHermesApprovalEvent(event, options);
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
  const occurredAt = getPayloadTime(payload) ?? options.now;
  const command = classification.type === "command" ? extractCommandDetailsFromPayload(event.name, payload) : undefined;
  const status = normalizeCommandStatus(normalizeActivityStatus(event.status), command);
  const title = activityTitleForTool(event.name, classification.type, memoryOperation, command, status);
  const details = redactActivityDetails(payload);
  const artifact = getArtifactData(payload, status);

  return {
    id: makeActivityId(classification.type, `${event.name}-${event.status}`, payload, options),
    type: classification.type,
    status,
    title,
    summary: getPayloadSummary(payload),
    startedAt: status === "running" ? occurredAt : undefined,
    completedAt: status === "completed" || status === "failed" ? occurredAt : undefined,
    collapsedByDefault: true,
    details,
    durationMs: command?.durationMs,
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
    command,
    artifact,
    metadata: getActivityMetadata(payload)
  };
}

export function createActivityEventFromHermesRunEvent(
  event: Extract<HermesChatStreamEvent, { type: "run_event" }>,
  options: ActivityOptions = {}
): AgentActivityEvent {
  const payload = event.payload ?? {};
  const eventType = asString(payload.event) || event.name;
  const status = normalizeApprovalStatus(eventType, event.status) ?? normalizeActivityStatus(event.status || event.name);
  const occurredAt = getPayloadTime(payload) ?? options.now;
  const type = activityTypeForRunEvent(eventType, status);
  const artifact = getArtifactData(payload, status);

  return {
    id: makeActivityId(type, `${eventType}-${event.status}`, payload, options),
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
    approval: type === "approval" ? getApprovalData(payload, status) : undefined,
    artifact,
    metadata: getActivityMetadata(payload)
  };
}

export function createActivityEventFromHermesApprovalEvent(
  event: Extract<HermesChatStreamEvent, { type: "approval_event" }>,
  options: ActivityOptions = {}
): AgentActivityEvent {
  const payload = event.payload ?? {};
  const eventType = asString(payload.event) || event.name;
  const status = normalizeApprovalStatus(eventType, event.status) ?? normalizeActivityStatus(event.status || event.name);
  const occurredAt = getPayloadTime(payload) ?? options.now;

  return {
    id: makeActivityId("approval", `${eventType}-${event.status}`, payload, options),
    type: "approval",
    status,
    title: titleFromEventType(eventType, "approval"),
    summary: getApprovalSummary(payload) ?? getPayloadSummary(payload),
    startedAt: status === "waiting_for_approval" || status === "running" ? occurredAt : undefined,
    completedAt: status === "completed" || status === "failed" || status === "cancelled" ? occurredAt : undefined,
    collapsedByDefault: false,
    details: redactActivityDetails(payload),
    source: "hermes",
    hermes: {
      eventType,
      runId: asString(payload.run_id),
      sessionId: asString(payload.session_id)
    },
    approval: getApprovalData(payload, status),
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
    title: args.title ?? `Worked for ${formatActivityDuration(args.durationMs)}`,
    startedAt: args.startedAt,
    completedAt: args.completedAt,
    durationMs: args.durationMs,
    collapsedByDefault: true,
    source: args.source ?? "ui",
    hermes: args.hermes
  };
}

export function makeStoppedActivityEvent(args: {
  id?: string;
  stoppedAt: string;
  startedAt?: string;
  durationMs?: number;
  source?: AgentActivitySource;
  summary?: string;
  details?: Record<string, unknown>;
  hermes?: AgentActivityEvent["hermes"];
}): AgentActivityEvent {
  return {
    id: args.id ?? `stopped-${args.stoppedAt}`,
    type: "status",
    status: "cancelled",
    title: "Stopped",
    summary: args.summary ?? "Generation stopped by user",
    startedAt: args.startedAt,
    completedAt: args.stoppedAt,
    durationMs: args.durationMs,
    collapsedByDefault: true,
    details: redactActivityDetails({
      stopStrategy: "client_stream_abort",
      ...(args.details ?? {})
    }),
    source: args.source ?? "ui",
    hermes: args.hermes
  };
}

export function formatActivityDuration(durationMs: number) {
  return formatDuration(durationMs);
}

export function computeActivityDuration(event: AgentActivityEvent) {
  return event.durationMs ?? computeRunElapsed(event.startedAt, event.completedAt);
}

export function computeRunElapsed(startedAt?: string, completedAt?: string) {
  const started = safeStartedAt(startedAt);
  const completed = safeCompletedAt(completedAt);
  if (!started || !completed) {
    return undefined;
  }
  const durationMs = Date.parse(completed) - Date.parse(started);
  return durationMs >= 0 ? durationMs : undefined;
}

export function safeStartedAt(value?: string | null) {
  return safeIsoLikeTime(value);
}

export function safeCompletedAt(value?: string | null) {
  return safeIsoLikeTime(value);
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

export function isCommandActivityEvent(event: AgentActivityEvent) {
  return event.type === "command" || Boolean(event.command);
}

export function extractCommandDetails(event: AgentActivityEvent): CommandDetails | undefined {
  if (event.command) {
    return event.command;
  }
  const details = objectRecord(event.details);
  if (!details) {
    return undefined;
  }
  return extractCommandDetailsFromPayload(event.hermes?.toolName ?? event.title, details);
}

export function formatCommandTitle(details?: CommandDetails, status: AgentActivityStatus = "info") {
  if (status === "failed") {
    return "Command failed";
  }
  if (status === "running" || status === "queued") {
    return "Running command";
  }
  if (status === "completed") {
    return "Command completed";
  }
  return details?.command ? "Ran command" : "Command activity";
}

export function normalizeExitCode(details?: CommandDetails) {
  return typeof details?.exitCode === "number" && Number.isFinite(details.exitCode)
    ? details.exitCode
    : undefined;
}

export function truncateCommandOutput(text: string, maxLength = COMMAND_OUTPUT_PREVIEW_LIMIT) {
  const clean = text.replace(/\r\n/g, "\n");
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}\n... truncated` : clean;
}

export function redactCommandOutput(text: string) {
  return redactText(text);
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
  operation: MemoryOperation,
  command?: CommandDetails,
  status?: AgentActivityStatus
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
    return formatCommandTitle(command, status);
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
    const normalized = normalizeName(eventType);
    if (normalized.includes("responded")) {
      return "Approval responded";
    }
    if (normalized.includes("deny") || normalized.includes("reject")) {
      return "Approval denied";
    }
    return "Approval required";
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
    normalizedToolName.includes("python") ||
    normalizedToolName.includes("npm") ||
    normalizedToolName.includes("run_command") ||
    normalizedToolName.includes("command") ||
    normalizedToolName.includes("exec") ||
    typeof payload.command === "string" ||
    typeof payload.cmd === "string" ||
    typeof payload.args === "string" ||
    Array.isArray(payload.args) ||
    typeof payload.cwd === "string" ||
    typeof payload.stdout === "string" ||
    typeof payload.stderr === "string" ||
    typeof payload.output === "string" ||
    typeof payload.exit_code === "number" ||
    typeof payload.exitCode === "number" ||
    typeof payload.return_code === "number" ||
    typeof payload.returnCode === "number"
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

function getApprovalSummary(payload: Record<string, unknown>) {
  for (const key of ["prompt", "question", "action", "requested_action", "command", "preview", "summary", "message"]) {
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
  for (const key of ["seq", "message_id", "layer", "memory_layer", "result_count", "exit_code", "exitCode", "return_code", "returnCode", "approval_id", "choice", "risk_level", "resolved", "channel", "source_channel", "caller"]) {
    if (payload[key] !== undefined) {
      metadata[key] = redactActivityDetails(payload[key]);
    }
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function extractCommandDetailsFromPayload(
  toolName: string,
  payload: Record<string, unknown>
): CommandDetails | undefined {
  const nested = objectRecord(payload.command_result) ?? objectRecord(payload.result);
  const source = nested ? { ...payload, ...nested } : payload;
  const command = commandText(source);
  const args = commandArgs(source);
  const cwd = asString(source.cwd) || asString(source.working_directory) || asString(source.workingDirectory);
  const stdout = asString(source.stdout);
  const stderr = asString(source.stderr);
  const output = asString(source.output) || asString(source.result_text) || asString(source.resultText);
  const exitCode = exitCodeFromPayload(source);
  const durationMs = asNumber(source.duration_ms) ?? asNumber(source.durationMs) ?? asNumber(source.elapsed_ms) ?? asNumber(source.elapsedMs);
  const sourceChannel = normalizeSourceChannel(
    asString(source.source_channel) ||
      asString(source.sourceChannel) ||
      asString(source.channel) ||
      asString(source.caller) ||
      asString(source.source)
  );
  const stdoutPreview = previewCommandOutput(stdout);
  const stderrPreview = previewCommandOutput(stderr);
  const outputPreview = previewCommandOutput(output);
  const truncated =
    isTruncated(stdout, stdoutPreview) ||
    isTruncated(stderr, stderrPreview) ||
    isTruncated(output, outputPreview);

  if (!command && args.length === 0 && !cwd && !stdoutPreview && !stderrPreview && !outputPreview && exitCode === undefined) {
    return undefined;
  }

  return {
    args: args.length > 0 ? args : undefined,
    command: command || undefined,
    cwd: cwd || undefined,
    durationMs,
    exitCode,
    outputPreview,
    sourceChannel,
    stderrPreview,
    stdoutPreview,
    toolName: toolName || undefined,
    truncated: truncated || undefined
  };
}

function normalizeCommandStatus(status: AgentActivityStatus, command?: CommandDetails): AgentActivityStatus {
  const exitCode = normalizeExitCode(command);
  if (typeof exitCode === "number" && exitCode !== 0 && status === "completed") {
    return "failed";
  }
  return status;
}

function commandText(payload: Record<string, unknown>) {
  const command =
    asString(payload.command) ||
    asString(payload.cmd) ||
    asString(payload.shell_command) ||
    asString(payload.shellCommand);
  return redactCommandOutput(command).trim();
}

function commandArgs(payload: Record<string, unknown>) {
  const raw = payload.args ?? payload.argv;
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string | number | boolean => ["string", "number", "boolean"].includes(typeof item))
      .map((item) => redactCommandOutput(String(item)));
  }
  const text = asString(raw);
  return text ? [redactCommandOutput(text)] : [];
}

function exitCodeFromPayload(payload: Record<string, unknown>) {
  return (
    asNumber(payload.exit_code) ??
    asNumber(payload.exitCode) ??
    asNumber(payload.return_code) ??
    asNumber(payload.returnCode) ??
    asNumber(payload.code)
  );
}

function previewCommandOutput(value: string) {
  if (!value.trim()) {
    return undefined;
  }
  return truncateCommandOutput(redactCommandOutput(value.trim()));
}

function isTruncated(raw: string, preview?: string) {
  return Boolean(preview && raw.trim().length > preview.length);
}

function normalizeSourceChannel(value: string): CommandDetails["sourceChannel"] {
  const normalized = normalizeName(value);
  if (normalized === "web_ui" || normalized === "web") {
    return "web-ui";
  }
  if (normalized === "telegram") {
    return "telegram";
  }
  if (normalized === "cli" || normalized === "terminal") {
    return "cli";
  }
  if (normalized === "api") {
    return "api";
  }
  return value ? "unknown" : undefined;
}

function getApprovalData(
  payload: Record<string, unknown>,
  status: AgentActivityStatus
): AgentActivityEvent["approval"] {
  return {
    action: asString(payload.action) ||
      asString(payload.requested_action) ||
      asString(payload.command) ||
      asString(payload.tool_name) ||
      undefined,
    actionAvailable: false,
    approvalId: asString(payload.approval_id) || asString(payload.approvalId) || asString(payload.id) || undefined,
    choices: getStringList(payload.choices),
    decision: getApprovalDecision(payload, status),
    prompt: asString(payload.prompt) || asString(payload.question) || undefined,
    reason: asString(payload.reason) || undefined,
    respondedAt: asString(payload.responded_at) || asString(payload.respondedAt) || undefined,
    riskLevel: asString(payload.risk_level) || asString(payload.riskLevel) || asString(payload.risk) || undefined,
    unavailableReason: "Approval action unavailable in current stream path"
  };
}

function getArtifactData(
  payload: Record<string, unknown>,
  status: AgentActivityStatus
): AgentActivityEvent["artifact"] | undefined {
  const nested = objectRecord(payload.artifact) ?? objectRecord(payload.file);
  const source = nested ?? payload;
  const artifactId = asString(source.artifact_id) || asString(source.artifactId);
  const fileId = asString(source.file_id) || asString(source.fileId) || asString(source.id);
  const path =
    asString(source.path) ||
    asString(source.file_path) ||
    asString(source.filePath) ||
    asString(source.filename);
  const title = asString(source.title) || asString(source.name);
  const kind = asString(source.kind) || asString(source.type);
  const mimeType = asString(source.mime_type) || asString(source.mimeType);
  const action = asString(source.action) || asString(source.operation);
  const sizeBytes = asNumber(source.size_bytes) ?? asNumber(source.sizeBytes);

  if (!artifactId && !fileId && !path && !title) {
    return undefined;
  }

  return {
    action: action || undefined,
    artifactId: artifactId || undefined,
    fileId: fileId || undefined,
    kind: kind || undefined,
    mimeType: mimeType || undefined,
    path: path || undefined,
    sizeBytes,
    status,
    title: title || undefined
  };
}

function getApprovalDecision(payload: Record<string, unknown>, status: AgentActivityStatus) {
  const explicit =
    asString(payload.choice) ||
    asString(payload.decision) ||
    asString(payload.response) ||
    asString(payload.status);
  if (explicit) {
    return explicit;
  }
  if (typeof payload.approved === "boolean") {
    return payload.approved ? "approve" : "deny";
  }
  if (status === "cancelled") {
    return "deny";
  }
  return undefined;
}

function getStringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeApprovalStatus(eventType: string, status: string): AgentActivityStatus | null {
  const combined = normalizeName(`${eventType} ${status}`);
  if (!combined.includes("approval")) {
    return null;
  }
  if (
    combined.includes("deny") ||
    combined.includes("denied") ||
    combined.includes("reject") ||
    combined.includes("rejected")
  ) {
    return "cancelled";
  }
  if (
    combined.includes("responded") ||
    combined.includes("approved") ||
    combined.includes("allow") ||
    combined.includes("once") ||
    combined.includes("session") ||
    combined.includes("always")
  ) {
    return "completed";
  }
  if (
    combined.includes("request") ||
    combined.includes("required") ||
    combined.includes("waiting") ||
    combined.includes("pending")
  ) {
    return "waiting_for_approval";
  }
  if (combined.includes("fail") || combined.includes("error")) {
    return "failed";
  }
  return "info";
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
    return `activity-${type}-${normalizeName(name) || "event"}-${stable}`;
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

function safeIsoLikeTime(value?: string | null) {
  if (!value) {
    return undefined;
  }
  return Number.isFinite(Date.parse(value)) ? value : undefined;
}

function formatDuration(durationMs: number) {
  const normalizedMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  if (normalizedMs > 0 && normalizedMs < 1000) {
    return "<1s";
  }
  const seconds = Math.max(0, Math.round(normalizedMs / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours > 0) {
    return `${hours}h ${minutes}m ${remainder}s`;
  }
  return minutes > 0 ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}
