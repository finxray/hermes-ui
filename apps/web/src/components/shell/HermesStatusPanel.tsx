import { RefreshCw } from "lucide-react";
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import styles from "./StatusPanel.module.css";

type HermesStatusPanelProps = {
  status: NormalizedHermesStatus | null;
  isLoading: boolean;
  isRefreshing?: boolean;
  onRefresh: () => void;
  sessionModel?: HermesSessionModelSync | null;
};

export function HermesStatusPanel({
  status,
  isLoading,
  isRefreshing = false,
  onRefresh,
  sessionModel = null
}: HermesStatusPanelProps) {
  const activeModelState = sessionModel?.modelState ?? status?.uiCapabilities.models ?? null;
  const capabilityRows = getCapabilityRows(status, sessionModel);
  const checkedAt = status?.checkedAt ? new Date(status.checkedAt).toLocaleTimeString() : "Never";
  const sessionCheckedAt = sessionModel?.checkedAt
    ? new Date(sessionModel.checkedAt).toLocaleTimeString()
    : null;

  return (
    <section className={styles.section} aria-labelledby="hermes-status-heading">
      <div className={styles.sectionLabel} id="hermes-status-heading">
        <span>Hermes status</span>
        <button
          className={`${styles.iconButton}${isRefreshing ? ` ${styles.iconButtonRefreshing}` : ""}`}
          type="button"
          aria-label="Refresh Hermes status"
          onClick={onRefresh}
          disabled={isLoading || isRefreshing}
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
        {sessionModel ? (
          <div className={styles.syncStrip} data-state={sessionModel.syncStatus}>
            <div className={styles.syncTop}>
              <span>Session model pipeline</span>
              <span className={styles.syncState}>{syncStatusLabel(sessionModel.syncStatus)}</span>
            </div>
            <div className={styles.syncPipeline} aria-label="Model sync pipeline">
              <span className={styles.syncNode}>Hermes</span>
              <span className={styles.syncLine} aria-hidden="true" />
              <span className={styles.syncNode}>BFF</span>
              <span className={styles.syncLine} aria-hidden="true" />
              <span className={styles.syncNode}>UI</span>
            </div>
            <div className={styles.meta}>
              {sessionModel.syncStatus === "fallback"
                ? "Hermes has not created this session yet; using the server default."
                : sessionModel.syncStatus === "turn-ready"
                  ? "UI OpenRouter model will be sent through Hermes on each turn."
                : sessionCheckedAt
                  ? `Session verified: ${sessionCheckedAt}`
                  : "Waiting for Hermes session verification."}
            </div>
            {sessionModel.error ? <div className={styles.error}>{sessionModel.error}</div> : null}
          </div>
        ) : null}
        {activeModelState ? (
          <div className={styles.fieldGrid} aria-label="Hermes model state">
            <ModelField label="Model" value={sessionModel?.modelLabel ?? activeModelState.currentModelLabel} />
            <ModelField label="Provider" value={sessionModel?.providerLabel ?? activeModelState.currentProviderLabel} />
            <ModelField label="Selection" value={activeModelState.selectionStatus} />
            <ModelField label="Fast stream" value={activeModelState.fastStreamProfile} />
          </div>
        ) : null}
        {capabilityRows.length > 0 ? (
          <div className={styles.capabilities} aria-label="Hermes capabilities">
            {capabilityRows.map((row) => (
              <span className={styles.pill} key={row.label}>
                {row.label}: {row.value}
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

function ModelField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value}</span>
    </div>
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

function syncStatusLabel(status: HermesSessionModelSync["syncStatus"]) {
  if (status === "synced") {
    return "verified";
  }
  if (status === "verifying") {
    return "switching";
  }
  if (status === "loading") {
    return "checking";
  }
  if (status === "fallback") {
    return "server default";
  }
  if (status === "turn-ready") {
    return "per-turn";
  }
  if (status === "error") {
    return "attention";
  }
  return "unavailable";
}

function getCapabilityRows(status: NormalizedHermesStatus | null, sessionModel?: HermesSessionModelSync | null) {
  const ui = status?.uiCapabilities;
  if (!ui) {
    return [];
  }

  return [
    {
      label: "session stream",
      value: ui.chat.sessionStreaming ? "available" : "unavailable"
    },
    {
      label: "runs",
      value: ui.runs.submission && ui.runs.eventsSse ? "available" : "unavailable"
    },
    {
      label: "stop",
      value: ui.cancellation.uiState
    },
    {
      label: "approvals",
      value: ui.approvals.uiState
    },
    {
      label: "tools",
      value: ui.tools.uiState
    },
    {
      label: "model",
      value: sessionModel?.modelLabel ?? ui.models.currentModelLabel
    },
    {
      label: "model mode",
      value: ui.models.selectionStatus
    },
    {
      label: "model selector",
      value: ui.models.uiState
    },
    {
      label: "memory bridge",
      value: ui.memory.instructionBridgeActive ? "active" : "inactive"
    },
    {
      label: "files",
      value: ui.files.uiState
    }
  ];
}
