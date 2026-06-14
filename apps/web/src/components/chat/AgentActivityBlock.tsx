import { ChevronRight } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { LiveTokenUsageTicker, type LiveTokenUsageSnapshot } from "@/components/chat/LiveTokenUsageTicker";
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
  isWorking?: boolean;
  legacyEvents?: ToolEvent[];
  liveTokenUsage?: LiveTokenUsageSnapshot | null;
  startedAt?: string | null;
};

// Keep a collapsed "Worked for <duration>" summary after every real run (Codex
// style) instead of only for very long runs. Previously this was 60s, which made
// the whole activity block — and any thinking/command rows under it — vanish the
// moment a short run completed.
const WORKED_LABEL_MIN_DURATION_MS = 0;
const COMPLETED_WORK_AUTO_COLLAPSE_DELAY_MS = 250;
const EMPTY_ACTIVITY_ID_SET: ReadonlySet<string> = new Set();

type CommandGroup = {
  events: AgentActivityEvent[];
  id: string;
};

type CommandItem = {
  event: AgentActivityEvent;
  id: string;
  relatedEvents: AgentActivityEvent[];
};

type ActivityTimelineItem =
  | {
      event: AgentActivityEvent;
      id: string;
      kind: "note";
    }
  | {
      events: AgentActivityEvent[];
      id: string;
      kind: "commands";
    };

export const AgentActivityBlock = memo(function AgentActivityBlock({
  events,
  isWorking = false,
  legacyEvents = [],
  liveTokenUsage = null,
  startedAt = null
}: AgentActivityBlockProps) {
  const displayEvents = useMemo(
    () => (events.length > 0 ? events : legacyEvents.map(toActivityEventFromToolEvent)),
    [events, legacyEvents]
  );

  // When a run begins, snapshot the activity events that already existed (from
  // earlier turns in this session). The live progress list then shows only the
  // current run's rows instead of briefly replaying the previous run's
  // completed rows — which read as several lines flashing in then vanishing.
  const wasWorkingRef = useRef(false);
  const liveBaselineIdsRef = useRef<ReadonlySet<string>>(EMPTY_ACTIVITY_ID_SET);
  let completedFromWorking = false;
  if (isWorking && !wasWorkingRef.current) {
    liveBaselineIdsRef.current = new Set(displayEvents.map((event) => event.id));
  } else if (!isWorking && wasWorkingRef.current) {
    completedFromWorking = true;
    liveBaselineIdsRef.current = EMPTY_ACTIVITY_ID_SET;
  }
  wasWorkingRef.current = isWorking;
  const liveBaselineIds = isWorking ? liveBaselineIdsRef.current : EMPTY_ACTIVITY_ID_SET;

  const sections = useMemo(
    () => buildActivitySections(displayEvents, liveBaselineIds),
    [displayEvents, liveBaselineIds]
  );
  const workingLabel = useWorkingLabel(isWorking, startedAt, displayEvents);
  const showWorked = Boolean(sections.workedLabel);
  const showCommands = sections.commandGroups.length > 0;

  if (!workingLabel && !showWorked && !showCommands) {
    return null;
  }

  return (
    <section className={styles.wrap} aria-label="Agent activity">
      {workingLabel ? (
        <WorkingLog items={sections.liveTimelineItems} label={workingLabel} liveTokenUsage={liveTokenUsage} />
      ) : showWorked ? (
        <WorkedRow
          autoCollapseDelayMs={completedFromWorking ? COMPLETED_WORK_AUTO_COLLAPSE_DELAY_MS : null}
          initiallyOpen={completedFromWorking}
          items={sections.timelineItems}
          label={sections.workedLabel!}
          tokenParts={sections.tokenParts}
        />
      ) : (
        <>
          {sections.commandGroups.map((group) => (
            <CommandGroupRow events={group.events} key={group.id} />
          ))}
        </>
      )}
    </section>
  );
});

