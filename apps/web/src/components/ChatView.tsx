import { AlertTriangle, BookOpenText, PanelRight, SendHorizontal } from "lucide-react";
import { Composer } from "@/components/Composer";
import { EmptyState } from "@/components/EmptyState";
import { MessageBubble } from "@/components/MessageBubble";
import { ModelSelector } from "@/components/ModelSelector";
import { StatusBadge } from "@/components/StatusBadge";
import type { ModelChoice, Project, Session } from "@/data/types";

type ChatViewProps = {
  activeProject: Project;
  activeSession: Session | null;
  createSession: () => void;
  modelChoices: ModelChoice[];
};

export function ChatView({
  activeProject,
  activeSession,
  createSession,
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
          <StatusBadge label="Hermes disconnected / mock" tone="mock" />
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
              Mock data only. No Hermes, Brain Memory Gateway, provider, or storage calls are
              active in this slice.
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
