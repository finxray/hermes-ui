"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  createMockWorkspaceState,
  getVisibleSessions,
  loadWorkspaceState,
  saveWorkspaceState,
  workspaceReducer,
  type WorkspaceAction
} from "@/lib/workspaceStore";
import type { ChatMessage, RunRecord, SessionModelPreference, ToolEvent } from "@/data/types";

export function useWorkspaceState() {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createMockWorkspaceState);
  const [isHydrated, setIsHydrated] = useState(false);
  const latestStateRef = useRef(state);

  latestStateRef.current = state;

  useEffect(() => {
    const loaded = loadWorkspaceState(window.localStorage);
    if (loaded) {
      dispatch({ type: "hydrate", state: loaded });
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const timeout = window.setTimeout(() => {
      saveWorkspaceState(window.localStorage, latestStateRef.current);
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [isHydrated, state]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const flush = () => saveWorkspaceState(window.localStorage, latestStateRef.current);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [isHydrated]);

  const activeProject =
    state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0];
  const activeProjectSessions = activeProject
    ? getVisibleSessions(state, activeProject.id)
    : [];
  const activeSession =
    activeProjectSessions.find((session) => session.id === state.activeSessionId) ?? null;

  const actions = useMemo(
    () => ({
      appendMessage: (sessionId: string, message: ChatMessage) =>
        dispatch({ type: "appendMessage", sessionId, message }),
      appendRunRecord: (sessionId: string, run: RunRecord) =>
        dispatch({ type: "appendRunRecord", sessionId, run }),
      appendToolEvent: (sessionId: string, event: ToolEvent) =>
        dispatch({ type: "appendToolEvent", sessionId, event }),
      archiveSession: (sessionId: string) => dispatch({ type: "archiveSession", sessionId }),
      createProject: () => dispatch({ type: "createProject" }),
      createSession: () => dispatch({ type: "createSession" }),
      createSessionForProject: (
        projectId: string,
        options: { activate?: boolean; sessionId?: string } = {}
      ) => {
        const sessionId = options.sessionId ?? `session-${crypto.randomUUID()}`;
        dispatch({
          type: "createSession",
          activate: options.activate,
          projectId,
          sessionId
        });
        return sessionId;
      },
      dispatch: (action: WorkspaceAction) => dispatch(action),
      renameProject: (projectId: string, name: string) =>
        dispatch({ type: "renameProject", projectId, name }),
      renameSession: (sessionId: string, title: string) =>
        dispatch({ type: "renameSession", sessionId, title }),
      reset: () => dispatch({ type: "reset" }),
      switchProject: (projectId: string) => dispatch({ type: "switchProject", projectId }),
      switchSession: (sessionId: string) => dispatch({ type: "switchSession", sessionId }),
      updateRunRecord: (sessionId: string, runId: string, patch: Partial<RunRecord>) =>
        dispatch({ type: "updateRunRecord", sessionId, runId, patch }),
      updateMessage: (
        sessionId: string,
        messageId: string,
        content: string,
        status?: Extract<WorkspaceAction, { type: "updateMessage" }>["status"],
        references?: string[],
        usage?: ChatMessage["usage"]
      ) =>
        dispatch({
          type: "updateMessage",
          sessionId,
          messageId,
          content,
          references,
          status,
          usage
        }),
      loadHermesMessages: (sessionId: string, messages: ChatMessage[]) =>
        dispatch({ type: "loadHermesMessages", sessionId, messages }),
      setSessionModelPreference: (sessionId: string, preference: SessionModelPreference) =>
        dispatch({ type: "setSessionModelPreference", sessionId, preference })
    }),
    []
  );

  return {
    actions,
    activeProject,
    activeProjectSessions,
    activeSession,
    isHydrated,
    state
  };
}
