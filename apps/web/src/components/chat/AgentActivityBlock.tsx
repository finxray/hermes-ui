import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Database,
  Hammer,
  Info,
  ShieldAlert,
  Terminal
} from "lucide-react";
import {
  computeActivityDuration,
  computeRunElapsed,
  extractCommandDetails,
  formatActivityDuration
} from "@/lib/agentActivityEvents";
import type { ToolEvent } from "@/data/types";
import type { AgentActivityEvent, AgentActivityStatus, AgentActivityType } from "@/types/agentActivity";
import styles from "./AgentActivityBlock.module.css";

type AgentActivityBlockProps = {
  events: AgentActivityEvent[];
  legacyEvents?: ToolEvent[];
  showThinking?: boolean;
};

type ActivityGroup = {
  id: string;
  events: AgentActivityEvent[];
  primary: AgentActivityEvent;
};

export function AgentActivityBlock({
  events,
  legacyEvents = [],
  showThinking = false
}: AgentActivityBlockProps) {
  const displayEvents = events.length > 0 ? events : legacyEvents.map(toActivityEventFromToolEvent);
  const groups = groupActivityEvents(displayEvents);

  if (!showThinking && groups.length === 0) {
    return null;
  }

  return (
    <section className={styles.wrap} aria-label="Agent activity">
      {showThinking ? <ThinkingRow /> : null}
      {groups.map((group) => (
        <ActivityDetails group={group} key={group.id} />
      ))}
    </section>
  );
}

function ThinkingRow() {
  return (
    <div className={styles.thinking} role="status">
      <span className={styles.icon} aria-hidden="true">
        <CircleDashed size={15} />
      </span>
      <span className={styles.thinkingText}>Thinking...</span>
    </div>
  );
}

function ActivityDetails({ group }: { group: ActivityGroup }) {
  const { primary } = group;
  const status = groupStatus(group.events);
  const summary = groupSummary(group.events, primary);
  const command = primary.type === "command" ? extractCommandDetails(primary) : undefined;
  const detailPayload = group.events.map((event) => ({
    id: event.id,
    type: event.type,
    status: event.status,
    title: event.title,
    summary: event.summary,
    source: event.source,
    hermes: event.hermes,
    memory: event.memory,
    approval: event.approval,
    command: event.command,
    artifact: event.artifact,
    metadata: event.metadata,
    details: event.details
  }));

  return (
    <details className={styles.block} data-status={status} data-type={primary.type}>
      <summary className={styles.summary}>
        <span className={styles.chevron} aria-hidden="true">
          <ChevronRight size={15} />
        </span>
        <span className={styles.icon} aria-hidden="true">
          <ActivityIcon type={primary.type} status={status} />
        </span>
        <span className={styles.content}>
          <span className={styles.titleRow}>
            <span className={styles.title}>{summary.title}</span>
            <span className={styles.status}>{statusLabel(status)}</span>
            {summary.duration ? <span className={styles.duration}>{summary.duration}</span> : null}
          </span>
          <span className={styles.subtitle}>{summary.subtitle}</span>
        </span>
      </summary>
      <div className={styles.details}>
        <dl className={styles.metaGrid}>
          <Meta label="source" value={primary.source} />
          <Meta label="type" value={primary.type} />
          {primary.memory?.operation ? <Meta label="operation" value={primary.memory.operation} /> : null}
          {primary.memory?.projectKey ? <Meta label="project" value={primary.memory.projectKey} /> : null}
          {primary.memory?.sessionKey ? <Meta label="session" value={primary.memory.sessionKey} /> : null}
          {command?.cwd ? <Meta label="cwd" value={command.cwd} /> : null}
          {command?.exitCode !== undefined ? <Meta label="exit" value={String(command.exitCode)} /> : null}
          {command?.sourceChannel ? <Meta label="channel" value={command.sourceChannel} /> : null}
          {primary.approval?.approvalId ? <Meta label="approval" value={primary.approval.approvalId} /> : null}
          {primary.approval?.decision ? <Meta label="decision" value={primary.approval.decision} /> : null}
          {primary.approval?.riskLevel ? <Meta label="risk" value={primary.approval.riskLevel} /> : null}
          {primary.hermes?.runId ? <Meta label="run" value={primary.hermes.runId} /> : null}
        </dl>
        {command ? <CommandDetails command={command} /> : null}
        <pre className={styles.pre}>{safeJson(detailPayload)}</pre>
      </div>
    </details>
  );
}

