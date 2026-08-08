import { RefreshCw } from "@/components/ui/AppIcons";
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import type { HermesModelRuntimeMetadata, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
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
  const activeModelDescriptor = activeModelState?.availableModels.find(
    (model) => model.id === activeModelState.selectedModelId
  );
  const capabilityRows = getCapabilityRows(status, sessionModel);
  const checkedAt = status?.checkedAt ? new Date(status.checkedAt).toLocaleTimeString() : "Never";
  const sessionCheckedAt = sessionModel?.checkedAt
    ? new Date(sessionModel.checkedAt).toLocaleTimeString()
    : null;
  const softOverrideActive =
    Boolean(sessionModel) &&
    status?.reachable === true &&
    activeModelState?.selectionStatus === "client-selectable" &&
    (sessionModel?.syncStatus === "synced" || sessionModel?.syncStatus === "turn-ready");
  const connectionTone = status?.mode === "real" && status.reachable ? "connected" : "attention";

  return (
    <section className={styles.section} aria-labelledby="hermes-status-heading">
      <div className={styles.sectionLabel} id="hermes-status-heading">
        <span>Hermes</span>
        <button
          className={`${styles.iconButton} ${styles.refreshButton}${isRefreshing ? ` ${styles.iconButtonRefreshing}` : ""}`}
          type="button"
          aria-label="Refresh Hermes status"
          onClick={onRefresh}
          disabled={isLoading || isRefreshing}
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      <div className={styles.statusSummary}>
        <div className={styles.statusHeadline} data-tone={connectionTone}>
          <span className={styles.statusDot} aria-hidden="true" />
          <span>{statusLabel(status, isLoading)}</span>
        </div>
        {activeModelState ? (
          <div className={styles.primaryFields} aria-label="Active Hermes route">
            <ModelField
              label="Model"
              value={sessionModel?.modelLabel ?? activeModelState.currentModelLabel}
            />
            <ModelField
              label="Provider"
              value={sessionModel?.providerLabel ?? activeModelState.currentProviderLabel}
            />
          </div>
        ) : null}

        {sessionModel ? (
          <div
            className={styles.syncStrip}
            data-state={sessionModel.syncStatus}
            data-unconfirmed={softOverrideActive ? "true" : undefined}
          >
            <div className={styles.syncTop}>
              <span>Session model pipeline</span>
              <span className={styles.syncState}>
                {softOverrideActive && sessionModel.syncStatus === "synced"
                  ? "requested"
                  : syncStatusLabel(sessionModel.syncStatus)}
              </span>
            </div>
            <div className={styles.meta}>
              {sessionPipelineMeta(sessionModel.syncStatus, sessionCheckedAt, softOverrideActive)}
            </div>
            {sessionModel.error ? <div className={styles.error}>{sessionModel.error}</div> : null}
          </div>
        ) : null}

        {status?.error ? <div className={styles.error}>{status.error.message}</div> : null}

        <details className={styles.runtimeDetails}>
          <summary>Runtime details</summary>
          <div className={styles.detailBody}>
            <div className={styles.fieldGrid} aria-label="Hermes runtime details">
              <ModelField label="Mode" value={status?.mode ?? "checking"} />
              <ModelField label="Configured" value={status?.configured ? "Yes" : "No"} />
              <ModelField label="Reachable" value={status?.reachable ? "Yes" : "No"} />
              <ModelField label="Base URL" value={status?.baseUrl ?? "Not configured"} />
              {activeModelState ? (
                <>
                  <ModelField label="Selection" value={activeModelState.selectionStatus} />
                  <ModelField label="Fast stream" value={activeModelState.fastStreamProfile} />
                </>
              ) : null}
              {activeModelDescriptor?.runtime ? (
                <>
                  <ModelField
                    label="Context"
                    value={formatRuntimeContext(activeModelDescriptor.runtime)}
                  />
                  <ModelField
                    label="Quantization"
                    value={formatRuntimeQuantization(activeModelDescriptor.runtime)}
                  />
                  <ModelField
                    label="Runtime"
                    value={formatRuntimeFlags(activeModelDescriptor.runtime)}
                  />
                </>
              ) : null}
            </div>
            {softOverrideActive ? (
              <p className={styles.caveat}>
                Hermes accepted this per-session model request but does not confirm which model
                generated the response. Verify the effective route in provider logs when needed.
              </p>
            ) : null}
            {capabilityRows.length > 0 ? (
              <dl className={styles.capabilityList} aria-label="Hermes capabilities">
                {capabilityRows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className={styles.meta}>Capabilities unavailable until Hermes responds.</div>
            )}
            <div className={styles.meta}>Last checked {checkedAt}</div>
          </div>
        </details>
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

function formatRuntimeContext(runtime: HermesModelRuntimeMetadata) {
  const loaded = runtime.loadedContextLength;
  const max = runtime.maxContextLength;
  if (typeof loaded === "number" && typeof max === "number" && loaded !== max) {
    return `${formatCompactContext(loaded)} active / ${formatCompactContext(max)} max`;
  }
  if (typeof loaded === "number" || typeof max === "number") {
    return `${formatCompactContext(loaded ?? max ?? 0)} context`;
  }
  return "Unknown";
}

function formatRuntimeQuantization(runtime: HermesModelRuntimeMetadata) {
  if (!runtime.quantization) {
    return "Unknown";
  }
  return typeof runtime.quantizationBits === "number"
    ? `${runtime.quantization} / ${runtime.quantizationBits}-bit`
    : runtime.quantization;
}

function formatRuntimeFlags(runtime: HermesModelRuntimeMetadata) {
  const config = runtime.runtimeConfig;
  const parts = [
    config?.offloadKvCacheToGpu ? "GPU KV" : null,
    config?.flashAttention ? "Flash" : null,
    typeof config?.evalBatchSize === "number" ? `batch ${config.evalBatchSize}` : null,
    typeof config?.numExperts === "number" ? `${config.numExperts} experts` : null
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : runtime.state ?? "Unknown";
}

function formatCompactContext(value: number) {
  if (value >= 1_000_000) {
    return `${Math.round(value / 1_000_000)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return `${value}`;
}

function statusLabel(status: NormalizedHermesStatus | null, isLoading: boolean) {
  if (isLoading && !status) {
    return "Checking connection";
  }
  if (!status) {
    return "Status unavailable";
  }
  if (status.mode === "real" && status.reachable) {
    return "Connected";
  }
  if (status.mode === "unconfigured") {
    return "Not configured";
  }
  return "Unavailable";
}

function sessionPipelineMeta(
  syncStatus: HermesSessionModelSync["syncStatus"],
  sessionCheckedAt: string | null,
  softOverrideActive: boolean
): string {
  if (syncStatus === "fallback") {
    return "Using Hermes server default until the session model is verified.";
  }
  if (syncStatus === "turn-ready") {
    return "Requested through Hermes but not confirmed as the active session model.";
  }
  if (syncStatus === "synced") {
    if (softOverrideActive) {
      return sessionCheckedAt
        ? `Hermes accepted this route at ${sessionCheckedAt}.`
        : "Hermes accepted this route.";
    }
    return sessionCheckedAt ? `Session verified at ${sessionCheckedAt}.` : "Session verified.";
  }
  return sessionCheckedAt ? `Last checked at ${sessionCheckedAt}.` : "Waiting for verification.";
}

function syncStatusLabel(status: HermesSessionModelSync["syncStatus"]) {
  if (status === "synced") return "verified";
  if (status === "verifying") return "switching";
  if (status === "loading") return "checking";
  if (status === "fallback") return "server default";
  if (status === "turn-ready") return "unverified";
  if (status === "error") return "attention";
  return "unavailable";
}

function getCapabilityRows(
  status: NormalizedHermesStatus | null,
  sessionModel?: HermesSessionModelSync | null
) {
  const ui = status?.uiCapabilities;
  if (!ui) {
    return [];
  }

  return [
    { label: "Session streaming", value: ui.chat.sessionStreaming ? "Available" : "Unavailable" },
    { label: "Runs", value: ui.runs.submission && ui.runs.eventsSse ? "Available" : "Unavailable" },
    { label: "Stop", value: ui.cancellation.uiState },
    { label: "Approvals", value: ui.approvals.uiState },
    { label: "Tools", value: ui.tools.uiState },
    { label: "Model", value: sessionModel?.modelLabel ?? ui.models.currentModelLabel },
    { label: "Model mode", value: ui.models.selectionStatus },
    { label: "Files", value: ui.files.uiState }
  ];
}
