"use client";

import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import styles from "./TopBar.module.css";

type TopBarProps = {
  leftCollapsed: boolean;
  onToggleLeft: () => void;
  onToggleRight: () => void;
  rightCollapsed: boolean;
};

export function TopBar({
  leftCollapsed,
  onToggleLeft,
  onToggleRight,
  rightCollapsed
}: TopBarProps) {
  return (
    <header className={styles.topbar} aria-label="Brain Memory Studio workspace menu">
      <div className={styles.left}>
        <button
          className={styles.iconButton}
          aria-label={leftCollapsed ? "Open left sidebar" : "Collapse left sidebar"}
          aria-pressed={!leftCollapsed}
          onClick={onToggleLeft}
          type="button"
        >
          <PanelToggleIcon side="left" />
        </button>
        <nav className={styles.menu} aria-label="Workspace sections">
          {["Workspace", "Memory", "Projects", "Tools", "Help"].map((item) => (
            <button
              className={`${styles.menuItem} ${item === "Workspace" ? styles.active : ""}`}
              key={item}
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
          onClick={onToggleRight}
          type="button"
        >
          <PanelToggleIcon side="right" />
        </button>
      </div>
    </header>
  );
}
