"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  createMockWorkspaceState,
  getVisibleSessions,
  workspaceReducer,
  type WorkspaceAction
} from "@/lib/workspaceStore";
import { getMemoryStore } from "@/lib/storage/provider";
import {
  loadWorkspaceFromStore,
  saveWorkspaceToStore
} from "@/lib/storage/workspace-storage";
import type { MemoryStore } from "@/lib/storage/memory-store";
import type { ChatMessage, RunRecord, SessionModelPreference, ToolEvent } from "@/data/types";

export function useWorkspaceState() {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createMockWorkspaceState);
  const [isHydrated, setIsHydrated] = useState(false);
  const latestStateRef = useRef(state);
  // The MemoryStore is resolved asynchronously (IndexedDB open + migration).
  // We hold the resolved instance here so save effects can reuse it.
  const storeRef = useRef<MemoryStore | null>(null);

  latestStateRef.current = state;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { store } = await getMemoryStore();
        if (cancelled) {
          return;
        }
        storeRef.current = store;
        const loaded = await loadWorkspaceFromStore(store);
        if (!cancelled && loaded) {
          dispatch({ type: "hydrate", state: loaded });
        }
      } catch {
        // Storage failed to resolve; keep the default mock state so the UI
        // remains usable. The provider surfaces a diagnostic separately.
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const store = storeRef.current;
      if (store) {
        void saveWorkspaceToStore(store, latestStateRef.current);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [isHydrated, state]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    // Best-effort flush on unload. IndexedDB writes are async and may not
    // complete during teardown, but the 500ms debounce above already persists
    // shortly after every change, so unsaved data at unload is rare.
    const flush = () => {
      const store = storeRef.current;
      if (store) {
        void saveWorkspaceToStore(store, latestStateRef.current);
      }
    };
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
      createProject: (options: { activate?: boolean; name?: string; projectId?: string } = {}) => {
        const projectId = options.projectId ?? `project-${crypto.randomUUID()}`;
        dispatch({ type: "createProject", ...options, projectId });
        return projectId;
      },
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
