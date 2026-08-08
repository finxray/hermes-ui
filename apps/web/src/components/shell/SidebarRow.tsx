import type { ReactNode } from "react";
import { OverflowFadeText } from "./OverflowFadeText";
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
  onBlur?: () => void;
  onClick?: () => void;
  onFocus?: () => void;
  secondary?: ReactNode;
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
  onBlur,
  onClick,
  onFocus,
  secondary
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
      {meta ? <span className={styles.meta} data-sidebar-row-meta="true">{meta}</span> : null}
    </span>
  );
  const actionMetaSlot = actions ? (
    <span className={`${styles.metaSlot} ${styles.actionMetaSlot}`}>
      {meta ? <span className={styles.meta} data-sidebar-row-meta="true">{meta}</span> : null}
      <span className={styles.actions} data-sidebar-row-actions="true">{actions}</span>
    </span>
  ) : null;

  const content = (
    <>
      <span className={styles.icon} aria-hidden={icon ? undefined : "true"}>
        {icon}
      </span>
      <span className={styles.text}>
        <OverflowFadeText className={styles.label}>{label}</OverflowFadeText>
        {secondary ? <span className={styles.secondary}>{secondary}</span> : null}
      </span>
      {meta ? metaSlot : null}
    </>
  );

  if (onClick && actions) {
    return (
      <div className={className} data-depth={depth}>
        <button
          aria-current={active ? "page" : undefined}
          className={styles.contentButton}
          disabled={disabled}
          onBlur={onBlur}
          onClick={onClick}
          onFocus={onFocus}
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
        onBlur={onBlur}
        onClick={onClick}
        onFocus={onFocus}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <div className={className} data-depth={depth}>
      {content}
    </div>
  );
}

export function SidebarIconButton({
  children,
  label,
  onMouseEnter,
  onClick,
  size = "default",
  tooltip
}: {
  children: ReactNode;
  label: string;
  onMouseEnter?: () => void;
  onClick: () => void;
  size?: "default" | "compact";
  tooltip?: string;
}) {
  return (
    <button
      className={styles.actionButton}
      type="button"
      aria-label={label}
      data-action-size={size}
      data-sidebar-row-action="true"
      onMouseEnter={onMouseEnter}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
        event.currentTarget.blur();
      }}
    >
      {children}
      {tooltip ? <span className={styles.actionTooltip} role="tooltip">{tooltip}</span> : null}
    </button>
  );
}

export function SidebarStatusDot({ tone = "quiet" }: { tone?: "error" | "mock" | "quiet" | "success" }) {
  return <span className={`${styles.statusDot} ${styles[tone]}`} aria-hidden="true" />;
}
