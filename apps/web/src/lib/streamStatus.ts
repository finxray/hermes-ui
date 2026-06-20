import { isCommandActivityEvent } from "@/lib/agentActivityEvents";
import type { AgentActivityEvent, AgentActivityStatus } from "@/types/agentActivity";

export type StreamStatusLabel = string;

const STATUS_DETAIL_MAX_LENGTH = 86;

export function isActiveActivityStatus(status: AgentActivityStatus) {
  return status === "queued" || status === "running" || status === "waiting_for_approval";
}

export function isTemporaryActiveEvent(event: AgentActivityEvent) {
  if (!isActiveActivityStatus(event.status)) {
    return false;
  }
  if (event.type === "approval" || event.status === "waiting_for_approval") {
    return true;
  }
  return isCommandActivityEvent(event);
}

export function resolveStreamStatusLabel(events: AgentActivityEvent[]): StreamStatusLabel {
  const activeEvent = latestCurrentActiveEvent(events);
  if (activeEvent) {
    return labelForActiveEvent(activeEvent);
  }
  // Intermediate narration/reasoning lives in the activity timeline, while
  // final-answer deltas stream into the message body once classified.
  return "Thinking";
}

function latestCurrentActiveEvent(events: AgentActivityEvent[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (!isTemporaryActiveEvent(event)) {
      continue;
    }
    if (!hasLaterTerminalEvent(events, index, event)) {
      return event;
    }
  }
  return null;
}

function hasLaterTerminalEvent(events: AgentActivityEvent[], activeIndex: number, activeEvent: AgentActivityEvent) {
  const activeKey = eventCorrelationKey(activeEvent);
  if (!activeKey) {
    return false;
  }
  return events.slice(activeIndex + 1).some((event) => {
    if (!isTerminalActivityStatus(event.status)) {
      return false;
    }
    return eventCorrelationKey(event) === activeKey;
  });
}

function eventCorrelationKey(event: AgentActivityEvent) {
  return (
    event.hermes?.toolCallId ||
    event.hermes?.toolName ||
    event.command?.toolName ||
    event.command?.command ||
    event.title
  );
}

function isTerminalActivityStatus(status: AgentActivityStatus) {
  return status === "completed" || status === "failed" || status === "cancelled" || status === "info";
}

function labelForActiveEvent(event: AgentActivityEvent): StreamStatusLabel {
  if (event.type === "approval" || event.status === "waiting_for_approval") {
    return withDetail("Waiting for approval", activeEventTarget(event));
  }

  const target = activeEventTarget(event);
  const text = [
    event.type,
    event.title,
    event.summary,
    event.hermes?.eventType,
    event.hermes?.toolName,
    event.command?.toolName,
    event.command?.command,
    event.command?.args?.join(" "),
    event.memory?.operation,
    event.artifact?.action,
    event.artifact?.path
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(search|grep|rg|find|query|lookup)\b/.test(text)) {
    return withDetail("Searching", target);
  }
  if (/\b(read|cat|open|inspect|list|ls|get|load|fetch)\b/.test(text)) {
    return withDetail("Reading", target);
  }
  if (/\b(write|edit|patch|apply|create|update|save|move|rename|delete|remove)\b/.test(text)) {
    return withDetail("Editing", target);
  }
  if (/\b(shell|bash|powershell|cmd|terminal|exec|run|npm|node|python|pytest|test|build)\b/.test(text)) {
    return withDetail("Running", target);
  }
  if (event.status === "queued") {
    return "Preparing";
  }
  return isCommandActivityEvent(event) ? withDetail("Running", target) : withDetail("Thinking", target);
}

function activeEventTarget(event: AgentActivityEvent) {
  const command = event.command?.command || event.command?.args?.join(" ");
  if (command) {
    return shortenInline(command);
  }

  const path = event.artifact?.path || event.artifact?.title;
  if (path) {
    return shortenInline(path);
  }

  const memoryTarget = event.memory?.operation
    ? [event.memory.operation, event.memory.projectKey || event.memory.sessionKey].filter(Boolean).join(" ")
    : "";
  if (memoryTarget) {
    return shortenInline(memoryTarget);
  }

  const summaryTarget = extractLikelyTarget(event.summary) || extractLikelyTarget(event.title);
  return summaryTarget ? shortenInline(summaryTarget) : "";
}

function extractLikelyTarget(value?: string) {
  const text = value?.trim();
  if (!text) {
    return "";
  }
  const quoted = text.match(/["'`]([^"'`]+)["'`]/)?.[1];
  if (quoted) {
    return quoted;
  }
  const path = text.match(/(?:[A-Za-z]:[\\/])?[\w./\\-]+(?:\.[A-Za-z0-9]{1,8})/)?.[0];
  if (path) {
    return path;
  }
  return text.length <= 52 ? text : "";
}

function withDetail(label: string, detail?: string) {
  return detail ? `${label} ${detail}` : label;
}

function shortenInline(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= STATUS_DETAIL_MAX_LENGTH) {
    return normalized;
  }
  return `${normalized.slice(0, STATUS_DETAIL_MAX_LENGTH - 1).trimEnd()}...`;
}
