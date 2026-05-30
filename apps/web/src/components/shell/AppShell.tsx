"use client";

import { ChatView } from "@/components/chat/ChatView";
import { ContextRail } from "@/components/shell/ContextRail";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { useBrainMemoryStatus } from "@/hooks/useBrainMemoryStatus";
import { useHermesStatus } from "@/hooks/useHermesStatus";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { useState } from "react";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { actions, activeProject, activeSession, isHydrated, state } = useWorkspaceState();
  const hermesStatus = useHermesStatus();
  const brainMemoryStatus = useBrainMemoryStatus();
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  return (
    <main
      className={styles.shell}
      data-left-collapsed={leftCollapsed ? "true" : "false"}
      data-right-collapsed={rightCollapsed ? "true" : "false"}
    >
      <input
        aria-hidden="true"
        className={`${styles.toggleInput} ${styles.leftToggle}`}
        defaultChecked={false}
        id="studio-left-rail-toggle"
        onChange={(event) => setLeftCollapsed(event.currentTarget.checked)}
        tabIndex={-1}
        type="checkbox"
      />
      <input
        aria-hidden="true"
        className={`${styles.toggleInput} ${styles.rightToggle}`}
        defaultChecked={false}
        id="studio-right-rail-toggle"
        onChange={(event) => setRightCollapsed(event.currentTarget.checked)}
        tabIndex={-1}
        type="checkbox"
      />
      <TopBar
        leftToggleId="studio-left-rail-toggle"
        leftCollapsed={leftCollapsed}
        rightToggleId="studio-right-rail-toggle"
        rightCollapsed={rightCollapsed}
      />
      <Sidebar
        actions={actions}
        activeProject={activeProject}
        activeSession={activeSession}
        allSessions={state.sessions}
        connectionStatus={state.connectionStatus}
        hermesStatus={hermesStatus.status}
        isHermesStatusLoading={hermesStatus.isLoading}
        isHydrated={isHydrated}
        projects={state.projects}
        refreshHermesStatus={hermesStatus.refresh}
      />
      <ChatView
        activeProject={activeProject}
        activeSession={activeSession}
        createSession={actions.createSession}
        hermesStatus={hermesStatus.status}
        isHermesStatusLoading={hermesStatus.isLoading}
        modelChoices={state.modelChoices}
        workspaceActions={actions}
      />
      <ContextRail
        activeProject={activeProject}
        activeSession={activeSession}
        brainMemoryStatus={brainMemoryStatus.status}
        hermesStatus={hermesStatus.status}
        isBrainMemoryStatusLoading={brainMemoryStatus.isLoading}
        isHermesStatusLoading={hermesStatus.isLoading}
        refreshBrainMemoryStatus={brainMemoryStatus.refresh}
        refreshHermesStatus={hermesStatus.refresh}
      />
    </main>
  );
}
