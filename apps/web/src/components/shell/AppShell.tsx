"use client";

import { ChatView } from "@/components/chat/ChatView";
import { Sidebar } from "@/components/shell/Sidebar";
import { SplitPane, type RightPaneMode } from "@/components/shell/SplitPane";
import { TopBar } from "@/components/shell/TopBar";
import { useBrainMemoryStatus } from "@/hooks/useBrainMemoryStatus";
import { useHermesSessionModel } from "@/hooks/useHermesSessionModel";
import { useHermesStatus } from "@/hooks/useHermesStatus";
import { useHermesSessions } from "@/hooks/useHermesSessions";
import { useLmStudioModels } from "@/hooks/useLmStudioModels";
import { useOpenRouterModels } from "@/hooks/useOpenRouterModels";
import { useTenantScopeDiagnosticsPosture } from "@/hooks/useTenantScopeDiagnosticsPosture";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useRef, useState } from "react";
import type { AgentActivityEvent } from "@/types/agentActivity";
import mainWindowStyles from "./MainWindow.module.css";
import styles from "./AppShell.module.css";

type ShellStyle = CSSProperties & {
  "--rail-width-left"?: string;
  "--rail-width-right"?: string;
  "--rail-right-transition-duration"?: string;
};

function clampPanelWidth(width: number, min: number, max: number) {
  return Math.min(Math.max(width, min), max);
}

function computeRightPanelTransition(width: number) {
  return clampPanelWidth(Math.round(180 + width * 0.2), 240, 420);
}

