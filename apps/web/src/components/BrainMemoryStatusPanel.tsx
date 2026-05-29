import { RefreshCw } from "lucide-react";
import type { NormalizedBrainMemoryStatus } from "@hermes-ui/brain-memory-client";

type BrainMemoryStatusPanelProps = {
  status: NormalizedBrainMemoryStatus | null;
  isLoading: boolean;
  onRefresh: () => void;
};

export function BrainMemoryStatusPanel({
  status,
  isLoading,
  onRefresh
}: BrainMemoryStatusPanelProps) {
  const checkedAt = status?.checkedAt ? new Date(status.checkedAt).toLocaleTimeString() : "Never";

  return (
    <section className="panel-section" aria-labelledby="brain-memory-status-heading">
      <div className="section-label" id="brain-memory-status-heading">
        <span>Brain Memory status</span>
        <button
          className="mini-action"
          type="button"
          aria-label="Refresh Brain Memory status"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw size={13} aria-hidden="true" />
        </button>
      </div>
      <div className="summary-card">
        <div className="card-title">
          <span>{statusLabel(status, isLoading)}</span>
          <span className="pill">{status?.mode ?? "checking"}</span>
        </div>
        <div className="summary-grid">
          <div className="metric">
            <div className="metric-value">{status?.configured ? "Yes" : "No"}</div>
            <div className="metric-label">configured</div>
          </div>
          <div className="metric">
            <div className="metric-value">{status?.reachable ? "Yes" : "No"}</div>
            <div className="metric-label">reachable</div>
          </div>
        </div>
        <div className="card-body">
          {status?.baseUrl
            ? `Gateway URL: ${status.baseUrl}`
            : "Set BRAIN_MEMORY_GATEWAY_URL and enable the Gateway flag for real read-only checks."}
        </div>
        {status?.error ? <div className="status-error">{status.error.message}</div> : null}
        <div className="card-meta">Last checked: {checkedAt}</div>
      </div>
    </section>
  );
}

function statusLabel(status: NormalizedBrainMemoryStatus | null, isLoading: boolean) {
  if (isLoading && !status) {
    return "Checking Gateway";
  }
  if (!status) {
    return "Gateway status unavailable";
  }
  if (status.mode === "real" && status.reachable) {
    return "Gateway connected";
  }
  if (status.mode === "unconfigured") {
    return "Gateway unconfigured";
  }
  if (status.mode === "mock") {
    return "Gateway mock mode";
  }
  return "Gateway unreachable";
}
