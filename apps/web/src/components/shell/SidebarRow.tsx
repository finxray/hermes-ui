import type { ReactNode } from "react";
import styles from "./SidebarRow.module.css";

type SidebarRowProps = {
  actions?: ReactNode;
  active?: boolean;
  depth?: 0 | 1;
  disabled?: boolean;
  icon?: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  muted?: boolean;
  onClick?: () => void;
  secondary?: ReactNode;
  title?: string;
};

export function SidebarRow({
  actions,
  active = false,
  depth = 0,
  disabled = false,
  icon,
  label,
  meta,
  muted = false,
  onClick,
  secondary,
  title
}: SidebarRowProps) {
  const className = [
    styles.row,
    active ? styles.active : "",
    muted ? styles.muted : "",
    disabled ? styles.disabled : "",
    actions ? styles.hasActions : "",
    icon ? "" : styles.noIcon
  ]
    .filter(Boolean)
    .join(" ");

  const metaSlot = (
    <span className={styles.metaSlot}>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
    </span>
  );
  const actionMetaSlot = actions ? (
    <span className={`${styles.metaSlot} ${styles.actionMetaSlot}`}>
      {meta ? <span className={styles.meta}>{meta}</span> : null}
      <span className={styles.actions}>{actions}</span>
    </span>
  ) : null;

  const content = (
    <>
      <span className={styles.icon} aria-hidden={icon ? undefined : "true"}>
        {icon}
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {secondary ? <span className={styles.secondary}>{secondary}</span> : null}
      </span>
      {meta ? metaSlot : null}
    </>
  );

  if (onClick && actions) {
    return (
      <div className={className} data-depth={depth} title={title}>
        <button
          aria-current={active ? "page" : undefined}
          className={styles.contentButton}
          disabled={disabled}
          onClick={onClick}
          type="button"
        >
          {content}
        </button>
        {actionMetaSlot}
      </div>
    );
  }

  if (onClick) {
    return (
      <button
        aria-current={active ? "page" : undefined}
        className={className}
        data-depth={depth}
        disabled={disabled}
        onClick={onClick}
        title={title}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} data-depth={depth} title={title}>
      {content}
    </div>
  );
}

export function SidebarIconButton({
  children,
  label,
  onClick
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={styles.actionButton}
      type="button"
      aria-label={label}
      data-sidebar-row-action="true"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function SidebarStatusDot({ tone = "quiet" }: { tone?: "error" | "mock" | "quiet" | "success" }) {
  return <span className={`${styles.statusDot} ${styles[tone]}`} aria-hidden="true" />;
}
