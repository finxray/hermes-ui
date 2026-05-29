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
  const capabilities = formatCapabilities(status?.capabilities ?? null);

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
            : "Brain Memory is optional. The Web UI can run standalone; set BRAIN_MEMORY_GATEWAY_URL and enable the Gateway flag when you connect Brain Memory later."}
        </div>
        {status?.error ? <div className="status-error">{status.error.message}</div> : null}
        {status?.mode === "mock" || status?.mode === "unconfigured" ? (
          <div className="card-meta">
            Connect later with npm run studio:env -- --mode attach-brain-memory-later,
            then set BRAIN_MEMORY_UI_ENABLE_REAL_GATEWAY=true when Gateway is reachable.
          </div>
        ) : null}
        {status?.mode === "real" ? (
          <div className="card-meta">
            {capabilities.length > 0
              ? `Capabilities: ${capabilities.join(", ")}`
              : "Capabilities endpoint unavailable or protected; status is still read from /health."}
          </div>
        ) : null}
        <div className="card-meta">
          Real memory search may require both an optional UI API bearer and a tenant-bound Gateway
          memory key.
        </div>
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

function formatCapabilities(capabilities: Record<string, unknown> | null): string[] {
  const features =
    capabilities?.features && typeof capabilities.features === "object" && !Array.isArray(capabilities.features)
      ? (capabilities.features as Record<string, unknown>)
      : capabilities;

  if (!features) {
    return [];
  }

  return Object.entries(features)
    .filter(([, value]) => value === true)
    .map(([key]) => key)
    .slice(0, 5);
}
