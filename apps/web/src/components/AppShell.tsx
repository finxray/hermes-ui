import { ChatView } from "@/components/ChatView";
import { ContextPanel } from "@/components/ContextPanel";
import { Sidebar } from "@/components/Sidebar";
import type { WorkspaceMock } from "@/data/types";

type AppShellProps = {
  workspace: WorkspaceMock;
};

export function AppShell({ workspace }: AppShellProps) {
  const activeProject =
    workspace.projects.find((project) => project.id === workspace.activeProjectId) ??
    workspace.projects[0];
  const activeSession =
    workspace.sessions.find((session) => session.id === workspace.activeSessionId) ??
    workspace.sessions[0];
  const activeProjectSessions = workspace.sessions.filter(
    (session) => session.projectId === activeProject.id
  );

  return (
    <main className="app-shell">
      <Sidebar
        activeProject={activeProject}
        activeSession={activeSession}
        connectionStatus={workspace.connectionStatus}
        projects={workspace.projects}
        sessions={activeProjectSessions}
      />
      <ChatView
        activeProject={activeProject}
        activeSession={activeSession}
        messages={workspace.messages}
        modelChoices={workspace.modelChoices}
      />
      <ContextPanel
        activeProject={activeProject}
        activeSession={activeSession}
        artifacts={workspace.artifacts}
        memoryEvidence={workspace.memoryEvidence}
        toolEvents={workspace.toolEvents}
      />
    </main>
  );
}
