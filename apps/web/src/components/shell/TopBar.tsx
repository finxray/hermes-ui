"use client";

import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import styles from "./TopBar.module.css";

export type ShellSection = "workspace" | "plugins" | "config" | "keys" | "logs";

const SECTION_ITEMS: { id: ShellSection; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "plugins", label: "Plugins" },
  { id: "config", label: "Config" },
  { id: "keys", label: "Keys" },
  { id: "logs", label: "Logs" }
];

type TopBarProps = {
  activeSection: ShellSection;
  canGoBack?: boolean;
  leftToggleId: string;
  leftCollapsed: boolean;
  onBack?: () => void;
  onSectionChange: (section: ShellSection) => void;
  onRightToggle?: () => void;
  rightToggleId: string;
  rightCollapsed: boolean;
  rightToggleLabel?: string;
};

export function TopBar({
  activeSection,
  canGoBack = false,
  leftToggleId,
  leftCollapsed,
  onBack,
  onRightToggle,
  onSectionChange,
  rightToggleId,
  rightCollapsed,
  rightToggleLabel
}: TopBarProps) {
  const activateToggle = (toggleId: string) => {
    document.getElementById(toggleId)?.click();
  };

  return (
    <header className={styles.topbar} aria-label="Brain Memory Studio workspace menu">
      <div className={styles.left}>
        <button
          className={styles.iconButton}
          aria-label={leftCollapsed ? "Open left sidebar" : "Collapse left sidebar"}
          aria-pressed={!leftCollapsed}
          onClick={() => activateToggle(leftToggleId)}
          title={leftCollapsed ? "Open left sidebar" : "Collapse left sidebar"}
          type="button"
        >
          <PanelToggleIcon side="left" />
        </button>
        {canGoBack ? (
          <button
            className={styles.backButton}
            aria-label="Go back"
            onClick={onBack}
            title="Go back"
            type="button"
          >
            <span aria-hidden="true" />
          </button>
        ) : null}
        <nav className={styles.menu} aria-label="Workspace sections">
          {SECTION_ITEMS.map((item) => (
            <button
              aria-current={activeSection === item.id ? "page" : undefined}
              className={`${styles.menuItem} ${activeSection === item.id ? styles.active : ""}`}
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              title={item.label}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
      <div className={styles.right}>
        <button
          className={styles.iconButton}
          aria-label={rightToggleLabel ?? (rightCollapsed ? "Open right context panel" : "Collapse right context panel")}
          aria-pressed={!rightCollapsed}
          onClick={onRightToggle ?? (() => activateToggle(rightToggleId))}
          title={rightToggleLabel ?? (rightCollapsed ? "Open right context panel" : "Collapse right context panel")}
          type="button"
        >
          <PanelToggleIcon side="right" />
        </button>
      </div>
    </header>
  );
}