function WorkingLog({
  items,
  label,
  liveTokenUsage
}: {
  items: ActivityTimelineItem[];
  label: string;
  liveTokenUsage: LiveTokenUsageSnapshot | null;
}) {
  const showLiveUsage =
    typeof liveTokenUsage?.promptTokens === "number" ||
    typeof liveTokenUsage?.completionTokens === "number";

  return (
    <div className={styles.workLog}>
      <div className={styles.workHeader}>
        <span className={styles.workedLabel}>{label}</span>
        {showLiveUsage ? (
          <LiveTokenUsageTicker
            completionTokens={liveTokenUsage.completionTokens}
            promptTokens={liveTokenUsage.promptTokens}
            variant="activity"
          />
        ) : null}
      </div>
      {items.length > 0 ? (
        <div className={styles.liveProgressBody}>
          <ActivityTimeline items={items} />
        </div>
      ) : null}
    </div>
  );
}

function WorkedRow({
  autoCollapseDelayMs = null,
  initiallyOpen = false,
  items,
  label,
  tokenParts
}: {
  autoCollapseDelayMs?: number | null;
  initiallyOpen?: boolean;
  items: ActivityTimelineItem[];
  label: string;
  tokenParts: Array<{ key: string; kind: "in" | "out" | "total"; label: string }>;
}) {
  return (
    <AnimatedDisclosure
      autoCollapseDelayMs={autoCollapseDelayMs}
      className={styles.workedBlock}
      initiallyOpen={initiallyOpen}
      summaryClassName={styles.workedSummary}
      type={initiallyOpen ? "completed-work" : undefined}
      summary={
        <>
          <ChevronRight className={styles.chevron} size={14} aria-hidden="true" />
          <span className={styles.workedLabel}>{label}</span>
          {tokenParts.map((part) => (
            <span className={styles.tokenPart} data-kind={part.kind} key={part.key}>
              {part.label}
            </span>
          ))}
        </>
      }
    >
      <div className={styles.expandedBody}>
        {items.length > 0 ? (
          <ActivityTimeline items={items} />
        ) : (
          <p className={styles.reasoningEmpty}>Assistant response completed.</p>
        )}
      </div>
    </AnimatedDisclosure>
  );
}

function ActivityTimeline({ items }: { items: ActivityTimelineItem[] }) {
  return (
    <div className={styles.timeline}>
      {items.map((item) =>
        item.kind === "commands" ? (
          <CommandGroupRow events={item.events} key={item.id} />
        ) : (
          <ReasoningChunk event={item.event} key={item.id} />
        )
      )}
    </div>
  );
}

function ReasoningChunk({ event }: { event: AgentActivityEvent }) {
  const title = titleForReasoningChunk(event);
  const detail = summarizeWorkedDetail(event);
  const showDetail = detail ? !isSameActivityLabel(title, detail) : false;

  if (event.type === "tool") {
    // Render a tool note as a single status-like line ("Used Write File
    // /tmp/...") instead of a title stacked over its target, matching the
    // inline Thinking/Running/Reading status rows.
    return (
      <div className={styles.toolNote}>
        <span className={styles.toolIcon} aria-hidden="true" />
        <p className={styles.toolNoteLine}>
          <span className={styles.toolNoteTitle}>{title}</span>
          {showDetail ? <span className={styles.toolNoteTarget}>{detail}</span> : null}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.reasoningChunk}>
      <p className={styles.reasoningTitle}>{title}</p>
      {showDetail ? <p className={styles.reasoningLine}>{detail}</p> : null}
    </div>
  );
}

function CommandGroupRow({ events }: { events: AgentActivityEvent[] }) {
  const commandItems = buildCommandItems(events);
  const count = commandItems.length;
  const label = count === 1
    ? commandItemRowLabel(commandItems[0])
    : `${commandItems.some(commandItemIsActive) ? "Running" : "Ran"} ${count} commands`;

  if (count === 0) {
    return null;
  }

  return (
    <AnimatedDisclosure
      className={styles.commandBlock}
      summaryClassName={styles.commandSummary}
      type="command"
      summary={
        <>
          <span className={styles.commandIcon} aria-hidden="true">
            <span className={styles.commandIconChevron}>&gt;</span>
            <span className={styles.commandIconCursor} />
          </span>
          <span className={styles.commandLabel}>{label}</span>
          <ChevronRight className={styles.commandChevron} size={14} aria-hidden="true" />
        </>
      }
    >
      <div className={styles.expandedBody}>
        {count === 1 ? (
          <CommandDetail item={commandItems[0]} />
        ) : (
          <div className={styles.commandItems}>
            {commandItems.map((item) => (
              <CommandItemRow item={item} key={item.id} />
            ))}
          </div>
        )}
      </div>
    </AnimatedDisclosure>
  );
}

