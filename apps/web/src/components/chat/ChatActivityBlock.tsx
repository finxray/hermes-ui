import { CheckCircle2, ChevronRight, CircleDashed, Terminal, XCircle } from "@/components/ui/AppIcons";
import type { ToolEvent } from "@/data/types";
import styles from "./ChatActivityBlock.module.css";

type ChatActivityBlockProps = {
  events: ToolEvent[];
};

export function ChatActivityBlock({ events }: ChatActivityBlockProps) {
  if (events.length === 0) {
    return null;
  }

  const hasRunningEvent = events.some((event) => event.status === "started" || event.status === "pending");
  const hasMockEvent = events.some((event) => event.status === "mocked");
  const failedCount = events.filter((event) => event.status === "failed").length;
  const summary = hasRunningEvent
    ? "Working"
    : failedCount > 0
      ? `Worked with ${failedCount} issue${failedCount === 1 ? "" : "s"}`
      : `Worked through ${events.length} activity row${events.length === 1 ? "" : "s"}`;

  return (
    <details className={styles.block}>
      <summary className={styles.summary}>
        <span className={styles.chevron} aria-hidden="true">
          <ChevronRight size={15} />
        </span>
        <span>{summary}</span>
        {hasMockEvent ? <span className={styles.mockLabel}>mock activity</span> : null}
      </summary>
      <div className={styles.body}>
        {events.map((event) => (
          <div className={styles.row} data-status={event.status} key={event.id}>
            <span className={styles.icon} aria-hidden="true">
              <StatusIcon status={event.status} />
            </span>
            <span className={styles.content}>
              <span className={styles.titleRow}>
                <span className={styles.name}>{event.name}</span>
                <span className={styles.status}>{event.status}</span>
              </span>
              <span className={styles.detail}>{event.detail}</span>
            </span>
            <span className={styles.time}>{event.time}</span>
          </div>
        ))}
      </div>
    </details>
  );
}

function StatusIcon({ status }: { status: ToolEvent["status"] }) {
  if (status === "completed" || status === "mocked") {
    return <CheckCircle2 size={15} />;
  }
  if (status === "failed") {
    return <XCircle size={15} />;
  }
  if (status === "started" || status === "pending") {
    return <CircleDashed size={15} />;
  }
  return <Terminal size={15} />;
}
