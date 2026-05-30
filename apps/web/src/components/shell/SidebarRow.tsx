import type { ReactNode } from "react";
import styles from "./SidebarRow.module.css";

type SidebarRowProps = {
  actions?: ReactNode;
  active?: boolean;
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
    actions ? styles.hasActions : ""
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <>
      <span className={styles.icon} aria-hidden={icon ? undefined : "true"}>
        {icon}
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {secondary ? <span className={styles.secondary}>{secondary}</span> : null}
      </span>
      <span className={styles.meta}>{meta}</span>
      {actions ? <span className={styles.actions}>{actions}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        aria-current={active ? "page" : undefined}
        className={className}
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
    <div className={className} title={title}>
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
    <button className={styles.actionButton} type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function SidebarStatusDot({ tone = "quiet" }: { tone?: "error" | "mock" | "quiet" | "success" }) {
  return <span className={`${styles.statusDot} ${styles[tone]}`} aria-hidden="true" />;
}
