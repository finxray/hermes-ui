"use client";

import { MessageSquare, MessageSquarePlus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatView } from "@/components/chat/ChatView";
import { ContextRail } from "@/components/shell/ContextRail";
import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import { formatSessionUpdatedAt } from "@/lib/workspaceStore";
import type { NormalizedBrainMemoryStatus } from "@hermes-ui/brain-memory-client";
import type { HermesSessionSummary, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { Project, Session } from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
import type { TenantScopeDiagnostics } from "@/lib/tenantScopeDiagnostics";
import type { AgentActivityEvent } from "@/types/agentActivity";
import styles from "./SplitPane.module.css";

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];

export type RightPaneMode = "chat" | "console";

type SplitPaneProps = {
  activeProject: Project;
  activeSession: Session | null;
  activityEvents: AgentActivityEvent[];
  allSessions: Session[];
  availableSessions: Session[];
  brainMemoryStatus: NormalizedBrainMemoryStatus | null;
  createSideSession: () => void;
  hermesSessions: HermesSessionSummary[];
  hermesStatus: NormalizedHermesStatus | null;
  hermesSessionModel: HermesSessionModelSync;
  isBrainMemoryStatusLoading: boolean;
  isHermesSessionsLoading: boolean;
  isHermesStatusLoading: boolean;
  isHermesStatusRefreshing?: boolean;
  mode: RightPaneMode;
  onActivityEvent: (sessionId: string, event: AgentActivityEvent) => void;
  refreshBrainMemoryStatus: () => void;
  refreshHermesStatus: () => void;
  refreshHermesSessions: () => void;
  closeSideSession: () => void;
  selectSideSession: (sessionId: string) => void;
  setMode: (mode: RightPaneMode) => void;
  sideActivityEvents: AgentActivityEvent[];
  sideSession: Session | null;
  sideSessionModel: HermesSessionModelSync;
  tenantScopePosture: TenantScopeDiagnostics["redactedPosture"] | null;
  workspaceActions: WorkspaceActions;
};

