import { AlertTriangle, BookOpenText, PanelRight, SendHorizontal } from "lucide-react";
import { Composer } from "@/components/Composer";
import { EmptyState } from "@/components/EmptyState";
import { MessageBubble } from "@/components/MessageBubble";
import { ModelSelector } from "@/components/ModelSelector";
import { StatusBadge } from "@/components/StatusBadge";
import type { NormalizedHermesStatus } from "@hermes-ui/hermes-client";
import type { ModelChoice, Project, Session } from "@/data/types";

type ChatViewProps = {
  activeProject: Project;
  activeSession: Session | null;
  createSession: () => void;
  hermesStatus: NormalizedHermesStatus | null;
  isHermesStatusLoading: boolean;
  modelChoices: ModelChoice[];
};

export function ChatView({
  activeProject,
  activeSession,
  createSession,
  hermesStatus,
  isHermesStatusLoading,
  modelChoices
}: ChatViewProps) {
  return (
    <section className="chat-view" aria-label="Chat workspace">
      <header className="topbar">
        <div>
          <h1>{activeSession?.title ?? "No chat selected"}</h1>
          <p>
            {activeProject.name} ·{" "}
            {activeSession?.summary ?? "Create a new local mock chat to start this project."}
          </p>
        </div>
        <div className="topbar-actions">
          <ModelSelector choices={modelChoices} selectedId="hermes-default" />
          <StatusBadge
            label={`Hermes ${formatHermesStatus(hermesStatus, isHermesStatusLoading)}`}
            tone={hermesStatusTone(hermesStatus, isHermesStatusLoading)}
          />
          <button className="icon-button" type="button" aria-label="Open right panel">
            <PanelRight size={16} />
          </button>
        </div>
      </header>

      <div className="transcript" aria-label="Mock chat transcript">
        <div className="transcript-inner">
          <div className="mock-banner" role="status">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>
              Chat remains mocked. This slice only checks Hermes health/capabilities through the
              server-side BFF.
            </span>
          </div>
          {activeSession ? (
            activeSession.messages.length > 0 ? (
              activeSession.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            ) : (
              <EmptyState
                title="New chat is empty"
                body="This local mock session is ready for Slice 03+ integration. Sending remains disabled until Hermes is wired through the BFF."
              />
            )
          ) : (
            <EmptyState
              title="No chats in this project"
              body="Projects can exist without sessions. Create a new local mock chat when you want a transcript under this project."
              actionLabel="New chat"
              onAction={createSession}
            />
          )}
          <div className="reference-row" aria-label="Active scope references">
            <span className="reference-chip">
              <BookOpenText size={14} aria-hidden="true" />
              Scope: {activeProject.memoryScopeKey}
            </span>
            <span className="reference-chip">
              <SendHorizontal size={14} aria-hidden="true" />
              Send disabled until integration slices
            </span>
          </div>
        </div>
      </div>

      <Composer />
    </section>
  );
}

function formatHermesStatus(status: NormalizedHermesStatus | null, isLoading: boolean) {
  if (isLoading && !status) {
    return "checking";
  }
  if (!status || status.mode === "unconfigured") {
    return "unconfigured";
  }
  if (status.mode === "real" && status.reachable) {
    return "connected";
  }
  if (status.mode === "mock") {
    return "mock";
  }
  return "unreachable";
}

function hermesStatusTone(
  status: NormalizedHermesStatus | null,
  isLoading: boolean
): "error" | "mock" | "quiet" | "success" {
  if (isLoading && !status) {
    return "quiet";
  }
  if (status?.mode === "real" && status.reachable) {
    return "success";
  }
  if (status?.mode === "error") {
    return "error";
  }
  return "mock";
}
