import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  title: string;
  body: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  compact?: boolean;
  onAction?: () => void;
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
  tone?: "important" | "neutral";
};

export function EmptyState({
  actionLabel,
  actionDisabled = false,
  body,
  compact = false,
  onAction,
  onSecondaryAction,
  secondaryActionLabel,
  title,
  tone = "neutral"
}: EmptyStateProps) {
  return (
    <div
      className={`${styles.empty} ${compact ? styles.compact : ""}`}
      aria-busy={actionDisabled || undefined}
      data-tone={tone}
      role={tone === "important" ? "alert" : undefined}
    >
      <div className={styles.title}>{title}</div>
      <p>{body}</p>
      {actionLabel && onAction ? (
        <div className={styles.actions}>
          <button className={styles.button} disabled={actionDisabled} type="button" onClick={onAction}>
            {actionLabel}
          </button>
          {secondaryActionLabel && onSecondaryAction ? (
            <button
              className={styles.secondaryButton}
              disabled={actionDisabled}
              type="button"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