export function SplitPane({
  activeProject,
  activeSession,
  activityEvents,
  allSessions,
  availableSessions,
  brainMemoryStatus,
  createSideSession,
  hermesSessions,
  hermesStatus,
  hermesSessionModel,
  isBrainMemoryStatusLoading,
  isHermesSessionsLoading,
  isHermesStatusLoading,
  isHermesStatusRefreshing = false,
  mode,
  onActivityEvent,
  refreshBrainMemoryStatus,
  refreshHermesStatus,
  refreshHermesSessions,
  closeSideSession,
  selectSideSession,
  setMode,
  sideActivityEvents,
  sideSession,
  sideSessionModel,
  tenantScopePosture,
  workspaceActions
}: SplitPaneProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const sideTitle = sideSession?.title ?? "Side chat";
  const canCloseSideTab = mode === "chat" && Boolean(sideSession);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function closeOnOutside(event: MouseEvent) {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("mousedown", closeOnOutside);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("mousedown", closeOnOutside);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  const switchToSideSession = (sessionId: string) => {
    selectSideSession(sessionId);
    setMode("chat");
    setMenuOpen(false);
  };

  const startNewSideSession = () => {
    createSideSession();
    setMenuOpen(false);
  };

  const handleSideTabClick = () => {
    if (canCloseSideTab) {
      closeSideSession();
      setMenuOpen(false);
      return;
    }

    if (sideSession) {
      setMode("chat");
      return;
    }

    setMenuOpen((current) => !current);
  };

  return (
    <aside
      aria-label="Split chat and context console"
      className={styles.splitPane}
      data-active-pane={mode}
      data-shell-rail="right"
    >
      <header className={styles.toolbar}>
        <div className={styles.tabGroup} aria-label="Right panel tabs" role="tablist">
          <div className={styles.menuHost} ref={menuRef}>
            <button
              aria-controls="studio-side-chat-menu"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-selected={mode === "chat"}
              className={`${styles.tabButton} ${styles.sideTab} ${mode === "chat" ? styles.activeTab : ""}`}
              data-side-chat-tab="true"
              onClick={handleSideTabClick}
              role="tab"
              title={sideTitle}
              type="button"
            >
              {canCloseSideTab ? (
                <span className={styles.closeGlyph} aria-hidden="true" />
              ) : (
                <MessageSquarePlus size={14} />
              )}
              <span>{sideTitle}</span>
            </button>
            <button
              aria-label="Open side chat menu"
              aria-controls="studio-side-chat-menu"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className={styles.addButton}
              data-side-chat-add="true"
              onClick={() => setMenuOpen((current) => !current)}
              title="Open side chat menu"
              type="button"
            >
              <Plus size={18} />
            </button>
            {menuOpen ? (
              <div className={styles.sessionMenu} id="studio-side-chat-menu" role="menu">
                <button className={styles.menuCreate} onClick={startNewSideSession} role="menuitem" type="button">
                  <Plus size={15} />
                  <span>New side chat</span>
                </button>
                <div className={styles.menuDivider} />
                <div className={styles.menuLabel}>Open in side tab</div>
                <div className={styles.menuList}>
                  {availableSessions.length > 0 ? (
                    availableSessions.map((session) => (
                      <button
                        className={`${styles.menuItem} ${session.id === sideSession?.id ? styles.selectedItem : ""}`}
                        key={session.id}
                        onClick={() => switchToSideSession(session.id)}
                        role="menuitem"
                        title={session.title}
                        type="button"
                      >
                        <MessageSquare size={14} />
                        <span className={styles.menuItemText}>{session.title}</span>
                        <span className={styles.menuItemMeta}>{formatSessionUpdatedAt(session.updatedAt)}</span>
                      </button>
                    ))
                  ) : (
                    <div className={styles.menuEmpty}>No chats in this project yet</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
          <button
            aria-selected={mode === "console"}
            className={`${styles.tabButton} ${mode === "console" ? styles.activeTab : ""}`}
            onClick={() => setMode("console")}
            role="tab"
            type="button"
          >
            <PanelToggleIcon side="split" />
            <span>Console</span>
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <div
          aria-hidden={mode !== "chat"}
          className={`${styles.pane} ${styles.chatPane}`}
          data-active={mode === "chat" ? "true" : "false"}
          hidden={mode !== "chat"}
          role="tabpanel"
        >
          {mode === "chat" ? (
            <ChatView
              activeProject={activeProject}
              activeSession={sideSession}
              activityEvents={sideActivityEvents}
              createSession={createSideSession}
              hermesStatus={hermesStatus}
              isHermesStatusLoading={isHermesStatusLoading}
              onActivityEvent={onActivityEvent}
              sessionModel={sideSessionModel}
              showHeader={false}
              variant="side"
              workspaceActions={workspaceActions}
            />
          ) : null}
        </div>
        <div
          aria-hidden={mode !== "console"}
          className={`${styles.pane} ${styles.consolePane}`}
          data-active={mode === "console" ? "true" : "false"}
          hidden={mode !== "console"}
          role="tabpanel"
        >
          {mode === "console" ? (
            <ContextRail
              activeProject={activeProject}
              activeSession={activeSession}
              activityEvents={activityEvents}
              allSessions={allSessions}
              brainMemoryStatus={brainMemoryStatus}
              hermesSessions={hermesSessions}
              hermesStatus={hermesStatus}
              hermesSessionModel={hermesSessionModel}
              isBrainMemoryStatusLoading={isBrainMemoryStatusLoading}
              isHermesSessionsLoading={isHermesSessionsLoading}
              isHermesStatusLoading={isHermesStatusLoading}
              isHermesStatusRefreshing={isHermesStatusRefreshing}
              refreshBrainMemoryStatus={refreshBrainMemoryStatus}
              refreshHermesStatus={refreshHermesStatus}
              refreshHermesSessions={refreshHermesSessions}
              tenantScopePosture={tenantScopePosture}
              workspaceActions={workspaceActions}
            />
          ) : null}
        </div>
      </div>
    </aside>
  );
}
