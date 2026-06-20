"use client";

import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import styles from "./TopBar.module.css";

type TopBarProps = {
  activeSection: "workspace" | "plugins";
  leftToggleId: string;
  leftCollapsed: boolean;
  onSectionChange: (section: "workspace" | "plugins") => void;
  rightToggleId: string;
  rightCollapsed: boolean;
};

export function TopBar({
  activeSection,
  leftToggleId,
  leftCollapsed,
  onSectionChange,
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
            aria-current={activeSection === "workspace" ? "page" : undefined}
            className={`${styles.menuItem} ${activeSection === "workspace" ? styles.active : ""}`}
            onClick={() => onSectionChange("workspace")}
            title="Workspace"
            type="button"
          >
            Workspace
          </button>
          <button
            aria-current={activeSection === "plugins" ? "page" : undefined}
            className={`${styles.menuItem} ${activeSection === "plugins" ? styles.active : ""}`}
            onClick={() => onSectionChange("plugins")}
            title="Plugins"
            type="button"
          >
            Plugins
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