function CommandItemRow({ item }: { item: CommandItem }) {
  return (
    <AnimatedDisclosure
      className={styles.commandItemBlock}
      summaryClassName={styles.commandItemSummary}
      summary={
        <>
          <span className={styles.commandItemLabel}>{commandItemRowLabel(item)}</span>
          <ChevronRight className={styles.commandItemChevron} size={14} aria-hidden="true" />
        </>
      }
    >
      <div className={styles.commandItemDetail}>
        <CommandDetail item={item} />
      </div>
    </AnimatedDisclosure>
  );
}

function AnimatedDisclosure({
  autoCollapseDelayMs = null,
  children,
  className,
  initiallyOpen = false,
  summary,
  summaryClassName,
  type
}: {
  autoCollapseDelayMs?: number | null;
  children: ReactNode;
  className: string;
  initiallyOpen?: boolean;
  summary: ReactNode;
  summaryClassName: string;
  type?: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  useEffect(() => {
    if (!initiallyOpen || typeof autoCollapseDelayMs !== "number") {
      return;
    }

    const timer = window.setTimeout(() => setOpen(false), autoCollapseDelayMs);
    return () => window.clearTimeout(timer);
  }, [autoCollapseDelayMs, initiallyOpen]);

  return (
    <div className={className} data-open={open ? "true" : "false"} data-type={type}>
      <button
        className={summaryClassName}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {summary}
      </button>
      <div className={styles.disclosureBody} data-open={open ? "true" : "false"} aria-hidden={!open}>
        {children}
      </div>
    </div>
  );
}

function CommandDetail({ item }: { item: CommandItem }) {
  const detail = commandDetailData(item);
  const preview = commandDetailPreview(detail);
  const status = commandDetailStatus(item);

  return (
    <div className={styles.commandDetailPanel}>
      <p className={styles.commandDetailTitle}>Shell</p>
      {preview ? (
        <pre className={styles.commandPreview} data-tone={detail.stderrPreview && !detail.stdoutPreview ? "error" : undefined}>
          {preview}
        </pre>
      ) : null}
      {status ? <p className={styles.commandResult} data-status={status.kind}>{status.label}</p> : null}
    </div>
  );
}

function buildActivitySections(
  events: AgentActivityEvent[],
  liveBaselineIds: ReadonlySet<string> = EMPTY_ACTIVITY_ID_SET
) {
  const elapsed = [...events].reverse().find((event) => event.type === "elapsed");
  const workedLabel = resolveWorkedLabel(events, elapsed);
  const commandGroups = groupCommandEvents(events);
  const tokenParts = formatTokenUsageParts(extractTokenUsage(elapsed) ?? extractTokenUsage([...events].reverse().find((event) => Boolean(extractTokenUsage(event)))));
  const meaningfulEvents = events.filter(isMeaningfulTimelineEvent);
  const timelineItems = buildTimelineItems(meaningfulEvents, meaningfulEvents);
  const liveTimelineItems = buildLiveTimelineItems(events, liveBaselineIds);

  return { commandGroups, liveTimelineItems, timelineItems, tokenParts, workedLabel };
}

function buildLiveTimelineItems(
  events: AgentActivityEvent[],
  liveBaselineIds: ReadonlySet<string> = EMPTY_ACTIVITY_ID_SET
) {
  const currentRunEvents =
    liveBaselineIds.size > 0 ? events.filter((event) => !liveBaselineIds.has(event.id)) : events;
  const meaningfulEvents = currentRunEvents.filter(isMeaningfulTimelineEvent);
  return buildTimelineItems(meaningfulEvents, meaningfulEvents).slice(-8);
}

// A single source of truth for which activity events deserve their own row.
// Run/message lifecycle markers ("Run started", "Message started", "Run
// completed"), stream/elapsed bookkeeping, and the internal "thinking" signal
// are intentionally dropped: the live status line already says Thinking/Running,
// so they would only add a noisy list of repeated rows. Real commands, tool
// uses, memory operations, approvals, errors, and reasoning that carries an
// actual public summary are kept.
function isMeaningfulTimelineEvent(event: AgentActivityEvent): boolean {
  if (event.type === "elapsed" || event.type === "stream" || event.type === "status") {
    return false;
  }
  if (isRunLifecycleNoiseEvent(event)) {
    return false;
  }
  if (isInternalThinkingSignal(event)) {
    return false;
  }
  if (isCommandLikeEvent(event) || event.type === "memory" || event.type === "approval" || event.type === "error") {
    return true;
  }
  if (event.type === "reasoning") {
    return Boolean(pickMeaningfulActivityText(event.summary));
  }
  if (event.type === "tool") {
    return Boolean(event.summary) || Boolean(pickMeaningfulActivityText(event.title));
  }
  return Boolean(event.summary || event.title);
}

function isInternalThinkingSignal(event: AgentActivityEvent): boolean {
  const toolName = (event.hermes?.toolName ?? "").trim().toLowerCase();
  return toolName === "_thinking" || toolName === "thinking";
}

function summarizeWorkedDetail(event: AgentActivityEvent) {
  if (event.command?.command) {
    return event.command.command;
  }
  if (event.command?.outputPreview) {
    return event.command.outputPreview;
  }
  return pickMeaningfulActivityText(event.summary);
}

function isSameActivityLabel(left: string, right: string) {
  return normalizeActivityLabel(left) === normalizeActivityLabel(right);
}

function normalizeActivityLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function titleForReasoningChunk(event: AgentActivityEvent) {
  if (event.type === "reasoning") {
    return "Thinking";
  }
  if (event.type === "status") {
    return event.title === "Run completed" ? "Completed run" : event.title;
  }
  if (event.type === "memory") {
    return pickMeaningfulActivityText(event.title) ?? "Used memory";
  }
  if (event.type === "tool") {
    return formatToolActivityTitle(event);
  }
  if (event.type === "approval") {
    return "Handled approval";
  }
  if (event.type === "error") {
    return "Error";
  }
  return pickMeaningfulActivityText(event.title) ?? "Activity update";
}

function commandItemRowLabel(item?: CommandItem) {
  if (!item) {
    return "Ran command";
  }
  const command = extractCommandDetails(item.event);
  const preview =
    command?.command ||
    command?.args?.join(" ") ||
    item.event.summary ||
    item.event.title;
  const duration = commandItemDuration(item);
  const cleaned = cleanCommandLabel(preview);
  const verb = commandItemIsActive(item) ? "Running" : "Ran";
  return cleaned ? `${verb} ${cleaned}${duration}` : `${verb} command${duration}`;
}

function commandItemIsActive(item: CommandItem) {
  return [item.event, ...item.relatedEvents].some(
    (event) => event.status === "running" || event.status === "queued" || event.status === "waiting_for_approval"
  );
}

function commandItemDuration(item: CommandItem) {
  const durationMs =
    extractCommandDetails(item.event)?.durationMs ??
    item.event.durationMs ??
    item.relatedEvents.map((event) => extractCommandDetails(event)?.durationMs ?? event.durationMs).find(finiteNumber);
  return durationMs ? ` for ${formatActivityDuration(durationMs)}` : "";
}

function cleanCommandLabel(value?: string) {
  const text = value?.trim();
  if (!text) {
    return "";
  }
  return text.replace(/^ran\s+/i, "").replace(/^command completed$/i, "command");
}

function commandDetailData(item: CommandItem) {
  const commandEvents = [item.event, ...item.relatedEvents];
  const details = commandEvents.map((event) => extractCommandDetails(event)).filter(isCommandDetails);
  const primary = extractCommandDetails(item.event);
  const commandLine =
    primary?.command ||
    primary?.args?.join(" ") ||
    cleanCommandLabel(item.event.summary) ||
    cleanCommandLabel(item.event.title);
  const stdoutPreview = details.map((detail) => detail.stdoutPreview || detail.outputPreview).find(Boolean);
  const stderrPreview = details.map((detail) => detail.stderrPreview).find(Boolean);
  const exitCode = details.map((detail) => detail.exitCode).find(finiteNumber);
  return { commandLine, exitCode, stderrPreview, stdoutPreview };
}

function commandDetailPreview(detail: ReturnType<typeof commandDetailData>) {
  const lines: string[] = [];
  if (detail.commandLine) {
    lines.push(`$ ${detail.commandLine}`);
  }
  if (detail.stdoutPreview) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(detail.stdoutPreview);
  }
  if (detail.stderrPreview) {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(detail.stderrPreview);
  }
  return lines.join("\n");
}

