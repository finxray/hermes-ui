"use client";

import { ChatView } from "@/components/ChatView";
import { ContextPanel } from "@/components/ContextPanel";
import { Sidebar } from "@/components/Sidebar";
import { StatusBadge } from "@/components/StatusBadge";
import { useBrainMemoryStatus } from "@/hooks/useBrainMemoryStatus";
import { useHermesStatus } from "@/hooks/useHermesStatus";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import {
  Brain,
  CircleHelp,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Search,
  TerminalSquare
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
          <div className="app-menu-brand">
            <span className="app-menu-mark" aria-hidden="true">
              <Brain size={15} />
            </span>
            <span>Brain Memory Studio</span>
          </div>
          <nav className="app-menu" aria-label="Workspace sections">
            <button className="app-menu-item is-active" type="button">
              Workspace
            </button>
            <button className="app-menu-item" type="button">
              <Search size={13} aria-hidden="true" />
              Memory
            </button>
            <button className="app-menu-item" type="button">
              <FolderKanban size={13} aria-hidden="true" />
              Projects
            </button>
            <button className="app-menu-item" type="button">
              <TerminalSquare size={13} aria-hidden="true" />
              Tools
            </button>
            <button className="app-menu-item" type="button">
              <CircleHelp size={13} aria-hidden="true" />
              Help
            </button>
          </nav>
        </div>
        <div className="app-topbar-right">
          <StatusBadge
            label={`Hermes ${formatHermesStatus(hermesStatus.status, hermesStatus.isLoading)}`}
            tone={hermesStatusTone(hermesStatus.status, hermesStatus.isLoading)}
          />
          <StatusBadge
            label={`Memory ${formatBrainMemoryStatus(
              brainMemoryStatus.status,
              brainMemoryStatus.isLoading
            )}`}
            tone={brainMemoryStatusTone(brainMemoryStatus.status, brainMemoryStatus.isLoading)}
          />
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
        isHermesStatusLoading={hermesStatus.isLoading}
        modelChoices={state.modelChoices}
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

function formatHermesStatus(status: ReturnType<typeof useHermesStatus>["status"], isLoading: boolean) {
  if (isLoading && !status) {
    return "checking";
  }
  if (!status || status.mode === "unconfigured") {
    return "unconfigured";
  }
  if (status.mode === "real" && status.reachable) {
    return "connected";
  }
  if (status.mode === "mock") {
    return "mock";
  }
  return "unreachable";
}

function hermesStatusTone(
  status: ReturnType<typeof useHermesStatus>["status"],
  isLoading: boolean
): "error" | "mock" | "quiet" | "success" {
  if (isLoading && !status) {
    return "quiet";
  }
  if (status?.mode === "real" && status.reachable) {
    return "success";
  }
  if (status?.mode === "error") {
    return "error";
  }
  return "mock";
}

function formatBrainMemoryStatus(
  status: ReturnType<typeof useBrainMemoryStatus>["status"],
  isLoading: boolean
) {
  if (isLoading && !status) {
    return "checking";
  }
  if (!status || status.mode === "unconfigured") {
    return "unconfigured";
  }
  if (status.mode === "real" && status.reachable) {
    return "connected";
  }
  if (status.mode === "mock") {
    return "mock";
  }
  return "unreachable";
}

function brainMemoryStatusTone(
  status: ReturnType<typeof useBrainMemoryStatus>["status"],
  isLoading: boolean
): "error" | "mock" | "quiet" | "success" {
  if (isLoading && !status) {
    return "quiet";
  }
  if (status?.mode === "real" && status.reachable) {
    return "success";
  }
  if (status?.mode === "error") {
    return "error";
  }
  return "mock";
}
