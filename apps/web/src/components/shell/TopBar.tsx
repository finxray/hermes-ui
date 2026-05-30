import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen
} from "lucide-react";
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
  return (
    <header className={styles.topbar} aria-label="Brain Memory Studio workspace menu">
      <div className={styles.left}>
        <label
          className={styles.iconButton}
          aria-label={leftCollapsed ? "Open left sidebar" : "Collapse left sidebar"}
          aria-pressed={!leftCollapsed}
          htmlFor={leftToggleId}
          role="button"
          tabIndex={0}
        >
          {leftCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </label>
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
        <label
          className={styles.iconButton}
          aria-label={rightCollapsed ? "Open right context panel" : "Collapse right context panel"}
          aria-pressed={!rightCollapsed}
          htmlFor={rightToggleId}
          role="button"
          tabIndex={0}
        >
          {rightCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
        </label>
      </div>
    </header>
  );
}
