import styles from "./EmptyState.module.css";

type EmptyStateProps = {
  title: string;
  body: string;
  actionLabel?: string;
  compact?: boolean;
  onAction?: () => void;
};

export function EmptyState({
  actionLabel,
  body,
  compact = false,
  onAction,
  title
}: EmptyStateProps) {
  return (
    <div className={`${styles.empty} ${compact ? styles.compact : ""}`}>
      <div className={styles.title}>{title}</div>
      <p>{body}</p>
      {actionLabel && onAction ? (
        <button className={styles.button} type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
