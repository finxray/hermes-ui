"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import { Maximize2, Minimize2 } from "@/components/ui/AppIcons";
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
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activateToggle = (toggleId: string) => {
    document.getElementById(toggleId)?.click();
  };

  useEffect(() => {
    const fullscreenDocument = document as FullscreenDocument;
    const syncFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement));
    };

    setFullscreenSupported(Boolean(
      document.fullscreenEnabled ||
      fullscreenDocument.webkitFullscreenEnabled ||
      document.documentElement.requestFullscreen ||
      (document.documentElement as FullscreenElement).webkitRequestFullscreen
    ));
    syncFullscreenState();
    document.addEventListener("fullscreenchange", syncFullscreenState);
    document.addEventListener("webkitfullscreenchange", syncFullscreenState);
    return () => {
      document.removeEventListener("fullscreenchange", syncFullscreenState);
      document.removeEventListener("webkitfullscreenchange", syncFullscreenState);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const fullscreenDocument = document as FullscreenDocument;
    const fullscreenElement = document.documentElement as FullscreenElement;
    try {
      if (document.fullscreenElement || fullscreenDocument.webkitFullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else {
          await fullscreenDocument.webkitExitFullscreen?.();
        }
      } else if (fullscreenElement.requestFullscreen) {
        await fullscreenElement.requestFullscreen();
      } else {
        await fullscreenElement.webkitRequestFullscreen?.();
      }
    } catch {
      // The browser keeps the current state when a fullscreen request is denied.
    }
  }, []);

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
          aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          aria-pressed={isFullscreen}
          disabled={!fullscreenSupported}
          onClick={toggleFullscreen}
          title={isFullscreen ? "Exit full screen" : "Full screen"}
          type="button"
        >
          {isFullscreen ? <Minimize2 /> : <Maximize2 />}
        </button>
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

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};
