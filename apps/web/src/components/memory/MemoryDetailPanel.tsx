import { X } from "@/components/ui/AppIcons";
import { MessageMarkdown } from "@/components/chat/MessageMarkdown";
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
        <span>Read-only detail</span>
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
      <div className={styles.detailContentScroll}>
        <MessageMarkdown content={memory.excerpt} />
      </div>
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
        <span>Scoped result</span>
        <span className={styles.pill}>{detail.scopeStatus ?? "scoped"}</span>
      </div>
      <div className={styles.detailContentScroll}>
        <MessageMarkdown content={detail.content} />
      </div>
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
        <ContextField label="Audit" value="Metadata only" />
      </div>
      {detail.lifecycleState ? <LifecycleSection detail={detail} /> : null}
      {detail.scope ? <ScopeSummary scope={detail.scope} /> : null}
      <EvidenceSection
        label="Evidence"
        status={evidence?.status}
        items={evidence?.evidence ?? []}
        emptyText="Evidence: not implemented by Gateway yet."
      />
      <EvidenceSection
        label="Supersession chain"
        status={supersession?.status}
        items={supersession?.chain ?? []}
        emptyText="Supersession chain: not implemented by Gateway yet."
      />
      {detail.metadata ? (
        <details className={styles.metadata}>
          <summary>Audit metadata</summary>
          <pre>{safeMetadataJson(detail.metadata)}</pre>
        </details>
      ) : null}
    </div>
  );
}

function LifecycleSection({ detail }: { detail: NormalizedMemoryDetail }) {
  const hasChain = (detail.supersessionChain?.length ?? 0) > 0;
  const hasAudit = (detail.auditEvents?.length ?? 0) > 0;

  return (
    <div className={styles.readonlySection}>
      <div className={styles.cardTitle}>
        <span>Lifecycle</span>
        <span className={styles.pill}>{detail.lifecycleState}</span>
      </div>
      <div className={styles.fieldGrid}>
        <ContextField label="Lifecycle state" value={detail.lifecycleState ?? "unknown"} />
        <ContextField label="Created" value={formatDetailDate(detail.createdAt)} />
        <ContextField label="Updated" value={formatDetailDate(detail.updatedAt)} />
        <ContextField label="Archived" value={formatDetailDate(detail.archivedAt)} />
        <ContextField label="Deleted" value={formatDetailDate(detail.deletedAt)} />
        <ContextField label="Supersedes" value={detail.supersedesMemoryId ?? "-"} />
        <ContextField label="Superseded by" value={detail.supersededByMemoryId ?? "-"} />
      </div>

      {hasChain ? (
        <div className={styles.lifecycleChain}>
          {detail.supersessionChain?.map((item) => (
            <div className={styles.lifecycleChainItem} key={item.memoryId}>
              <div className={styles.evidenceDot} aria-hidden="true" />
              <div>
                <div className={styles.evidenceTitle}>{item.memoryId}</div>
                <div className={styles.evidenceMeta}>
                  {item.lifecycleState} · {formatDetailDate(item.createdAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {hasAudit ? (
        <div className={styles.lifecycleAudit}>
          <div className={styles.fieldLabel}>Audit history</div>
          <ol className={styles.evidenceList}>
            {detail.auditEvents?.map((event) => (
              <li className={styles.evidenceItem} key={event.id}>
                <div className={styles.evidenceDot} aria-hidden="true" />
                <div className={styles.evidenceBody}>
                  <div className={styles.evidenceTitle}>
                    {formatDetailDate(event.createdAt)} - {event.operation} {"->"} {event.toState}
                  </div>
                  <div className={styles.evidenceMeta}>
                    {event.fromState ? `${event.fromState} -> ${event.toState}` : event.toState}
                    {event.reason ? ` · ${event.reason}` : ""}
                    {event.callerLabel ? ` · ${event.callerLabel}` : ""}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceSection({
  emptyText,
  items,
  label,
  status
}: {
  emptyText: string;
  items: unknown[];
  label: string;
  status?: string;
}) {
  const hasItems = status !== "not_implemented" && items.length > 0;

  return (
    <div className={styles.readonlySection}>
      <div className={styles.cardTitle}>
        <span>{label}</span>
        <span className={styles.pill}>{status ?? "unknown"}</span>
      </div>
      {hasItems ? (
        <ul className={styles.evidenceList}>
          {items.map((item, index) => (
            <EvidenceItem key={index} item={item} />
          ))}
        </ul>
      ) : (
        <div className={styles.cardBody}>{emptyText}</div>
      )}
    </div>
  );
}

function EvidenceItem({ item }: { item: unknown }) {
  const shape = extractEvidenceShape(item);
  return (
    <li className={styles.evidenceItem}>
      <div className={styles.evidenceDot} aria-hidden="true" />
      <div className={styles.evidenceBody}>
        <div className={styles.evidenceTitle}>{shape.title}</div>
        {shape.meta ? <div className={styles.evidenceMeta}>{shape.meta}</div> : null}
      </div>
    </li>
  );
}

function extractEvidenceShape(item: unknown): { title: string; meta: string } {
  if (!item || typeof item !== "object") {
    return { title: String(item ?? "(empty)"), meta: "" };
  }
  const obj = item as Record<string, unknown>;
  const title =
    typeof obj.title === "string"
      ? obj.title
      : typeof obj.id === "string"
        ? obj.id
        : JSON.stringify(item).slice(0, 80);
  const parts: string[] = [];
  if (typeof obj.source === "string") parts.push(obj.source);
  if (typeof obj.createdAt === "string") parts.push(obj.createdAt);
  if (typeof obj.date === "string") parts.push(obj.date);
  if (typeof obj.status === "string") parts.push(obj.status);
  return { title, meta: parts.join(" · ") };
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

function safeMetadataJson(value: Record<string, unknown>) {
  return JSON.stringify(redactMetadata(value), null, 2);
}

function formatDetailDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function redactMetadata(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return "[redacted:depth]";
  }
  if (typeof value === "string") {
    return value
      .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
      .replace(
        /\b(api[_-]?key|authorization|credential|password|secret|token)\s*[:=]\s*["']?[^"'\s,;]+/gi,
        "$1=[redacted]"
      );
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactMetadata(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      redacted[key] = /api[_-]?key|authorization|bearer|credential|password|secret|token/i.test(key)
        ? "[redacted]"
        : redactMetadata(child, depth + 1);
    }
    return redacted;
  }
  return value;
}
