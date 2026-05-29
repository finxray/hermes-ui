"use client";

import { ChatView } from "@/components/ChatView";
import { ContextPanel } from "@/components/ContextPanel";
import { Sidebar } from "@/components/Sidebar";
import { useBrainMemoryStatus } from "@/hooks/useBrainMemoryStatus";
import { useHermesStatus } from "@/hooks/useHermesStatus";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen
} from "lucide-react";
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
      <header className="app-topbar" aria-label="Brain Memory Studio workspace menu">
        <div className="app-topbar-left">
          <button
            className="icon-button shell-toggle"
            type="button"
            aria-label={isLeftPanelOpen ? "Collapse left sidebar" : "Open left sidebar"}
            aria-pressed={isLeftPanelOpen}
            onClick={() => setIsLeftPanelOpen((isOpen) => !isOpen)}
          >
            {isLeftPanelOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          </button>
          <nav className="app-menu" aria-label="Workspace sections">
            <button className="app-menu-item is-active" type="button">
              Workspace
            </button>
            <button className="app-menu-item" type="button">
              Memory
            </button>
            <button className="app-menu-item" type="button">
              Projects
            </button>
            <button className="app-menu-item" type="button">
              Tools
            </button>
            <button className="app-menu-item" type="button">
              Help
            </button>
          </nav>
        </div>
        <div className="app-topbar-right">
          <button
            className="icon-button shell-toggle"
            type="button"
            aria-label={isRightPanelOpen ? "Collapse right context panel" : "Open right context panel"}
            aria-pressed={isRightPanelOpen}
            onClick={() => setIsRightPanelOpen((isOpen) => !isOpen)}
          >
            {isRightPanelOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        </div>
      </header>
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
        workspaceActions={actions}
      />
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
    </main>
  );
}
