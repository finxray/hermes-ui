"use client";

import { ChatView } from "@/components/chat/ChatView";
import { ChatHeader } from "@/components/chat/ChatHeader";
import type { ChatPaneId, ChatTabMove } from "@/components/chat/ChatPaneTabs";
import { ConfigView } from "@/components/config/ConfigView";
import { KeysView } from "@/components/keys/KeysView";
import { LogsView } from "@/components/logs/LogsView";
import { PluginsView } from "@/components/plugins/PluginsView";
import { SettingsView } from "@/components/settings/SettingsView";
import { SectionNavProvider, useSectionNav } from "@/components/shell/SectionNavContext";
import { Sidebar } from "@/components/shell/Sidebar";
import { SplitPane, type RightPaneMode } from "@/components/shell/SplitPane";
import { TopBar, type ShellSection } from "@/components/shell/TopBar";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useHermesSessionModel } from "@/hooks/useHermesSessionModel";
import { useHermesStatus } from "@/hooks/useHermesStatus";
import { useHermesSessions } from "@/hooks/useHermesSessions";
import { useLmStudioModels } from "@/hooks/useLmStudioModels";
import { useOpenRouterModels } from "@/hooks/useOpenRouterModels";
import { useWorkspaceState } from "@/hooks/useWorkspaceState";
import { fetchHermesSessionMessages } from "@/lib/hermesSessionsClient";
import { makeSessionChannel, normalizeHermesMessages } from "@/lib/sessionChannels";
import {
  appendUniqueTab,
  insertUniqueTab,
  reorderTab,
  resolveSidebarAddTargetPane,
  resolveSidebarSelectedSessionIds,
  resolveSidebarTargetPane,
  selectSidebarTab
} from "@/lib/chatTabState";
import { type CSSProperties, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react";
import type { HermesSessionSummary } from "@hermes-ui/hermes-client";
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
  return 700;
}

export function AppShell() {
  return (
    <SectionNavProvider>
      <AppShellInner />
    </SectionNavProvider>
  );
}

