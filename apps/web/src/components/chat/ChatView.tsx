import { AlertTriangle, BookOpenText, SendHorizontal } from "lucide-react";
import { useRef, useState } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatTranscript } from "@/components/chat/ChatTranscript";
import { Composer } from "@/components/chat/Composer";
import { streamHermesChatFromBff } from "@/lib/hermesChatClient";
import { WORKSPACE_STORAGE_VERSION } from "@/lib/workspaceStore";
import type { HermesChatStreamEvent, NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { ChatMessage, ModelChoice, Project, Session, ToolEvent } from "@/data/types";
import type { useWorkspaceState } from "@/hooks/useWorkspaceState";
import styles from "./ChatView.module.css";

type WorkspaceActions = ReturnType<typeof useWorkspaceState>["actions"];

type ChatViewProps = {
  activeProject: Project;
  activeSession: Session | null;
  createSession: () => void;
  hermesStatus: NormalizedHermesStatus | null;
  isHermesStatusLoading: boolean;
  modelChoices: ModelChoice[];
  workspaceActions: WorkspaceActions;
};

export function ChatView({
  activeProject,
  activeSession,
  createSession,
  hermesStatus,
  isHermesStatusLoading,
  modelChoices,
  workspaceActions
}: ChatViewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const flushFrameRef = useRef<number | null>(null);
  const selectedModel = modelChoices.find((choice) => choice.id === "hermes-default");
  const modelLabel = selectedModel
    ? `${selectedModel.label} · ${selectedModel.provider}`
    : "Hermes default";

  async function handleSend(content: string) {
    if (!activeSession || isGenerating) {
      return;
    }

    const session = activeSession;
    const userMessage = createMessage("user", "Alexey", content, "complete");
    const assistantId = `msg-${crypto.randomUUID()}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      author: "Hermes",
      createdAt: currentTimeLabel(),
      content: "",
      status: "streaming"
    };

    workspaceActions.appendMessage(session.id, userMessage);
    workspaceActions.appendMessage(session.id, assistantMessage);
    setIsGenerating(true);

    if (!canUseRealHermes(hermesStatus)) {
      const fallback = mockUnavailableResponse(hermesStatus, isHermesStatusLoading);
      workspaceActions.updateMessage(session.id, assistantId, fallback, "mock", [
        "Local mock fallback",
        "BFF boundary preserved"
      ]);
      setIsGenerating(false);
      return;
    }

    let accumulated = "";
    let completedAssistant = false;
    let hadStreamError = false;

    const flush = (status: ChatMessage["status"] = "streaming", references?: string[]) => {
      if (flushFrameRef.current !== null) {
        return;
      }
      flushFrameRef.current = window.requestAnimationFrame(() => {
        flushFrameRef.current = null;
        workspaceActions.updateMessage(session.id, assistantId, accumulated, status, references);
      });
    };

    await streamHermesChatFromBff(
      {
        context: {
          project: {
            id: activeProject.id,
            title: activeProject.name,
            stableKey: activeProject.memoryScope.stableProjectKey,
            tenantId: activeProject.memoryScope.tenantId,
            retrievalProfile: activeProject.memoryScope.retrievalProfile,
            contextPolicy: activeProject.memoryScope.contextPolicy,
            pinnedMemoryIds: activeProject.memoryScope.pinnedMemoryIds,
            userVisibleSummary: activeProject.memoryScope.userVisibleSummary
          },
          session: {
            id: session.id,
            title: session.title,
            stableKey: session.memoryScope.stableSessionKey,
            hermesSessionId: session.hermesSessionId,
            includeProjectContext: session.memoryScope.includeProjectContext,
            includeSessionContext: session.memoryScope.includeSessionContext,
            lastContextRefreshAt: session.memoryScope.lastContextRefreshAt,
            userVisibleSummary: session.memoryScope.userVisibleSummary
          },
          ui: {
            source: "hermes-ui",
            workspaceVersion: WORKSPACE_STORAGE_VERSION
          }
        },
        message: content,
        model: selectedModel?.id ?? null,
        provider: selectedModel?.provider ?? null,
        recentMessages: session.messages.slice(-12).map((message) => ({
          role: message.role,
          content: message.content
        }))
      },
      {
        onEvent: (event) => {
          if (event.type === "message_delta") {
            accumulated += event.delta;
            flush("streaming");
          } else if (event.type === "message_done") {
            completedAssistant = true;
            accumulated = event.message.content || accumulated;
            workspaceActions.updateMessage(session.id, assistantId, accumulated, "complete", [
              "Hermes session stream",
              activeProject.memoryScope.stableProjectKey
            ]);
          } else if (event.type === "tool_event" || event.type === "run_event") {
            workspaceActions.appendToolEvent(session.id, toToolEvent(event));
          } else if (event.type === "error") {
            hadStreamError = true;
            accumulated = event.error.message;
            workspaceActions.updateMessage(session.id, assistantId, accumulated, "error", [
              "Hermes stream error"
            ]);
          }
        }
      }
    );

    if (flushFrameRef.current !== null) {
      window.cancelAnimationFrame(flushFrameRef.current);
      flushFrameRef.current = null;
    }

    if (!completedAssistant && !hadStreamError && accumulated) {
      workspaceActions.updateMessage(session.id, assistantId, accumulated, "complete", [
        "Hermes session stream"
      ]);
    } else if (!completedAssistant && !hadStreamError && !accumulated) {
      workspaceActions.updateMessage(
        session.id,
        assistantId,
        "Hermes finished without returning assistant text.",
        "error",
        ["Hermes stream"]
      );
    }

    setIsGenerating(false);
  }

  return (
    <section className={styles.workspace} aria-label="Chat workspace">
      <ChatHeader title={activeSession?.title ?? "No chat selected"} />
      <ChatTranscript
        activeProject={activeProject}
        activeSession={activeSession}
        bannerIcon={<AlertTriangle size={15} />}
        createSession={createSession}
        routeIcon={<SendHorizontal size={14} />}
        scopeIcon={<BookOpenText size={14} />}
      />
      <Composer
        disabled={!activeSession}
        isGenerating={isGenerating}
        modelLabel={modelLabel}
        modelSelectorState={hermesStatus?.uiCapabilities.models.uiState}
        onSend={handleSend}
        stopControlState={hermesStatus?.uiCapabilities.ui.stopControl}
      />
    </section>
  );
}

function canUseRealHermes(status: NormalizedHermesStatus | null) {
  return status?.mode === "real" && status.reachable && status.uiCapabilities.chat.canSend;
}

function createMessage(
  role: ChatMessage["role"],
  author: string,
  content: string,
  status: ChatMessage["status"]
): ChatMessage {
  return {
    id: `msg-${crypto.randomUUID()}`,
    role,
    author,
    content,
    createdAt: currentTimeLabel(),
    status
  };
}

function currentTimeLabel() {
  return new Date().toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function mockUnavailableResponse(
  status: NormalizedHermesStatus | null,
  isLoading: boolean
): string {
  if (isLoading && !status) {
    return "Hermes status is still checking, so this turn was kept local. No real agent call was made.";
  }
  if (!status || status.mode === "unconfigured") {
    return "Hermes is not configured for this Studio process. I saved your message locally and used a mock response instead of calling the agent.";
  }
  if (status.mode === "mock") {
    return "Real Hermes chat is disabled for this UI process, so this response is a local mock fallback.";
  }
  return "Hermes is currently unreachable. Your message stayed in this local session; retry after the status panel reports connected.";
}

function toToolEvent(
  event:
    | Extract<HermesChatStreamEvent, { type: "tool_event" }>
    | Extract<HermesChatStreamEvent, { type: "run_event" }>
): ToolEvent {
  const now = currentTimeLabel();
  if (event.type === "tool_event") {
    return {
      id: `tool-${crypto.randomUUID()}`,
      name: event.name,
      status: event.status,
      detail: describePayload(event.payload),
      time: now
    };
  }

  return {
    id: `tool-${crypto.randomUUID()}`,
    name: event.name,
    status: normalizeToolStatus(event.status),
    detail: describePayload(event.payload),
    time: now
  };
}

function normalizeToolStatus(status: string): ToolEvent["status"] {
  if (status === "started" || status === "completed" || status === "failed") {
    return status;
  }
  return "pending";
}

function describePayload(payload: Record<string, unknown>) {
  const preview = payload.preview;
  if (typeof preview === "string" && preview.trim()) {
    return preview;
  }
  const message = payload.message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }
  return "Normalized Hermes stream event";
}
