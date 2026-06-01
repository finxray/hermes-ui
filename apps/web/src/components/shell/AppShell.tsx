"use client";

import { ChatView } from "@/components/chat/ChatView";
import { ContextRail } from "@/components/shell/ContextRail";
import { Sidebar } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { useBrainMemoryStatus } from "@/hooks/useBrainMemoryStatus";
import { useHermesStatus } from "@/hooks/useHermesStatus";
import { useTenantScopeDiagnosticsPosture } from "@/hooks/useTenantScopeDiagnosticsPosture";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { useState } from "react";
import type { AgentActivityEvent } from "@/types/agentActivity";
import styles from "./AppShell.module.css";

export function AppShell() {
  const { actions, activeProject, activeSession, isHydrated, state } = useWorkspaceState();
  const hermesStatus = useHermesStatus();
  const brainMemoryStatus = useBrainMemoryStatus();
  const tenantScopePosture = useTenantScopeDiagnosticsPosture();
  const [activityEventsBySession, setActivityEventsBySession] = useState<Record<string, AgentActivityEvent[]>>({});
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const activeActivityEvents = activeSession ? (activityEventsBySession[activeSession.id] ?? []) : [];

  function appendActivityEvent(sessionId: string, event: AgentActivityEvent) {
    setActivityEventsBySession((current) => ({
      ...current,
      [sessionId]: [...(current[sessionId] ?? []), event].slice(-80)
    }));
  }

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
        activityEvents={activeActivityEvents}
        createSession={actions.createSession}
        hermesStatus={hermesStatus.status}
        isHermesStatusLoading={hermesStatus.isLoading}
        modelChoices={state.modelChoices}
        onActivityEvent={appendActivityEvent}
        workspaceActions={actions}
      />
      <ContextRail
        activeProject={activeProject}
        activeSession={activeSession}
        activityEvents={activeActivityEvents}
        brainMemoryStatus={brainMemoryStatus.status}
        hermesStatus={hermesStatus.status}
        isBrainMemoryStatusLoading={brainMemoryStatus.isLoading}
        isHermesStatusLoading={hermesStatus.isLoading}
        isHermesStatusRefreshing={hermesStatus.isRefreshing}
        refreshBrainMemoryStatus={brainMemoryStatus.refresh}
        refreshHermesStatus={hermesStatus.refresh}
        tenantScopePosture={tenantScopePosture.posture}
      />
    </main>
  );
}