function CommandDetails({ command }: { command: NonNullable<AgentActivityEvent["command"]> }) {
  return (
    <div className={styles.commandDetails} aria-label="Command execution details">
      {command.command ? (
        <div className={styles.commandLine}>
          <span className={styles.commandLabel}>command</span>
          <code>{command.command}</code>
        </div>
      ) : null}
      {command.args?.length ? (
        <div className={styles.commandLine}>
          <span className={styles.commandLabel}>args</span>
          <code>{command.args.join(" ")}</code>
        </div>
      ) : null}
      {command.stdoutPreview ? <OutputBlock label="stdout" value={command.stdoutPreview} /> : null}
      {command.stderrPreview ? <OutputBlock label="stderr" value={command.stderrPreview} tone="error" /> : null}
      {command.outputPreview ? <OutputBlock label="output" value={command.outputPreview} /> : null}
    </div>
  );
}

function OutputBlock({ label, tone, value }: { label: string; tone?: "error"; value: string }) {
  return (
    <div className={styles.outputBlock} data-tone={tone}>
      <span className={styles.commandLabel}>{label}</span>
      <pre>{value}</pre>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function groupActivityEvents(events: AgentActivityEvent[]): ActivityGroup[] {
  const groups: ActivityGroup[] = [];

  for (const event of events) {
    const key = groupKey(event);
    const previous = groups.at(-1);
    if (previous && previous.id === key) {
      previous.events.push(event);
      previous.primary = choosePrimary(previous.events);
    } else {
      groups.push({
        events: [event],
        id: key,
        primary: event
      });
    }
  }

  return groups;
}

function groupKey(event: AgentActivityEvent) {
  if (event.type === "memory") {
    return `memory:${event.memory?.operation ?? event.title}:${event.memory?.memoryId ?? event.hermes?.toolName ?? event.title}`;
  }
  if (event.type === "tool" || event.type === "command") {
    return `${event.type}:${event.hermes?.toolCallId ?? event.command?.command ?? event.hermes?.toolName ?? event.title}`;
  }
  if (event.type === "approval") {
    return `approval:${event.approval?.approvalId ?? event.hermes?.runId ?? event.hermes?.eventType ?? event.title}`;
  }
  if (event.type === "status") {
    if (event.hermes?.runId) {
      return `status:run:${event.hermes.runId}`;
    }
    return `status:${event.hermes?.eventType ?? event.title}`;
  }
  return `${event.type}:${event.id}`;
}

function choosePrimary(events: AgentActivityEvent[]) {
  return events.find((event) => event.status === "failed") ?? events.at(-1) ?? events[0];
}

function groupStatus(events: AgentActivityEvent[]): AgentActivityStatus {
  if (events.some((event) => event.status === "failed")) {
    return "failed";
  }
  if (events.some((event) => event.status === "cancelled")) {
    return "cancelled";
  }
  if (
    events.some((event) => event.status === "waiting_for_approval") &&
    !events.some((event) => event.status === "completed")
  ) {
    return "waiting_for_approval";
  }
  if (events.some((event) => event.status === "running")) {
    return events.some((event) => event.status === "completed") ? "completed" : "running";
  }
  return events.at(-1)?.status ?? "info";
}

function groupSummary(events: AgentActivityEvent[], primary: AgentActivityEvent) {
  const first = events[0];
  const last = events.at(-1) ?? first;
  const durationMs = computeActivityDuration(primary) ?? computeRunElapsed(first.startedAt, last.completedAt);
  const eventCount = events.length > 1 ? `${events.length} events` : sourceLabel(primary);
  const commandDetails = primary.type === "command" ? extractCommandDetails(primary) : undefined;
  const subtitleParts = [
    commandDetails ? commandSubtitle(commandDetails) : primary.summary,
    primary.type === "approval" ? approvalAvailabilityLabel(primary) : null,
    primary.type === "memory" ? memoryScopeLabel(primary) : null,
    primary.type === "command" && commandDetails?.exitCode !== undefined ? `exit ${commandDetails.exitCode}` : null,
    primary.type === "command" && commandDetails?.sourceChannel ? `source ${commandDetails.sourceChannel}` : null,
    eventCount
  ].filter(Boolean);

  return {
    duration: typeof durationMs === "number" ? `Worked for ${formatActivityDuration(durationMs)}` : undefined,
    subtitle: subtitleParts.join(" - "),
    title: primary.title
  };
}

function commandSubtitle(command: NonNullable<AgentActivityEvent["command"]>) {
  if (command.command) {
    return command.command;
  }
  if (command.outputPreview) {
    return command.outputPreview.split("\n")[0];
  }
  if (command.stdoutPreview) {
    return command.stdoutPreview.split("\n")[0];
  }
  if (command.stderrPreview) {
    return command.stderrPreview.split("\n")[0];
  }
  return "Command output unavailable";
}

function approvalAvailabilityLabel(event: AgentActivityEvent) {
  if (event.approval?.actionAvailable) {
    return null;
  }
  return event.approval?.unavailableReason ?? "Approval action unavailable in current stream path";
}

function memoryScopeLabel(event: AgentActivityEvent) {
  const scope = [event.memory?.projectKey, event.memory?.sessionKey].filter(Boolean);
  return scope.length > 0 ? `scope ${scope.join(" / ")}` : null;
}

function sourceLabel(event: AgentActivityEvent) {
  if (event.source === "brain-memory") {
    return "brain-memory";
  }
  if (event.source === "mcp") {
    return "mcp";
  }
  return event.source;
}

function statusLabel(status: AgentActivityStatus) {
  if (status === "waiting_for_approval") {
    return "waiting";
  }
  return status;
}

function ActivityIcon({ status, type }: { status: AgentActivityStatus; type: AgentActivityType }) {
  if (status === "failed") {
    return <AlertTriangle size={15} />;
  }
  if (type === "approval") {
    return <ShieldAlert size={15} />;
  }
  if (status === "running" || status === "queued") {
    return <CircleDashed size={15} />;
  }
  if (type === "memory") {
    return <Database size={15} />;
  }
  if (type === "command") {
    return <Terminal size={15} />;
  }
  if (type === "tool") {
    return <Hammer size={15} />;
  }
  if (status === "completed") {
    return <CheckCircle2 size={15} />;
  }
  return <Info size={15} />;
}

function toActivityEventFromToolEvent(event: ToolEvent): AgentActivityEvent {
  return {
    id: `legacy-${event.id}`,
    type: "tool",
    status: statusFromToolEvent(event.status),
    title: event.name,
    summary: event.detail,
    collapsedByDefault: true,
    details: {
      detail: event.detail,
      legacyStatus: event.status,
      time: event.time
    },
    metadata: {
      legacy: true
    },
    source: event.status === "mocked" ? "ui" : "hermes"
  };
}

function statusFromToolEvent(status: ToolEvent["status"]): AgentActivityStatus {
  if (status === "started" || status === "pending") {
    return "running";
  }
  if (status === "completed" || status === "mocked") {
    return "completed";
  }
  if (status === "failed") {
    return "failed";
  }
  return "info";
}

function safeJson(value: unknown) {
  const text = JSON.stringify(value, null, 2) ?? "";
  return text.length > 5_000 ? `${text.slice(0, 5_000)}\n... truncated` : text;
}