function AppShellInner() {
  const sectionNav = useSectionNav();
  const { actions, activeProject, activeSession, state } = useWorkspaceState();
  const appUpdate = useAppUpdate();
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
  const [mainTabIds, setMainTabIds] = useState<string[]>([]);
  const [sideTabIds, setSideTabIds] = useState<string[]>([]);
  const [singlePane, setSinglePane] = useState<ChatPaneId | null>(null);
  const [focusedChatPane, setFocusedChatPane] = useState<"main" | "side">("main");
  const [rightPaneMode, setRightPaneMode] = useState<RightPaneMode>("console");
  const mainTabs = mainTabIds
    .map((sessionId) => state.sessions.find((session) => session.id === sessionId && !session.archivedAt))
    .filter((session): session is NonNullable<typeof session> => Boolean(session));
  const sideTabOrder = sideSessionId && !sideTabIds.includes(sideSessionId)
    ? [...sideTabIds, sideSessionId]
    : sideTabIds;
  const sideTabs = sideTabOrder
    .map((sessionId) => state.sessions.find((session) => session.id === sessionId && !session.archivedAt))
    .filter((session): session is NonNullable<typeof session> => Boolean(session));
  const sideSession =
    state.sessions.find((session) => session.id === sideSessionId && !session.archivedAt) ?? null;
  const sideProject = state.projects.find((project) => project.id === sideSession?.projectId) ?? activeProject;
  const sideSessionModel = useHermesSessionModel({
    activeSession: sideSession,
    hermesStatus: hermesStatus.status,
    lmStudioModels: lmStudioModels.models,
    modelChoices: state.modelChoices,
    openRouterModels: openRouterModels.models,
    persistSessionModelPreference: actions.setSessionModelPreference,
    refreshHermesStatus: hermesStatus.refresh
  });
  const [activeSection, setActiveSection] = useState<ShellSection>("workspace");
  const [sectionHistory, setSectionHistory] = useState<ShellSection[]>([]);
  const [detailBackSection, setDetailBackSection] = useState<ShellSection | null>(null);
  const detailBackRef = useRef<(() => void) | null>(null);
  const [activityEventsBySession, setActivityEventsBySession] = useState<Record<string, AgentActivityEvent[]>>({});
  const [generatingSessionIds, setGeneratingSessionIds] = useState<string[]>([]);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(true);
  const [leftRailWidth, setLeftRailWidth] = useState<number | null>(null);
  const [rightRailWidth, setRightRailWidth] = useState<number | null>(null);
  const [promotingSideSessionId, setPromotingSideSessionId] = useState<string | null>(null);
  const [sectionScrolled, setSectionScrolled] = useState(false);
  const shellRef = useRef<HTMLElement | null>(null);
  const sectionScrollRef = useRef<HTMLDivElement | null>(null);
  const leftRailDefaultWidthRef = useRef<number | null>(null);
  const rightRailDefaultWidthRef = useRef<number | null>(null);
  const activeResizeCleanupRef = useRef<(() => void) | null>(null);
  const rightRevealFrameRef = useRef<number | null>(null);
  const splitWidthBeforeSingleRef = useRef<number | null>(null);
  const channelSyncKeyRef = useRef<string | null>(null);
  const activeMainSessionIdRef = useRef<string | null>(activeSession?.id ?? null);
  const hermesOpenRequestRef = useRef(0);
  const openWorkspaceSessionRef = useRef<(sessionId: string) => void>(() => undefined);
  const activeActivityEvents = activeSession ? (activityEventsBySession[activeSession.id] ?? []) : [];
  const sideActivityEvents = sideSession ? (activityEventsBySession[sideSession.id] ?? []) : [];
  const sidebarActiveSession =
    focusedChatPane === "side" && !rightCollapsed && (rightPaneMode === "chat" || rightPaneMode === "chat-console") && sideSession
      ? sideSession
      : activeSession;
  const sideChatIsVisible =
    !rightCollapsed && (rightPaneMode === "chat" || rightPaneMode === "chat-console");
  const sidebarSelectedSessionIds = resolveSidebarSelectedSessionIds({
    activeSessionId: activeSession?.id,
    sideChatIsVisible,
    sideSessionId: sideSession?.id,
    singlePane
  });
  const shellStyle: ShellStyle = {};
  const sectionWindowTitle =
    sectionNav.labelForSection(activeSection) ??
    ({ plugins: "Plugins", config: "Config", keys: "Keys", logs: "Logs", settings: "Settings" } as const)[
      activeSection as Exclude<ShellSection, "workspace">
    ];

  useEffect(() => {
    if (!activeSession) {
      activeMainSessionIdRef.current = null;
      return;
    }
    const previousSessionId = activeMainSessionIdRef.current;
    setMainTabIds((current) => selectSidebarTab(current, previousSessionId, activeSession.id));
    activeMainSessionIdRef.current = activeSession.id;
  }, [activeSession]);

  useEffect(() => {
    const availableIds = new Set(state.sessions.filter((session) => !session.archivedAt).map((session) => session.id));
    setMainTabIds((current) => current.filter((id) => availableIds.has(id)));
    setSideTabIds((current) => current.filter((id) => availableIds.has(id)));
    if (sideSessionId && !availableIds.has(sideSessionId)) {
      setSideSessionId(null);
    }
  }, [sideSessionId, state.sessions]);

  useEffect(() => {
    if (activeSection === "settings" && appUpdate.hasUnseenUpdate) {
      appUpdate.markUpdateSeen();
    }
  }, [activeSection, appUpdate.hasUnseenUpdate, appUpdate.markUpdateSeen]);

  const ensureHermesSession = useCallback(async (
    summary: HermesSessionSummary,
    options: { activate: boolean }
  ) => {
    const existingSession = state.sessions.find(
      (session) => session.hermesSessionId === summary.id && !session.archivedAt
    );
    if (existingSession) {
      if (options.activate) {
        actions.switchSession(existingSession.id);
      }
      if (existingSession.messages.length === 0) {
        const result = await fetchHermesSessionMessages(summary.id);
        if (result.ok) {
          actions.loadHermesMessages(existingSession.id, normalizeHermesMessages(result.messages));
        }
      }
      return existingSession.id;
    }

    const result = await fetchHermesSessionMessages(summary.id);
    const sessionId = actions.createSessionForProject(activeProject.id, {
      activate: options.activate,
      channel: makeSessionChannel(summary),
      createdAt: summary.startedAt,
      hermesSessionId: summary.id,
      messages: result.ok ? normalizeHermesMessages(result.messages) : [],
      title: summary.title || "Untitled session",
      updatedAt: summary.lastActiveAt ?? summary.endedAt ?? summary.startedAt
    });
    channelSyncKeyRef.current = makeChannelSyncKey(summary);
    return sessionId;
  }, [actions, activeProject.id, state.sessions]);

  const openHermesSession = useCallback(async (summary: HermesSessionSummary) => {
    const requestId = ++hermesOpenRequestRef.current;
    const sessionId = await ensureHermesSession(summary, { activate: false });
    if (sessionId && requestId === hermesOpenRequestRef.current) {
      openWorkspaceSessionRef.current(sessionId);
    }
  }, [ensureHermesSession]);

  useEffect(() => {
    if (!activeSession?.channel?.external || generatingSessionIds.includes(activeSession.id)) {
      return;
    }
    const summary = hermesSessions.sessions.find(
      (session) => session.id === activeSession.hermesSessionId
    );
    if (!summary) {
      return;
    }
    const syncKey = makeChannelSyncKey(summary);
    if (channelSyncKeyRef.current === syncKey) {
      return;
    }
    channelSyncKeyRef.current = syncKey;
    let cancelled = false;
    void fetchHermesSessionMessages(summary.id).then((result) => {
      if (!cancelled && result.ok) {
        actions.loadHermesMessages(activeSession.id, normalizeHermesMessages(result.messages));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [actions, activeSession, generatingSessionIds, hermesSessions.sessions]);

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

  const markSessionGenerating = useCallback((sessionId: string, isGenerating: boolean) => {
    setGeneratingSessionIds((current) => {
      const hasSession = current.includes(sessionId);
      if (isGenerating) {
        return hasSession ? current : [...current, sessionId];
      }
      return hasSession ? current.filter((id) => id !== sessionId) : current;
    });
  }, []);

  useEffect(() => {
    return () => {
      activeResizeCleanupRef.current?.();
      if (rightRevealFrameRef.current !== null) {
        window.cancelAnimationFrame(rightRevealFrameRef.current);
        rightRevealFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!promotingSideSessionId) {
      return;
    }

    const rightRail = shellRef.current?.querySelector<HTMLElement>("[data-shell-rail='right']");
    if (!rightRail) {
      actions.switchSession(promotingSideSessionId);
      setMainTabIds((current) => appendUniqueTab(current, promotingSideSessionId));
      setSideTabIds((current) => {
        const remaining = current.filter((id) => id !== promotingSideSessionId);
        setSideSessionId(remaining[0] ?? null);
        return remaining;
      });
      setRightPaneMode("console");
      setRightCollapsed(true);
      setSinglePane(null);
      setFocusedChatPane("main");
      resetRightRailWidth();
      setPromotingSideSessionId(null);
      return;
    }

    let finished = false;
    let handoffFrame: number | null = null;

    const finishPromotion = () => {
      if (finished) {
        return;
      }
      finished = true;
      actions.switchSession(promotingSideSessionId);
      setMainTabIds((current) => appendUniqueTab(current, promotingSideSessionId));
      setSideTabIds((current) => {
        const remaining = current.filter((id) => id !== promotingSideSessionId);
        setSideSessionId(remaining[0] ?? null);
        return remaining;
      });
      setFocusedChatPane("main");
      handoffFrame = window.requestAnimationFrame(() => {
        setRightCollapsed(true);
        setRightPaneMode("console");
        setSinglePane(null);
        resetRightRailWidth();
        setPromotingSideSessionId(null);
      });
    };

    const finishOnWidthTransition = (event: TransitionEvent) => {
      if (event.target === rightRail && event.propertyName === "width") {
        finishPromotion();
      }
    };

    rightRail.addEventListener("transitionend", finishOnWidthTransition);
    const fallbackTimer = window.setTimeout(
      finishPromotion,
      computeRightPanelTransition(rightRail.getBoundingClientRect().width) + 120
    );

    return () => {
      rightRail.removeEventListener("transitionend", finishOnWidthTransition);
      window.clearTimeout(fallbackTimer);
      if (handoffFrame !== null) {
        window.cancelAnimationFrame(handoffFrame);
      }
    };
  }, [actions, promotingSideSessionId]);

  function revealRightRailAfterRender() {
    if (!rightCollapsed) {
      setRightCollapsed(false);
      return;
    }

    if (rightRevealFrameRef.current !== null) {
      window.cancelAnimationFrame(rightRevealFrameRef.current);
    }

    rightRevealFrameRef.current = window.requestAnimationFrame(() => {
      rightRevealFrameRef.current = window.requestAnimationFrame(() => {
        rightRevealFrameRef.current = null;
        setRightCollapsed(false);
      });
    });
  }

  function hideRightRail() {
    if (rightRevealFrameRef.current !== null) {
      window.cancelAnimationFrame(rightRevealFrameRef.current);
      rightRevealFrameRef.current = null;
    }
    setRightCollapsed(true);
    setFocusedChatPane("main");
  }

  function startLeftResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (leftCollapsed) {
      return;
    }

    activeResizeCleanupRef.current?.();
    const resizeHandle = event.currentTarget;
    const pointerId = event.pointerId;
    const sidebar = shellRef.current?.querySelector<HTMLElement>("[data-shell-rail='left']");
    const startWidth = leftRailWidth ?? sidebar?.getBoundingClientRect().width ?? 260;
    const defaultWidth = leftRailDefaultWidthRef.current ?? startWidth;
    leftRailDefaultWidthRef.current = defaultWidth;
    const minWidth = Math.round(defaultWidth * 0.5);
    const maxWidth = Math.round(defaultWidth * 1.5);
    const startX = event.clientX;
    let nextWidth = startWidth;
    let animationFrame: number | null = null;
    let foldedDuringDrag = false;
    let resizeActive = true;

    event.preventDefault();
    resizeHandle.setPointerCapture(pointerId);
    document.body.dataset.shellResizing = "true";

    function cleanupResize() {
      if (!resizeActive) {
        return;
      }
      resizeActive = false;
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      delete document.body.dataset.shellResizing;
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", stopResize);
      document.removeEventListener("pointercancel", stopResize);
      if (resizeHandle.hasPointerCapture(pointerId)) {
        resizeHandle.releasePointerCapture(pointerId);
      }
      if (activeResizeCleanupRef.current === cleanupResize) {
        activeResizeCleanupRef.current = null;
      }
    }

    function handleMove(moveEvent: PointerEvent) {
      const rawNextWidth = startWidth + moveEvent.clientX - startX;

      if (rawNextWidth <= minWidth + 1) {
        foldedDuringDrag = true;
        shellRef.current?.style.removeProperty("--rail-width-left");
        setLeftRailWidth(null);
        setLeftCollapsed(true);
        cleanupResize();
        return;
      }

      nextWidth = clampPanelWidth(rawNextWidth, minWidth, maxWidth);

      if (animationFrame !== null) {
        return;
      }

      animationFrame = window.requestAnimationFrame(() => {
        shellRef.current?.style.setProperty("--rail-width-left", `${Math.round(nextWidth)}px`);
        animationFrame = null;
      });
    }

    function stopResize() {
      if (foldedDuringDrag) {
        return;
      }

      if (nextWidth <= minWidth + 1) {
        shellRef.current?.style.removeProperty("--rail-width-left");
        setLeftRailWidth(null);
        setLeftCollapsed(true);
      } else {
        shellRef.current?.style.setProperty("--rail-width-left", `${Math.round(nextWidth)}px`);
        setLeftRailWidth(nextWidth);
      }
      cleanupResize();
    }

    activeResizeCleanupRef.current = cleanupResize;
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", stopResize);
    document.addEventListener("pointercancel", stopResize);
  }

  function startRightResize(event: ReactPointerEvent<HTMLButtonElement>) {
    if (rightCollapsed) {
      return;
    }

    activeResizeCleanupRef.current?.();
    const resizeHandle = event.currentTarget;
    const pointerId = event.pointerId;
    const mainWindow = shellRef.current?.querySelector<HTMLElement>("[data-shell-main-window='true']");
    const contextRail = mainWindow?.querySelector<HTMLElement>("[data-shell-rail='right']");
    const startWidth = rightRailWidth ?? contextRail?.getBoundingClientRect().width ?? 414;
    const defaultWidth = rightRailDefaultWidthRef.current ?? startWidth;
    rightRailDefaultWidthRef.current = defaultWidth;
    const mainWidth = mainWindow?.getBoundingClientRect().width ?? defaultWidth * 2;
    const minWidth = Math.round(defaultWidth * 0.5);
    // Allow the right panel to grow past half so the chat-and-console split
    // (opened at 0.62 of the main window) can be dragged further left without
    // snapping back, while still keeping a usable minimum width for the main chat.
    const maxWidth = Math.max(minWidth, Math.round(mainWidth * 0.72));
    const startX = event.clientX;
    let nextWidth = startWidth;
    let animationFrame: number | null = null;
    let resizeActive = true;

    event.preventDefault();
    resizeHandle.setPointerCapture(pointerId);
    document.body.dataset.shellResizing = "true";

    function cleanupResize() {
      if (!resizeActive) {
        return;
      }
      resizeActive = false;
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
        animationFrame = null;
      }
      delete document.body.dataset.shellResizing;
      document.removeEventListener("pointermove", handleMove);
      document.removeEventListener("pointerup", stopResize);
      document.removeEventListener("pointercancel", stopResize);
      if (resizeHandle.hasPointerCapture(pointerId)) {
        resizeHandle.releasePointerCapture(pointerId);
      }
      if (activeResizeCleanupRef.current === cleanupResize) {
        activeResizeCleanupRef.current = null;
      }
    }

    function handleMove(moveEvent: PointerEvent) {
      nextWidth = clampPanelWidth(startWidth - (moveEvent.clientX - startX), minWidth, maxWidth);

      if (animationFrame !== null) {
        return;
      }

      animationFrame = window.requestAnimationFrame(() => {
        shellRef.current?.style.setProperty("--rail-width-right", `${Math.round(nextWidth)}px`);
        animationFrame = null;
      });
    }

    function stopResize() {
      shellRef.current?.style.setProperty("--rail-width-right", `${Math.round(nextWidth)}px`);
      shellRef.current?.style.setProperty(
        "--rail-right-transition-duration",
        `${computeRightPanelTransition(nextWidth)}ms`
      );
      setRightRailWidth(nextWidth);
      cleanupResize();
    }

    activeResizeCleanupRef.current = cleanupResize;
    document.addEventListener("pointermove", handleMove);
    document.addEventListener("pointerup", stopResize);
    document.addEventListener("pointercancel", stopResize);
  }

  function splitMainWindowEvenly() {
    setSinglePane(null);
    setRightPaneMode("chat");
    setFocusedChatPane("side");
    if (!sideSession && sideTabs[0]) {
      setSideSessionId(sideTabs[0].id);
    } else if (!sideSession) {
      const sessionId = actions.createSessionForProject(activeProject.id, { activate: false });
      if (activeSession?.modelPreference) {
        actions.setSessionModelPreference(sessionId, activeSession.modelPreference);
      }
      setSideSessionId(sessionId);
      setSideTabIds((current) => appendUniqueTab(current, sessionId));
    }

    const mainWindow = shellRef.current?.querySelector<HTMLElement>("[data-shell-main-window='true']");
    if (!mainWindow) {
      revealRightRailAfterRender();
      return;
    }

    const nextWidth = Math.round(mainWindow.getBoundingClientRect().width / 2);
    shellRef.current?.style.setProperty("--rail-width-right", `${nextWidth}px`);
    shellRef.current?.style.setProperty(
      "--rail-right-transition-duration",
      `${computeRightPanelTransition(nextWidth)}ms`
    );
    setRightRailWidth(nextWidth);
    revealRightRailAfterRender();
  }

  function setRightRailToMainWindowFraction(fraction: number) {
    const mainWindow = shellRef.current?.querySelector<HTMLElement>("[data-shell-main-window='true']");
    if (!mainWindow) {
      return;
    }

    const nextWidth = Math.round(mainWindow.getBoundingClientRect().width * fraction);
    shellRef.current?.style.setProperty("--rail-width-right", `${nextWidth}px`);
    shellRef.current?.style.setProperty(
      "--rail-right-transition-duration",
      `${computeRightPanelTransition(nextWidth)}ms`
    );
    setRightRailWidth(nextWidth);
  }

  function resetRightRailWidth() {
    shellRef.current?.style.removeProperty("--rail-width-right");
    shellRef.current?.style.removeProperty("--rail-right-transition-duration");
    setRightRailWidth(null);
  }

  function toggleMainWindowSplit() {
    if (rightCollapsed || rightPaneMode === "console") {
      splitMainWindowEvenly();
      return;
    }
    focusMainPane();
  }

  function promoteSideChatToMain() {
    if (rightCollapsed || !sideSession || promotingSideSessionId) {
      return;
    }
    setPromotingSideSessionId(sideSession.id);
  }

  function toggleConsolePanel() {
    if (!rightCollapsed && rightPaneMode === "chat-console") {
      setRightPaneMode("chat");
      setFocusedChatPane("side");
      setRightRailToMainWindowFraction(0.5);
      return;
    }

    if (!rightCollapsed && rightPaneMode === "console") {
      hideRightRail();
      return;
    }

    if (!rightCollapsed && rightPaneMode === "chat" && sideSession) {
      setRightPaneMode("chat-console");
      setFocusedChatPane("main");
      setRightRailToMainWindowFraction(0.62);
      return;
    }

    resetRightRailWidth();
    setRightPaneMode("console");
    setFocusedChatPane("main");
    revealRightRailAfterRender();
  }

  function openLogsSideView() {
    setSinglePane(null);
    setRightPaneMode("logs");
    setFocusedChatPane("main");
    setRightRailToMainWindowFraction(0.42);
    revealRightRailAfterRender();
  }

  function createSideSession() {
    const sessionId = actions.createSessionForProject(activeProject.id, { activate: false });
    if (activeSession?.modelPreference) {
      actions.setSessionModelPreference(sessionId, activeSession.modelPreference);
    }
    setSideSessionId(sessionId);
    setSideTabIds((current) => appendUniqueTab(current, sessionId));
    setRightPaneMode("chat");
    setFocusedChatPane("side");
    revealRightRailAfterRender();
  }

  function selectSideSession(sessionId: string) {
    setSideSessionId(sessionId);
    setSideTabIds((current) => appendUniqueTab(current, sessionId));
    setMainTabIds((current) => current.filter((id) => id !== sessionId));
    setRightPaneMode("chat");
    setFocusedChatPane("side");
    revealRightRailAfterRender();
  }

  function createMainSession() {
    const sessionId = actions.createSessionForProject(activeProject.id, { activate: true });
    if (activeSession?.modelPreference) {
      actions.setSessionModelPreference(sessionId, activeSession.modelPreference);
    }
    setMainTabIds((current) => appendUniqueTab(current, sessionId));
    setFocusedChatPane("main");
  }

  function createWorkspaceSession(projectId = activeProject.id) {
    if (focusedChatPane === "side") {
      const sessionId = actions.createSessionForProject(projectId, { activate: false });
      if (activeSession?.modelPreference) {
        actions.setSessionModelPreference(sessionId, activeSession.modelPreference);
      }
      setSideSessionId(sessionId);
      setSideTabIds((current) => appendUniqueTab(current, sessionId));
      setMainTabIds((current) => current.filter((id) => id !== sessionId));
      setRightPaneMode("chat");
      setFocusedChatPane("side");
      revealRightRailAfterRender();
      return;
    }

    const sessionId = actions.createSessionForProject(projectId, { activate: true });
    setMainTabIds((current) => appendUniqueTab(current, sessionId));
    setFocusedChatPane("main");
  }

  async function addHermesSessionToPane(summary: HermesSessionSummary, pane: ChatPaneId) {
    const sessionId = await ensureHermesSession(summary, { activate: pane === "main" });
    if (!sessionId) {
      return;
    }
    if (pane === "main") {
      setMainTabIds((current) => appendUniqueTab(current, sessionId));
      setSideTabIds((current) => current.filter((id) => id !== sessionId));
      actions.switchSession(sessionId);
      setFocusedChatPane("main");
      return;
    }
    setSideSessionId(sessionId);
    setSideTabIds((current) => appendUniqueTab(current, sessionId));
    setMainTabIds((current) => current.filter((id) => id !== sessionId));
    setRightPaneMode("chat");
    setFocusedChatPane("side");
    revealRightRailAfterRender();
  }

  function selectMainSession(sessionId: string) {
    setMainTabIds((current) => appendUniqueTab(current, sessionId));
    setSideTabIds((current) => current.filter((id) => id !== sessionId));
    actions.switchSession(sessionId);
    setFocusedChatPane("main");
  }

  function focusPaneComposer(pane: ChatPaneId) {
    window.requestAnimationFrame(() => {
      shellRef.current
        ?.querySelector<HTMLTextAreaElement>(`[data-chat-pane='${pane}'] textarea[aria-label='Message']`)
        ?.focus({ preventScroll: true });
    });
  }

  function openWorkspaceSession(sessionId: string) {
    hermesOpenRequestRef.current += 1;
    const targetPane = resolveSidebarTargetPane(
      mainTabIds,
      sideTabIds,
      focusedChatPane,
      sessionId
    );
    if (targetPane === "main") {
      setMainTabIds((current) => selectSidebarTab(current, activeSession?.id ?? null, sessionId));
      setSideTabIds((current) => current.filter((id) => id !== sessionId));
      actions.switchSession(sessionId);
      setFocusedChatPane("main");
      focusPaneComposer("main");
      return;
    }
    setSideTabIds((current) => selectSidebarTab(current, sideSessionId, sessionId));
    setMainTabIds((current) => current.filter((id) => id !== sessionId));
    setSideSessionId(sessionId);
    setRightPaneMode("chat");
    setFocusedChatPane("side");
    revealRightRailAfterRender();
    focusPaneComposer("side");
  }

  function addWorkspaceSessionToView(sessionId: string) {
    hermesOpenRequestRef.current += 1;
    const targetPane = resolveSidebarAddTargetPane({
      focusedPane: focusedChatPane,
      sideChatIsVisible,
      singlePane
    });
    const sourcePane = mainTabIds.includes(sessionId)
      ? "main"
      : sideTabOrder.includes(sessionId)
        ? "side"
        : null;

    if (sourcePane && sourcePane !== targetPane) {
      moveChatTab({
        sessionId,
        sourcePane,
        targetIndex: targetPane === "main" ? mainTabIds.length : sideTabOrder.length,
        targetPane
      });
      if (singlePane) {
        setSinglePane(targetPane);
      }
    } else if (targetPane === "main") {
      selectMainSession(sessionId);
    } else {
      selectSideSession(sessionId);
    }

    setFocusedChatPane(targetPane);
    focusPaneComposer(targetPane);
  }

  openWorkspaceSessionRef.current = openWorkspaceSession;

  function closeChatTab(pane: ChatPaneId, sessionId: string) {
    if (pane === "main") {
      const index = mainTabIds.indexOf(sessionId);
      const remaining = mainTabIds.filter((id) => id !== sessionId);
      setMainTabIds(remaining);
      if (activeSession?.id !== sessionId) {
        return;
      }
      const replacement = remaining[Math.min(Math.max(index, 0), remaining.length - 1)];
      if (replacement) {
        actions.switchSession(replacement);
      } else if (sideSession) {
        promoteSideChatToMain();
      } else {
        createMainSession();
      }
      return;
    }

    const index = sideTabIds.indexOf(sessionId);
    const remaining = sideTabIds.filter((id) => id !== sessionId);
    setSideTabIds(remaining);
    if (sideSessionId !== sessionId) {
      return;
    }
    const replacement = remaining[Math.min(Math.max(index, 0), remaining.length - 1)] ?? null;
    setSideSessionId(replacement);
    if (!replacement) {
      setSinglePane(null);
      setRightPaneMode("console");
      hideRightRail();
    }
  }

  function moveChatTab(move: ChatTabMove) {
    if (move.sourcePane === move.targetPane) {
      if (move.targetPane === "main") {
        setMainTabIds((current) => reorderTab(current, move.sessionId, move.targetIndex));
      } else {
        setSideTabIds((current) => reorderTab(current, move.sessionId, move.targetIndex));
      }
      return;
    }

    if (move.targetPane === "side") {
      const remainingMain = mainTabIds.filter((id) => id !== move.sessionId);
      setMainTabIds(remainingMain);
      setSideTabIds((current) => insertUniqueTab(current, move.sessionId, move.targetIndex));
      setSideSessionId(move.sessionId);
      setRightPaneMode("chat");
      setFocusedChatPane("side");
      setSinglePane(null);
      if (activeSession?.id === move.sessionId) {
        const replacement = remainingMain[0];
        if (replacement) {
          actions.switchSession(replacement);
        } else {
          createMainSession();
        }
      }
      if (rightCollapsed) {
        const mainWindow = shellRef.current?.querySelector<HTMLElement>("[data-shell-main-window='true']");
        const nextWidth = Math.round((mainWindow?.getBoundingClientRect().width ?? window.innerWidth) / 2);
        shellRef.current?.style.setProperty("--rail-width-right", `${nextWidth}px`);
        shellRef.current?.style.setProperty(
          "--rail-right-transition-duration",
          `${computeRightPanelTransition(nextWidth)}ms`
        );
        setRightRailWidth(nextWidth);
        revealRightRailAfterRender();
      }
      return;
    }

    const remainingSide = sideTabIds.filter((id) => id !== move.sessionId);
    setSideTabIds(remainingSide);
    setMainTabIds((current) => insertUniqueTab(current, move.sessionId, move.targetIndex));
    actions.switchSession(move.sessionId);
    setFocusedChatPane("main");
    if (sideSessionId === move.sessionId) {
      setSideSessionId(remainingSide[0] ?? null);
    }
    if (remainingSide.length === 0) {
      setSinglePane(null);
      setRightPaneMode("console");
      hideRightRail();
    }
  }

  function rememberSplitWidth() {
    const rightRail = shellRef.current?.querySelector<HTMLElement>("[data-shell-rail='right']");
    splitWidthBeforeSingleRef.current =
      rightRailWidth ?? rightRail?.getBoundingClientRect().width ?? splitWidthBeforeSingleRef.current;
  }

  function restoreSplitView() {
    setSinglePane(null);
    setRightPaneMode("chat");
    const rememberedWidth = splitWidthBeforeSingleRef.current;
    if (rememberedWidth) {
      shellRef.current?.style.setProperty("--rail-width-right", `${Math.round(rememberedWidth)}px`);
      shellRef.current?.style.setProperty(
        "--rail-right-transition-duration",
        `${computeRightPanelTransition(rememberedWidth)}ms`
      );
      setRightRailWidth(rememberedWidth);
      revealRightRailAfterRender();
      return;
    }
    splitMainWindowEvenly();
  }

  function focusMainPane() {
    if (singlePane === "main" || rightCollapsed) {
      if (sideTabs.length === 0) {
        splitMainWindowEvenly();
      } else {
        restoreSplitView();
      }
      return;
    }
    rememberSplitWidth();
    setSinglePane("main");
    hideRightRail();
  }

  function focusSidePane() {
    if (singlePane === "side") {
      restoreSplitView();
      return;
    }
    if (!sideSession) {
      createSideSession();
    }
    rememberSplitWidth();
    const mainWindow = shellRef.current?.querySelector<HTMLElement>("[data-shell-main-window='true']");
    const nextWidth = Math.round(mainWindow?.getBoundingClientRect().width ?? window.innerWidth);
    shellRef.current?.style.setProperty("--rail-width-right", `${nextWidth}px`);
    shellRef.current?.style.setProperty(
      "--rail-right-transition-duration",
      `${computeRightPanelTransition(nextWidth)}ms`
    );
    setRightRailWidth(nextWidth);
    setRightPaneMode("chat");
    setRightCollapsed(false);
    setSinglePane("side");
    setFocusedChatPane("side");
  }

  function activateSection(section: ShellSection) {
    if (section === activeSection) {
      return;
    }
    setSectionHistory((current) => [...current, activeSection]);
    setActiveSection(section);
    if (section !== "workspace") {
      hideRightRail();
    }
  }

  function navigateBack() {
    if (detailBackSection === activeSection && detailBackRef.current) {
      detailBackRef.current();
      return;
    }
    const previous = sectionHistory[sectionHistory.length - 1] ?? "workspace";
    setSectionHistory((current) => current.slice(0, -1));
    setActiveSection(previous);
    if (previous !== "workspace") {
      hideRightRail();
    }
  }

  const registerDetailBack = useCallback((section: ShellSection, handler: (() => void) | null) => {
    detailBackRef.current = handler;
    setDetailBackSection(handler ? section : null);
  }, []);

  useEffect(() => {
    const element = sectionScrollRef.current;
    if (!element) {
      return;
    }

    const updateScrolledState = () => {
      setSectionScrolled(activeSection !== "workspace" && element.scrollTop > 4);
    };

    updateScrolledState();
    element.addEventListener("scroll", updateScrolledState, { passive: true });
    return () => element.removeEventListener("scroll", updateScrolledState);
  }, [activeSection]);

  const registerPluginsBack = useCallback(
    (handler: (() => void) | null) => registerDetailBack("plugins", handler),
    [registerDetailBack]
  );
  const registerConfigBack = useCallback(
    (handler: (() => void) | null) => registerDetailBack("config", handler),
    [registerDetailBack]
  );
  const registerKeysBack = useCallback(
    (handler: (() => void) | null) => registerDetailBack("keys", handler),
    [registerDetailBack]
  );

  return (
    <main
      className={styles.shell}
      data-left-collapsed={leftCollapsed ? "true" : "false"}
      data-promoting-side-chat={promotingSideSessionId ? "true" : "false"}
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
        activeSection={activeSection}
        leftToggleId="studio-left-rail-toggle"
        leftCollapsed={leftCollapsed}
        onSectionChange={activateSection}
        onRightToggle={toggleConsolePanel}
        rightToggleId="studio-right-rail-toggle"
        rightCollapsed={rightCollapsed}
        rightToggleLabel={
          !rightCollapsed && (rightPaneMode === "console" || rightPaneMode === "chat-console")
            ? "Close context console"
            : "Open context console"
        }
      />
      <Sidebar
        actions={actions}
        activeSection={activeSection}
        activeProject={activeProject}
        activeSession={sidebarActiveSession}
        selectedSessionIds={sidebarSelectedSessionIds}
        visibleSessionIds={[activeSession?.id, sideSession?.id].filter((id): id is string => Boolean(id))}
        allSessions={state.sessions}
        hermesStatus={hermesStatus.status}
        hermesSessions={hermesSessions.sessions}
        hasUnseenUpdate={appUpdate.hasUnseenUpdate}
        isHermesStatusLoading={hermesStatus.isLoading}
        onCreateWorkspaceSession={createWorkspaceSession}
        onSectionChange={activateSection}
        onEnsureHermesSession={(summary) => ensureHermesSession(summary, { activate: false })}
        onHermesSessionSelect={(summary) => {
          void openHermesSession(summary);
        }}
        onWorkspaceSessionAdd={addWorkspaceSessionToView}
        onWorkspaceSessionSelect={openWorkspaceSession}
        projects={state.projects}
        runningSessionIds={generatingSessionIds}
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
        data-focused-pane={focusedChatPane}
        data-promoting-side-chat={promotingSideSessionId ? "true" : "false"}
        data-right-pane-mode={rightPaneMode}
        data-single-pane={singlePane ?? "split"}
        data-shell-main-window="true"
        data-right-collapsed={rightCollapsed ? "true" : "false"}
      >
        <div
          className={`${mainWindowStyles.chatPane}${
            activeSection !== "workspace" ? ` ${mainWindowStyles.chatPaneScrollable}` : ""
          }`}
          data-scrollable={activeSection !== "workspace" ? "true" : "false"}
          data-section-scrolled={sectionScrolled ? "true" : "false"}
          data-shell-chat-pane="true"
          ref={sectionScrollRef}
        >
          <div
            className={mainWindowStyles.workspacePage}
            hidden={activeSection !== "workspace"}
          >
            <ChatView
              activeProject={activeProject}
              activeSession={activeSession}
              activityEvents={activeActivityEvents}
              createSession={createMainSession}
              hermesStatus={hermesStatus.status}
              isHermesStatusLoading={hermesStatus.isLoading}
              isFocused={focusedChatPane === "main"}
              isSplitViewOpen={!rightCollapsed && (rightPaneMode === "chat" || rightPaneMode === "chat-console")}
              onActivate={() => setFocusedChatPane("main")}
              onActivityEvent={appendActivityEvent}
              onCloseMainInSplit={sideSession ? promoteSideChatToMain : undefined}
              onGeneratingChange={markSessionGenerating}
              onRefreshHermes={() => hermesStatus.refresh({ refreshModels: true })}
              onSplitView={toggleMainWindowSplit}
              projects={state.projects}
              sessionModel={hermesSessionModel}
              tabs={{
                activeSessionId: activeSession?.id ?? null,
                availableChannelSessions: hermesSessions.sessions,
                availableSessions: state.sessions,
                isSingleView: rightCollapsed || singlePane === "main",
                onAdd: createMainSession,
                onAddChannelSession: (summary) => {
                  void addHermesSessionToPane(summary, "main");
                },
                onArchive: actions.archiveSession,
                onClose: (sessionId) => closeChatTab("main", sessionId),
                onMove: moveChatTab,
                onRename: actions.renameSession,
                onSelect: selectMainSession,
                onToggleView: focusMainPane,
                pane: "main",
                projects: state.projects,
                sessions: mainTabs
              }}
              workspaceActions={actions}
            />
          </div>
          {activeSection !== "workspace" ? (
            <div
              className={`${mainWindowStyles.sectionPage} ${
                activeSection === "logs" ? mainWindowStyles.logsSectionPage : ""
              }`}
            >
              <div className={mainWindowStyles.sectionWindowHeader}>
                <ChatHeader onBack={navigateBack} title={sectionWindowTitle ?? activeSection} />
              </div>
              {activeSection === "plugins" ? (
                <PluginsView
                  availableModels={hermesSessionModel.modelState.availableModels.filter(
                    (model) => model.catalogSource !== "ui-openrouter"
                  )}
                  hermesStatus={hermesStatus.status}
                  onDetailBackChange={registerPluginsBack}
                />
              ) : activeSection === "keys" ? (
                <KeysView hermesStatus={hermesStatus.status} onDetailBackChange={registerKeysBack} />
              ) : activeSection === "logs" ? (
                <LogsView hermesStatus={hermesStatus.status} onOpenSideView={openLogsSideView} />
              ) : activeSection === "settings" ? (
                <SettingsView
                  activeProject={activeProject}
                  appUpdate={appUpdate}
                  hermesStatus={hermesStatus.status}
                  isHermesStatusLoading={hermesStatus.isLoading}
                  onNavigate={activateSection}
                  onRefreshHermes={() => {
                    void hermesStatus.refresh({ refreshModels: true });
                  }}
                  onResetWorkspace={actions.reset}
                  projects={state.projects}
                  sessions={state.sessions}
                />
              ) : (
                <ConfigView
                  hermesStatus={hermesStatus.status}
                  isHermesStatusLoading={hermesStatus.isLoading}
                  onRefreshHermes={() => {
                    void hermesStatus.refresh({ refreshModels: true });
                  }}
                  onDetailBackChange={registerConfigBack}
                />
              )}
            </div>
          ) : null}
        </div>
        <button
          aria-label="Resize right context panel"
          className={mainWindowStyles.rightResizeHandle}
          disabled={rightCollapsed}
          onPointerDown={startRightResize}
          type="button"
        />
        <SplitPane
          activeProject={sideProject}
          activeSession={activeSession}
          activityEvents={activeActivityEvents}
          projects={state.projects}
          allSessions={state.sessions}
          createSideSession={createSideSession}
          hermesSessions={hermesSessions.sessions}
          hermesStatus={hermesStatus.status}
          hermesSessionModel={hermesSessionModel}
          isHermesSessionsLoading={hermesSessions.isLoading}
          isHermesStatusLoading={hermesStatus.isLoading}
          isHermesStatusRefreshing={hermesStatus.isRefreshing}
          isFocused={focusedChatPane === "side"}
          mode={rightPaneMode}
          onActivateSideChat={() => setFocusedChatPane("side")}
          onActivityEvent={appendActivityEvent}
          onCloseLogs={hideRightRail}
          onGeneratingChange={markSessionGenerating}
          refreshHermesStatus={() => {
            void hermesStatus.refresh({ refreshModels: true });
          }}
          refreshHermesSessions={hermesSessions.refresh}
          sideActivityEvents={sideActivityEvents}
          sideSession={sideSession}
          sideSessionModel={sideSessionModel}
          tabs={{
            activeSessionId: sideSessionId,
            availableChannelSessions: hermesSessions.sessions,
            availableSessions: state.sessions,
            isSingleView: singlePane === "side",
            onAdd: createSideSession,
            onAddChannelSession: (summary) => {
              void addHermesSessionToPane(summary, "side");
            },
            onArchive: actions.archiveSession,
            onClose: (sessionId) => closeChatTab("side", sessionId),
            onMove: moveChatTab,
            onRename: actions.renameSession,
            onSelect: selectSideSession,
            onToggleView: focusSidePane,
            pane: "side",
            projects: state.projects,
            sessions: sideTabs
          }}
          workspaceActions={actions}
        />
      </div>
    </main>
  );
}

function makeChannelSyncKey(summary: HermesSessionSummary): string {
  return [summary.id, summary.messageCount ?? "", summary.lastActiveAt ?? summary.endedAt ?? ""].join(":");
}
