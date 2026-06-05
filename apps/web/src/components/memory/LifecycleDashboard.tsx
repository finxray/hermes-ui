"use client";

import { BarChart3, RefreshCw } from "lucide-react";
import { useLifecycleMetrics } from "@/hooks/useLifecycleMetrics";
import type { LifecycleMetrics } from "@hermes-ui/brain-memory-client";
import styles from "./LifecycleDashboard.module.css";

export function LifecycleDashboard() {
  const { error, isLoading, metrics, refresh } = useLifecycleMetrics();

  return (
    <details className={styles.section} open>
      <summary className={styles.sectionLabel}>
        <span>Lifecycle dashboard</span>
        <span className={styles.summaryActions}>
          <BarChart3 size={13} aria-hidden="true" />
          <button
            aria-label="Refresh lifecycle metrics"
            className={styles.iconButton}
            disabled={isLoading}
            type="button"
            onClick={(event) => {
              event.preventDefault();
              void refresh();
            }}
          >
            <RefreshCw size={13} aria-hidden="true" />
          </button>
        </span>
      </summary>

      {error ? <div className={styles.error}>{error}</div> : null}
      <StateCards metrics={metrics} isLoading={isLoading} />
      <OperationCards metrics={metrics} isLoading={isLoading} />
    </details>
  );
}

function StateCards({
  isLoading,
  metrics
}: {
  isLoading: boolean;
  metrics: LifecycleMetrics | null;
}) {
  const cards = [
    ["Active", metrics?.active_count],
    ["Archived", metrics?.archived_count],
    ["Superseded", metrics?.superseded_count],
    ["Deleted", metrics?.deleted_soft_count]
  ] as const;

  return (
    <div className={styles.cardGrid} aria-label="Lifecycle state distribution">
      {cards.map(([label, value]) => (
        <MetricCard
          key={label}
          label={label}
          value={isLoading && metrics === null ? "..." : String(value ?? 0)}
        />
      ))}
    </div>
  );
}

function OperationCards({
  isLoading,
  metrics
}: {
  isLoading: boolean;
  metrics: LifecycleMetrics | null;
}) {
  const cards = [
    ["Archives", metrics?.archives_24h, metrics?.archives_7d],
    ["Restores", metrics?.restores_24h, metrics?.restores_7d],
    ["Deletes", metrics?.deletes_24h, metrics?.deletes_7d],
    ["Supersedes", metrics?.supersedes_24h, metrics?.supersedes_7d]
  ] as const;

  return (
    <div className={styles.operationGrid} aria-label="Lifecycle operation activity">
      {cards.map(([label, today, sevenDays]) => (
        <div className={styles.metricCard} key={label}>
          <div className={styles.metricLabel}>{label}</div>
          <div className={styles.operationRows}>
            <MetricLine label="today" value={isLoading && metrics === null ? "..." : String(today ?? 0)} />
            <MetricLine label="7d" value={isLoading && metrics === null ? "..." : String(sevenDays ?? 0)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
    </div>
  );
}

function MetricLine({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metricLine}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
