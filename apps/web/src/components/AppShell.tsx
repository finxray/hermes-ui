"use client";

import { ChatView } from "@/components/ChatView";
import { ContextPanel } from "@/components/ContextPanel";
import { Sidebar } from "@/components/Sidebar";
import { useHermesStatus } from "@/hooks/useHermesStatus";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";

export function AppShell() {
  const { actions, activeProject, activeProjectSessions, activeSession, isHydrated, state } =
    useWorkspaceState();
  const hermesStatus = useHermesStatus();

  return (
    <main className="app-shell">
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
      <ChatView
        activeProject={activeProject}
        activeSession={activeSession}
        createSession={actions.createSession}
        hermesStatus={hermesStatus.status}
        isHermesStatusLoading={hermesStatus.isLoading}
        modelChoices={state.modelChoices}
      />
      <ContextPanel
        activeProject={activeProject}
        activeSession={activeSession}
        hermesStatus={hermesStatus.status}
        isHermesStatusLoading={hermesStatus.isLoading}
        refreshHermesStatus={hermesStatus.refresh}
      />
    </main>
  );
}
