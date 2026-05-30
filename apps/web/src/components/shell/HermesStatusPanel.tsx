import { RefreshCw } from "lucide-react";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import styles from "./StatusPanel.module.css";

type HermesStatusPanelProps = {
  status: NormalizedHermesStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
};

export function HermesStatusPanel({ status, isLoading, onRefresh }: HermesStatusPanelProps) {
  const capabilityFlags = getCapabilityFlags(status);
  const checkedAt = status?.checkedAt ? new Date(status.checkedAt).toLocaleTimeString() : "Never";

  return (
    <section className={styles.section} aria-labelledby="hermes-status-heading">
      <div className={styles.sectionLabel} id="hermes-status-heading">
        <span>Hermes status</span>
        <button
          className={styles.iconButton}
          type="button"
          aria-label="Refresh Hermes status"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw size={13} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span>{statusLabel(status, isLoading)}</span>
          <span className={styles.pill}>{status?.mode ?? "checking"}</span>
        </div>
        <div className={styles.metrics}>
          <Metric label="configured" value={status?.configured ? "Yes" : "No"} />
          <Metric label="reachable" value={status?.reachable ? "Yes" : "No"} />
        </div>
        <div className={styles.cardBody}>
          {status?.baseUrl ? `Base URL: ${status.baseUrl}` : "Set HERMES_API_BASE_URL to enable real checks."}
        </div>
        {status?.error ? <div className={styles.error}>{status.error.message}</div> : null}
        {capabilityFlags.length > 0 ? (
          <div className={styles.capabilities} aria-label="Hermes capabilities">
            {capabilityFlags.slice(0, 8).map((flag) => (
              <span className={styles.pill} key={flag}>
                {flag}
              </span>
            ))}
          </div>
        ) : (
          <div className={styles.meta}>Capabilities unavailable until Hermes responds.</div>
        )}
        <div className={styles.meta}>Last checked: {checkedAt}</div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricValue}>{value}</div>
      <div className={styles.metricLabel}>{label}</div>
    </div>
  );
}

function statusLabel(status: NormalizedHermesStatus | null, isLoading: boolean) {
  if (isLoading && !status) {
    return "Checking Hermes";
  }
  if (!status) {
    return "Hermes status unavailable";
  }
  if (status.mode === "real" && status.reachable) {
    return "Hermes connected";
  }
  if (status.mode === "unconfigured") {
    return "Hermes unconfigured";
  }
  if (status.mode === "mock") {
    return "Hermes mock mode";
  }
  return "Hermes unreachable";
}

function getCapabilityFlags(status: NormalizedHermesStatus | null) {
  const features = status?.capabilities?.features;
  if (!features || typeof features !== "object" || Array.isArray(features)) {
    return [];
  }

  return Object.entries(features)
    .filter(([, value]) => value === true)
    .map(([key]) => key.replaceAll("_", " "));
}
