"use client";

import { ChatView } from "@/components/ChatView";
import { ContextPanel } from "@/components/ContextPanel";
import { Sidebar } from "@/components/Sidebar";
import { useBrainMemoryStatus } from "@/hooks/useBrainMemoryStatus";
import { useHermesStatus } from "@/hooks/useHermesStatus";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { useState } from "react";

export function AppShell() {
  const { actions, activeProject, activeProjectSessions, activeSession, isHydrated, state } =
    useWorkspaceState();
  const hermesStatus = useHermesStatus();
  const brainMemoryStatus = useBrainMemoryStatus();
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);

  return (
    <main
      className={`app-shell${isLeftPanelOpen ? "" : " is-left-collapsed"}${
        isRightPanelOpen ? "" : " is-right-collapsed"
      }`}
    >
      {isLeftPanelOpen ? (
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
          sessions={activeProjectSessions}
        />
      ) : null}
      <ChatView
        activeProject={activeProject}
        activeSession={activeSession}
        createSession={actions.createSession}
        hermesStatus={hermesStatus.status}
        isLeftPanelOpen={isLeftPanelOpen}
        isHermesStatusLoading={hermesStatus.isLoading}
        isRightPanelOpen={isRightPanelOpen}
        modelChoices={state.modelChoices}
        toggleLeftPanel={() => setIsLeftPanelOpen((isOpen) => !isOpen)}
        toggleRightPanel={() => setIsRightPanelOpen((isOpen) => !isOpen)}
        workspaceActions={actions}
      />
      {isRightPanelOpen ? (
        <ContextPanel
          activeProject={activeProject}
          activeSession={activeSession}
          brainMemoryStatus={brainMemoryStatus.status}
          hermesStatus={hermesStatus.status}
          isBrainMemoryStatusLoading={brainMemoryStatus.isLoading}
          isHermesStatusLoading={hermesStatus.isLoading}
          refreshBrainMemoryStatus={brainMemoryStatus.refresh}
          refreshHermesStatus={hermesStatus.refresh}
        />
      ) : null}
    </main>
  );
}
