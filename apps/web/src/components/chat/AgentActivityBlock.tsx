import { ChevronRight, Terminal } from "lucide-react";
import { memo, useMemo } from "react";
import {
  computeActivityDuration,
  computeRunElapsed,
  extractCommandDetails,
  formatActivityDuration
} from "@/lib/agentActivityEvents";
import { isActiveActivityStatus } from "@/lib/streamStatus";
import type { ToolEvent } from "@/data/types";
import type { AgentActivityEvent, AgentActivityStatus } from "@/types/agentActivity";
import styles from "./AgentActivityBlock.module.css";

type AgentActivityBlockProps = {
  events: AgentActivityEvent[];
  legacyEvents?: ToolEvent[];
};

type CommandGroup = {
  events: AgentActivityEvent[];
  id: string;
};

export const AgentActivityBlock = memo(function AgentActivityBlock({
  events,
  legacyEvents = []
}: AgentActivityBlockProps) {
  const displayEvents = useMemo(
    () => (events.length > 0 ? events : legacyEvents.map(toActivityEventFromToolEvent)),
    [events, legacyEvents]
  );
  const sections = useMemo(() => buildActivitySections(displayEvents), [displayEvents]);
  const showWorked = Boolean(sections.workedLabel);
  const showCommands = sections.commandGroups.length > 0;

  if (!showWorked && !showCommands) {
    return null;
  }

  return (
    <section className={styles.wrap} aria-label="Agent activity">
      {showWorked ? (
        <WorkedRow label={sections.workedLabel!} reasoning={sections.reasoning} />
      ) : null}
      {sections.commandGroups.map((group) => (
        <CommandGroupRow events={group.events} key={group.id} />
      ))}
    </section>
  );
});

function WorkedRow({ label, reasoning }: { label: string; reasoning: AgentActivityEvent[] }) {
  return (
    <details className={styles.workedBlock}>
      <summary className={styles.workedSummary}>
        <ChevronRight className={styles.chevron} size={14} aria-hidden="true" />
        <span className={styles.workedLabel}>{label}</span>
      </summary>
      <div className={styles.expandedBody}>
        {reasoning.length > 0 ? (
          reasoning.map((event) => (
            <p className={styles.reasoningLine} key={event.id}>
              {event.summary || event.title}
            </p>
          ))
        ) : (
          <p className={styles.reasoningEmpty}>No additional reasoning details were recorded for this run.</p>
        )}
      </div>
    </details>
  );
}

function CommandGroupRow({ events }: { events: AgentActivityEvent[] }) {
  const count = events.length;
  const label = count === 1 ? "Ran 1 command" : `Ran ${count} commands`;

  return (
    <details className={styles.commandBlock}>
      <summary className={styles.commandSummary}>
        <span className={styles.commandIcon} aria-hidden="true">
          <Terminal size={12} strokeWidth={2} />
        </span>
        <span className={styles.commandLabel}>{label}</span>
      </summary>
      <div className={styles.expandedBody}>
        {events.map((event) => (
          <CommandDetail event={event} key={event.id} />
        ))}
      </div>
    </details>
  );
}

function CommandDetail({ event }: { event: AgentActivityEvent }) {
  const command = extractCommandDetails(event);
  const preview =
    command?.command ||
    command?.outputPreview ||
    command?.stdoutPreview ||
    event.summary ||
    event.title;

  return (
    <div className={styles.commandDetail}>
      <p className={styles.commandDetailTitle}>{event.title}</p>
      {preview ? <pre className={styles.commandPreview}>{preview}</pre> : null}
      {command?.stderrPreview ? (
        <pre className={styles.commandPreview} data-tone="error">
          {command.stderrPreview}
        </pre>
      ) : null}
      {typeof command?.exitCode === "number" ? (
        <p className={styles.commandMeta}>exit {command.exitCode}</p>
      ) : null}
    </div>
  );
}

function buildActivitySections(events: AgentActivityEvent[]) {
  const reasoning = events.filter(
    (event) =>
      event.type === "reasoning" ||
      (event.type === "status" && Boolean(event.summary)) ||
      (event.type === "tool" && Boolean(event.summary) && !isCommandLikeEvent(event))
  );
  const elapsed = [...events].reverse().find((event) => event.type === "elapsed");
  const workedLabel = resolveWorkedLabel(events, elapsed);
  const commandGroups = groupCommandEvents(events);

  return { commandGroups, reasoning, workedLabel };
}

function resolveWorkedLabel(events: AgentActivityEvent[], elapsed?: AgentActivityEvent) {
  if (elapsed) {
    const durationMs = computeActivityDuration(elapsed);
    if (typeof durationMs === "number") {
      return `Worked for ${formatActivityDuration(durationMs)}`;
    }
    return elapsed.title;
  }

  const startedAt = events.find((event) => event.startedAt)?.startedAt;
  const completedAt = [...events].reverse().find((event) => event.completedAt)?.completedAt;
  const durationMs = computeRunElapsed(startedAt, completedAt);
  if (typeof durationMs === "number" && !events.some((event) => isActiveActivityStatus(event.status))) {
    return `Worked for ${formatActivityDuration(durationMs)}`;
  }

  return null;
}

function groupCommandEvents(events: AgentActivityEvent[]): CommandGroup[] {
  const groups: CommandGroup[] = [];
  let currentBatch: AgentActivityEvent[] = [];

  const flush = () => {
    if (currentBatch.length === 0) {
      return;
    }
    groups.push({
      events: currentBatch,
      id: `commands-${groups.length}-${currentBatch[0]?.id ?? "batch"}`
    });
    currentBatch = [];
  };

  for (const event of events) {
    if (isCommandLikeEvent(event)) {
      currentBatch.push(event);
      continue;
    }
    if (event.type === "elapsed" || event.type === "stream") {
      continue;
    }
    flush();
  }

  flush();
  return groups;
}

function isCommandLikeEvent(event: AgentActivityEvent) {
  return event.type === "command" || Boolean(event.command);
}

function toActivityEventFromToolEvent(event: ToolEvent): AgentActivityEvent {
  return {
    id: `legacy-${event.id}`,
    type: "tool",
    status: statusFromToolEvent(event.status),
    title: event.name,
    summary: event.detail,
    collapsedByDefault: true,
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
