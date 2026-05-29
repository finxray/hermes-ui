"use client";

import { ChatView } from "@/components/ChatView";
import { ContextPanel } from "@/components/ContextPanel";
import { Sidebar } from "@/components/Sidebar";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";

export function AppShell() {
  const { actions, activeProject, activeProjectSessions, activeSession, isHydrated, state } =
    useWorkspaceState();

  return (
    <main className="app-shell">
      <Sidebar
        actions={actions}
        activeProject={activeProject}
        activeSession={activeSession}
        allSessions={state.sessions}
        connectionStatus={state.connectionStatus}
        isHydrated={isHydrated}
        projects={state.projects}
        sessions={activeProjectSessions}
      />
      <ChatView
        activeProject={activeProject}
        activeSession={activeSession}
        createSession={actions.createSession}
        modelChoices={state.modelChoices}
      />
      <ContextPanel
        activeProject={activeProject}
        activeSession={activeSession}
      />
    </main>
  );
}
