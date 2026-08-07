"use client";

import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import styles from "./TopBar.module.css";

export type ShellSection = "workspace" | "plugins" | "config" | "keys" | "logs" | "settings";

const SECTION_ITEMS: { id: ShellSection; label: string }[] = [
  { id: "workspace", label: "Workspace" },
  { id: "plugins", label: "Plugins" },
  { id: "config", label: "Config" },
  { id: "keys", label: "Keys" },
  { id: "logs", label: "Logs" }
];

type TopBarProps = {
  activeSection: ShellSection;
  leftToggleId: string;
  leftCollapsed: boolean;
  onSectionChange: (section: ShellSection) => void;
  onRightToggle?: () => void;
  rightToggleId: string;
  rightCollapsed: boolean;
  rightToggleLabel?: string;
};

export function TopBar({
  activeSection,
  leftToggleId,
  leftCollapsed,
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
    <header className={styles.topbar} aria-label="Stoix workspace menu">
      <div className={styles.left}>
        <button
          className={`${styles.iconButton} ${styles.leadingButton}`}
          aria-label={leftCollapsed ? "Open left sidebar" : "Collapse left sidebar"}
          aria-pressed={!leftCollapsed}
          onClick={() => activateToggle(leftToggleId)}
          type="button"
        >
          <PanelToggleIcon side="left" />
        </button>
        <nav className={styles.menu} aria-label="Workspace sections">
          {SECTION_ITEMS.map((item) => (
            <button
              aria-current={activeSection === item.id ? "page" : undefined}
              className={`${styles.menuItem} ${activeSection === item.id ? styles.active : ""}`}
              key={item.id}
              onClick={() => onSectionChange(item.id)}
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
          type="button"
        >
          <PanelToggleIcon side="right" />
        </button>
      </div>
    </header>
  );
}
