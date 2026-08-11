"use client";

import { ChatView } from "@/components/chat/ChatView";
import type { ChatHeaderTabs } from "@/components/chat/ChatHeader";
import { ContextRail } from "@/components/shell/ContextRail";
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import type { HermesSessionSummary, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session } from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
import type { AgentActivityEvent } from "@/types/agentActivity";
import styles from "./SplitPane.module.css";

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];

export type RightPaneMode = "chat" | "console" | "chat-console";

type SplitPaneProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  allSessions: Session[];
  createSideSession: () => void;
  hermesSessions: HermesSessionSummary[];
  hermesStatus: NormalizedHermesStatus | null;
  hermesSessionModel: HermesSessionModelSync;
  isHermesSessionsLoading: boolean;
  isHermesStatusLoading: boolean;
  isHermesStatusRefreshing?: boolean;
  isFocused?: boolean;
  mode: RightPaneMode;
  onActivateSideChat?: () => void;
  onActivityEvent: (sessionId: string, event: AgentActivityEvent) => void;
  onGeneratingChange?: (sessionId: string, isGenerating: boolean) => void;
  projects: Project[];
  refreshHermesStatus: () => void;
  refreshHermesSessions: () => void;
  sideActivityEvents: AgentActivityEvent[];
  sideSession: Session | null;
  sideSessionModel: HermesSessionModelSync;
  tabs: ChatHeaderTabs;
  workspaceActions: WorkspaceActions;
};

export function SplitPane({
  activeProject,
  activeSession,
  activityEvents,
  allSessions,
  createSideSession,
  hermesSessions,
  hermesStatus,
  hermesSessionModel,
  isHermesSessionsLoading,
  isHermesStatusLoading,
  isHermesStatusRefreshing = false,
  isFocused = false,
  mode,
  onActivateSideChat,
  onActivityEvent,
  onGeneratingChange,
  projects,
  refreshHermesStatus,
  refreshHermesSessions,
  sideActivityEvents,
  sideSession,
  sideSessionModel,
  tabs,
  workspaceActions
}: SplitPaneProps) {
  const isChatVisible = mode === "chat" || mode === "chat-console";
  const isConsoleVisible = mode === "console" || mode === "chat-console";

  return (
    <aside
      aria-label="Split chat and context console"
      className={styles.splitPane}
      data-active-pane={mode}
      data-layout={mode === "chat-console" ? "combined" : "single"}
      data-shell-rail="right"
    >
      <div className={styles.body}>
        <div
          aria-hidden={!isChatVisible}
          className={`${styles.pane} ${styles.chatPane}`}
          data-active={isChatVisible ? "true" : "false"}
          role="tabpanel"
        >
          {isChatVisible && sideSession ? (
            <ChatView
              activeProject={activeProject}
              activeSession={sideSession}
              activityEvents={sideActivityEvents}
              createSession={createSideSession}
              hermesStatus={hermesStatus}
              isHermesStatusLoading={isHermesStatusLoading}
              isFocused={isFocused}
              isSplitViewOpen={isChatVisible}
              onActivate={onActivateSideChat}
              onActivityEvent={onActivityEvent}
              onGeneratingChange={onGeneratingChange}
              onRefreshHermes={refreshHermesStatus}
              projects={projects}
              sessionModel={sideSessionModel}
              showHeader
              tabs={tabs}
              variant="side"
              workspaceActions={workspaceActions}
            />
          ) : null}
        </div>
        <div
          aria-hidden={!isConsoleVisible}
          className={`${styles.pane} ${styles.consolePane}`}
          data-active={isConsoleVisible ? "true" : "false"}
          role="tabpanel"
        >
          {isConsoleVisible ? (
            <ContextRail
              activeProject={activeProject}
              activeSession={activeSession}
              activityEvents={activityEvents}
              allSessions={allSessions}
              hermesSessions={hermesSessions}
              hermesStatus={hermesStatus}
              hermesSessionModel={hermesSessionModel}
              isHermesSessionsLoading={isHermesSessionsLoading}
              isHermesStatusLoading={isHermesStatusLoading}
              isHermesStatusRefreshing={isHermesStatusRefreshing}
              refreshHermesStatus={refreshHermesStatus}
              refreshHermesSessions={refreshHermesSessions}
              workspaceActions={workspaceActions}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
