"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import {
  createMockWorkspaceState,
  getVisibleSessions,
  loadWorkspaceState,
  saveWorkspaceState,
  workspaceReducer,
  type WorkspaceAction
} from "@/lib/workspaceStore";
import type { ChatMessage, RunRecord, ToolEvent } from "@/data/types";

export function useWorkspaceState() {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createMockWorkspaceState);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadWorkspaceState(window.localStorage);
    if (loaded) {
      dispatch({ type: "hydrate", state: loaded });
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      saveWorkspaceState(window.localStorage, state);
    }
  }, [isHydrated, state]);

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
        references?: string[]
      ) =>
        dispatch({
          type: "updateMessage",
          sessionId,
          messageId,
          content,
          references,
          status
        })
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
