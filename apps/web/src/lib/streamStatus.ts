import { isCommandActivityEvent } from "@/lib/agentActivityEvents";
import type { AgentActivityEvent, AgentActivityStatus } from "@/types/agentActivity";

export type StreamStatusLabel = "Thinking" | "Running";

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
  if (events.some(isTemporaryActiveEvent)) {
    return "Running";
  }
  return "Thinking";
}