function commandDetailStatus(item: CommandItem) {
  const events = [item.event, ...item.relatedEvents];
  const exitCode = events.map((event) => extractCommandDetails(event)?.exitCode).find(finiteNumber);
  if (events.some((event) => event.status === "failed") || (typeof exitCode === "number" && exitCode !== 0)) {
    return { kind: "failed", label: typeof exitCode === "number" ? `exit ${exitCode}` : "Failed" };
  }
  if (events.some((event) => event.status === "running")) {
    return { kind: "running", label: "Running" };
  }
  if (events.some((event) => event.status === "completed") || typeof exitCode === "number") {
    return { kind: "completed", label: "Success" };
  }
  return null;
}

function buildCommandItems(events: AgentActivityEvent[]): CommandItem[] {
  const items: CommandItem[] = [];
  let current: CommandItem | null = null;

  for (const event of events) {
    if (!isCommandLikeEvent(event)) {
      continue;
    }

    const startsCommand = isCommandStartEvent(event);
    if (startsCommand || !current) {
      if (isCommandCompletionOnlyEvent(event) && !current) {
        continue;
      }
      current = {
        event,
        id: `command-item-${items.length}-${event.id}`,
        relatedEvents: []
      };
      items.push(current);
      continue;
    }

    current.relatedEvents.push(event);
  }

  return items;
}

