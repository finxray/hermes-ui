"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  createInitialWorkspaceState,
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
import type { ChatMessage, RunRecord, SessionChannel, SessionModelPreference, ToolEvent } from "@/data/types";
import {
  linkVaultAttachmentsToMessage,
  uploadDataPreviewToVault
} from "@/lib/attachmentVaultClient";

export function useWorkspaceState() {
  const [state, dispatch] = useReducer(workspaceReducer, undefined, createInitialWorkspaceState);
  const [isHydrated, setIsHydrated] = useState(false);
  const latestStateRef = useRef(state);
  const isHydratedRef = useRef(false);
  const pendingHydrationActionsRef = useRef<WorkspaceAction[]>([]);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const legacyAttachmentMigrationStartedRef = useRef(false);
  // The MemoryStore is resolved asynchronously (IndexedDB open + migration).
  // We hold the resolved instance here so save effects can reuse it.
  const storeRef = useRef<MemoryStore | null>(null);

  latestStateRef.current = state;

  const dispatchWorkspaceAction = useCallback((action: WorkspaceAction) => {
    if (!isHydratedRef.current) {
      pendingHydrationActionsRef.current.push(action);
    }
    dispatch(action);
  }, []);

  const enqueueSave = useCallback((store: MemoryStore, nextState = latestStateRef.current) => {
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => saveWorkspaceToStore(store, nextState));
  }, []);

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
          for (const action of pendingHydrationActionsRef.current) {
            dispatch(action);
          }
        }
      } catch {
        // Storage failed to resolve; keep the clean initial state so the UI
        // remains usable. The provider surfaces a diagnostic separately.
      } finally {
        if (!cancelled) {
          pendingHydrationActionsRef.current = [];
          isHydratedRef.current = true;
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
        enqueueSave(store);
      }
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [enqueueSave, isHydrated, state]);

  useEffect(() => {
    if (!isHydrated || legacyAttachmentMigrationStartedRef.current) {
      return;
    }
    const legacyMessages = state.sessions.flatMap((session) =>
      session.messages
        .filter((message) => message.attachments?.some(
          (attachment) => !attachment.storageId && attachment.previewUrl?.startsWith("data:")
        ))
        .map((message) => ({ message, session }))
    );
    if (legacyMessages.length === 0) {
      return;
    }
    legacyAttachmentMigrationStartedRef.current = true;

    void (async () => {
      for (const { message, session } of legacyMessages) {
        const nextAttachments = await Promise.all((message.attachments ?? []).map(async (attachment) => {
          if (attachment.storageId || !attachment.previewUrl?.startsWith("data:")) {
            return attachment;
          }
          try {
            return await uploadDataPreviewToVault(
              attachment.previewUrl,
              attachment.fileName,
              attachment.kind
            );
          } catch {
            return attachment;
          }
        }));
        dispatchWorkspaceAction({
          type: "updateMessageAttachments",
          sessionId: session.id,
          messageId: message.id,
          attachments: nextAttachments
        });
        const objectIds = nextAttachments
          .map((attachment) => attachment.storageId)
          .filter((id): id is string => Boolean(id));
        if (objectIds.length > 0) {
          await linkVaultAttachmentsToMessage({
            sessionId: session.hermesSessionId,
            clientMessageId: message.id,
            content: message.content,
            objectIds
          }).catch(() => undefined);
        }
      }
    })();
  }, [dispatchWorkspaceAction, isHydrated, state]);

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
        enqueueSave(store);
      }
    };
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
    };
  }, [enqueueSave, isHydrated]);

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
        dispatchWorkspaceAction({ type: "appendMessage", sessionId, message }),
      appendRunRecord: (sessionId: string, run: RunRecord) =>
        dispatchWorkspaceAction({ type: "appendRunRecord", sessionId, run }),
      appendToolEvent: (sessionId: string, event: ToolEvent) =>
        dispatchWorkspaceAction({ type: "appendToolEvent", sessionId, event }),
      archiveSession: (sessionId: string) => dispatchWorkspaceAction({ type: "archiveSession", sessionId }),
      archiveProjectSessions: (projectId: string) =>
        dispatchWorkspaceAction({ type: "archiveProjectSessions", projectId }),
      createProject: (options: { activate?: boolean; name?: string; projectId?: string } = {}) => {
        const projectId = options.projectId ?? `project-${crypto.randomUUID()}`;
        dispatchWorkspaceAction({ type: "createProject", ...options, projectId });
        return projectId;
      },
      createSession: () => dispatchWorkspaceAction({ type: "createSession" }),
      createSessionForProject: (
        projectId: string,
        options: {
          activate?: boolean;
          channel?: SessionChannel;
          createdAt?: string;
          hermesSessionId?: string;
          messages?: ChatMessage[];
          sessionId?: string;
          title?: string;
          updatedAt?: string;
        } = {}
      ) => {
        const sessionId = options.sessionId ?? `session-${crypto.randomUUID()}`;
        dispatchWorkspaceAction({
          type: "createSession",
          activate: options.activate,
          channel: options.channel,
          createdAt: options.createdAt,
          hermesSessionId: options.hermesSessionId,
          messages: options.messages,
          projectId,
          sessionId,
          title: options.title,
          updatedAt: options.updatedAt
        });
        return sessionId;
      },
      dispatch: dispatchWorkspaceAction,
      renameProject: (projectId: string, name: string) =>
        dispatchWorkspaceAction({ type: "renameProject", projectId, name }),
      renameSession: (sessionId: string, title: string) =>
        dispatchWorkspaceAction({ type: "renameSession", sessionId, title }),
      markSessionTitleGenerationRequested: (sessionId: string, requestedAt: string) =>
        dispatchWorkspaceAction({ type: "markSessionTitleGenerationRequested", sessionId, requestedAt }),
      applyGeneratedSessionTitle: (sessionId: string, title: string, generatedAt: string) =>
        dispatchWorkspaceAction({ type: "applyGeneratedSessionTitle", sessionId, title, generatedAt }),
      removeProject: (projectId: string) => dispatchWorkspaceAction({ type: "removeProject", projectId }),
      reset: () => dispatchWorkspaceAction({ type: "reset" }),
      switchProject: (projectId: string) => dispatchWorkspaceAction({ type: "switchProject", projectId }),
      switchSession: (sessionId: string) => dispatchWorkspaceAction({ type: "switchSession", sessionId }),
      updateRunRecord: (sessionId: string, runId: string, patch: Partial<RunRecord>) =>
        dispatchWorkspaceAction({ type: "updateRunRecord", sessionId, runId, patch }),
      updateMessage: (
        sessionId: string,
        messageId: string,
        content: string,
        status?: Extract<WorkspaceAction, { type: "updateMessage" }>["status"],
        references?: string[],
        usage?: ChatMessage["usage"]
      ) =>
        dispatchWorkspaceAction({
          type: "updateMessage",
          sessionId,
          messageId,
          content,
          references,
          status,
          usage
        }),
      updateMessageAttachments: (
        sessionId: string,
        messageId: string,
        attachments: ChatMessage["attachments"]
      ) => dispatchWorkspaceAction({ type: "updateMessageAttachments", sessionId, messageId, attachments }),
      loadHermesMessages: (sessionId: string, messages: ChatMessage[]) =>
        dispatchWorkspaceAction({ type: "loadHermesMessages", sessionId, messages }),
      setSessionModelPreference: (sessionId: string, preference: SessionModelPreference) =>
        dispatchWorkspaceAction({ type: "setSessionModelPreference", sessionId, preference })
    }),
    [dispatchWorkspaceAction]
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
