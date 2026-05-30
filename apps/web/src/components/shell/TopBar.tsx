"use client";

import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import styles from "./TopBar.module.css";

type TopBarProps = {
  leftToggleId: string;
  leftCollapsed: boolean;
  rightToggleId: string;
  rightCollapsed: boolean;
};

export function TopBar({
  leftToggleId,
  leftCollapsed,
  rightToggleId,
  rightCollapsed
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
        <nav className={styles.menu} aria-label="Workspace sections">
          <button
            aria-current="page"
            aria-label="Workspace section current"
            className={`${styles.menuItem} ${styles.active}`}
            title="Current workspace section"
            type="button"
          >
            Workspace
          </button>
          {["Memory", "Projects", "Tools", "Help"].map((item) => (
            <button
              aria-label={`${item} section coming soon`}
              className={styles.menuItem}
              disabled
              key={item}
              title={`${item} section navigation is coming soon.`}
              type="button"
            >
              {item}
            </button>
          ))}
        </nav>
      </div>
      <div className={styles.right}>
        <button
          className={styles.iconButton}
          aria-label={rightCollapsed ? "Open right context panel" : "Collapse right context panel"}
          aria-pressed={!rightCollapsed}
          onClick={() => activateToggle(rightToggleId)}
          title={rightCollapsed ? "Open right context panel" : "Collapse right context panel"}
          type="button"
        >
          <PanelToggleIcon side="right" />
        </button>
      </div>
    </header>
  );
}
