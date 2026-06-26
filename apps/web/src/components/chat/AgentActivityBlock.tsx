import { Check, ChevronRight } from "@/components/ui/AppIcons";
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
  autoCollapseCompletedWork?: boolean;
  completedWorkAutoCollapseDelayMs?: number;
  events: AgentActivityEvent[];
  isWorking?: boolean;
  legacyEvents?: ToolEvent[];
  liveTokenUsage?: LiveTokenUsageSnapshot | null;
  onCompletedWorkAutoCollapse?: () => void;
  showSummaryTokenUsage?: boolean;
  startedAt?: string | null;
};

// Keep a collapsed "Worked for <duration>" summary after every real run (Codex
// style) instead of only for very long runs. Previously this was 60s, which made
// the whole activity block — and any thinking/command rows under it — vanish the
// moment a short run completed.
const WORKED_LABEL_MIN_DURATION_MS = 0;
const COMPLETED_WORK_AUTO_COLLAPSE_DELAY_MS = 2000;
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
      events: AgentActivityEvent[];
      id: string;
      kind: "commands";
    }
  | {
      events: AgentActivityEvent[];
      id: string;
      kind: "notes";
      title: string;
    };

export const AgentActivityBlock = memo(function AgentActivityBlock({
  autoCollapseCompletedWork = false,
  completedWorkAutoCollapseDelayMs = COMPLETED_WORK_AUTO_COLLAPSE_DELAY_MS,
  events,
  isWorking = false,
  legacyEvents = [],
  liveTokenUsage = null,
  onCompletedWorkAutoCollapse,
  showSummaryTokenUsage = true,
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
  const completedWorkCollapseKeyRef = useRef<string | null>(null);
  const completedWorkCollapseSequenceRef = useRef(0);
  const liveBaselineIdsRef = useRef<ReadonlySet<string>>(EMPTY_ACTIVITY_ID_SET);
  let completedFromWorking = false;
  if (isWorking && !wasWorkingRef.current) {
    completedWorkCollapseKeyRef.current = null;
    liveBaselineIdsRef.current = new Set(displayEvents.map((event) => event.id));
  } else if (!isWorking && wasWorkingRef.current) {
    completedFromWorking = true;
    completedWorkCollapseSequenceRef.current += 1;
    completedWorkCollapseKeyRef.current = `completed-work-${completedWorkCollapseSequenceRef.current}`;
    liveBaselineIdsRef.current = EMPTY_ACTIVITY_ID_SET;
  }
  wasWorkingRef.current = isWorking;
  const liveBaselineIds = isWorking ? liveBaselineIdsRef.current : EMPTY_ACTIVITY_ID_SET;
  const completedWorkCollapseKey = completedWorkCollapseKeyRef.current;
  const shouldAutoCollapseCompletedWork = Boolean(
    completedWorkCollapseKey && autoCollapseCompletedWork
  );

  const sections = useMemo(
    () => buildActivitySections(displayEvents, liveBaselineIds, isWorking),
    [displayEvents, isWorking, liveBaselineIds]
  );
  const workingLabel = useWorkingLabel(isWorking, startedAt, displayEvents);
  const completedSummaryLabel =
    sections.workedLabel ??
    (!isWorking && (sections.timelineItems.length > 0 || sections.commandGroups.length > 0)
      ? "Worked"
      : null);
  const showWorked = Boolean(completedSummaryLabel);
  const showCommands = !showWorked && sections.commandGroups.length > 0;

  if (!workingLabel && !showWorked && !showCommands) {
    return null;
  }

  return (
    <section className={styles.wrap} data-agent-activity-block="true" aria-label="Agent activity">
      {workingLabel ? (
        <WorkingLog items={sections.liveTimelineItems} label={workingLabel} liveTokenUsage={liveTokenUsage} />
      ) : showWorked ? (
        <WorkedRow
          autoCollapseDelayMs={shouldAutoCollapseCompletedWork ? completedWorkAutoCollapseDelayMs : null}
          autoCollapseKey={shouldAutoCollapseCompletedWork ? completedWorkCollapseKey : null}
          initiallyOpen={completedFromWorking || Boolean(completedWorkCollapseKey)}
          items={sections.timelineItems}
          label={completedSummaryLabel!}
          onAutoCollapseStart={onCompletedWorkAutoCollapse}
          tokenParts={showSummaryTokenUsage ? sections.tokenParts : []}
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
          <ActivityTimeline allowActiveState items={items} />
        </div>
      ) : null}
    </div>
  );
}

function WorkedRow({
  autoCollapseDelayMs = null,
  autoCollapseKey = null,
  initiallyOpen = false,
  items,
  label,
  onAutoCollapseStart,
  tokenParts
}: {
  autoCollapseDelayMs?: number | null;
  autoCollapseKey?: string | null;
  initiallyOpen?: boolean;
  items: ActivityTimelineItem[];
  label: string;
  onAutoCollapseStart?: () => void;
  tokenParts: Array<{ key: string; kind: "in" | "out" | "speed" | "total"; label: string }>;
}) {
  const hasDetails = items.length > 0;
  const openInitially = hasDetails && initiallyOpen;
  const summaryContent = (
    <>
      <span className={styles.workedLabel}>{label}</span>
      {tokenParts.map((part) => (
        <span className={styles.tokenPart} data-kind={part.kind} key={part.key}>
          {part.label}
        </span>
      ))}
      {hasDetails ? <ChevronRight className={styles.workedChevron} size={14} aria-hidden="true" /> : null}
    </>
  );

  if (!hasDetails) {
    return (
      <div className={styles.workedBlock} data-has-details="false">
        <div className={`${styles.workedSummary} ${styles.workedSummaryStatic}`}>
          {summaryContent}
        </div>
      </div>
    );
  }

  return (
    <AnimatedDisclosure
      autoCollapseDelayMs={autoCollapseDelayMs}
      autoCollapseKey={autoCollapseKey}
      className={styles.workedBlock}
      initiallyOpen={openInitially}
      onAutoCollapseStart={onAutoCollapseStart}
      summaryClassName={styles.workedSummary}
      type={openInitially ? "completed-work" : undefined}
      summary={summaryContent}
    >
      <div className={styles.expandedBody}>
        <ActivityTimeline items={items} />
      </div>
    </AnimatedDisclosure>
  );
}

function ActivityTimeline({
  allowActiveState = false,
  items
}: {
  allowActiveState?: boolean;
  items: ActivityTimelineItem[];
}) {
  return (
    <div className={styles.timeline}>
      {items.map((item) =>
        item.kind === "commands" ? (
          <CommandGroupRow allowActiveState={allowActiveState} events={item.events} key={item.id} />
        ) : (
          <NoteGroupRow allowActiveState={allowActiveState} events={item.events} key={item.id} title={item.title} />
        )
      )}
    </div>
  );
}

// A single tool/memory/approval note: one status-like line ("Used Read File
// /tmp/...") with the action and its target.
function ToolNoteLine({
  allowActiveState = false,
  event
}: {
  allowActiveState?: boolean;
  event: AgentActivityEvent;
}) {
  const title = titleForReasoningChunk(event);
  const detail = noteRowDetail(event);
  const active = allowActiveState && isActiveActivityStatus(event.status);
  return (
    <div className={styles.toolNote}>
      <span className={styles.toolIcon} aria-hidden="true" />
      <p className={styles.toolNoteLine} data-active={active ? "true" : "false"}>
        <span className={styles.toolNoteTitle}>{title}</span>
        {detail ? <span className={styles.toolNoteTarget}>{detail}</span> : null}
      </p>
    </div>
  );
}

// Consecutive notes of the same kind ("Used Read File" x3) collapse into one
// row. While only one has arrived it is a plain line; once it repeats, the row
// shows the latest target and a chevron to expand every task of that kind.
function NoteGroupRow({
  allowActiveState = false,
  events,
  title
}: {
  allowActiveState?: boolean;
  events: AgentActivityEvent[];
  title: string;
}) {
  if (events.length === 0) {
    return null;
  }
  if (events.length === 1) {
    return <ToolNoteLine allowActiveState={allowActiveState} event={events[0]} />;
  }

  const latest = events[events.length - 1];
  const latestDetail = noteRowDetail(latest);
  const active = allowActiveState && events.some((event) => isActiveActivityStatus(event.status));

  return (
    <AnimatedDisclosure
      className={styles.commandBlock}
      summaryClassName={styles.commandSummary}
      type="command"
      summary={
        <>
          <span className={styles.toolIcon} aria-hidden="true" />
          <span className={styles.commandLabel} data-active={active ? "true" : "false"}>{title}</span>
          {latestDetail ? <span className={styles.toolNoteTarget}>{latestDetail}</span> : null}
          <ChevronRight className={styles.commandChevron} size={14} aria-hidden="true" />
        </>
      }
    >
      <div className={styles.expandedBody}>
        <div className={styles.commandItems}>
          {events.map((event, index) => (
            <ToolNoteLine allowActiveState={allowActiveState} event={event} key={`${event.id}-${index}`} />
          ))}
        </div>
      </div>
    </AnimatedDisclosure>
  );
}

function noteRowDetail(event: AgentActivityEvent) {
  const detail = summarizeWorkedDetail(event);
  if (!detail) {
    return "";
  }
  return isSameActivityLabel(titleForReasoningChunk(event), detail) ? "" : detail;
}

function CommandGroupRow({
  allowActiveState = false,
  events
}: {
  allowActiveState?: boolean;
  events: AgentActivityEvent[];
}) {
  const commandItems = buildCommandItems(events);
  const count = commandItems.length;
  const isActive = allowActiveState && commandItems.some(commandItemIsActive);
  const label = count === 1
    ? commandItemRowLabel(commandItems[0], allowActiveState)
    : `${isActive ? "Running" : "Ran"} ${count} commands`;

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
          <span className={styles.commandLabel} data-active={isActive ? "true" : "false"}>{label}</span>
          <ChevronRight className={styles.commandChevron} size={14} aria-hidden="true" />
        </>
      }
    >
      <div className={styles.expandedBody}>
        {count === 1 ? (
          <CommandDetail allowActiveState={allowActiveState} item={commandItems[0]} />
        ) : (
          <div className={styles.commandItems}>
            {commandItems.map((item) => (
              <CommandItemRow allowActiveState={allowActiveState} item={item} key={item.id} />
            ))}
          </div>
        )}
      </div>
    </AnimatedDisclosure>
  );
}

