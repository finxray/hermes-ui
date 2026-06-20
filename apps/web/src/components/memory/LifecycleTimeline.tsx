"use client";

import { Clock3 } from "@/components/ui/AppIcons";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLifecycleTimeline } from "@/hooks/useLifecycleTimeline";
import type { TimelineEvent } from "@hermes-ui/brain-memory-client";
import styles from "./LifecycleTimeline.module.css";

type LifecycleTimelineProps = {
  canInspectMemory: boolean;
  isGatewayConnected: boolean;
  onInspectMemory: (memoryId: string) => void;
};

export function LifecycleTimeline({
  canInspectMemory,
  isGatewayConnected,
  onInspectMemory
}: LifecycleTimelineProps) {
  const { error, events, hasMore, isLoading, loadMore, mode, total } = useLifecycleTimeline(
    20,
    0,
    isGatewayConnected
  );

  if (!isGatewayConnected) {
    return (
      <details className={styles.section} open>
        <summary className={styles.sectionLabel}>
          <span>Lifecycle timeline</span>
          <Clock3 size={13} aria-hidden="true" />
        </summary>
        <div className={styles.meta} role="status">
          Brain Memory Gateway is not connected. Lifecycle audit events appear when a Gateway is
          configured and reachable.
        </div>
      </details>
    );
  }

  return (
    <details className={styles.section} open>
      <summary className={styles.sectionLabel}>
        <span>Lifecycle timeline</span>
        <Clock3 size={13} aria-hidden="true" />
      </summary>

      <div className={styles.meta}>
        Showing {events.length} of {total} events
      </div>
      {mode === "error" && error ? <div className={styles.error}>{error}</div> : null}

      {events.length === 0 && !isLoading ? (
        <EmptyState compact title="No lifecycle events" body="No lifecycle audit events were returned." />
      ) : (
        <ol className={styles.feed}>
          {events.map((event) => (
            <LifecycleEventRow
              canInspectMemory={canInspectMemory}
              event={event}
              key={event.audit_event_id}
              onInspectMemory={onInspectMemory}
            />
          ))}
        </ol>
      )}

      {isLoading && events.length === 0 ? <div className={styles.meta}>Loading events...</div> : null}

      {hasMore ? (
        <button
          className={styles.loadMoreButton}
          disabled={isLoading}
          type="button"
          onClick={() => void loadMore()}
        >
          {isLoading ? "Loading..." : "Load more"}
        </button>
      ) : null}
    </details>
  );
}

function LifecycleEventRow({
  canInspectMemory,
  event,
  onInspectMemory
}: {
  canInspectMemory: boolean;
  event: TimelineEvent;
  onInspectMemory: (memoryId: string) => void;
}) {
  const canInspect = canInspectMemory && Boolean(event.memory_id);

  return (
    <li className={styles.event}>
      <div className={styles.connector} aria-hidden="true" />
      <div className={styles.eventBody}>
        <div className={styles.eventHeader}>
          <span className={styles.timestamp}>{formatTimestamp(event.created_at)}</span>
          <span className={styles.badge} data-operation={operationFamily(event.operation)}>
            {formatOperation(event.operation)}
          </span>
        </div>
        <button
          className={styles.memoryButton}
          disabled={!canInspect}
          type="button"
          onClick={() => onInspectMemory(event.memory_id)}
        >
          {truncateUuid(event.memory_id)}
        </button>
        <div className={styles.reason}>{truncateText(event.reason ?? "No reason recorded", 80)}</div>
        <div className={styles.meta}>
          {event.from_state ? `${event.from_state} -> ${event.to_state}` : event.to_state}
          {event.lifecycle_state ? ` · current ${event.lifecycle_state}` : ""}
          {event.project_key ? ` · ${event.project_key}` : ""}
          {event.session_key ? ` · ${event.session_key}` : ""}
        </div>
        {event.caller_label ? <div className={styles.meta}>caller {event.caller_label}</div> : null}
      </div>
    </li>
  );
}

function operationFamily(operation: string) {
  if (operation === "archive") return "archive";
  if (operation === "restore") return "restore";
  if (operation === "delete_soft") return "delete";
  if (operation === "superseded" || operation === "supersede_create") return "supersede";
  return "unknown";
}

function formatOperation(operation: string) {
  return operation.replace(/_/g, " ");
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString(undefined, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  });
}

function truncateUuid(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function truncateText(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}