function isCommandStartEvent(event: AgentActivityEvent) {
  const command = extractCommandDetails(event);
  if (command?.command || (command?.args?.length ?? 0) > 0) {
    return true;
  }
  if (isCommandCompletionOnlyEvent(event)) {
    return false;
  }
  return event.type === "command" && Boolean(event.title || event.summary);
}

function isCommandCompletionOnlyEvent(event: AgentActivityEvent) {
  const command = extractCommandDetails(event);
  if (command?.command || (command?.args?.length ?? 0) > 0) {
    return false;
  }
  const label = `${event.title} ${event.summary ?? ""}`.trim();
  return /\bcommand completed\b/i.test(label);
}

function isCommandDetails(value?: AgentActivityEvent["command"]): value is NonNullable<AgentActivityEvent["command"]> {
  return Boolean(value);
}

function extractTokenUsage(event?: AgentActivityEvent) {
  const usage = event?.metadata?.tokenUsage;
  return usage && typeof usage === "object" && !Array.isArray(usage)
    ? (usage as { promptTokens?: unknown; completionTokens?: unknown; totalTokens?: unknown })
    : undefined;
}

function formatTokenUsageParts(usage?: { promptTokens?: unknown; completionTokens?: unknown; totalTokens?: unknown }) {
  const totalTokens = finiteNumber(usage?.totalTokens);
  const promptTokens = finiteNumber(usage?.promptTokens);
  const completionTokens = finiteNumber(usage?.completionTokens);
  const formatter = new Intl.NumberFormat();
  const parts: Array<{ key: string; kind: "in" | "out" | "total"; label: string }> = [];
  if (promptTokens !== undefined) {
    parts.push({ key: "in", kind: "in", label: `${formatter.format(promptTokens)} in` });
  }
  if (completionTokens !== undefined) {
    parts.push({ key: "out", kind: "out", label: `${formatter.format(completionTokens)} out` });
  }
  if (parts.length === 0 && totalTokens !== undefined) {
    parts.push({ key: "total", kind: "total", label: `${formatter.format(totalTokens)} tokens` });
  }
  return parts;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function useWorkingLabel(isWorking: boolean, startedAt: string | null, events: AgentActivityEvent[]) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!isWorking) {
      return;
    }
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isWorking]);

  if (!isWorking) {
    return null;
  }

  const startedAtMs = resolveWorkingStartedAtMs(startedAt, events);
  if (typeof startedAtMs !== "number") {
    return "Working";
  }
  return `Working for ${formatActivityDuration(nowMs - startedAtMs)}`;
}

function resolveWorkingStartedAtMs(startedAt: string | null, events: AgentActivityEvent[]) {
  const explicit = parseSafeTime(startedAt);
  if (typeof explicit === "number") {
    return explicit;
  }
  for (const event of events) {
    const eventStartedAt = parseSafeTime(event.startedAt);
    if (typeof eventStartedAt === "number") {
      return eventStartedAt;
    }
  }
  return undefined;
}

