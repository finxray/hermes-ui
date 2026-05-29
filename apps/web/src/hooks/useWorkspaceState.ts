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
      switchSession: (sessionId: string) => dispatch({ type: "switchSession", sessionId })
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