function CommandItemRow({
  allowActiveState = false,
  item
}: {
  allowActiveState?: boolean;
  item: CommandItem;
}) {
  const active = allowActiveState && commandItemIsActive(item);
  return (
    <AnimatedDisclosure
      className={styles.commandItemBlock}
      summaryClassName={styles.commandItemSummary}
      summary={
        <>
          <span className={styles.commandItemLabel} data-active={active ? "true" : "false"}>{commandItemRowLabel(item, allowActiveState)}</span>
          <ChevronRight className={styles.commandItemChevron} size={14} aria-hidden="true" />
        </>
      }
    >
      <div className={styles.commandItemDetail}>
        <CommandDetail allowActiveState={allowActiveState} item={item} />
      </div>
    </AnimatedDisclosure>
  );
}

function AnimatedDisclosure({
  autoCollapseDelayMs = null,
  autoCollapseKey = null,
  children,
  className,
  initiallyOpen = false,
  onAutoCollapseStart,
  summary,
  summaryClassName,
  type
}: {
  autoCollapseDelayMs?: number | null;
  autoCollapseKey?: string | null;
  children: ReactNode;
  className: string;
  initiallyOpen?: boolean;
  onAutoCollapseStart?: () => void;
  summary: ReactNode;
  summaryClassName: string;
  type?: string;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const onAutoCollapseStartRef = useRef(onAutoCollapseStart);
  const autoCollapseDelayRef = useRef(autoCollapseDelayMs);
  autoCollapseDelayRef.current = autoCollapseDelayMs;

  useEffect(() => {
    onAutoCollapseStartRef.current = onAutoCollapseStart;
  }, [onAutoCollapseStart]);

  // Fold the disclosure shut once, `autoCollapseDelayMs` after a new
  // autoCollapseKey appears. Keyed only on autoCollapseKey (delay is read from a
  // ref) so a later delay change — e.g. the finalizing window ending — cannot
  // clear the pending timer, and with no "handled" guard so React StrictMode's
  // mount/unmount/mount cycle reschedules the timer instead of dropping it.
  useEffect(() => {
    if (!autoCollapseKey) {
      return;
    }
    const delay = autoCollapseDelayRef.current;
    if (typeof delay !== "number") {
      return;
    }
    const timer = window.setTimeout(() => {
      onAutoCollapseStartRef.current?.();
      setOpen(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [autoCollapseKey]);

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
        <div className={styles.disclosureInner}>{children}</div>
      </div>
    </div>
  );
}

function CommandDetail({ allowActiveState = false, item }: { allowActiveState?: boolean; item: CommandItem }) {
  const detail = commandDetailData(item);
  const preview = commandDetailPreview(detail);
  const status = commandDetailStatus(item, allowActiveState);

  return (
    <div className={styles.commandDetailPanel}>
      <p className={styles.commandDetailTitle}>Shell</p>
      {preview ? (
        <pre className={styles.commandPreview} data-tone={detail.stderrPreview && !detail.stdoutPreview ? "error" : undefined}>
          {preview}
        </pre>
      ) : null}
      {status ? (
        <p className={styles.commandResult} data-status={status.kind}>
          {status.kind === "completed" ? <Check className={styles.commandResultIcon} size={14} aria-hidden="true" /> : null}
          <span>{status.label}</span>
        </p>
      ) : null}
    </div>
  );
}

function buildActivitySections(
  events: AgentActivityEvent[],
  liveBaselineIds: ReadonlySet<string> = EMPTY_ACTIVITY_ID_SET,
  isWorking = false
) {
  const elapsed = [...events].reverse().find((event) => event.type === "elapsed");
  const commandGroups = groupCommandEvents(events);
  const tokenParts = formatTokenUsageParts(extractTokenUsage(elapsed) ?? extractTokenUsage([...events].reverse().find((event) => Boolean(extractTokenUsage(event)))));
  const meaningfulEvents = events.filter(isMeaningfulTimelineEvent);
  const timelineItems = buildTimelineItems(meaningfulEvents, meaningfulEvents);
  const liveTimelineItems = buildLiveTimelineItems(events, liveBaselineIds);
  const hasDisplayableWork = commandGroups.length > 0 || timelineItems.length > 0;
  const workedLabel = hasDisplayableWork
    ? resolveWorkedLabel(events, elapsed) ?? (!isWorking ? resolveFallbackWorkedLabel(events) : null)
    : null;

  return { commandGroups, liveTimelineItems, timelineItems, tokenParts, workedLabel };
}

function buildLiveTimelineItems(
  events: AgentActivityEvent[],
  liveBaselineIds: ReadonlySet<string> = EMPTY_ACTIVITY_ID_SET
) {
  const currentRunEvents =
    liveBaselineIds.size > 0 ? events.filter((event) => !liveBaselineIds.has(event.id)) : events;
  const meaningfulEvents = currentRunEvents.filter(isMeaningfulTimelineEvent);
  return buildTimelineItems(meaningfulEvents, meaningfulEvents);
}

// A single source of truth for which activity events deserve their own row.
// Run/message lifecycle markers ("Run started", "Message started", "Run
// completed"), stream/elapsed bookkeeping, and the internal "thinking" signal
// are intentionally dropped: the live status line already says Thinking/Running,
// so they would only add a noisy list of repeated rows. Real commands, tool
// uses, memory operations, approvals, errors, public narration, and reasoning
// that carries an actual public summary are kept.
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
  // Reasoning and narration are intermediate text and are never surfaced.
  if (event.type === "reasoning" || event.type === "narration") {
    return false;
  }
  if (isCommandLikeEvent(event) || event.type === "memory" || event.type === "approval" || event.type === "error") {
    return true;
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
  // Narration summaries are already compacted once when the event is created
  // (in ChatView). Re-running the compactor on every render was the main source
  // of the streaming slowdown, so render the stored text as-is here.
  return pickMeaningfulActivityText(event.summary);
}

function isSameActivityLabel(left: string, right: string) {
  return normalizeActivityLabel(left) === normalizeActivityLabel(right);
}

function normalizeActivityLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function titleForReasoningChunk(event: AgentActivityEvent) {
  if (event.type === "narration") {
    return "Progress";
  }
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

function commandItemRowLabel(item?: CommandItem, allowActiveState = false) {
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
  const verb = allowActiveState && commandItemIsActive(item) ? "Running" : "Ran";
  return cleaned ? `${verb} ${cleaned}${duration}` : `${verb} command${duration}`;
}

function commandItemIsActive(item: CommandItem) {
  const events = [item.event, ...item.relatedEvents];
  // A command groups its started (running) and completed events. Once any
  // terminal event has arrived it is done — stop shimmering even though the
  // earlier running event is still in the group. Only commands still awaiting a
  // result shimmer, so a finished command settles while the next one animates.
  if (events.some((event) => event.status === "completed" || event.status === "failed" || event.status === "cancelled")) {
    return false;
  }
  return events.some(
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

function commandDetailStatus(item: CommandItem, allowActiveState = false) {
  const events = [item.event, ...item.relatedEvents];
  const exitCode = events.map((event) => extractCommandDetails(event)?.exitCode).find(finiteNumber);
  if (events.some((event) => event.status === "failed") || (typeof exitCode === "number" && exitCode !== 0)) {
    return { kind: "failed", label: typeof exitCode === "number" ? `exit ${exitCode}` : "Failed" };
  }
  if (events.some((event) => event.status === "completed") || typeof exitCode === "number") {
    return { kind: "completed", label: "Success" };
  }
  // A still-"running" command only reads as Running while the run is live. Once
  // the run is over (completed block), the command finished — never leave a
  // stale "Running" badge; show success since there was no failure evidence.
  if (events.some((event) => event.status === "running")) {
    return allowActiveState
      ? { kind: "running", label: "Running" }
      : { kind: "completed", label: "Success" };
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
    ? (usage as { promptTokens?: unknown; completionTokens?: unknown; tokensPerSecond?: unknown; totalTokens?: unknown })
    : undefined;
}

function formatTokenUsageParts(usage?: { promptTokens?: unknown; completionTokens?: unknown; tokensPerSecond?: unknown; totalTokens?: unknown }) {
  const totalTokens = finiteNumber(usage?.totalTokens);
  const promptTokens = finiteNumber(usage?.promptTokens);
  const completionTokens = finiteNumber(usage?.completionTokens);
  const tokensPerSecond = finiteNumber(usage?.tokensPerSecond);
  const parts: Array<{ key: string; kind: "in" | "out" | "speed" | "total"; label: string }> = [];
  if (promptTokens !== undefined) {
    parts.push({ key: "in", kind: "in", label: `${formatCompactTokenCount(promptTokens)} in` });
  }
  if (completionTokens !== undefined) {
    parts.push({ key: "out", kind: "out", label: `${formatCompactTokenCount(completionTokens)} out` });
  }
  if (tokensPerSecond !== undefined) {
    parts.push({ key: "speed", kind: "speed", label: `${formatSpeed(tokensPerSecond)} tok/s` });
  }
  if (parts.length === 0 && totalTokens !== undefined) {
    parts.push({ key: "total", kind: "total", label: `${formatCompactTokenCount(totalTokens)} tokens` });
  }
  return parts;
}

function formatCompactTokenCount(value: number) {
  const safe = Math.max(0, Math.round(value));
  if (safe >= 1_000_000) {
    return `${formatCompactTokenValue(safe / 1_000_000)}m`;
  }
  if (safe >= 1_000) {
    return `${formatCompactTokenValue(safe / 1_000)}k`;
  }
  return new Intl.NumberFormat().format(safe);
}

function formatCompactTokenValue(value: number) {
  if (value >= 100) {
    return String(Math.round(value));
  }
  if (value >= 10) {
    return value.toFixed(1).replace(/\.0$/, "");
  }
  return value.toFixed(2).replace(/\.0+$/, "").replace(/(\.\d)0$/, "$1");
}

function formatSpeed(value: number) {
  const safe = Math.max(0, value);
  return safe >= 100 ? new Intl.NumberFormat().format(Math.round(safe)) : safe.toFixed(1);
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

function resolveFallbackWorkedLabel(events: AgentActivityEvent[]) {
  if (!events.some(isMeaningfulTimelineEvent)) {
    return null;
  }
  const startedAt = events.find((event) => event.startedAt)?.startedAt;
  const completedAt = [...events].reverse().find((event) => event.completedAt)?.completedAt;
  const durationMs = computeRunElapsed(startedAt, completedAt);
  if (typeof durationMs === "number" && durationMs >= WORKED_LABEL_MIN_DURATION_MS) {
    return `Worked for ${formatActivityDuration(durationMs)}`;
  }
  return "Worked";
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
  const fallbackIds = new Set(fallbackDetails.map((event) => event.id));

  const build = (source: AgentActivityEvent[], honorFallbackFilter: boolean) => {
    const items: ActivityTimelineItem[] = [];
    let currentCommands: AgentActivityEvent[] = [];

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

    for (const event of source) {
      if (event.type === "elapsed" || event.type === "stream") {
        continue;
      }
      if (isCommandLikeEvent(event)) {
        currentCommands.push(event);
        continue;
      }
      if (honorFallbackFilter && fallbackIds.size > 0 && !fallbackIds.has(event.id)) {
        continue;
      }
      if (!event.summary && !event.title) {
        continue;
      }
      flushCommands();

      // Group a note with the run of same-kind notes immediately before it
      // (e.g. several "Used Read File" in a row), so one expandable row stands
      // in for the group. A note of a different kind starts a new row.
      const title = titleForReasoningChunk(event);
      const previous = items[items.length - 1];
      if (previous && previous.kind === "notes" && isSameActivityLabel(previous.title, title)) {
        const last = previous.events[previous.events.length - 1];
        // Drop a true duplicate (same kind AND same target) of the last member.
        if (last && isDuplicateNoteEvent(last, event)) {
          continue;
        }
        previous.events.push(event);
        continue;
      }
      items.push({
        events: [event],
        id: `timeline-notes-${event.id}`,
        kind: "notes",
        title
      });
    }

    flushCommands();
    return items;
  };

  const items = build(events, true);
  if (items.length > 0) {
    return items;
  }
  return build(fallbackDetails, false);
}

function isDuplicateNoteEvent(left: AgentActivityEvent, right: AgentActivityEvent) {
  if (!isSameActivityLabel(titleForReasoningChunk(left), titleForReasoningChunk(right))) {
    return false;
  }
  const leftDetail = summarizeWorkedDetail(left) ?? "";
  const rightDetail = summarizeWorkedDetail(right) ?? "";
  return isSameActivityLabel(leftDetail, rightDetail);
}

function isCommandLikeEvent(event: AgentActivityEvent) {
  return event.type === "command" || Boolean(event.command);
}

function isRunLifecycleNoiseEvent(event: AgentActivityEvent) {
  if (event.type !== "status") {
    return false;
  }
  const label = `${event.title} ${event.summary ?? ""} ${event.hermes?.eventType ?? ""}`.trim();
  return /\b(?:run|message|response|stream)[\s._-]*(?:start|started|created|complete|completed|done|finished)\b/i.test(label);
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