function parseSafeTime(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveWorkedLabel(events: AgentActivityEvent[], elapsed?: AgentActivityEvent) {
  if (elapsed) {
    const durationMs = computeActivityDuration(elapsed);
    if (typeof durationMs === "number") {
      return durationMs >= WORKED_LABEL_MIN_DURATION_MS ? `Worked for ${formatActivityDuration(durationMs)}` : null;
    }
    return null;
  }

  const startedAt = events.find((event) => event.startedAt)?.startedAt;
  const completedAt = [...events].reverse().find((event) => event.completedAt)?.completedAt;
  const durationMs = computeRunElapsed(startedAt, completedAt);
  if (
    typeof durationMs === "number" &&
    durationMs >= WORKED_LABEL_MIN_DURATION_MS &&
    !events.some((event) => isActiveActivityStatus(event.status))
  ) {
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

function buildTimelineItems(events: AgentActivityEvent[], fallbackDetails: AgentActivityEvent[]): ActivityTimelineItem[] {
  const items: ActivityTimelineItem[] = [];
  let currentCommands: AgentActivityEvent[] = [];
  const fallbackIds = new Set(fallbackDetails.map((event) => event.id));

  const flushCommands = () => {
    if (currentCommands.length === 0) {
      return;
    }
    items.push({
      events: currentCommands,
      id: `timeline-commands-${items.length}-${currentCommands[0]?.id ?? "batch"}`,
      kind: "commands"
    });
    currentCommands = [];
  };

  for (const event of events) {
    if (event.type === "elapsed" || event.type === "stream") {
      continue;
    }
    if (isCommandLikeEvent(event)) {
      currentCommands.push(event);
      continue;
    }
    if (fallbackIds.size > 0 && !fallbackIds.has(event.id)) {
      continue;
    }
    if (!event.summary && !event.title) {
      continue;
    }
    flushCommands();
    const title = titleForReasoningChunk(event);
    const lastNote = [...items].reverse().find((item): item is Extract<ActivityTimelineItem, { kind: "note" }> => item.kind === "note");
    if (lastNote && isSameActivityLabel(titleForReasoningChunk(lastNote.event), title)) {
      continue;
    }
    items.push({
      event,
      id: `timeline-note-${event.id}`,
      kind: "note"
    });
  }

  flushCommands();
  if (items.length > 0) {
    return items;
  }

  const fallbackItems: ActivityTimelineItem[] = [];
  for (const event of fallbackDetails) {
    const title = titleForReasoningChunk(event);
    const lastNote = [...fallbackItems].reverse().find((item): item is Extract<ActivityTimelineItem, { kind: "note" }> => item.kind === "note");
    if (lastNote && isSameActivityLabel(titleForReasoningChunk(lastNote.event), title)) {
      continue;
    }
    fallbackItems.push({
      event,
      id: `timeline-note-${event.id}`,
      kind: "note"
    });
  }
  return fallbackItems;
}

function isCommandLikeEvent(event: AgentActivityEvent) {
  return event.type === "command" || Boolean(event.command);
}

function isRunLifecycleNoiseEvent(event: AgentActivityEvent) {
  if (event.type !== "status") {
    return false;
  }
  const label = `${event.title} ${event.summary ?? ""}`.trim();
  return /\brun\s+(started|completed)\b/i.test(label);
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

function formatToolActivityTitle(event: AgentActivityEvent) {
  const rawName =
    pickMeaningfulActivityText(event.hermes?.toolName) ??
    pickMeaningfulActivityText(event.title) ??
    pickMeaningfulActivityText(event.summary);
  if (!rawName) {
    return "Used a tool";
  }
  const name = humanizeToolName(rawName);
  if (/^used\b/i.test(name)) {
    return name;
  }
  return `Used ${name}`;
}

function humanizeToolName(value: string) {
  return value
    .replace(/^mcp[_-]?/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function pickMeaningfulActivityText(value?: string | null) {
  const text = value?.trim();
  if (!text || text.length <= 1 || /^[*\-•]+$/.test(text)) {
    return null;
  }
  return text.replace(/^[*\-•]\s+/, "").trim() || null;
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
