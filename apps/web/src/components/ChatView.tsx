import { AlertTriangle, BookOpenText, PanelRight, SendHorizontal } from "lucide-react";
import { Composer } from "@/components/Composer";
import { MessageBubble } from "@/components/MessageBubble";
import { ModelSelector } from "@/components/ModelSelector";
import { StatusBadge } from "@/components/StatusBadge";
import type { ChatMessage, ModelChoice, Project, Session } from "@/data/types";

type ChatViewProps = {
  activeProject: Project;
  activeSession: Session;
  messages: ChatMessage[];
  modelChoices: ModelChoice[];
};

export function ChatView({
  activeProject,
  activeSession,
  messages,
  modelChoices
}: ChatViewProps) {
  return (
    <section className="chat-view" aria-label="Chat workspace">
      <header className="topbar">
        <div>
          <h1>{activeSession.title}</h1>
          <p>
            {activeProject.name} · {activeSession.summary}
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
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
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