export function AppShell() {
  const { actions, activeProject, activeProjectSessions, activeSession, isHydrated, state } = useWorkspaceState();
  const hermesStatus = useHermesStatus();
  const lmStudioModels = useLmStudioModels();
  const openRouterModels = useOpenRouterModels();
  const hermesSessions = useHermesSessions(hermesStatus.status?.mode === "real" && hermesStatus.status.reachable);
  const hermesSessionModel = useHermesSessionModel({
    activeSession,
    hermesStatus: hermesStatus.status,
    lmStudioModels: lmStudioModels.models,
    modelChoices: state.modelChoices,
    openRouterModels: openRouterModels.models,
    persistSessionModelPreference: actions.setSessionModelPreference,
    refreshHermesStatus: hermesStatus.refresh
  });
  const [sideSessionId, setSideSessionId] = useState<string | null>(null);
  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>("console");
  const sideSession =
    activeProjectSessions.find((session) => session.id === sideSessionId && !session.archivedAt) ?? null;
  const sideSessionModel = useHermesSessionModel({
    activeSession: sideSession,
    hermesStatus: hermesStatus.status,
    lmStudioModels: lmStudioModels.models,
    modelChoices: state.modelChoices,
    openRouterModels: openRouterModels.models,
    persistSessionModelPreference: actions.setSessionModelPreference,
    refreshHermesStatus: hermesStatus.refresh
  });
  const brainMemoryStatus = useBrainMemoryStatus();
  const tenantScopePosture = useTenantScopeDiagnosticsPosture();
  const [activityEventsBySession, setActivityEventsBySession] = useState<Record<string, AgentActivityEvent[]>>({});
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [leftRailWidth, setLeftRailWidth] = useState<number | null>(null);
  const [rightRailWidth, setRightRailWidth] = useState<number | null>(null);
  const shellRef = useRef<HTMLElement | null>(null);
  const leftRailDefaultWidthRef = useRef<number | null>(null);
  const rightRailDefaultWidthRef = useRef<number | null>(null);
  const activeActivityEvents = activeSession ? (activityEventsBySession[activeSession.id] ?? []) : [];
  const sideActivityEvents = sideSession ? (activityEventsBySession[sideSession.id] ?? []) : [];
  const shellStyle: ShellStyle = {};

  if (leftRailWidth !== null) {
    shellStyle["--rail-width-left"] = `${Math.round(leftRailWidth)}px`;
  }

  if (rightRailWidth !== null) {
    shellStyle["--rail-width-right"] = `${Math.round(rightRailWidth)}px`;
    shellStyle["--rail-right-transition-duration"] = `${computeRightPanelTransition(rightRailWidth)}ms`;
  }

  function appendActivityEvent(sessionId: string, event: AgentActivityEvent) {
    setActivityEventsBySession((current) => {
      const list = current[sessionId] ?? [];
      // Upsert by id so a growing event (e.g. an accumulating reasoning block
      // re-recorded under a stable segment id) replaces its prior version in
      // place instead of appending a duplicate row.
      const existingIndex = list.findIndex((existing) => existing.id === event.id);
      const next =
        existingIndex >= 0
          ? [...list.slice(0, existingIndex), event, ...list.slice(existingIndex + 1)]
          : [...list, event];
      return {
        ...current,
        [sessionId]: next.slice(-80)
      };
    });
  }

  function startLeftResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (leftCollapsed) {
      return;
    }

    const sidebar = shellRef.current?.querySelector<HTMLElement>("[data-shell-rail='left']");
    const startWidth = leftRailWidth ?? sidebar?.getBoundingClientRect().width ?? 260;
    const defaultWidth = leftRailDefaultWidthRef.current ?? startWidth;
    leftRailDefaultWidthRef.current = defaultWidth;
    const minWidth = Math.round(defaultWidth * 0.5);
    const maxWidth = Math.round(defaultWidth * 1.5);
    const startX = event.clientX;
    let nextWidth = startWidth;
    let animationFrame: number | null = null;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.dataset.shellResizing = "true";

    const handleMove = (moveEvent: PointerEvent) => {
      nextWidth = clampPanelWidth(startWidth + moveEvent.clientX - startX, minWidth, maxWidth);

      if (animationFrame !== null) {
        return;
      }

      animationFrame = window.requestAnimationFrame(() => {
        shellRef.current?.style.setProperty("--rail-width-left", `${Math.round(nextWidth)}px`);
        animationFrame = null;
      });
    };

    const stopResize = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }

      shellRef.current?.style.setProperty("--rail-width-left", `${Math.round(nextWidth)}px`);
      setLeftRailWidth(nextWidth);
      delete document.body.dataset.shellResizing;
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", stopResize);
      document.removeEventListener("pointercancel", stopResize);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", stopResize);
    document.addEventListener("pointercancel", stopResize);
  }

  function startRightResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (rightCollapsed) {
      return;
    }

    const mainWindow = shellRef.current?.querySelector<HTMLElement>("[data-shell-main-window='true']");
    const contextRail = mainWindow?.querySelector<HTMLElement>("[data-shell-rail='right']");
    const startWidth = rightRailWidth ?? contextRail?.getBoundingClientRect().width ?? 414;
    const defaultWidth = rightRailDefaultWidthRef.current ?? startWidth;
    rightRailDefaultWidthRef.current = defaultWidth;
    const mainWidth = mainWindow?.getBoundingClientRect().width ?? defaultWidth * 2;
    const minWidth = Math.round(defaultWidth * 0.5);
    const maxWidth = Math.max(minWidth, Math.round(mainWidth * 0.5));
    const startX = event.clientX;
    let nextWidth = startWidth;
    let animationFrame: number | null = null;

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.body.dataset.shellResizing = "true";

    const handleMove = (moveEvent: PointerEvent) => {
      nextWidth = clampPanelWidth(startWidth - (moveEvent.clientX - startX), minWidth, maxWidth);

      if (animationFrame !== null) {
        return;
      }

      animationFrame = window.requestAnimationFrame(() => {
        shellRef.current?.style.setProperty("--rail-width-right", `${Math.round(nextWidth)}px`);
        animationFrame = null;
      });
    };

    const stopResize = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }

      shellRef.current?.style.setProperty("--rail-width-right", `${Math.round(nextWidth)}px`);
      shellRef.current?.style.setProperty(
        "--rail-right-transition-duration",
        `${computeRightPanelTransition(nextWidth)}ms`
      );
      setRightRailWidth(nextWidth);
      delete document.body.dataset.shellResizing;
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", stopResize);
      document.removeEventListener("pointercancel", stopResize);
    };

    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", stopResize);
    document.addEventListener("pointercancel", stopResize);
  }

  function splitMainWindowEvenly() {
    setRightPaneMode("chat");
    if (!sideSession) {
      const sessionId = actions.createSessionForProject(activeProject.id, { activate: false });
      if (activeSession?.modelPreference) {
        actions.setSessionModelPreference(sessionId, activeSession.modelPreference);
      }
      setSideSessionId(sessionId);
    }

    const mainWindow = shellRef.current?.querySelector<HTMLElement>("[data-shell-main-window='true']");
    if (!mainWindow) {
      setRightCollapsed(false);
      return;
    }

    const nextWidth = Math.round(mainWindow.getBoundingClientRect().width / 2);
    shellRef.current?.style.setProperty("--rail-width-right", `${nextWidth}px`);
    shellRef.current?.style.setProperty(
      "--rail-right-transition-duration",
      `${computeRightPanelTransition(nextWidth)}ms`
    );
    setRightRailWidth(nextWidth);
    setRightCollapsed(false);
  }

  function toggleMainWindowSplit() {
    if (!rightCollapsed && rightPaneMode === "chat") {
      setRightCollapsed(true);
      return;
    }

    splitMainWindowEvenly();
  }

  function createSideSession() {
    const sessionId = actions.createSessionForProject(activeProject.id, { activate: false });
    if (activeSession?.modelPreference) {
      actions.setSessionModelPreference(sessionId, activeSession.modelPreference);
    }
    setSideSessionId(sessionId);
    setRightPaneMode("chat");
    setRightCollapsed(false);
  }

  function selectSideSession(sessionId: string) {
    setSideSessionId(sessionId);
    setRightPaneMode("chat");
    setRightCollapsed(false);
  }

  function closeSideSession() {
    setSideSessionId(null);
    setRightPaneMode("console");
  }

  return (
    <main
      className={styles.shell}
      data-left-collapsed={leftCollapsed ? "true" : "false"}
      data-right-collapsed={rightCollapsed ? "true" : "false"}
      ref={shellRef}
      style={shellStyle}
    >
      <input
        aria-hidden="true"
        className={`${styles.toggleInput} ${styles.leftToggle}`}
        checked={leftCollapsed}
        id="studio-left-rail-toggle"
        onChange={(event) => setLeftCollapsed(event.currentTarget.checked)}
        tabIndex={-1}
        type="checkbox"
      />
      <input
        aria-hidden="true"
        className={`${styles.toggleInput} ${styles.rightToggle}`}
        checked={rightCollapsed}
        id="studio-right-rail-toggle"
        onChange={(event) => {
          const collapsed = event.currentTarget.checked;
          if (!collapsed) {
            setRightPaneMode("console");
          }
          setRightCollapsed(collapsed);
        }}
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
        refreshHermesStatus={() => {
          void hermesStatus.refresh({ refreshModels: true });
        }}
      />
      <button
        aria-label="Resize left sidebar"
        className={styles.leftResizeHandle}
        disabled={leftCollapsed}
        onPointerDown={startLeftResize}
        type="button"
      />
      <div
        className={mainWindowStyles.mainWindow}
        data-shell-main-window="true"
        data-right-collapsed={rightCollapsed ? "true" : "false"}
      >
        <div className={mainWindowStyles.chatPane} data-shell-chat-pane="true">
          <ChatView
            activeProject={activeProject}
            activeSession={activeSession}
            activityEvents={activeActivityEvents}
            createSession={actions.createSession}
            hermesStatus={hermesStatus.status}
            isHermesStatusLoading={hermesStatus.isLoading}
            isSplitViewOpen={!rightCollapsed && rightPaneMode === "chat"}
            onActivityEvent={appendActivityEvent}
            onSplitView={toggleMainWindowSplit}
            sessionModel={hermesSessionModel}
            workspaceActions={actions}
          />
        </div>
        <button
          aria-label="Resize right context panel"
          className={mainWindowStyles.rightResizeHandle}
          disabled={rightCollapsed}
          onPointerDown={startRightResize}
          type="button"
        />
        <SplitPane
          activeProject={activeProject}
          activeSession={activeSession}
          activityEvents={activeActivityEvents}
          availableSessions={activeProjectSessions}
          allSessions={state.sessions}
          brainMemoryStatus={brainMemoryStatus.status}
          closeSideSession={closeSideSession}
          createSideSession={createSideSession}
          hermesSessions={hermesSessions.sessions}
          hermesStatus={hermesStatus.status}
          hermesSessionModel={hermesSessionModel}
          isBrainMemoryStatusLoading={brainMemoryStatus.isLoading}
          isHermesSessionsLoading={hermesSessions.isLoading}
          isHermesStatusLoading={hermesStatus.isLoading}
          isHermesStatusRefreshing={hermesStatus.isRefreshing}
          mode={rightPaneMode}
          onActivityEvent={appendActivityEvent}
          refreshBrainMemoryStatus={brainMemoryStatus.refresh}
          refreshHermesStatus={() => {
            void hermesStatus.refresh({ refreshModels: true });
          }}
          refreshHermesSessions={hermesSessions.refresh}
          selectSideSession={selectSideSession}
          setMode={setRightPaneMode}
          sideActivityEvents={sideActivityEvents}
          sideSession={sideSession}
          sideSessionModel={sideSessionModel}
          tenantScopePosture={tenantScopePosture.posture}
          workspaceActions={actions}
        />
      </div>
    </main>
  );
}
