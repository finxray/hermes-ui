import { X } from "lucide-react";
import type {
  NormalizedBrainMemoryInspectResponse,
  NormalizedBrainMemorySearchScope,
  NormalizedMemoryDetail,
  NormalizedMemoryEvidence,
  NormalizedMemorySupersessionChain
} from "@hermes-ui/brain-memory-client";
import type { MemoryEvidence } from "@/data/types";
import styles from "./BrainMemoryConsole.module.css";

type MemoryDetailPanelProps = {
  inspection: NormalizedBrainMemoryInspectResponse | null;
  isInspecting: boolean;
  mockDetail: MemoryEvidence | null;
  onClose: () => void;
};

export function MemoryDetailPanel({
  inspection,
  isInspecting,
  mockDetail,
  onClose
}: MemoryDetailPanelProps) {
  const detail = inspection?.detail ?? null;

  return (
    <section className={styles.section} aria-labelledby="memory-detail-heading">
      <div className={styles.sectionLabel} id="memory-detail-heading">
        <span>Memory detail</span>
        <button
          aria-label="Close memory detail"
          className={styles.iconButton}
          type="button"
          onClick={onClose}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      {isInspecting ? (
        <div className={styles.detailPanel}>
          <div className={styles.cardTitle}>
            <span>Loading memory</span>
            <span className={styles.pill}>read-only</span>
          </div>
          <div className={styles.cardBody}>Fetching scoped detail through the local BFF.</div>
        </div>
      ) : null}

      {!isInspecting && inspection?.error ? (
        <div className={styles.error}>{inspection.error.message}</div>
      ) : null}

      {!isInspecting && mockDetail ? <MockMemoryDetail memory={mockDetail} /> : null}

      {!isInspecting && detail ? (
        <GatewayMemoryDetail
          detail={detail}
          evidence={inspection?.evidence ?? null}
          supersession={inspection?.supersession ?? null}
        />
      ) : null}
    </section>
  );
}

function MockMemoryDetail({ memory }: { memory: MemoryEvidence }) {
  return (
    <div className={styles.detailPanel}>
      <div className={styles.cardTitle}>
        <span>{memory.title}</span>
        <span className={styles.pill}>mock/local</span>
      </div>
      <div className={styles.detailContent}>{memory.excerpt}</div>
      <div className={styles.fieldGrid}>
        <ContextField label="Memory id" value={memory.id} />
        <ContextField label="Layer" value={memory.layer} />
        <ContextField label="Source" value={memory.source} />
        <ContextField label="Timestamp" value={memory.timestamp} />
      </div>
      <div className={styles.meta}>
        Gateway detail is unavailable in mock mode; this is local demo evidence only.
      </div>
    </div>
  );
}

function GatewayMemoryDetail({
  detail,
  evidence,
  supersession
}: {
  detail: NormalizedMemoryDetail;
  evidence: NormalizedMemoryEvidence | null;
  supersession: NormalizedMemorySupersessionChain | null;
}) {
  return (
    <div className={styles.detailPanel}>
      <div className={styles.cardTitle}>
        <span>{detail.id}</span>
        <span className={styles.pill}>{detail.scopeStatus ?? "scoped"}</span>
      </div>
      <div className={styles.detailContent}>{detail.content}</div>
      {detail.snippet ? <div className={styles.cardBody}>Snippet: {detail.snippet}</div> : null}
      <div className={styles.fieldGrid}>
        <ContextField label="Memory id" value={detail.id} />
        <ContextField label="Layer" value={detail.layer ?? "unknown"} />
        <ContextField label="Source" value={detail.source ?? "Gateway"} />
        <ContextField label="Project key" value={detail.projectKey ?? "unknown"} />
        <ContextField label="Session key" value={detail.sessionKey ?? "project-level"} />
        <ContextField label="Supersession" value={detail.supersessionStatus ?? "unknown"} />
        <ContextField label="Evidence count" value={String(detail.evidenceCount ?? 0)} />
        <ContextField label="Created" value={detail.createdAt ?? "unknown"} />
        <ContextField label="Updated" value={detail.updatedAt ?? "unknown"} />
      </div>
      {detail.scope ? <ScopeSummary scope={detail.scope} /> : null}
      <ReadOnlyStatusSection
        label="Evidence"
        status={evidence?.status}
        emptyText="Evidence storage is not implemented yet."
        count={evidence?.evidence.length ?? 0}
      />
      <ReadOnlyStatusSection
        label="Supersession chain"
        status={supersession?.status}
        emptyText="Supersession chain storage is not implemented yet."
        count={supersession?.chain.length ?? 0}
      />
      {detail.metadata ? (
        <details className={styles.metadata}>
          <summary>Metadata</summary>
          <pre>{JSON.stringify(detail.metadata, null, 2)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function ReadOnlyStatusSection({
  count,
  emptyText,
  label,
  status
}: {
  count: number;
  emptyText: string;
  label: string;
  status?: string;
}) {
  return (
    <div className={styles.readonlySection}>
      <div className={styles.cardTitle}>
        <span>{label}</span>
        <span className={styles.pill}>{status ?? "unknown"}</span>
      </div>
      <div className={styles.cardBody}>
        {status === "not_implemented" || count === 0
          ? emptyText
          : `${count} read-only item${count === 1 ? "" : "s"} available.`}
      </div>
    </div>
  );
}

export function ScopeSummary({ scope }: { scope: NormalizedBrainMemorySearchScope }) {
  const excluded = scope.legacyUnscopedExcluded ?? 0;
  const mismatchedProject = scope.mismatchedProjectExcluded ?? 0;
  const mismatchedSession = scope.mismatchedSessionExcluded ?? 0;

  return (
    <div className={styles.meta}>
      Scope: {scope.status ?? "unknown"} / {scope.mode ?? "project"} for{" "}
      {scope.projectKey ?? "project"}.
      {excluded > 0 ? ` Legacy/unscoped excluded: ${excluded}.` : ""}
      {mismatchedProject > 0 ? ` Project mismatches excluded: ${mismatchedProject}.` : ""}
      {mismatchedSession > 0 ? ` Session mismatches excluded: ${mismatchedSession}.` : ""}
    </div>
  );
}

export function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value}</span>
    </div>
  );
}
