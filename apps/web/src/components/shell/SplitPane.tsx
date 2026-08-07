"use client";

import { MessageSquare, MessageSquarePlus, Plus } from "@/components/ui/AppIcons";
import { useEffect, useRef, useState } from "react";
import { ChatView } from "@/components/chat/ChatView";
import { ContextRail } from "@/components/shell/ContextRail";
import { PanelToggleIcon } from "@/components/ui/PanelToggleIcon";
import type { HermesSessionModelSync } from "@/hooks/useHermesSessionModel";
import { formatSessionUpdatedAt } from "@/lib/workspaceStore";
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
  availableSessions: Session[];
  createSideSession: () => void;
  hermesSessions: HermesSessionSummary[];
  hermesStatus: NormalizedHermesStatus | null;
  hermesSessionModel: HermesSessionModelSync;
  isHermesSessionsLoading: boolean;
  isHermesStatusLoading: boolean;
  isHermesStatusRefreshing?: boolean;
  mode: RightPaneMode;
  onActivateSideChat?: () => void;
  onActivityEvent: (sessionId: string, event: AgentActivityEvent) => void;
  onGeneratingChange?: (sessionId: string, isGenerating: boolean) => void;
  projects: Project[];
  refreshHermesStatus: () => void;
  refreshHermesSessions: () => void;
  returnToSingleChat: () => void;
  closeSideSession: () => void;
  selectSideSession: (sessionId: string) => void;
  setMode: (mode: RightPaneMode) => void;
  sideActivityEvents: AgentActivityEvent[];
  sideSession: Session | null;
  sideSessionModel: HermesSessionModelSync;
  workspaceActions: WorkspaceActions;
};

export function SplitPane({
  activeProject,
  activeSession,
  activityEvents,
  allSessions,
  availableSessions,
  createSideSession,
  hermesSessions,
  hermesStatus,
  hermesSessionModel,
  isHermesSessionsLoading,
  isHermesStatusLoading,
  isHermesStatusRefreshing = false,
  mode,
  onActivateSideChat,
  onActivityEvent,
  onGeneratingChange,
  projects,
  refreshHermesStatus,
  refreshHermesSessions,
  returnToSingleChat,
  closeSideSession,
  selectSideSession,
  setMode,
  sideActivityEvents,
  sideSession,
  sideSessionModel,
  workspaceActions
}: SplitPaneProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAllSideSessions, setShowAllSideSessions] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const sideTitle = sideSession?.title ?? "Side chat";
  const isChatVisible = mode === "chat" || mode === "chat-console";
  const isConsoleVisible = mode === "console" || mode === "chat-console";
  const canCloseSideTab = isChatVisible && Boolean(sideSession);
  const sideSessionPreviewLimit = 6;
  const visibleSideSessions = showAllSideSessions
    ? availableSessions
    : availableSessions.slice(0, sideSessionPreviewLimit);
  const hasSideSessionOverflow = availableSessions.length > sideSessionPreviewLimit;

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
    setShowAllSideSessions(false);
  };

  const handleSideTabClick = () => {
    if (sideSession) {
      setMode("chat");
      setMenuOpen(false);
      return;
    }
    setMenuOpen(true);
  };

  return (
    <aside
      aria-label="Split chat and context console"
      className={styles.splitPane}
      data-active-pane={mode}
      data-layout={mode === "chat-console" ? "combined" : "single"}
      data-shell-rail="right"
    >
      <header className={styles.toolbar}>
        <div className={styles.tabGroup} aria-label="Right panel tabs" role="tablist">
          <div className={styles.menuHost} ref={menuRef}>
            <span className={styles.sideTabWrap}>
              <button
                aria-controls="studio-side-chat-menu"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-selected={isChatVisible}
                className={`${styles.tabButton} ${styles.sideTab} ${isChatVisible ? styles.activeTab : ""}`}
                data-closable={canCloseSideTab ? "true" : "false"}
                data-side-chat-tab="true"
                onClick={handleSideTabClick}
                onMouseEnter={() => sideSession && setMenuOpen(false)}
                role="tab"
                type="button"
              >
                {!canCloseSideTab ? <MessageSquarePlus size={14} /> : null}
                <span>{sideTitle}</span>
              </button>
              {canCloseSideTab ? (
                <button
                  aria-label={`Close side chat ${sideTitle}`}
                  className={styles.closeTabButton}
                  data-side-chat-close="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuOpen(false);
                    setShowAllSideSessions(false);
                    closeSideSession();
                  }}
                  onFocus={() => setMenuOpen(false)}
                  onMouseEnter={() => setMenuOpen(false)}
                  onPointerDown={(event) => event.stopPropagation()}
                  type="button"
                >
                  <span className={styles.closeGlyph} aria-hidden="true" />
                </button>
              ) : null}
            </span>
            <button
              aria-label="Open side chat menu"
              aria-controls="studio-side-chat-menu"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className={styles.addButton}
              data-side-chat-add="true"
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen(true);
              }}
              onFocus={() => setMenuOpen(true)}
              onMouseEnter={() => setMenuOpen(true)}
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
                    visibleSideSessions.map((session) => (
                      <button
                        className={`${styles.menuItem} ${session.id === sideSession?.id ? styles.selectedItem : ""}`}
                        data-side-chat-session="true"
                        key={session.id}
                        onClick={() => switchToSideSession(session.id)}
                        role="menuitem"
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
                  {hasSideSessionOverflow ? (
                    <button
                      aria-expanded={showAllSideSessions}
                      className={styles.menuMore}
                      onClick={() => setShowAllSideSessions((current) => !current)}
                      type="button"
                    >
                      {showAllSideSessions
                        ? "Show less"
                        : `Show more (${availableSessions.length - sideSessionPreviewLimit})`}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
          <button
            aria-label={isChatVisible ? "Return to single chat view" : "Context console is open"}
            className={`${styles.tabButton} ${styles.returnButton}`}
            onClick={isChatVisible ? returnToSingleChat : undefined}
            type="button"
          >
            <PanelToggleIcon side="single" />
            <span className={styles.returnTooltip} role="tooltip">Single view</span>
          </button>
        </div>
      </header>

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
              isSplitViewOpen={isChatVisible}
              onActivate={onActivateSideChat}
              onActivityEvent={onActivityEvent}
              onGeneratingChange={onGeneratingChange}
              projects={projects}
              sessionModel={sideSessionModel}
              showHeader={false}
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
